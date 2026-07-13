"use client";

import React, { useState, useEffect } from "react";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@shaily/ui";
import { DEFAULT_AGENTS, SYSTEM_VERSION } from "@shaily/core";
import { TaskPayload, TaskStatus } from "@shaily/shared";
import { useStudioStore } from "@/store";
import {
  LayoutDashboard,
  Bot,
  Terminal,
  Cpu,
  Database,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Activity,
  Server,
  Network,
} from "lucide-react";

export default function Home() {
  const { activeTab, setActiveTab, simulatedTasks, addSimulatedTask } = useStudioStore();
  const [promptInput, setPromptInput] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(DEFAULT_AGENTS[0]?.id || "");
  const [isSimulating, setIsSimulating] = useState(false);
  const [logs, setLogs] = useState<Array<{ time: string; msg: string; type: "info" | "success" | "error" }>>([
    { time: new Date().toLocaleTimeString(), msg: "Shaily Studio Core initialized.", type: "info" },
    { time: new Date().toLocaleTimeString(), msg: "FastAPI server heartbeat OK.", type: "info" },
    { time: new Date().toLocaleTimeString(), msg: "Worker queue listener active.", type: "info" },
  ]);

  const addLog = (msg: string, type: "info" | "success" | "error" = "info") => {
    setLogs((prev) => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 50));
  };

  const handleSimulateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    const agent = DEFAULT_AGENTS.find((a) => a.id === selectedAgent);
    if (!agent) return;

    const taskId = `task-${Math.random().toString(36).substr(2, 9)}`;
    const newTask: TaskPayload = {
      taskId,
      agentId: agent.id,
      inputData: { prompt: promptInput },
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addSimulatedTask(newTask);
    addLog(`Submitted prompt to ${agent.name}: "${promptInput.slice(0, 40)}..."`, "info");
    setPromptInput("");

    // Simulate lifecycle states: pending -> running -> completed
    setTimeout(() => {
      newTask.status = "running";
      newTask.updatedAt = new Date().toISOString();
      addSimulatedTask({ ...newTask });
      addLog(`[${agent.name}] task ${taskId} is now running...`, "info");

      setTimeout(() => {
        const isSuccess = Math.random() > 0.15;
        newTask.status = isSuccess ? "completed" : "failed";
        newTask.updatedAt = new Date().toISOString();
        newTask.completedAt = new Date().toISOString();
        if (!isSuccess) {
          newTask.error = "Agent execution timed out or API key limit reached.";
        }
        addSimulatedTask({ ...newTask });
        addLog(
          `[${agent.name}] task ${taskId} finished with status: ${newTask.status.toUpperCase()}`,
          isSuccess ? "success" : "error"
        );
      }, 2500);
    }, 1200);
  };

  const handleSimulatePipeline = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    addLog("Initiating Content Generation Pipeline Simulation...", "info");

    const pipelineTasks = [
      { id: "agent-ideator", name: "Ideator", prompt: "Create 3 viral video topics about personal finance" },
      { id: "agent-writer", name: "Writer", prompt: "Write a 60-second video script based on the chosen topic" },
      { id: "agent-editor", name: "Editor", prompt: "Assemble final video frames and schedule export" }
    ];

    let currentStep = 0;

    const runNextPipelineStep = () => {
      if (currentStep >= pipelineTasks.length) {
        setIsSimulating(false);
        addLog("Pipeline Simulation Completed Successfully.", "success");
        return;
      }

      const step = pipelineTasks[currentStep];
      const taskId = `pipeline-step-${currentStep + 1}`;
      const task: TaskPayload = {
        taskId,
        agentId: step.id,
        inputData: { prompt: step.prompt },
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      addSimulatedTask(task);
      addLog(`[Pipeline] Step ${currentStep + 1}/3 (${step.name}) initiated...`, "info");

      setTimeout(() => {
        task.status = "running";
        addSimulatedTask({ ...task });
        addLog(`[Pipeline] ${step.name} is processing payload...`, "info");

        setTimeout(() => {
          task.status = "completed";
          task.completedAt = new Date().toISOString();
          addSimulatedTask({ ...task });
          addLog(`[Pipeline] ${step.name} successfully exported output.`, "success");
          currentStep++;
          runNextPipelineStep();
        }, 2000);
      }, 1000);
    };

    runNextPipelineStep();
  };

  return (
    <div className="flex h-screen bg-black overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col justify-between">
        <div>
          <div className="h-16 flex items-center px-6 border-b border-zinc-800">
            <h1 className="text-xl font-bold tracking-tight font-display bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              SHAILY STUDIO
            </h1>
          </div>
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "dashboard"
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-400 hover:bg-zinc-900/50 hover:text-white"
              }`}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab("agents")}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "agents"
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-400 hover:bg-zinc-900/50 hover:text-white"
              }`}
            >
              <Bot size={18} />
              <span>AI Agents</span>
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "logs"
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-400 hover:bg-zinc-900/50 hover:text-white"
              }`}
            >
              <Terminal size={18} />
              <span>System Logs</span>
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-zinc-800 text-xs text-zinc-500">
          <div className="flex items-center space-x-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>OS Core Running</span>
          </div>
          <div>v{SYSTEM_VERSION}</div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col bg-zinc-950/50 overflow-y-auto">
        {/* Header */}
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-950/30 backdrop-blur-md">
          <h2 className="text-lg font-semibold tracking-tight">
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} View
          </h2>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSimulatePipeline}
              disabled={isSimulating}
              className="flex items-center space-x-2 border-zinc-800 hover:border-zinc-700 bg-zinc-900"
            >
              {isSimulating ? (
                <RefreshCw size={14} className="animate-spin text-violet-400" />
              ) : (
                <Play size={14} className="text-violet-400" />
              )}
              <span>{isSimulating ? "Running Pipeline..." : "Trigger Full Pipeline"}</span>
            </Button>
          </div>
        </header>

        {/* Content Container */}
        <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
          {activeTab === "dashboard" && (
            <>
              {/* Info Banner */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl -z-10"></div>
                <h3 className="text-2xl font-bold tracking-tight font-display mb-2">Welcome to Shaily Studio OS</h3>
                <p className="text-zinc-400 max-w-2xl text-sm leading-relaxed">
                  A modular personal AI Content Operating System constructed with FastAPI, Next.js, and Redis.
                  All background workers and API endpoints are wired through Docker orchestration. Start customizing agent behaviors in the Python layers.
                </p>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">API Backend</p>
                      <h4 className="text-lg font-bold">FastAPI</h4>
                      <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> Live / Port 8000
                      </p>
                    </div>
                    <Server className="text-violet-400" size={28} />
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">Work Queue</p>
                      <h4 className="text-lg font-bold">Redis Queue</h4>
                      <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> Active / Port 6379
                      </p>
                    </div>
                    <Network className="text-violet-400" size={28} />
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">Database</p>
                      <h4 className="text-lg font-bold">PostgreSQL</h4>
                      <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> Connected / Port 5432
                      </p>
                    </div>
                    <Database className="text-violet-400" size={28} />
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">Worker Pool</p>
                      <h4 className="text-lg font-bold">Arq Service</h4>
                      <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> Idle / Listening
                      </p>
                    </div>
                    <Cpu className="text-violet-400" size={28} />
                  </CardContent>
                </Card>
              </div>

              {/* Tasks and Execution Sim */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Active Jobs Monitor */}
                <div className="lg:col-span-2 space-y-6">
                  <Card className="bg-zinc-900/30 border-zinc-800">
                    <CardHeader className="p-6 border-b border-zinc-800/80">
                      <CardTitle className="text-lg flex items-center space-x-2">
                        <Activity size={18} className="text-violet-400" />
                        <span>Active Pipeline Monitor</span>
                      </CardTitle>
                      <CardDescription>Real-time task tracking for all local agent workflows.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      {simulatedTasks.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500 text-sm">
                          No tasks have been executed in this session. Trigger a simulation run or enter a prompt.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {simulatedTasks.map((task) => {
                            const agent = DEFAULT_AGENTS.find((a) => a.id === task.agentId);
                            return (
                              <div
                                key={task.taskId}
                                className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-between"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-3">
                                    <span className="font-semibold text-sm">{agent?.name || "Agent"}</span>
                                    <span className="text-xs text-zinc-500 font-mono">ID: {task.taskId}</span>
                                  </div>
                                  <p className="text-xs text-zinc-400 max-w-md truncate">
                                    Prompt: {String(task.inputData.prompt)}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-4">
                                  <span
                                    className={`px-2 py-1 rounded text-2xs font-semibold uppercase tracking-wider ${
                                      task.status === "completed"
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                        : task.status === "failed"
                                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                          : task.status === "running"
                                            ? "bg-violet-500/10 text-violet-400 border border-violet-500/20 animate-pulse"
                                            : "bg-zinc-800 text-zinc-400"
                                    }`}
                                  >
                                    {task.status}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Console Event Log */}
                <div className="space-y-6">
                  <Card className="bg-zinc-900/30 border-zinc-800 h-full flex flex-col">
                    <CardHeader className="p-6 border-b border-zinc-800/80">
                      <CardTitle className="text-lg flex items-center space-x-2">
                        <Terminal size={18} className="text-violet-400" />
                        <span>Core Shell Output</span>
                      </CardTitle>
                      <CardDescription>Live operational outputs from the local event loops.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 flex-1 flex flex-col justify-between overflow-hidden">
                      <div className="font-mono text-2xs space-y-2 h-[260px] overflow-y-auto pr-2 bg-black/60 p-4 rounded-xl border border-zinc-850">
                        {logs.map((log, idx) => (
                          <div key={idx} className="flex gap-2 leading-relaxed">
                            <span className="text-zinc-600">{log.time}</span>
                            <span
                              className={
                                log.type === "success"
                                  ? "text-emerald-400"
                                  : log.type === "error"
                                    ? "text-rose-400"
                                    : "text-zinc-300"
                              }
                            >
                              {log.msg}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}

          {activeTab === "agents" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Agent List */}
              <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {DEFAULT_AGENTS.map((agent) => (
                    <Card key={agent.id} className="bg-zinc-900/40 border-zinc-800">
                      <CardHeader className="p-6 pb-4 border-b border-zinc-800/40">
                        <CardTitle className="text-lg flex items-center justify-between">
                          <span>{agent.name}</span>
                          <span className="text-2xs bg-zinc-800 px-2 py-1 rounded text-zinc-400 font-mono">
                            v{agent.version}
                          </span>
                        </CardTitle>
                        <CardDescription className="text-violet-400 font-medium text-xs mt-1">
                          {agent.role}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <p className="text-zinc-400 text-xs leading-relaxed">{agent.description}</p>
                        <div>
                          <p className="text-2xs text-zinc-500 font-bold uppercase tracking-wider mb-2">Capabilities</p>
                          <div className="flex flex-wrap gap-1.5">
                            {agent.capabilities.map((cap) => (
                              <span
                                key={cap}
                                className="text-2xs font-mono bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded text-zinc-300"
                              >
                                {cap}
                              </span>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Agent Tester Console */}
              <div>
                <Card className="bg-zinc-900/30 border-zinc-800">
                  <CardHeader className="p-6 border-b border-zinc-800/80">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Play size={18} className="text-violet-400" />
                      <span>Console Trigger</span>
                    </CardTitle>
                    <CardDescription>Dispatch parameters directly to an agent runtime.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <form onSubmit={handleSimulateTask} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs text-zinc-400 font-semibold block">Target Agent</label>
                        <select
                          value={selectedAgent}
                          onChange={(e) => setSelectedAgent(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        >
                          {DEFAULT_AGENTS.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-zinc-400 font-semibold block">Prompt Input</label>
                        <textarea
                          value={promptInput}
                          onChange={(e) => setPromptInput(e.target.value)}
                          placeholder="Type input details to execute..."
                          rows={4}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm flex items-center justify-center gap-2 h-10"
                      >
                        <Play size={14} />
                        <span>Run Simulation Task</span>
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "logs" && (
            <Card className="bg-zinc-900/30 border-zinc-800">
              <CardHeader className="p-6 border-b border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Structured Output Shell</CardTitle>
                    <CardDescription>Inspect system actions, status evaluations, and Docker status messages.</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-zinc-800 bg-zinc-900 hover:bg-zinc-850 hover:text-white"
                    onClick={() => setLogs([])}
                  >
                    Clear Console
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="font-mono text-xs space-y-3 bg-black/50 p-6 rounded-xl border border-zinc-850 h-[500px] overflow-y-auto">
                  {logs.length === 0 ? (
                    <div className="text-center text-zinc-600 py-24 font-sans">
                      Logs are empty. Run simulations or task executions to populate logs.
                    </div>
                  ) : (
                    logs.map((log, idx) => (
                      <div key={idx} className="flex gap-4 leading-relaxed">
                        <span className="text-zinc-650 shrink-0 select-none">[{log.time}]</span>
                        <span
                          className={
                            log.type === "success"
                              ? "text-emerald-400"
                              : log.type === "error"
                                ? "text-rose-400"
                                : "text-zinc-400"
                          }
                        >
                          {log.msg}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
