"use client";

import React, { useState } from "react";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@shaily/ui";
import { Workflow, Play, Compass, CheckCircle2, ChevronRight, Clock, HelpCircle, Loader2 } from "lucide-react";

interface PipelineStep {
  id: string;
  name: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  duration?: string;
}

export default function PipelineMonitor() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[]>([
    { id: "step-1", name: "Topic Angle", description: "Target demographics research & SEO keywords", status: "completed", duration: "1.2s" },
    { id: "step-2", name: "Research Segment", description: "Fetch references and wiki data facts", status: "completed", duration: "4.5s" },
    { id: "step-3", name: "Script Generation", description: "Write narration script with hook & CTA", status: "completed", duration: "12.8s" },
    { id: "step-4", name: "Voice Synthesis", description: "Generate voiceover mp3 using TTS engine", status: "running" },
    { id: "step-5", name: "Image Sourcing", description: "Generate dynamic cinematic visuals via AI", status: "pending" },
    { id: "step-6", name: "Video Render", description: "Stitch visual assets and voiceover track", status: "pending" },
    { id: "step-7", name: "Post Editing", description: "Apply subtitles and background soundtrack", status: "pending" },
    { id: "step-8", name: "Publishing Check", status: "pending", description: "Upload to YouTube and apply metadata" }
  ]);

  const handleSimulate = () => {
    if (isSimulating) return;
    setIsSimulating(true);

    // Reset all steps to pending except first
    setSteps((prev) =>
      prev.map((step, idx) => ({
        ...step,
        status: idx === 0 ? "running" : "pending",
        duration: undefined
      }))
    );

    let currentIndex = 0;
    const interval = setInterval(() => {
      setSteps((prev) => {
        const nextSteps = [...prev];
        // Complete current step
        nextSteps[currentIndex] = {
          ...nextSteps[currentIndex],
          status: "completed",
          duration: `${(Math.random() * 5 + 1).toFixed(1)}s`
        };

        // Advance to next step
        currentIndex++;
        if (currentIndex < nextSteps.length) {
          nextSteps[currentIndex] = {
            ...nextSteps[currentIndex],
            status: "running"
          };
        } else {
          clearInterval(interval);
          setIsSimulating(false);
        }
        return nextSteps;
      });
    }, 2000);
  };

  const getStepIcon = (status: PipelineStep["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="text-emerald-500 shrink-0" size={18} />;
      case "running":
        return <Loader2 className="animate-spin text-violet-400 shrink-0" size={18} />;
      default:
        return <Clock className="text-zinc-600 shrink-0" size={18} />;
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
        <Button
          onClick={handleSimulate}
          disabled={isSimulating}
          className="bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs flex items-center justify-center gap-2 h-9 px-4"
        >
          {isSimulating ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>Simulating...</span>
            </>
          ) : (
            <>
              <Play size={12} />
              <span>Trigger Pipeline Run</span>
            </>
          )}
        </Button>
      </div>

      {/* Horizontal Workflow Stepper */}
      <Card className="bg-zinc-900/20 border-zinc-800 p-6 overflow-x-auto">
        <div className="flex items-center space-x-4 min-w-[800px]">
          {steps.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center space-y-2 shrink-0 w-24">
                <div
                  className={`w-10 h-10 rounded-full border flex items-center justify-center ${
                    step.status === "completed"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : step.status === "running"
                        ? "bg-violet-500/10 border-violet-500/40 text-violet-400 animate-pulse"
                        : "bg-zinc-950 border-zinc-850 text-zinc-600"
                  }`}
                >
                  <span className="text-xs font-semibold font-mono">{idx + 1}</span>
                </div>
                <span className="text-[10px] font-semibold text-center text-zinc-350 truncate w-full">
                  {step.name}
                </span>
              </div>
              {idx < steps.length - 1 && <ChevronRight size={14} className="text-zinc-750 shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </Card>

      {/* Detailed Steps List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {steps.map((step) => (
          <Card
            key={step.id}
            className={`bg-zinc-900/30 border-zinc-850 transition-colors ${
              step.status === "running" ? "border-violet-600/30 bg-zinc-900/50" : ""
            }`}
          >
            <CardHeader className="p-4 flex flex-row items-center justify-between border-b border-zinc-900 bg-zinc-950/20">
              <div className="flex items-center space-x-3">
                {getStepIcon(step.status)}
                <CardTitle className="text-sm font-semibold text-zinc-250">{step.name}</CardTitle>
              </div>
              {step.duration && (
                <span className="font-mono text-3xs text-zinc-500">Duration: {step.duration}</span>
              )}
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
