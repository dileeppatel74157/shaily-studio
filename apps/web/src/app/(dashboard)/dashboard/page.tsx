"use client";

import React, { useState, useEffect } from "react";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@shaily/ui";
import { SYSTEM_VERSION } from "@shaily/core/client";
import { getChannels, getMissions, getMemories, Mission, ChannelConnection } from "@/lib/api";
import {
  Activity,
  Server,
  Network,
  Database,
  Cpu,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Radio,
  FileVideo,
  ListTodo,
  Sparkles
} from "lucide-react";

export default function OverviewDashboard() {
  const [channels, setChannels] = useState<ChannelConnection[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<
    Array<{ time: string; msg: string; type: "info" | "success" | "error" }>
  >([
    { time: new Date().toLocaleTimeString(), msg: "FastAPI gateway connection established.", type: "info" },
    { time: new Date().toLocaleTimeString(), msg: "Core memory engines active.", type: "info" },
    { time: new Date().toLocaleTimeString(), msg: "Autonomous agent execution queue listening...", type: "info" },
  ]);

  useEffect(() => {
    async function loadData() {
      try {
        const [ch, miss] = await Promise.all([getChannels(), getMissions()]);
        setChannels(ch);
        setMissions(miss);
      } catch (err) {
        console.error("Failed to load dashboard metrics:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const getActiveMissionsCount = () => missions.filter(m => m.status === "running").length;
  const getCompletedMissionsCount = () => missions.filter(m => m.status === "completed").length;

  return (
    <div className="space-y-8">
      {/* Welcome & Command Prompt Info Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-black border border-zinc-800 relative overflow-hidden flex items-center justify-between">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl -z-10"></div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold tracking-tight font-display bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles size={20} className="text-violet-400 animate-pulse" />
            AI Content Command Center
          </h3>
          <p className="text-zinc-400 max-w-2xl text-sm leading-relaxed">
            Welcome to Shaily Studio V2. This command center coordinates autonomous AI agent execution, 
            monitors content pipelines, and manages publishing networks. Give commands directly in the Command Chat tab.
          </p>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">
                Connected Channels
              </p>
              <h4 className="text-2xl font-bold font-mono">{channels.length}</h4>
              <p className="text-2xs text-zinc-500 mt-1 flex items-center gap-1">
                <Radio size={10} className="text-emerald-500" /> Active Platform Streams
              </p>
            </div>
            <Radio className="text-violet-400" size={32} />
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">
                Active Missions
              </p>
              <h4 className="text-2xl font-bold font-mono">{getActiveMissionsCount()}</h4>
              <p className="text-2xs text-zinc-500 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></span>
                Agents Executing
              </p>
            </div>
            <Cpu className="text-violet-400" size={32} />
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">
                Missions Completed
              </p>
              <h4 className="text-2xl font-bold font-mono">{getCompletedMissionsCount()}</h4>
              <p className="text-2xs text-zinc-500 mt-1 flex items-center gap-1">
                <CheckCircle2 size={10} className="text-emerald-500" /> Lifetime Executions
              </p>
            </div>
            <FileVideo className="text-violet-400" size={32} />
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">
                Optimization Score
              </p>
              <h4 className="text-2xl font-bold font-mono">94.2%</h4>
              <p className="text-2xs text-zinc-500 mt-1 flex items-center gap-1">
                <Sparkles size={10} className="text-violet-400" /> System Healthy
              </p>
            </div>
            <Activity className="text-violet-400" size={32} />
          </CardContent>
        </Card>
      </div>

      {/* Database & Infrastructure Health Status Grid */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-450">Infrastructure Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-zinc-900/30 border-zinc-850">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Server className="text-zinc-400" size={18} />
                <span className="text-sm font-medium">FastAPI Server</span>
              </div>
              <span className="text-2xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                Live (Port 8000)
              </span>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/30 border-zinc-850">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Network className="text-zinc-400" size={18} />
                <span className="text-sm font-medium">Redis Queue</span>
              </div>
              <span className="text-2xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                Active (Port 6379)
              </span>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/30 border-zinc-850">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Database className="text-zinc-400" size={18} />
                <span className="text-sm font-medium">PostgreSQL DB</span>
              </div>
              <span className="text-2xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                Connected (Port 5432)
              </span>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/30 border-zinc-850">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Cpu className="text-zinc-400" size={18} />
                <span className="text-sm font-medium">Worker Pool</span>
              </div>
              <span className="text-2xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                Idle / Listening
              </span>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Timeline Monitor & Core Shell Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pipeline Monitor */}
        <div className="lg:col-span-2">
          <Card className="bg-zinc-900/30 border-zinc-800 h-full">
            <CardHeader className="p-6 border-b border-zinc-800/80">
              <CardTitle className="text-lg flex items-center space-x-2">
                <Activity size={18} className="text-violet-400" />
                <span>Active Pipeline Monitor</span>
              </CardTitle>
              <CardDescription>
                Real-time tracking for active content generation missions.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {isLoading ? (
                <div className="text-center py-12 text-zinc-500">Loading pipelines...</div>
              ) : missions.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">No active pipelines found.</div>
              ) : (
                <div className="space-y-4">
                  {missions.slice(0, 3).map((mission) => (
                    <div
                      key={mission.id}
                      className="p-4 rounded-xl border border-zinc-850 bg-zinc-950/40 flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-3">
                          <span className="font-semibold text-sm">{mission.name}</span>
                          <span className="text-2xs text-zinc-500 font-mono">ID: {mission.id}</span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          Active Agent: <span className="text-violet-400">{mission.agent}</span>
                        </p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-24 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-violet-500 h-full transition-all duration-500" 
                            style={{ width: `${mission.progress}%` }}
                          />
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            mission.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : mission.status === "failed"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : mission.status === "running"
                                  ? "bg-violet-500/10 text-violet-400 border border-violet-500/20 animate-pulse"
                                  : "bg-zinc-800 text-zinc-450 border border-zinc-700/50"
                          }`}
                        >
                          {mission.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Core Shell Console Output */}
        <div>
          <Card className="bg-zinc-900/30 border-zinc-800 h-full flex flex-col justify-between">
            <CardHeader className="p-6 border-b border-zinc-800/80">
              <CardTitle className="text-lg flex items-center space-x-2">
                <Terminal size={18} className="text-violet-400" />
                <span>Core Shell Output</span>
              </CardTitle>
              <CardDescription>
                Live operational logs from active agents.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col justify-between overflow-hidden">
              <div className="font-mono text-2xs space-y-2 h-[220px] overflow-y-auto pr-2 bg-black/60 p-4 rounded-xl border border-zinc-850">
                {logs.map((log, idx) => (
                  <div key={idx} className="flex gap-2 leading-relaxed">
                    <span className="text-zinc-650 shrink-0">{log.time}</span>
                    <span
                      className={
                        log.type === "success"
                          ? "text-emerald-400"
                          : log.type === "error"
                            ? "text-rose-400"
                            : "text-zinc-350"
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
    </div>
  );
}
