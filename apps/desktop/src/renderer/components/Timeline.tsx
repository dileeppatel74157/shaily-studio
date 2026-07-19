import React, { useState } from "react";
import { useDesktopStore } from "../store";
import { ChevronDown, ChevronUp, Clock, AlertOctagon, RefreshCw, CheckCircle2 } from "lucide-react";

interface Stage {
  id: string;
  name: string;
  desc: string;
  role: string;
  inputs: string;
  outputs: string;
}

export default function Timeline() {
  const {
    currentStageId,
    completedStages,
    failedStages,
    stageDurations,
    stageErrors,
    isPipelineRunning
  } = useDesktopStore();

  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({
    research: true,
  });

  const stages: Stage[] = [
    { id: "research", name: "Research Stage", role: "Search Agent", desc: "Crawls search platforms for viral content hooks.", inputs: "Topic name keywords", outputs: "Top 10 search hook angles" },
    { id: "strategy", name: "Strategy Plan", role: "Strategy Agent", desc: "Selects the optimal hook and structures scheduling.", inputs: "Top 10 search hooks", outputs: "1 selected hook with slot scheduling" },
    { id: "channel", name: "Channel Rules", role: "Channel Agent", desc: "Checks target media specs (resolution ratios, audio specs).", inputs: "Selected hook name", outputs: "Platform formatting guidelines" },
    { id: "script", name: "Scripting Stage", role: "Script Agent", desc: "Composes voice narration, B-Roll prompts and time markers.", inputs: "Target hooks & platform rules", outputs: "Narrative script & visual prompt sheet" },
    { id: "production", name: "Production Config", role: "Production Agent", desc: "Prepares workspace folders and indexing templates.", inputs: "Script parameters", outputs: "Stitched output folder structure" },
    { id: "generation", name: "Media Synthesis", role: "Voice & B-Roll Agents", desc: "Synthesizes voiceovers and renders prompt visual frames.", inputs: "Narrative script text", outputs: "Voice MP3 & Image URL list" },
    { id: "composition", name: "Timeline Staging", role: "Composer Agent", desc: "Aligns voice assets, images, and captions.", inputs: "Voice file & B-Roll list", outputs: "XML edit sheet" },
    { id: "rendering", name: "Video Render", role: "Render Agent", desc: "Assembles media components into high-quality video files.", inputs: "XML edit sheet", outputs: "Raw MP4 video" },
    { id: "quality", name: "Quality Check", role: "QC Agent", desc: "Verifies audio decibel levels and video frame encoding.", inputs: "Raw MP4 video", outputs: "QC pass metadata" },
    { id: "publishing", name: "Platform Push", role: "Publisher Agent", desc: "Uploads final video files and schedules publication.", inputs: "Raw MP4 video & captions", outputs: "Publishing reference link" },
    { id: "analytics", name: "Analytics Ingestion", role: "Analytics Agent", desc: "Tracks views, shares, and audience retention metrics.", inputs: "Publishing reference link", outputs: "Retention logs" },
    { id: "learning", name: "Model Tuning", role: "Learning Agent", desc: "Analyzes retention logs to optimize next generation cycles.", inputs: "Retention logs", outputs: "Optimized prompt templates" },
    { id: "optimization", name: "Resource Clean", role: "Cache Agent", desc: "Prunes finished assets and clears memory database.", inputs: "Session cache ID", outputs: "Freed local storage space" }
  ];

  const toggleExpand = (id: string) => {
    setExpandedStages((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getStageStatus = (id: string) => {
    if (failedStages.includes(id)) return "failed";
    if (completedStages.includes(id)) return "completed";
    if (currentStageId === id) return "running";
    return "pending";
  };

  return (
    <div className="glass-card">
      <div className="card-header">
        <h3 className="card-title">
          <Clock size={16} className="text-violet" />
          <span>Detailed Execution Timeline</span>
        </h3>
        <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
          {isPipelineRunning ? "Running Pipeline..." : "Awaiting execution run"}
        </span>
      </div>
      <div className="card-content">
        <div className="timeline-stages">
          {stages.map((stage) => {
            const status = getStageStatus(stage.id);
            const isExpanded = !!expandedStages[stage.id];
            const duration = stageDurations[stage.id];

            return (
              <div key={stage.id} className={`timeline-stage-item ${status}`}>
                {/* Header Toggle */}
                <div className="timeline-stage-header" onClick={() => toggleExpand(stage.id)}>
                  <div className="timeline-stage-left">
                    <span className={`stage-status-indicator ${status}`} />
                    <span className="stage-title">{stage.name}</span>
                    <span style={{ fontSize: "11px", opacity: 0.4 }}>•</span>
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                      {stage.role}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {duration && (
                      <span className="stage-duration" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={10} />
                        {duration}
                      </span>
                    )}
                    {status === "failed" && (
                      <span className="text-rose" style={{ fontSize: "10px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                        <AlertOctagon size={10} />
                        ERROR
                      </span>
                    )}
                    {status === "running" && (
                      <span className="text-violet" style={{ fontSize: "10px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                        <RefreshCw size={10} className="animate-spin" />
                        RUNNING
                      </span>
                    )}
                    {status === "completed" && (
                      <CheckCircle2 size={12} className="text-emerald" />
                    )}
                    {isExpanded ? <ChevronUp size={14} style={{ opacity: 0.5 }} /> : <ChevronDown size={14} style={{ opacity: 0.5 }} />}
                  </div>
                </div>

                {/* Details body */}
                {isExpanded && (
                  <div className="timeline-stage-body">
                    <p style={{ marginBottom: "10px", lineHeight: 1.5 }}>{stage.desc}</p>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                      <div>
                        <span style={{ fontWeight: 600, color: "#fff", display: "block", marginBottom: "2px" }}>Inputs:</span>
                        <span style={{ opacity: 0.8 }}>{stage.inputs}</span>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: "#fff", display: "block", marginBottom: "2px" }}>Outputs:</span>
                        <span style={{ opacity: 0.8 }}>{stage.outputs}</span>
                      </div>
                    </div>

                    {status === "failed" && stageErrors[stage.id] && (
                      <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "rgba(244, 63, 94, 0.1)", border: "1px solid rgba(244, 63, 94, 0.2)", borderRadius: "var(--radius-sm)", color: "var(--color-rose)" }}>
                        <div style={{ fontWeight: 600 }}>Execution Error Exception:</div>
                        <div style={{ opacity: 0.9, marginTop: "2px" }}>{stageErrors[stage.id]}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
