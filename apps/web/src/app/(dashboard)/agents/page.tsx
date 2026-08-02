"use client";

import React, { useState } from "react";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@shaily/ui";
import { DEFAULT_AGENTS } from "@shaily/core/client";
import { addMission } from "@/lib/api";
import { Bot, Play, Cpu, ShieldAlert, CheckCircle, Flame, Eye } from "lucide-react";

export default function AgentsCenter() {
  const [selectedAgent, setSelectedAgent] = useState(DEFAULT_AGENTS[0]?.id || "");
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;

    const agent = DEFAULT_AGENTS.find((a) => a.id === selectedAgent);
    if (!agent) return;

    setIsSubmitting(true);
    setNotification(null);

    try {
      await addMission({
        name: `Manual Command: ${prompt.slice(0, 30)}...`,
        agent: agent.name,
        status: "running",
        progress: 10,
        logs: [`Dispatched manual trigger payload to ${agent.name} runtime...`]
      });
      setNotification(`Successfully dispatched task to ${agent.name}. Monitor progress in Missions Manager.`);
      setPrompt("");
    } catch (err: any) {
      setNotification(`Failed to dispatch: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Agent Grid */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-100">AI Agents Core</h3>
          <p className="text-zinc-400 text-sm mt-1">
            Configure, inspect, and invoke the primary autonomous worker models.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DEFAULT_AGENTS.map((agent) => (
            <Card key={agent.id} className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
              <CardHeader className="p-6 pb-4 border-b border-zinc-850">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Bot size={16} className="text-violet-400" />
                    {agent.name}
                  </span>
                  <span className="text-2xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-mono">
                    v{agent.version}
                  </span>
                </CardTitle>
                <CardDescription className="text-violet-400 font-medium text-2xs mt-1 uppercase tracking-wider">
                  {agent.role}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <p className="text-zinc-400 text-xs leading-relaxed">{agent.description}</p>
                
                <div>
                  <p className="text-2xs text-zinc-550 font-bold uppercase tracking-wider mb-2">
                    Capabilities
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="text-2xs font-mono bg-zinc-950 border border-zinc-850 px-2.5 py-0.5 rounded text-zinc-350"
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

      {/* Manual Agent Trigger Console */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-100">Manual Console</h3>
          <p className="text-zinc-400 text-sm mt-1">Directly trigger agent executions.</p>
        </div>

        <Card className="bg-zinc-900/30 border-zinc-800">
          <CardHeader className="p-6 border-b border-zinc-850">
            <CardTitle className="text-sm font-semibold flex items-center space-x-2">
              <Cpu size={16} className="text-violet-400" />
              <span>Console Trigger</span>
            </CardTitle>
            <CardDescription className="text-2xs">
              Dispatch custom payload instructions to agent runtimes.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {notification && (
              <div className="p-3 mb-4 rounded-lg border border-zinc-800 bg-zinc-950 text-2xs text-zinc-350">
                {notification}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-2xs text-zinc-450 font-bold uppercase tracking-wider block">
                  Target Agent
                </label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  {DEFAULT_AGENTS.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-2xs text-zinc-450 font-bold uppercase tracking-wider block">
                  Prompt Input
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Provide payload parameters or description..."
                  rows={4}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs flex items-center justify-center gap-2 h-10 rounded-lg"
                disabled={isSubmitting || !prompt.trim()}
              >
                {isSubmitting ? (
                  <Flame size={14} className="animate-pulse" />
                ) : (
                  <Play size={14} />
                )}
                <span>Dispatch Trigger</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
