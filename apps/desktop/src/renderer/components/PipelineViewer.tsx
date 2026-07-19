import React from "react";
import { useDesktopStore } from "../store";
import { Check, X, Loader2, Play, AlertCircle } from "lucide-react";

interface StageInfo {
  id: string;
  name: string;
  desc: string;
}

export default function PipelineViewer() {
  const {
    isPipelineRunning,
    currentStageId,
    completedStages,
    failedStages,
    stageErrors,
    recoveryHistory
  } = useDesktopStore();

  const pipelineStages: StageInfo[] = [
    { id: "research", name: "1. Research Engine", desc: "Topic keyword extraction and SEO research" },
    { id: "strategy", name: "2. Strategy Planner", desc: "Audience demographic parsing and slot configuration" },
    { id: "channel", name: "3. Channel Manager", desc: "Configuring target post rules (YT, TikTok, etc.)" },
    { id: "script", name: "4. Script Writer", desc: "Drafting voice script and editing visual prompts" },
    { id: "production", name: "5. Production Coordinator", desc: "Configuring orientation ratios and track templates" },
    { id: "generation", name: "6. Asset Generator", desc: "Voiceover synthesis and image generation" },
    { id: "composition", name: "7. Video Composer", desc: "Arranging timing markers and overlays" },
    { id: "rendering", name: "8. Render Engine", desc: "Sequencing clips into final video files" },
    { id: "quality", name: "9. Quality Control", desc: "Inspecting decibel levels and resolution ratios" },
    { id: "publishing", name: "10. Publisher Service", desc: "Pushing raw files and captions to platforms" },
    { id: "analytics", name: "11. Analytics Ingestor", desc: "Gathering view ratios and engagement retention" },
    { id: "learning", name: "12. Feedback Loop Optimizer", desc: "Evaluating performance to adapt future prompts" },
    { id: "optimization", name: "13. Resource Clean Up", desc: "Flushing local cache files and temporary assets" }
  ];

  // Helper to determine node status class
  const getNodeClass = (stageId: string) => {
    if (failedStages.includes(stageId)) return "failed";
    if (currentStageId === stageId) return "current";
    if (completedStages.includes(stageId)) return "success";
    return "waiting";
  };

  const handleTriggerPipeline = () => {
    window.electronAPI.send("trigger-pipeline", { pipelineName: "Viral Finance Short" });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: "24px" }}>
      {/* Visual flowchart graph column */}
      <div className="glass-card">
        <div className="card-header">
          <h3 className="card-title">Execution Node graph</h3>
          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            Sequential engine stage activations
          </span>
        </div>
        <div className="card-content">
          <div className="pipeline-flow-wrapper">
            {pipelineStages.map((stage, idx) => {
              const nodeStatus = getNodeClass(stage.id);
              const isLast = idx === pipelineStages.length - 1;
              const nextNodeStatus = !isLast ? getNodeClass(pipelineStages[idx + 1].id) : "waiting";

              return (
                <React.Fragment key={stage.id}>
                  <div className={`pipeline-node ${nodeStatus}`}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                      <span style={{ textAlign: "left", width: "100%" }}>{stage.name}</span>
                      
                      {/* Status Icon */}
                      {nodeStatus === "success" && <Check size={14} className="text-emerald" />}
                      {nodeStatus === "failed" && <X size={14} className="text-rose" />}
                      {nodeStatus === "current" && <Loader2 size={14} className="animate-spin text-violet" />}
                    </div>
                    
                    <span style={{ display: "block", fontSize: "9px", opacity: 0.6, marginTop: "4px", textAlign: "left" }}>
                      {stage.desc}
                    </span>
                  </div>

                  {!isLast && (
                    <div className={`pipeline-arrow ${nodeStatus === "success" && nextNodeStatus !== "waiting" ? "active" : ""}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Details, Errors and Retries column */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Recovery and Retry logs */}
        <div className="glass-card" style={{ flexGrow: 1 }}>
          <div className="card-header">
            <h3 className="card-title">
              <AlertCircle size={16} className="text-rose" />
              <span>Retry & Recovery History</span>
            </h3>
          </div>
          <div className="card-content" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {failedStages.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {failedStages.map((failedId) => (
                  <div key={failedId} style={{ padding: "10px 14px", backgroundColor: "rgba(244, 63, 94, 0.08)", border: "1px solid rgba(244, 63, 94, 0.2)", borderRadius: "var(--radius-md)" }}>
                    <div style={{ fontWeight: 600, fontSize: "12px", color: "var(--color-rose)" }}>
                      Stage Failure: {failedId.toUpperCase()}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
                      Error: {stageErrors[failedId] || "Transient process disconnect."}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {recoveryHistory.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", color: "var(--text-secondary)", letterSpacing: "0.05em", marginTop: "10px" }}>
                  Active Recovery Logs
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "10px", backgroundColor: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                  {recoveryHistory.map((log, idx) => (
                    <div key={idx} style={{ color: "var(--color-amber)", display: "flex", gap: "6px" }}>
                      <span>➔</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "32px 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                No engine faults detected. System is running cleanly.
              </div>
            )}
          </div>
        </div>

        {/* Trigger card */}
        {!isPipelineRunning && (
          <div className="glass-card" style={{ padding: "20px" }}>
            <h4 style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "8px" }}>
              Quick Launch Pipeline
            </h4>
            <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: 1.5 }}>
              Launch a full content cycle to test end-to-end event subscription and stage transitions.
            </p>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleTriggerPipeline}>
              <Play size={14} fill="currentColor" />
              <span>Launch Sim Workflow</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
