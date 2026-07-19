import React from "react";
import { useDesktopStore } from "../store";
import {
  Cpu,
  Database,
  Activity,
  Server,
  Zap,
  Play,
  RotateCw,
  FolderSync,
  Layers,
  ChevronRight
} from "lucide-react";
import ResourceMonitor from "./ResourceMonitor";

export default function Dashboard() {
  const {
    engineHealth,
    backendConnected,
    liveMode,
    isPipelineRunning,
    pipelineName,
    pipelineProgress,
    setActiveTab
  } = useDesktopStore();

  const handleRestartRuntime = () => {
    window.electronAPI.send("restart-runtime");
  };

  // Get status color helper
  const getStatusColor = (status: "online" | "offline" | "initializing") => {
    switch (status) {
      case "online":
        return "text-emerald";
      case "initializing":
        return "text-amber";
      default:
        return "text-rose";
    }
  };

  const getStatusBgClass = (status: "online" | "offline" | "initializing") => {
    switch (status) {
      case "online":
        return "stage-status-indicator success";
      case "initializing":
        return "stage-status-indicator running";
      default:
        return "stage-status-indicator failed";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Welcome Banner */}
      <div className="welcome-banner">
        <h3 className="welcome-title">Shaily Studio Engine Dashboard</h3>
        <p className="welcome-subtitle">
          Your local control center for orchestrating multi-agent media production. All services are monitored in real-time. Monitor CPU allocations, pipeline queues, and fine-tune your learning feedback loops.
        </p>
      </div>

      {/* Engine Status Grid */}
      <div>
        <h4 style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Engine Status Registry
        </h4>
        <div className="grid-4">
          {Object.entries(engineHealth).map(([engine, status]) => (
            <div key={engine} className="glass-card stat-card" style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 500 }}>
                  {engine}
                </span>
                <span className={`stat-val ${getStatusColor(status)}`} style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className={getStatusBgClass(status)} style={{ width: "6px", height: "6px" }}></span>
                  {status.toUpperCase()}
                </span>
              </div>
              <Activity size={18} style={{ opacity: 0.25 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Main Monitoring Split */}
      <div className="grid-dashboard">
        {/* Left Column: Live resource monitor */}
        <div className="glass-card">
          <div className="card-header">
            <h3 className="card-title">
              <Cpu size={16} className="text-violet" />
              <span>Resource & Performance Monitor</span>
            </h3>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Refreshes live</span>
          </div>
          <div className="card-content">
            <ResourceMonitor />
          </div>
        </div>

        {/* Right Column: Active queues and Quick actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Active Job Queues */}
          <div className="glass-card">
            <div className="card-header">
              <h3 className="card-title">
                <Layers size={16} className="text-cyan" />
                <span>Live Execution Queues</span>
              </h3>
            </div>
            <div className="card-content" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {isPipelineRunning ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                    <span style={{ fontWeight: 500 }}>{pipelineName}</span>
                    <span className="text-violet" style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                      {pipelineProgress}%
                    </span>
                  </div>
                  <div style={{ width: "100%", height: "6px", backgroundColor: "rgba(0,0,0,0.3)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${pipelineProgress}%`, height: "100%", background: "linear-gradient(to right, var(--color-violet), var(--color-cyan))", transition: "width 0.3s ease" }}></div>
                  </div>
                  <span style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "4px" }}>
                    ETA: ~12 seconds remaining
                  </span>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "16px 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  No active pipelines running. Click "Trigger Full Pipeline" above to run.
                </div>
              )}

              <hr style={{ borderColor: "rgba(255,255,255,0.05)" }} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="stat-card" style={{ padding: "10px 14px", flexDirection: "column", alignItems: "flex-start" }}>
                  <span className="stat-label">Active Tasks</span>
                  <span className="stat-val">{isPipelineRunning ? 1 : 0}</span>
                </div>
                <div className="stat-card" style={{ padding: "10px 14px", flexDirection: "column", alignItems: "flex-start" }}>
                  <span className="stat-label">Token Accrual</span>
                  <span className="stat-val text-cyan">4,812 T</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="glass-card">
            <div className="card-header">
              <h3 className="card-title">
                <Zap size={16} className="text-amber" />
                <span>Control Actions</span>
              </h3>
            </div>
            <div className="card-content" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button className="btn btn-outline" style={{ justifyContent: "flex-start", width: "100%" }} onClick={handleRestartRuntime}>
                <RotateCw size={14} className="text-amber" />
                <span>Reboot RuntimeEngine</span>
              </button>
              <button className="btn btn-outline" style={{ justifyContent: "flex-start", width: "100%" }} onClick={() => setActiveTab("workspace")}>
                <FolderSync size={14} className="text-cyan" />
                <span>Change Workspace Directory</span>
              </button>
              <button className="btn btn-outline" style={{ justifyContent: "flex-start", width: "100%" }} onClick={() => setActiveTab("pipeline")}>
                <ChevronRight size={14} className="text-violet" />
                <span>Open Pipeline Viewer</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
