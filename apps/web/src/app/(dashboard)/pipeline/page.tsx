"use client";

import React, { useState, useEffect } from "react";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@shaily/ui";
import { Workflow, Play, Compass, CheckCircle2, ChevronRight, Clock, HelpCircle, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

const PIPELINE_STEPS = [
  { id: "step-1", name: "Topic Angle", description: "Target demographics research & SEO keywords" },
  { id: "step-2", name: "Research Segment", description: "Fetch references and wiki data facts" },
  { id: "step-3", name: "Script Generation", description: "Write narration script with hook & CTA" },
  { id: "step-4", name: "Voice Synthesis", description: "Generate voiceover mp3 using TTS engine" },
  { id: "step-5", name: "Image Sourcing", description: "Generate dynamic cinematic visuals via AI" },
  { id: "step-6", name: "Video Render", description: "Stitch visual assets and voiceover track" },
  { id: "step-7", name: "Post Editing", description: "Apply subtitles and background soundtrack" },
  { id: "step-8", name: "Publishing Check", description: "Upload to YouTube and apply metadata" }
];

interface Task {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  prompt: string;
  agent_id: string;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
}

export default function PipelineMonitor() {
  const [promptInput, setPromptInput] = useState("");
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load the latest task on mount to see if one is already running or what the last state was
  useEffect(() => {
    const fetchLatestTask = async () => {
      try {
        const tasks = await apiFetch<Task[]>("/api/tasks");
        if (tasks && tasks.length > 0) {
          setActiveTask(tasks[0]);
        }
      } catch (err: any) {
        console.error("Failed to load initial task state:", err);
      }
    };
    fetchLatestTask();
  }, []);

  // Poll tasks if active task is pending or running
  useEffect(() => {
    if (!activeTask || activeTask.status === "completed" || activeTask.status === "failed") {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const tasks = await apiFetch<Task[]>("/api/tasks");
        const matched = tasks.find((t) => t.id === activeTask.id);
        if (matched) {
          setActiveTask(matched);
        }
      } catch (err: any) {
        console.error("Error polling tasks:", err);
      }
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [activeTask?.id, activeTask?.status]);

  const handleStartPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await apiFetch<{ success: boolean; taskId: string; status: Task["status"] }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          prompt: promptInput.trim(),
          task_type: "video_generation"
        })
      });

      if (res.success) {
        setActiveTask({
          id: res.taskId,
          status: res.status || "pending",
          prompt: promptInput.trim(),
          agent_id: "default",
          error: null
        });
        setPromptInput("");
      } else {
        setSubmitError("Failed to trigger pipeline");
      }
    } catch (err: any) {
      setSubmitError(err.message || "Failed to start pipeline run");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-100">Content Pipeline Workflow</h3>
          <p className="text-zinc-400 text-sm mt-1">
            Monitor the autonomous lifecycle stages of script compilation, asset generation, and editing.
          </p>
        </div>
      </div>

      {/* Start new pipeline run input form */}
      <Card className="bg-zinc-900/30 border-zinc-800 p-6">
        <form onSubmit={handleStartPipeline} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="pipeline-prompt" className="text-xs font-semibold text-zinc-300 block">
              Video Topic / Prompt
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="pipeline-prompt"
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="e.g. 5 Mind-Blowing Facts About Space"
                disabled={isSubmitting}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <Button
                type="submit"
                disabled={isSubmitting || !promptInput.trim()}
                className="bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs flex items-center justify-center gap-2 h-9 px-6 rounded-lg shrink-0"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <Play size={12} />
                    <span>Start Pipeline</span>
                  </>
                )}
              </Button>
            </div>
          </div>
          {submitError && (
            <div className="text-xs text-rose-400 font-medium mt-1">
              {submitError}
            </div>
          )}
        </form>
      </Card>

      {/* Overall Task Status Card */}
      {activeTask ? (
        <Card className={`border transition-all duration-300 ${
          activeTask.status === "completed"
            ? "border-emerald-500/30 bg-emerald-500/5"
            : activeTask.status === "failed"
              ? "border-rose-500/30 bg-rose-500/5"
              : activeTask.status === "running"
                ? "border-violet-500/30 bg-violet-500/5 animate-pulse"
                : "border-zinc-800 bg-zinc-900/20"
        } p-6 space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Current Task ID:</span>
                <span className="font-mono text-[10px] text-zinc-550">{activeTask.id}</span>
              </div>
              <h4 className="text-sm font-semibold text-zinc-150">
                Prompt: <span className="text-zinc-300 font-normal italic">"{activeTask.prompt}"</span>
              </h4>
            </div>
            <div className="flex items-center space-x-2 shrink-0 self-start sm:self-center">
              <span className="text-xs text-zinc-400">Status:</span>
              <div className={`px-3 py-1 rounded-full text-xs font-semibold capitalize flex items-center gap-1.5 ${
                activeTask.status === "completed"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : activeTask.status === "failed"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    : activeTask.status === "running"
                      ? "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                      : "bg-zinc-800 text-zinc-400 border border-zinc-700"
              }`}>
                {activeTask.status === "running" && <Loader2 size={12} className="animate-spin" />}
                {activeTask.status === "completed" && <CheckCircle2 size={12} />}
                {activeTask.status === "failed" && <Clock size={12} />}
                <span>{activeTask.status}</span>
              </div>
            </div>
          </div>

          {activeTask.status === "failed" && activeTask.error && (
            <div className="p-4 bg-rose-950/20 border border-rose-900/30 rounded-lg text-rose-400 text-xs space-y-1">
              <div className="font-semibold">Error Details:</div>
              <div className="font-mono break-all">{activeTask.error}</div>
            </div>
          )}

          <div className="text-2xs text-zinc-500 flex items-center gap-1.5 border-t border-zinc-800/40 pt-3">
            <HelpCircle size={12} className="shrink-0 text-zinc-550" />
            <span>Note: The backend tracks the pipeline as one overall task. Per-stage granularity is not currently available in the database.</span>
          </div>
        </Card>
      ) : (
        <Card className="bg-zinc-900/20 border-zinc-800 p-6 text-center text-zinc-500 text-sm">
          No active content pipeline run detected. Enter a prompt above to start one.
        </Card>
      )}

      {/* Horizontal Workflow Stepper */}
      <Card className="bg-zinc-900/20 border-zinc-800 p-6 overflow-x-auto">
        <div className="flex items-center space-x-4 min-w-[800px]">
          {PIPELINE_STEPS.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center space-y-2 shrink-0 w-24">
                <div
                  className="w-10 h-10 rounded-full border flex items-center justify-center bg-zinc-950 border-zinc-850 text-zinc-650"
                >
                  <span className="text-xs font-semibold font-mono">{idx + 1}</span>
                </div>
                <span className="text-[10px] font-semibold text-center text-zinc-400 truncate w-full">
                  {step.name}
                </span>
              </div>
              {idx < PIPELINE_STEPS.length - 1 && <ChevronRight size={14} className="text-zinc-750 shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </Card>

      {/* Detailed Steps List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PIPELINE_STEPS.map((step) => (
          <Card
            key={step.id}
            className="bg-zinc-900/30 border-zinc-850 transition-colors"
          >
            <CardHeader className="p-4 flex flex-row items-center justify-between border-b border-zinc-900 bg-zinc-950/20">
              <div className="flex items-center space-x-3">
                <Clock className="text-zinc-600 shrink-0" size={18} />
                <CardTitle className="text-sm font-semibold text-zinc-250">{step.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-xs text-zinc-450 leading-relaxed">{step.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
