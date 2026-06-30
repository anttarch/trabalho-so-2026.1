import type { TAlgorithmType } from "./algorithmTypes";

export interface Process {
  id: number;
  name: string;
  arrivalTime: number;
  burstTime: number;
  priority: number;
  deadline: number;
  color: string;
}

export interface ProcessState {
  state: "not_arrived" | "ready" | "running" | "overload" | "finished";
  remainingTime: number;
  waitingTime: number;
  turnaroundTime: number;
  responseTime: number;
}

export interface SimulationStep {
  time: number;
  cpuState: "idle" | "running" | "overload";
  runningProcessId: number | null;
  readyQueue: number[];
  processStates: Record<number, ProcessState>;
  log: string;
}

export interface ProcessStat {
  id: number;
  name: string;
  arrivalTime: number;
  burstTime: number;
  finishTime: number;
  turnaroundTime: number;
  waitingTime: number;
  responseTime: number;
}

export interface SimulationResult {
  timeline: SimulationStep[];
  processStats: Record<number, ProcessStat>;
  avgTurnaround: number;
  avgWaiting: number;
  avgResponse: number;
}

/**
 * Creates a default fallback/initial process statistics structure.
 */
export function getDefaultProcessStat(p: Process): ProcessStat {
  return {
    id: p.id,
    name: p.name,
    arrivalTime: p.arrivalTime,
    burstTime: p.burstTime,
    finishTime: p.arrivalTime + p.burstTime,
    turnaroundTime: p.burstTime,
    waitingTime: 0,
    responseTime: 0,
  };
}

/**
 * Fetches the simulation results from an external library/backend service.
 * It sends the parameters via HTTP POST and parses the resulting execution timeline.
 */
export async function fetchSimulationFromExternal(
  apiUrl: string,
  processes: Process[],
  algorithm: TAlgorithmType,
  quantum: number,
  overloadTime: number,
): Promise<SimulationResult> {
  const payload = {
    algorithm,
    quantum,
    overload: overloadTime,
    processes: processes.map((p) => ({
      id: p.id,
      name: p.name,
      arrivalTime: p.arrivalTime,
      burstTime: p.burstTime,
      priority: p.priority,
      deadline: 0,
    })),
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Erro na chamada da API: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();

  // The external service must return:
  // - timeline: Array of identifiers (names/IDs, e.g., ["P1", 2, "overload", "idle"])
  // - processStats: array of process metrics objects
  interface BackendProcessStat {
    id: number;
    waitingTime: number;
    turnaroundTime: number;
    responseTime: number;
    finishTime: number;
  }

  const backendTimeline = (data.timeline || []) as Array<number>;
  const backendProcessStats = (data.processStats || []) as BackendProcessStat[];

  // Standardize process stats into a map keyed by process.id
  const processStatsMap: Record<number, BackendProcessStat> = {};
  backendProcessStats.forEach((stat) => {
    if (stat && stat.id !== undefined) {
      const numId = Number(stat.id);
      if (!isNaN(numId)) {
        processStatsMap[numId] = stat;
      }
    }
  });

  const timeline: SimulationStep[] = [];
  const totalSteps = backendTimeline.length;

  // Reconstruct step-by-step state for visualization
  for (let t = 0; t < totalSteps; t++) {
    const rawCpuState = backendTimeline[t];
    let cpuState: "idle" | "running" | "overload";
    let runningProcessId: number | null = null;

    if (rawCpuState === -2) {
      cpuState = "overload";
    } else if (
      rawCpuState === null ||
      rawCpuState === undefined ||
      rawCpuState === -1
    ) {
      cpuState = "idle";
    } else {
      cpuState = "running";
      // Match raw CPU identifier (e.g., process name, process ID)
      const rawStr = String(rawCpuState).toLowerCase();
      const matchedProc = processes.find(
        (p) =>
          p.name.toLowerCase() === rawStr ||
          String(p.id).toLowerCase() === rawStr,
      );

      if (matchedProc) {
        runningProcessId = matchedProc.id;
      } else {
        // Fallback to direct number parsing of CPU identifier
        const parsedNum = Number(rawCpuState);
        if (!isNaN(parsedNum)) {
          runningProcessId = parsedNum;
        }
      }
    }

    // Compute process states at second t
    const processStates: Record<number, ProcessState> = {};
    processes.forEach((p) => {
      // remainingTime at start of second t = burstTime - times run in intervals [0, t)
      let ticksRunBefore = 0;
      for (let prevT = 0; prevT < t; prevT++) {
        const prevCpu = backendTimeline[prevT];
        if (prevCpu) {
          const prevCpuStr = String(prevCpu).toLowerCase();
          if (
            prevCpuStr === p.name.toLowerCase() ||
            prevCpuStr === String(p.id).toLowerCase()
          ) {
            ticksRunBefore++;
          }
        }
      }
      const remainingTime = Math.max(0, p.burstTime - ticksRunBefore);

      const stat = processStatsMap[p.id] || ({} as BackendProcessStat);

      // Determine finish time: prefer backend, fallback to last execution time from timeline
      let calculatedFinishTime = -1;
      for (let prevT = totalSteps - 1; prevT >= 0; prevT--) {
        const prevCpu = backendTimeline[prevT];
        if (prevCpu) {
          const prevCpuStr = String(prevCpu).toLowerCase();
          if (
            prevCpuStr === p.name.toLowerCase() ||
            prevCpuStr === String(p.id).toLowerCase()
          ) {
            calculatedFinishTime = prevT + 1;
            break;
          }
        }
      }
      const finishTime =
        typeof stat.finishTime === "number"
          ? stat.finishTime
          : calculatedFinishTime;

      let state: ProcessState["state"] = "not_arrived";
      if (finishTime !== -1 && t >= finishTime) {
        state = "finished";
      } else if (t >= p.arrivalTime) {
        if (runningProcessId === p.id) {
          state = "running";
        } else {
          state = "ready";
        }
      }

      // Calculate accumulated waiting time up to second t
      let waitingTime = 0;
      if (t >= p.arrivalTime) {
        if (finishTime !== -1 && t >= finishTime) {
          waitingTime =
            typeof stat.waitingTime === "number" ? stat.waitingTime : 0; // Will be computed at mapping below if no backend stats
        } else {
          // Count ticks where process was in ready queue/waiting up to t
          let ticksWaiting = 0;
          for (let prevT = 0; prevT < t; prevT++) {
            if (prevT >= p.arrivalTime) {
              const prevCpu = backendTimeline[prevT];
              let wasRunning = false;
              if (prevCpu) {
                const prevCpuStr = String(prevCpu).toLowerCase();
                if (
                  prevCpuStr === p.name.toLowerCase() ||
                  prevCpuStr === String(p.id).toLowerCase()
                ) {
                  wasRunning = true;
                }
              }
              if (!wasRunning) {
                ticksWaiting++;
              }
            }
          }
          waitingTime =
            typeof stat.waitingTime === "number"
              ? Math.min(ticksWaiting, stat.waitingTime)
              : ticksWaiting;
        }
      }

      // Calculate turnaround time up to second t
      let turnaroundTime = 0;
      if (t >= p.arrivalTime) {
        if (finishTime !== -1 && t >= finishTime) {
          turnaroundTime =
            typeof stat.turnaroundTime === "number"
              ? stat.turnaroundTime
              : finishTime - p.arrivalTime;
        } else {
          turnaroundTime = t + 1 - p.arrivalTime;
          if (typeof stat.turnaroundTime === "number") {
            turnaroundTime = Math.min(turnaroundTime, stat.turnaroundTime);
          }
        }
      }

      // Calculate response time
      let firstRunTime = -1;
      for (let prevT = 0; prevT < totalSteps; prevT++) {
        const prevCpu = backendTimeline[prevT];
        if (prevCpu) {
          const prevCpuStr = String(prevCpu).toLowerCase();
          if (
            prevCpuStr === p.name.toLowerCase() ||
            prevCpuStr === String(p.id).toLowerCase()
          ) {
            firstRunTime = prevT;
            break;
          }
        }
      }
      let responseTime = -1;
      if (firstRunTime !== -1 && t >= firstRunTime) {
        responseTime =
          typeof stat.responseTime === "number"
            ? stat.responseTime
            : Math.max(0, firstRunTime - p.arrivalTime);
      }

      processStates[p.id] = {
        state,
        remainingTime,
        waitingTime,
        turnaroundTime,
        responseTime,
      };
    });

    // Reconstruct ready queue
    const readyQueue: number[] = [];
    processes.forEach((p) => {
      const pState = processStates[p.id];
      if (pState && pState.state === "ready") {
        readyQueue.push(p.id);
      }
    });

    // Reconstruct log step
    let log: string;
    if (cpuState === "running") {
      const runProc = processes.find((p) => p.id === runningProcessId);
      log = `Processo ${runProc?.name || "ID " + runningProcessId} em execução`;
    } else if (cpuState === "overload") {
      log = "Sobrecarga de CPU (Troca de Contexto)";
    } else {
      log = "CPU Ociosa (Sem processos na fila)";
    }

    timeline.push({
      time: t,
      cpuState,
      runningProcessId,
      readyQueue,
      processStates,
      log,
    });
  }

  // Map process stats
  const processStatsResult: Record<number, ProcessStat> = {};
  processes.forEach((p) => {
    const fallbackStat = getDefaultProcessStat(p);
    const stat = processStatsMap[p.id] || ({} as BackendProcessStat);

    // Get final step state for fallback calculation
    const finalStep = timeline[totalSteps - 1];
    const finalProcState = finalStep?.processStates[p.id];

    // Determine finish time: prefer backend, fallback to last execution time from timeline
    let calculatedFinishTime = -1;
    for (let prevT = totalSteps - 1; prevT >= 0; prevT--) {
      const prevCpu = backendTimeline[prevT];
      if (prevCpu) {
        const prevCpuStr = String(prevCpu).toLowerCase();
        if (
          prevCpuStr === p.name.toLowerCase() ||
          prevCpuStr === String(p.id).toLowerCase()
        ) {
          calculatedFinishTime = prevT + 1;
          break;
        }
      }
    }
    const finishTime =
      typeof stat.finishTime === "number"
        ? stat.finishTime
        : calculatedFinishTime !== -1
          ? calculatedFinishTime
          : fallbackStat.finishTime;

    const waitingTime =
      typeof stat.waitingTime === "number"
        ? stat.waitingTime
        : finalProcState
          ? finalProcState.waitingTime
          : fallbackStat.waitingTime;

    const turnaroundTime =
      typeof stat.turnaroundTime === "number"
        ? stat.turnaroundTime
        : finalProcState
          ? finalProcState.turnaroundTime
          : fallbackStat.turnaroundTime;

    const responseTime =
      typeof stat.responseTime === "number"
        ? stat.responseTime
        : finalProcState
          ? finalProcState.responseTime
          : fallbackStat.responseTime;

    processStatsResult[p.id] = {
      id: p.id,
      name: p.name,
      arrivalTime: p.arrivalTime,
      burstTime: p.burstTime,
      finishTime,
      turnaroundTime,
      waitingTime,
      responseTime,
    };
  });

  // Calculate averages entirely on the client side
  const validProcs = processes.length || 1;
  const avgTurnaround =
    Object.values(processStatsResult).reduce(
      (sum, s) => sum + s.turnaroundTime,
      0,
    ) / validProcs;

  const avgWaiting =
    Object.values(processStatsResult).reduce(
      (sum, s) => sum + s.waitingTime,
      0,
    ) / validProcs;

  const avgResponse =
    Object.values(processStatsResult).reduce(
      (sum, s) => sum + s.responseTime,
      0,
    ) / validProcs;

  return {
    timeline:
      timeline.length > 0
        ? timeline
        : [
            {
              time: 0,
              cpuState: "idle",
              runningProcessId: null,
              readyQueue: [],
              processStates: {},
              log: "Nenhum dado retornado da biblioteca externa",
            },
          ],
    processStats: processStatsResult,
    avgTurnaround: Number(avgTurnaround.toFixed(2)),
    avgWaiting: Number(avgWaiting.toFixed(2)),
    avgResponse: Number(avgResponse.toFixed(2)),
  };
}
