"use client";

import React, { useState, useEffect } from "react";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@shaily/ui";
import { getMemories, saveMemory, deleteMemory, MemoryItem } from "@/lib/api";
import { BrainCircuit, Plus, Trash2, User, Radio, FolderKanban, Save } from "lucide-react";

export default function MemorySystem() {
  const [activeTab, setActiveTab] = useState<"user" | "channel" | "project">("user");
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadMemories = async () => {
    try {
      setIsLoading(true);
      const data = await getMemories(activeTab);
      setMemories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, [activeTab]);

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const added = await saveMemory(activeTab, newKey, newValue);
      setMemories((prev) => [...prev, added]);
      setNewKey("");
      setNewValue("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMemory(activeTab, id);
      setMemories((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const getTabIcon = (tab: typeof activeTab) => {
    switch (tab) {
      case "user":
        return <User size={14} />;
      case "channel":
        return <Radio size={14} />;
      default:
        return <FolderKanban size={14} />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Memories Lists */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-100">Long-term Memory System</h3>
          <p className="text-zinc-400 text-sm mt-1">
            Manage vector memories, behavioral strategies, and target channel constraints.
          </p>
        </div>

        {/* Categories Tab Selector */}
        <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-900 w-full sm:w-auto self-start">
          {(["user", "channel", "project"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                activeTab === tab
                  ? "bg-zinc-900 text-white border border-zinc-850"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {getTabIcon(tab)}
              <span>{tab} Memory</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-zinc-550 text-sm">Loading memories data...</div>
        ) : memories.length === 0 ? (
          <div className="text-center py-20 text-zinc-550 text-sm border border-dashed border-zinc-850 rounded-2xl">
            No memories stored for this category yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {memories.map((item) => (
              <Card key={item.id} className="bg-zinc-900/30 border-zinc-850 flex flex-col justify-between">
                <CardHeader className="p-4 pb-2 border-b border-zinc-900 flex flex-row items-center justify-between bg-zinc-950/20">
                  <span className="text-2xs font-bold uppercase tracking-wider text-zinc-450">{item.key}</span>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-zinc-600 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </CardHeader>
                <CardContent className="p-4 pt-3 text-sm font-medium text-zinc-300">
                  {item.value}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Memory Preference Form */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-100">Add Preference</h3>
          <p className="text-zinc-400 text-sm mt-1">Inject parameters to model memory.</p>
        </div>

        <Card className="bg-zinc-900/30 border-zinc-800">
          <CardHeader className="p-6 border-b border-zinc-850">
            <CardTitle className="text-sm font-semibold flex items-center space-x-2">
              <BrainCircuit size={16} className="text-violet-400" />
              <span>Record Strategic Preference</span>
            </CardTitle>
            <CardDescription className="text-2xs">
              Saved criteria will be referenced by AI agents for content pipelines.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleAddMemory} className="space-y-4">
              <div className="space-y-2">
                <label className="text-2xs text-zinc-450 font-bold uppercase tracking-wider block">
                  Preference Parameter Key
                </label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g. Preferred Language"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-750 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-2xs text-zinc-455 font-bold uppercase tracking-wider block">
                  Value Input
                </label>
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="e.g. Hindi Voiceover"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-750 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs flex items-center justify-center gap-2 h-10 rounded-lg"
                disabled={isSubmitting || !newKey.trim() || !newValue.trim()}
              >
                <Save size={14} />
                <span>Inject Memory</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
