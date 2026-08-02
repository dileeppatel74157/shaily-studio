"use client";

import React, { useState, useEffect } from "react";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@shaily/ui";
import { getMissions, Mission } from "@/lib/api";
import { ListTodo, CheckCircle, RefreshCw, Calendar, Clock, ChevronDown, ChevronUp, Terminal } from "lucide-react";

export default function MissionsManager() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [expandedMission, setExpandedMission] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMissions = async () => {
    try {
      setIsLoading(true);
      const data = await getMissions();
      setMissions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMissions();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedMission((prev) => (prev === id ? null : id));
  };

  const getStatusColor = (status: Mission["status"]) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "failed":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "running":
        return "bg-violet-500/10 text-violet-400 border border-violet-500/20 animate-pulse";
      default:
        return "bg-zinc-800 text-zinc-400 border border-zinc-700/50";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-100">Missions Task Manager</h3>
          <p className="text-zinc-400 text-sm mt-1">
            Monitor autonomous content creation pipelines, logs execution, and schedule timelines.
          </p>
        </div>
        <Button
          onClick={loadMissions}
          variant="outline"
          className="border-zinc-800 bg-zinc-950 hover:bg-zinc-900 flex items-center gap-2 h-9 text-xs"
        >
          <RefreshCw size={12} />
          <span>Refresh Queue</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-24 text-zinc-550 text-sm">
          Loading active missions state...
        </div>
      ) : (
        <div className="space-y-4">
          {missions.map((mission) => {
            const isExpanded = expandedMission === mission.id;
            return (
              <Card
                key={mission.id}
                className="bg-zinc-900/20 border-zinc-850 hover:border-zinc-800 transition-colors"
              >
                <div
                  className="p-5 flex items-center justify-between cursor-pointer select-none"
                  onClick={() => toggleExpand(mission.id)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-850 flex items-center justify-center text-zinc-400">
                      {mission.status === "completed" ? (
                        <CheckCircle size={16} className="text-emerald-400" />
                      ) : mission.status === "running" ? (
                        <RefreshCw size={16} className="animate-spin text-violet-400" />
                      ) : (
                        <Clock size={16} />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-250 flex items-center gap-2">
                        {mission.name}
                        <span className="font-mono text-3xs text-zinc-500">ID: {mission.id}</span>
                      </h4>
                      <p className="text-2xs text-zinc-450 mt-0.5">
                        Assigned: <span className="text-violet-400 font-medium">{mission.agent}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-20 bg-zinc-850 rounded-full h-1">
                        <div
                          className="bg-violet-500 h-full transition-all duration-300"
                          style={{ width: `${mission.progress}%` }}
                        />
                      </div>
                      <span className="text-2xs font-mono text-zinc-450">{mission.progress}%</span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-3xs font-semibold uppercase tracking-wider ${getStatusColor(mission.status)}`}>
                      {mission.status}
                    </span>

                    {isExpanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-zinc-900 pt-4 bg-zinc-950/20 space-y-3">
                    <div className="flex items-center gap-2 text-2xs text-zinc-450 font-bold uppercase tracking-wider">
                      <Terminal size={12} className="text-violet-400" />
                      <span>Execution Step Logs</span>
                    </div>
                    <div className="bg-black/50 border border-zinc-900 p-4 rounded-lg font-mono text-3xs text-zinc-400 space-y-2 max-h-48 overflow-y-auto leading-relaxed">
                      {mission.logs.map((log, index) => (
                        <div key={index} className="flex gap-2">
                          <span className="text-zinc-650 shrink-0">[{new Date(mission.timestamp).toLocaleTimeString()}]</span>
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
