import React, { useState, useEffect, useRef, useMemo } from "react";
import { fetchSimulationFromExternal } from "./schedulerEngine";
import type {
  Process,
  SimulationStep,
  SimulationResult,
} from "./schedulerEngine";
import { algorithmType } from "./algorithmTypes";
import type { TAlgorithmType } from "./algorithmTypes";
import "./App.css";

// Preset colors for processes
const PRESET_COLORS = [
  "#10B981", // Emerald
  "#6366F1", // Indigo
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#8B5CF6", // Violet
  "#14B8A6", // Teal
  "#F97316", // Orange
  "#06B6D4", // Cyan
  "#3B82F6", // Blue
  "#EF4444", // Red
];

const INITIAL_PROCESSES: Process[] = [
  {
    id: 1,
    name: "P1",
    arrivalTime: 0,
    burstTime: 5,
    priority: 3,
    color: PRESET_COLORS[0],
  },
  {
    id: 2,
    name: "P2",
    arrivalTime: 2,
    burstTime: 3,
    priority: 1,
    color: PRESET_COLORS[1],
  },
  {
    id: 3,
    name: "P3",
    arrivalTime: 4,
    burstTime: 2,
    priority: 4,
    color: PRESET_COLORS[2],
  },
  {
    id: 4,
    name: "P4",
    arrivalTime: 6,
    burstTime: 4,
    priority: 2,
    color: PRESET_COLORS[3],
  },
];

export default function App() {
  const apiUrl = "http://localhost:8080/simulate";

  // Simulator Configurations
  const [processes, setProcesses] = useState<Process[]>(INITIAL_PROCESSES);
  const [algorithm, setAlgorithm] = useState<TAlgorithmType>(algorithmType.RR);
  const [quantum, setQuantum] = useState<number>(2);
  const [overloadTime, setOverloadTime] = useState<number>(1);
  const [isOverloadEnabled, setIsOverloadEnabled] = useState<boolean>(true);

  // Playback Control States
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1000); // ms per step

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulation Async Loading States
  const [simulationResult, setSimulationResult] =
    useState<SimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Computed simulation values
  const activeOverload = isOverloadEnabled ? overloadTime : 0;

  useEffect(() => {
    let active = true;
    const loadSimulation = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchSimulationFromExternal(
          apiUrl,
          processes,
          algorithm,
          quantum,
          activeOverload,
        );
        if (active) {
          setSimulationResult(result);
          setCurrentTime(0);
          setIsPlaying(false);
        }
      } catch (err: unknown) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Erro ao conectar à API do simulador.",
          );
          setIsPlaying(false);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadSimulation();

    return () => {
      active = false;
    };
  }, [processes, algorithm, quantum, activeOverload, apiUrl]);

  const timeline = useMemo(
    () => simulationResult?.timeline || [],
    [simulationResult],
  );
  const processStats = useMemo(
    () => simulationResult?.processStats || {},
    [simulationResult],
  );
  const avgTurnaround = simulationResult?.avgTurnaround || 0;
  const avgWaiting = simulationResult?.avgWaiting || 0;
  const avgResponse = simulationResult?.avgResponse || 0;

  // Playback interval logic
  useEffect(() => {
    if (isPlaying && timeline.length > 0) {
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev < timeline.length - 1) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            if (timerRef.current) clearInterval(timerRef.current);
            return prev;
          }
        });
      }, playbackSpeed);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed, timeline.length]);

  // Handle Process modifications
  const handleAddProcess = () => {
    const nextIndex = processes.length + 1;
    const maxId = processes.reduce(
      (max, p) => ((p.id as number) > max ? (p.id as number) : max),
      0,
    );
    const color = PRESET_COLORS[(nextIndex - 1) % PRESET_COLORS.length];
    const newProc: Process = {
      id: maxId + 1,
      name: `P${nextIndex}`,
      arrivalTime: Math.max(0, Math.min(20, Math.floor(Math.random() * 8))),
      burstTime: Math.max(1, Math.min(10, Math.floor(Math.random() * 7) + 2)),
      priority: Math.floor(Math.random() * 5) + 1,
      color,
    };
    setProcesses([...processes, newProc]);
  };

  const handleRemoveProcess = (id: number) => {
    if (processes.length <= 1) return;
    const updated = processes
      .filter((p) => p.id !== id)
      .map((p, idx) => ({
        ...p,
        name: `P${idx + 1}`,
      }));
    setProcesses(updated);
  };

  const handleUpdateProcess = (
    id: number,
    field: keyof Process,
    value: string | number,
  ) => {
    const updated = processes.map((p) => {
      if (p.id === id) {
        let parsedVal = value;
        if (
          field === "arrivalTime" ||
          field === "burstTime" ||
          field === "priority"
        ) {
          parsedVal = parseInt(String(value), 10) || 0;
          if (field === "burstTime" && parsedVal < 1) parsedVal = 1;
          if (field === "arrivalTime" && parsedVal < 0) parsedVal = 0;
          if (field === "priority" && parsedVal < 1) parsedVal = 1;
        }
        return { ...p, [field]: parsedVal };
      }
      return p;
    });
    setProcesses(updated);
  };

  const handleRandomize = () => {
    const count = Math.floor(Math.random() * 3) + 4; // 4 to 6 processes
    const randomized: Process[] = Array.from({ length: count }, (_, idx) => ({
      id: idx + 1,
      name: `P${idx + 1}`,
      arrivalTime: Math.floor(Math.random() * 8),
      burstTime: Math.floor(Math.random() * 7) + 2, // 2s to 8s
      priority: Math.floor(Math.random() * 5) + 1, // 1 to 5
      color: PRESET_COLORS[idx % PRESET_COLORS.length],
    }));
    setProcesses(randomized);
  };

  const handleLoadClassicPreset = () => {
    setProcesses([
      {
        id: 1,
        name: "P1",
        arrivalTime: 0,
        burstTime: 6,
        priority: 3,
        color: PRESET_COLORS[0],
      },
      {
        id: 2,
        name: "P2",
        arrivalTime: 2,
        burstTime: 3,
        priority: 1,
        color: PRESET_COLORS[1],
      },
      {
        id: 3,
        name: "P3",
        arrivalTime: 4,
        burstTime: 1,
        priority: 4,
        color: PRESET_COLORS[2],
      },
      {
        id: 4,
        name: "P4",
        arrivalTime: 5,
        burstTime: 4,
        priority: 2,
        color: PRESET_COLORS[3],
      },
    ]);
    setAlgorithm(algorithmType.RR);
    setQuantum(2);
    setOverloadTime(1);
    setIsOverloadEnabled(true);
  };

  const handleLoadConvoyPreset = () => {
    // Shows FCFS convoy effect vs SJF
    setProcesses([
      {
        id: 1,
        name: "P1",
        arrivalTime: 0,
        burstTime: 12,
        priority: 3,
        color: PRESET_COLORS[0],
      },
      {
        id: 2,
        name: "P2",
        arrivalTime: 1,
        burstTime: 2,
        priority: 2,
        color: PRESET_COLORS[1],
      },
      {
        id: 3,
        name: "P3",
        arrivalTime: 1,
        burstTime: 2,
        priority: 1,
        color: PRESET_COLORS[2],
      },
    ]);
    setAlgorithm(algorithmType.FIFO);
    setIsOverloadEnabled(false);
  };

  const handleLoadPriorityPreset = () => {
    setProcesses([
      {
        id: 1,
        name: "P1",
        arrivalTime: 0,
        burstTime: 5,
        priority: 4,
        color: PRESET_COLORS[0],
      },
      {
        id: 2,
        name: "P2",
        arrivalTime: 1,
        burstTime: 4,
        priority: 2,
        color: PRESET_COLORS[1],
      },
      {
        id: 3,
        name: "P3",
        arrivalTime: 2,
        burstTime: 6,
        priority: 1,
        color: PRESET_COLORS[2],
      },
      {
        id: 4,
        name: "P4",
        arrivalTime: 3,
        burstTime: 2,
        priority: 3,
        color: PRESET_COLORS[3],
      },
    ]);
    setAlgorithm(algorithmType.PRIO);
    setIsOverloadEnabled(true);
    setOverloadTime(1);
  };

  // Get current active step
  const currentStep: SimulationStep = timeline[currentTime] || {
    time: 0,
    cpuState: "idle",
    runningProcessId: null,
    readyQueue: [],
    processStates: {},
    log: "Sem dados",
  };

  const runningProcess = currentStep.runningProcessId
    ? processes.find((p) => p.id === currentStep.runningProcessId)
    : null;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <svg
            className="app-logo-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="2" y="2" width="20" height="20" rx="4" />
            <path d="M6 6h4v4H6zM14 6h4v4h-4zM6 14h4v4H6zM14 14h4v4h-4z" />
          </svg>
          <div>
            <h1>Simulador de Escalonamento de CPU</h1>
            <p className="subtitle">
              Visualizador interativo de algoritmos de sistemas operacionais em
              tempo real
            </p>
          </div>
        </div>

        {isLoading && (
          <div
            className="card glass loading-card"
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "16px",
              padding: "16px",
            }}
          >
            <div className="spinner" />
            <div>
              <h3 style={{ fontSize: "15px" }}>Carregando simulação...</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                Enviando parâmetros.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div
            className="card glass error-card border-danger"
            style={{
              borderLeft: "4px solid var(--accent-danger)",
              gap: "10px",
            }}
          >
            <div className="flex-align-center" style={{ gap: "10px" }}>
              <span
                className="material-symbols-rounded"
                style={{ color: "var(--accent-danger)", fontSize: 30 }}
              >
                warning
              </span>
              <div>
                <h3 style={{ color: "var(--text-primary)", fontSize: "15px" }}>
                  Falha na Conexão
                </h3>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "13px",
                    margin: "2px 0px",
                  }}
                >
                  Erro ao contatar o endpoint:{" "}
                  <code
                    className="font-mono"
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}
                  >
                    {apiUrl}
                  </code>
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="badge-academic">SO 2026.1</div>
      </header>

      <main className="dashboard-grid">
        {/* COLUNA ESQUERDA: CONTROLES & INPUTS */}
        <section className="column config-panel">
          <div className="card glass">
            <h2 className="card-title">
              <span
                className="material-symbols-rounded icon-title"
                style={{ height: "auto" }}
              >
                settings
              </span>
              Configurações Globais
            </h2>

            <div className="form-group">
              <label htmlFor="algorithm-select">
                Algoritmo de Escalonamento
              </label>
              <select
                id="algorithm-select"
                value={algorithm}
                onChange={(e) => {
                  setAlgorithm(Number(e.target.value) as TAlgorithmType);
                }}
                className="select-control"
              >
                <option value={algorithmType.FIFO}>
                  FIFO (First-In, First-Out - Não Preemptivo)
                </option>
                <option value={algorithmType.SJF}>
                  SJF (Shortest Job First - Não Preemptivo)
                </option>
                <option value={algorithmType.RR}>
                  Round Robin (Preemptivo)
                </option>
                <option value={algorithmType.PRIO}>
                  Prioridade (Preemptivo)
                </option>
                <option value={algorithmType.EDF}>
                  EDF (Earliest Deadline First - Preemptivo)
                </option>
                <option value={algorithmType.CFS}>
                  CFS (Completely Fair Scheduler - Preemptivo)
                </option>
                <option value={algorithmType.CUSTOM}>Autoral</option>
              </select>
            </div>

            {algorithm === algorithmType.RR && (
              <div className="form-group slide-in">
                <div className="label-with-val">
                  <label htmlFor="quantum-input">
                    Quantum de Tempo (Execução contínua)
                  </label>
                  <span className="val-badge">{quantum}s</span>
                </div>
                <input
                  id="quantum-input"
                  type="range"
                  min="1"
                  max="10"
                  value={quantum}
                  onChange={(e) => {
                    setQuantum(parseInt(e.target.value, 10));
                    setCurrentTime(0);
                    setIsPlaying(false);
                  }}
                  className="range-control"
                />
              </div>
            )}

            <div className="form-group">
              <div className="checkbox-container">
                <input
                  type="checkbox"
                  id="overload-toggle"
                  checked={isOverloadEnabled}
                  onChange={(e) => {
                    setIsOverloadEnabled(e.target.checked);
                    setCurrentTime(0);
                    setIsPlaying(false);
                  }}
                />
                <label htmlFor="overload-toggle">
                  Ativar Sobrecarga (Context Switch)
                </label>
              </div>
            </div>

            {isOverloadEnabled && (
              <div className="form-group slide-in">
                <div className="label-with-val">
                  <label htmlFor="overload-input">Tempo de Sobrecarga</label>
                  <span className="val-badge warning">{overloadTime}s</span>
                </div>
                <input
                  id="overload-input"
                  type="range"
                  min="1"
                  max="5"
                  value={overloadTime}
                  onChange={(e) => {
                    setOverloadTime(parseInt(e.target.value, 10));
                    setCurrentTime(0);
                    setIsPlaying(false);
                  }}
                  className="range-control"
                />
              </div>
            )}

            <div className="preset-quick-actions">
              <h3>Presets Recomendados:</h3>
              <div className="button-group-wrap">
                <button
                  onClick={handleLoadClassicPreset}
                  className="btn btn-secondary btn-xs"
                >
                  Round Robin Clássico
                </button>
                <button
                  onClick={handleLoadConvoyPreset}
                  className="btn btn-secondary btn-xs"
                >
                  Efeito Comboio (FIFO)
                </button>
                <button
                  onClick={handleLoadPriorityPreset}
                  className="btn btn-secondary btn-xs"
                >
                  Prioridade Preemptiva
                </button>
              </div>
            </div>
          </div>

          <div className="card glass">
            <div className="card-header-actions">
              <h2 className="card-title">
                <span
                  className="material-symbols-rounded icon-title"
                  style={{ height: "auto" }}
                >
                  process_chart
                </span>
                Lista de Processos
              </h2>
              <div className="header-actions">
                <button
                  onClick={handleRandomize}
                  title="Gerar Aleatório"
                  className="btn btn-icon-only"
                >
                  <span className="material-symbols-rounded">refresh</span>
                </button>
                <button
                  onClick={handleAddProcess}
                  title="Adicionar Processo"
                  className="btn btn-icon-only success"
                >
                  <span className="material-symbols-rounded">add</span>
                </button>
              </div>
            </div>

            <div className="process-list-container">
              <table className="process-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Chegada</th>
                    <th>Execução</th>
                    {algorithm === algorithmType.PRIO && <th>Prioridade</th>}
                    <th>Cor</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {processes.map((p) => (
                    <tr key={p.id} className="process-row">
                      <td className="font-bold">{p.name}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={p.arrivalTime}
                          onChange={(e) =>
                            handleUpdateProcess(
                              p.id,
                              "arrivalTime",
                              e.target.value,
                            )
                          }
                          className="table-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={p.burstTime}
                          onChange={(e) =>
                            handleUpdateProcess(
                              p.id,
                              "burstTime",
                              e.target.value,
                            )
                          }
                          className="table-input"
                        />
                      </td>
                      {algorithm === algorithmType.PRIO && (
                        <td>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={p.priority}
                            onChange={(e) =>
                              handleUpdateProcess(
                                p.id,
                                "priority",
                                e.target.value,
                              )
                            }
                            className="table-input"
                          />
                        </td>
                      )}
                      <td>
                        <div
                          className="color-picker-wrapper"
                          style={{ backgroundColor: p.color }}
                        >
                          <input
                            type="color"
                            value={p.color}
                            onChange={(e) =>
                              handleUpdateProcess(p.id, "color", e.target.value)
                            }
                            className="color-picker"
                          />
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={() => handleRemoveProcess(p.id)}
                          disabled={processes.length <= 1}
                          className="btn-trash"
                          title="Remover"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            width="14"
                            height="14"
                          >
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* COLUNA DIREITA: VISUALIZADOR DA EXECUÇÃO, GANTT & MÉTRICAS */}
        <section className="column main-visualization">
          {/* PLAYBACK CONTROLLER */}
          <div className="card glass playback-card">
            <div className="playback-layout">
              <div className="time-display-big">
                <span className="label">Tempo Atual</span>
                <span className="value">{currentTime}s</span>
              </div>

              <div className="playback-controls">
                <button
                  onClick={() =>
                    setCurrentTime((prev) => Math.max(0, prev - 1))
                  }
                  disabled={currentTime === 0}
                  className="btn btn-control"
                  title="Voltar 1s"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="16"
                    height="16"
                  >
                    <polygon points="19 20 9 12 19 4 19 20"></polygon>
                    <line x1="5" y1="19" x2="5" y2="5"></line>
                  </svg>
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`btn btn-control btn-play-pause ${isPlaying ? "playing" : ""}`}
                  title={isPlaying ? "Pausar" : "Iniciar Simulação"}
                >
                  {isPlaying ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="20"
                      height="20"
                    >
                      <rect x="6" y="4" width="4" height="16"></rect>
                      <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="20"
                      height="20"
                    >
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                  )}
                </button>

                <button
                  onClick={() =>
                    setCurrentTime((prev) =>
                      Math.min(timeline.length - 1, prev + 1),
                    )
                  }
                  disabled={currentTime === timeline.length - 1}
                  className="btn btn-control"
                  title="Avançar 1s"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="16"
                    height="16"
                  >
                    <polygon points="5 4 15 12 5 20 5 4"></polygon>
                    <line x1="19" y1="5" x2="19" y2="19"></line>
                  </svg>
                </button>

                <button
                  onClick={() => {
                    setCurrentTime(0);
                    setIsPlaying(false);
                  }}
                  className="btn btn-control"
                  title="Reiniciar"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="16"
                    height="16"
                  >
                    <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 1-.66-7.57l5.67-5.67" />
                  </svg>
                </button>
              </div>

              <div className="speed-controller">
                <label htmlFor="speed-select">Velocidade</label>
                <select
                  id="speed-select"
                  value={playbackSpeed}
                  onChange={(e) =>
                    setPlaybackSpeed(parseInt(e.target.value, 10))
                  }
                  className="select-control xs"
                >
                  <option value={2000}>0.5x (Lento)</option>
                  <option value={1000}>1.0x (Normal)</option>
                  <option value={500}>2.0x (Rápido)</option>
                  <option value={200}>5.0x (Super Rápido)</option>
                </select>
              </div>
            </div>

            <div className="timeline-slider-container">
              <input
                type="range"
                min="0"
                max={Math.max(0, timeline.length - 1)}
                value={currentTime}
                onChange={(e) => {
                  setCurrentTime(parseInt(e.target.value, 10));
                  setIsPlaying(false);
                }}
                className="timeline-slider"
              />
              <div className="timeline-labels">
                <span>0s</span>
                <span>{timeline.length - 1}s (Fim)</span>
              </div>
            </div>
          </div>

          {/* REALTIME HARDWARE VISUALIZATION */}
          <div className="realtime-hardware-row">
            {/* CPU SOCKET */}
            <div className="hardware-card glass cpu-socket-card">
              <span className="hw-label">CPU (Processador)</span>
              <div className={`cpu-socket ${currentStep.cpuState}`}>
                {currentStep.cpuState === "running" && runningProcess ? (
                  <div
                    className="cpu-running-state"
                    style={
                      {
                        "--proc-color": runningProcess.color,
                      } as React.CSSProperties
                    }
                  >
                    <div
                      className="process-bubble pulse"
                      style={{ backgroundColor: runningProcess.color }}
                    >
                      {runningProcess.name}
                    </div>
                    <span className="process-status-text">Executando</span>
                    <span className="burst-info">
                      Restante:{" "}
                      {
                        currentStep.processStates[runningProcess.id]
                          ?.remainingTime
                      }
                      s
                    </span>
                  </div>
                ) : currentStep.cpuState === "overload" ? (
                  <div className="cpu-overload-state striped-overload">
                    <svg
                      className="icon-warning animation-bounce"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="28"
                      height="28"
                    >
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span className="overload-text font-bold">SOBRECARGA</span>
                    <span className="overload-sub">
                      Salvar/Restaurar Contexto
                    </span>
                  </div>
                ) : (
                  <div className="cpu-idle-state">
                    <span className="idle-text">OCIOSA</span>
                    <span className="idle-sub">Fila Vazia</span>
                  </div>
                )}
              </div>
            </div>

            {/* READY QUEUE */}
            <div className="hardware-card glass ready-queue-card">
              <span className="hw-label">Fila de Prontos (Ready Queue)</span>
              <div className="ready-queue-container">
                {currentStep.readyQueue.length === 0 ? (
                  <div className="empty-queue-text">Fila de prontos vazia</div>
                ) : (
                  <div className="queue-flow">
                    {currentStep.readyQueue.map((id, index) => {
                      const proc = processes.find((p) => p.id === id);
                      if (!proc) return null;
                      return (
                        <div key={proc.id} className="queue-item-wrapper">
                          <div
                            className="queue-badge"
                            style={{ backgroundColor: proc.color }}
                          >
                            {proc.name}
                          </div>
                          {index < currentStep.readyQueue.length - 1 && (
                            <svg
                              className="queue-arrow"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              width="16"
                              height="16"
                            >
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                              <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* GANTT GRAPH */}
          <div className="card glass gantt-card">
            <h2 className="card-title">
              <svg
                className="icon-title"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
              </svg>
              Diagrama de Gantt Animado
            </h2>

            <div className="gantt-scroll-container">
              <div className="gantt-chart">
                {/* TIMELINE ROW */}
                <div className="gantt-row time-header-row">
                  <div className="gantt-row-label">Tempo (s)</div>
                  <div className="gantt-row-cells">
                    {timeline.map((_, idx) => (
                      <div
                        key={idx}
                        className={`gantt-time-cell ${currentTime === idx ? "active" : ""}`}
                      >
                        {idx}
                      </div>
                    ))}
                    <div className="gantt-time-cell end-cap">
                      {timeline.length}
                    </div>
                  </div>
                </div>

                {/* CPU ROW (Visão Geral) */}
                <div className="gantt-row cpu-row-gantt">
                  <div className="gantt-row-label font-bold">CPU Geral</div>
                  <div className="gantt-row-cells">
                    {timeline.map((step, idx) => {
                      const proc = step.runningProcessId
                        ? processes.find((p) => p.id === step.runningProcessId)
                        : null;
                      const isFuture = idx > currentTime;
                      return (
                        <div
                          key={idx}
                          className={`gantt-cell cpu-state-${step.cpuState} ${isFuture ? "future-cell" : ""} ${currentTime === idx ? "focused-cell" : ""}`}
                          style={{
                            backgroundColor:
                              step.cpuState === "running" && proc
                                ? proc.color
                                : undefined,
                          }}
                          onClick={() => {
                            setCurrentTime(idx);
                            setIsPlaying(false);
                          }}
                          title={`Tempo ${idx}s - ${step.log}`}
                        >
                          {step.cpuState === "running" && proc && (
                            <span className="cell-label">{proc.name}</span>
                          )}
                          {step.cpuState === "overload" && (
                            <span className="cell-label xs-text">C</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* PROCESS ROWS */}
                {processes.map((proc) => (
                  <div key={proc.id} className="gantt-row process-row-gantt">
                    <div
                      className="gantt-row-label"
                      style={{ borderLeft: `4px solid ${proc.color}` }}
                    >
                      {proc.name}
                    </div>
                    <div className="gantt-row-cells">
                      {timeline.map((step, idx) => {
                        const procState = step.processStates[proc.id];
                        const isFuture = idx > currentTime;
                        if (!procState || procState.state === "not_arrived") {
                          return (
                            <div key={idx} className="gantt-cell blank-cell" />
                          );
                        }

                        let cellClass = `gantt-cell proc-state-${procState.state}`;
                        if (isFuture) cellClass += " future-cell";
                        if (currentTime === idx) cellClass += " focused-cell";

                        return (
                          <div
                            key={idx}
                            className={cellClass}
                            style={{
                              backgroundColor:
                                procState.state === "running"
                                  ? proc.color
                                  : undefined,
                              borderColor:
                                procState.state === "ready"
                                  ? proc.color
                                  : undefined,
                            }}
                            onClick={() => {
                              setCurrentTime(idx);
                              setIsPlaying(false);
                            }}
                            title={`Tempo ${idx}s | ${proc.name}: ${
                              procState.state === "running"
                                ? "Executando"
                                : procState.state === "ready"
                                  ? "Pronto (Esperando)"
                                  : procState.state === "overload"
                                    ? "Troca de Contexto"
                                    : "Finalizado"
                            }`}
                          >
                            {procState.state === "running" && (
                              <span className="pulse-indicator" />
                            )}
                            {procState.state === "ready" && (
                              <span
                                className="ready-dot"
                                style={{ backgroundColor: proc.color }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* PLAYHEAD (Agulha de Tempo) */}
                <div
                  className="gantt-playhead"
                  style={{
                    left: `calc(150px + ${currentTime * 36}px + 18px)`, // Offset label width (150px) + step width (36px) + center adjustment
                  }}
                />
              </div>
            </div>

            <div className="gantt-legend">
              <div className="legend-item">
                <span className="legend-box running-legend" /> Executando
              </div>
              <div className="legend-item">
                <span className="legend-box ready-legend" /> Pronto (Fila)
              </div>
              <div className="legend-item">
                <span className="legend-box overload-legend striped-overload" />{" "}
                Sobrecarga
              </div>
              <div className="legend-item">
                <span className="legend-box idle-legend" /> CPU Ociosa / Vazio
              </div>
            </div>
          </div>

          {/* STATISTICS / RESULTS CARDS */}
          <div className="metrics-row">
            <div className="metric-card glass">
              <span className="metric-label">Tempo Médio de Espera</span>
              <span className="metric-value">{avgWaiting}s</span>
              <p className="metric-desc">
                Tempo médio que os processos ficaram na fila de prontos.
              </p>
            </div>

            <div className="metric-card glass">
              <span className="metric-label">Tempo Médio de Retorno</span>
              <span className="metric-value">{avgTurnaround}s</span>
              <p className="metric-desc">
                Tempo total da chegada até o término (Turnaround).
              </p>
            </div>

            <div className="metric-card glass">
              <span className="metric-label">Tempo Médio de Resposta</span>
              <span className="metric-value">{avgResponse}s</span>
              <p className="metric-desc">
                Tempo médio da chegada até começar a rodar na CPU.
              </p>
            </div>
          </div>

          {/* BOTTOM TABLES: RESULTS AND CHRONOLOGICAL LOGS */}
          <div className="bottom-dashboard-row">
            {/* STATS TABLE */}
            <div className="card glass flex-2">
              <h2 className="card-title">
                <svg
                  className="icon-title"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 20V10M18 20V4M6 20v-4" />
                </svg>
                Tabela de Métricas Detalhadas
              </h2>

              <div className="table-responsive">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Chegada ($T_c$)</th>
                      <th>Execução ($T_e$)</th>
                      <th>Conclusão ($T_f$)</th>
                      <th>Espera ($W$)</th>
                      <th>Retorno ($T$)</th>
                      <th>Resposta ($R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processes.map((p) => {
                      const stat = processStats[p.id] || {
                        arrivalTime: p.arrivalTime,
                        burstTime: p.burstTime,
                        finishTime: 0,
                        turnaroundTime: 0,
                        waitingTime: 0,
                        responseTime: 0,
                      };
                      return (
                        <tr key={p.id}>
                          <td className="font-bold flex-align-center">
                            <span
                              className="badge-color-dot"
                              style={{ backgroundColor: p.color }}
                            />
                            {p.name}
                          </td>
                          <td>{stat.arrivalTime}s</td>
                          <td>{stat.burstTime}s</td>
                          <td>{stat.finishTime}s</td>
                          <td>{stat.waitingTime}s</td>
                          <td>{stat.turnaroundTime}s</td>
                          <td>{stat.responseTime}s</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CHRONOLOGICAL LOGS */}
            <div className="card glass flex-1 logs-card">
              <h2 className="card-title">
                <svg
                  className="icon-title"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Diário de Eventos
              </h2>

              <div className="logs-scroller">
                {timeline.map((step, idx) => (
                  <div
                    key={idx}
                    className={`log-line-item ${currentTime === idx ? "active-log" : ""} ${idx > currentTime ? "future-log" : ""}`}
                    onClick={() => {
                      setCurrentTime(idx);
                      setIsPlaying(false);
                    }}
                  >
                    <span className="log-time">[{idx}s]</span>
                    <span className="log-msg">{step.log}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <p>
          Desenvolvido como simulador educacional de Sistemas Operacionais.
          &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
