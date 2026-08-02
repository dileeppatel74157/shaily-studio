"use client";

import React, { useState } from "react";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@shaily/ui";
import { Settings, Save, ShieldCheck, Key, Server, Database } from "lucide-react";

export default function SystemSettings() {
  const [geminiKey, setGeminiKey] = useState("••••••••••••••••••••••••••••••••");
  const [openaiKey, setOpenaiKey] = useState("••••••••••••••••••••••••••••••••");
  const [notification, setNotification] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setNotification("System settings saved successfully.");
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Settings Options Form */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-100">System Configuration</h3>
          <p className="text-zinc-400 text-sm mt-1">
            Configure system backend endpoints, model parameters, and credentials.
          </p>
        </div>

        {notification && (
          <div className="p-3 rounded-lg border border-emerald-950 bg-emerald-950/20 text-emerald-400 text-xs">
            {notification}
          </div>
        )}

        <Card className="bg-zinc-900/30 border-zinc-800">
          <CardHeader className="p-6 border-b border-zinc-850">
            <CardTitle className="text-sm font-semibold flex items-center space-x-2">
              <Key size={16} className="text-violet-400" />
              <span>Model API Credentials</span>
            </CardTitle>
            <CardDescription className="text-2xs">
              System access keys for Google Gemini, OpenAI, and Claude model generations.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <label className="text-2xs text-zinc-450 font-bold uppercase tracking-wider block">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-2xs text-zinc-450 font-bold uppercase tracking-wider block">
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <Button
                type="submit"
                className="bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs flex items-center justify-center gap-2 h-10 rounded-lg px-6"
              >
                <Save size={14} />
                <span>Save Credentials</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Connection Variables summary */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-100">Environment</h3>
          <p className="text-zinc-400 text-sm mt-1">Workstation system layout.</p>
        </div>

        <Card className="bg-zinc-900/30 border-zinc-800">
          <CardHeader className="p-6 border-b border-zinc-850">
            <CardTitle className="text-sm font-semibold flex items-center space-x-2">
              <Server size={16} className="text-violet-400" />
              <span>Core Environment Vars</span>
            </CardTitle>
            <CardDescription className="text-2xs">
              Active configuration parameters read from .env.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-550 uppercase font-bold tracking-wider">FastAPI Host URL</span>
              <div className="p-2 bg-zinc-950 border border-zinc-900 rounded font-mono text-3xs text-zinc-300 truncate">
                http://localhost:8000
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-zinc-550 uppercase font-bold tracking-wider">PostgreSQL DB URL</span>
              <div className="p-2 bg-zinc-950 border border-zinc-900 rounded font-mono text-3xs text-zinc-300 truncate">
                postgresql+psycopg://shaily_admin:***@localhost:5432/shaily_studio_dev
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-zinc-550 uppercase font-bold tracking-wider">Redis Server URL</span>
              <div className="p-2 bg-zinc-950 border border-zinc-900 rounded font-mono text-3xs text-zinc-300 truncate">
                redis://localhost:6379/0
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
