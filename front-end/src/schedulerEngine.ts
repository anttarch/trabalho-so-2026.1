export type AlgorithmType = "FIFO" | "SJF" | "SRTF" | "RR" | "PRIOnp" | "PRIOp";

export interface Process {
  id: string;
  name: string;
  arrivalTime: number;
  burstTime: number;
  priority: number;
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
  runningProcessId: string | null;
  readyQueue: string[];
  processStates: Record<string, ProcessState>;
  log: string;
}

export interface SimulationResult {
  timeline: SimulationStep[];
  processStats: Record<
    string,
    {
      id: string;
      name: string;
      arrivalTime: number;
      burstTime: number;
      finishTime: number;
      turnaroundTime: number;
      waitingTime: number;
      responseTime: number;
    }
  >;
  avgTurnaround: number;
  avgWaiting: number;
  avgResponse: number;
}

/**
 * Fetches the simulation results from an external library/backend service.
 * It sends the parameters via HTTP POST and parses the resulting execution timeline.
 */
export async function fetchSimulationFromExternal(
  apiUrl: string,
  processes: Process[],
  algorithm: AlgorithmType,
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
  interface BackendProcessStat {
    id: string;
    waitingTime: number;
    turnaroundTime: number;
    responseTime: number;
    finishTime: number;
  }

  const backendTimeline = (data.timeline || []) as string[];
  const backendProcessStats = (data.processStats || []) as BackendProcessStat[];

  // Standardize process stats into a map keyed by process.id
  const processStatsMap: Record<string, BackendProcessStat> = {};
  backendProcessStats.forEach((stat) => {
    if (stat && stat.id) {
      processStatsMap[stat.id] = stat;
    }
  });

  const timeline: SimulationStep[] = [];
  const totalSteps = backendTimeline.length;

  // Reconstruct step-by-step state for visualization
  for (let t = 0; t < totalSteps; t++) {
    const rawCpuState = backendTimeline[t];
    let cpuState: "idle" | "running" | "overload";
    let runningProcessId: string | null = null;

    if (rawCpuState === "overload" || rawCpuState === "sobrecarga") {
      cpuState = "overload";
    } else if (
      !rawCpuState ||
      rawCpuState === "idle" ||
      rawCpuState === "ocioso"
    ) {
      cpuState = "idle";
    } else {
      cpuState = "running";
      // Match raw CPU identifier (e.g., P1, p1) with processes
      const matchedProc = processes.find(
        (p) =>
          p.name.toLowerCase() === rawCpuState.toLowerCase() ||
          p.id.toLowerCase() === rawCpuState.toLowerCase(),
      );
      runningProcessId = matchedProc ? matchedProc.id : rawCpuState;
    }

    // Compute process states at second t
    const processStates: Record<string, ProcessState> = {};
    processes.forEach((p) => {
      // remainingTime at start of second t = burstTime - times run in intervals [0, t)
      let ticksRunBefore = 0;
      for (let prevT = 0; prevT < t; prevT++) {
        const prevCpu = backendTimeline[prevT];
        if (
          prevCpu &&
          (prevCpu.toLowerCase() === p.name.toLowerCase() ||
            prevCpu.toLowerCase() === p.id.toLowerCase())
        ) {
          ticksRunBefore++;
        }
      }
      const remainingTime = Math.max(0, p.burstTime - ticksRunBefore);

      const stat = processStatsMap[p.id] || ({} as BackendProcessStat);
      const finishTime =
        typeof stat.finishTime === "number" ? stat.finishTime : -1;

      let state: ProcessState["state"] = "not_arrived";
      if (finishTime !== -1 && t >= finishTime) {
        state = "finished";
      } else if (t >= p.arrivalTime) {
        if (runningProcessId === p.id) {
          state = "running";
        } else {
          // If CPU is in overload and this is the target process, it is in overload
          // For simplicity, we flag as ready unless it's running
          state = "ready";
        }
      }

      // Calculate accumulated waiting time up to second t
      let waitingTime = 0;
      for (let prevT = 0; prevT < t; prevT++) {
        if (prevT >= p.arrivalTime) {
          const prevCpu = backendTimeline[prevT];
          const isFinishedBefore = finishTime !== -1 && prevT >= finishTime;
          if (
            !isFinishedBefore &&
            (!prevCpu ||
              (prevCpu.toLowerCase() !== p.name.toLowerCase() &&
                prevCpu.toLowerCase() !== p.id.toLowerCase()))
          ) {
            waitingTime++;
          }
        }
      }

      // Calculate turnaround time up to second t
      let turnaroundTime = 0;
      if (t >= p.arrivalTime) {
        turnaroundTime = t + 1 - p.arrivalTime;
        if (finishTime !== -1 && t >= finishTime) {
          turnaroundTime = finishTime - p.arrivalTime;
        }
      }

      // Calculate response time
      let firstRunTime = -1;
      for (let prevT = 0; prevT < totalSteps; prevT++) {
        const prevCpu = backendTimeline[prevT];
        if (
          prevCpu &&
          (prevCpu.toLowerCase() === p.name.toLowerCase() ||
            prevCpu.toLowerCase() === p.id.toLowerCase())
        ) {
          firstRunTime = prevT;
          break;
        }
      }
      const responseTime =
        firstRunTime !== -1 ? Math.max(0, firstRunTime - p.arrivalTime) : -1;

      processStates[p.id] = {
        state,
        remainingTime,
        waitingTime,
        turnaroundTime,
        responseTime,
      };
    });

    // Reconstruct ready queue
    const readyQueue: string[] = [];
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
      log = `Processo ${runProc?.name || runningProcessId} em execução`;
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
  const processStatsResult: SimulationResult["processStats"] = {};
  processes.forEach((p) => {
    const stat = processStatsMap[p.id] || ({} as BackendProcessStat);
    const waitingTime =
      typeof stat.waitingTime === "number" ? stat.waitingTime : 0;
    const turnaroundTime =
      typeof stat.turnaroundTime === "number" ? stat.turnaroundTime : 0;
    const responseTime =
      typeof stat.responseTime === "number" ? stat.responseTime : 0;
    const finishTime =
      typeof stat.finishTime === "number" ? stat.finishTime : 0;

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
