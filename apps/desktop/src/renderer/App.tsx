import React, { useEffect } from "react";
import { useDesktopStore } from "./store";
import {
  LayoutDashboard,
  Clock,
  GitFork,
  FolderOpen,
  Brain,
  Bot,
  Terminal,
  Bell,
  Settings,
  Play,
  Square,
  RefreshCw,
  Cpu,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info
} from "lucide-react";

// Import components
import Dashboard from "./components/Dashboard";
import Timeline from "./components/Timeline";
import PipelineViewer from "./components/PipelineViewer";
import Workspace from "./components/Workspace";
import KnowledgeBase from "./components/KnowledgeBase";
import Assistant from "./components/Assistant";
import Logs from "./components/Logs";
import NotificationsPanel from "./components/Notifications";
import SettingsPanel from "./components/Settings";

// Type declaration for Electron context bridge
declare global {
  interface Window {
    electronAPI: {
      send: (channel: string, data?: any) => void;
      on: (channel: string, callback: (event: any, ...args: any[]) => void) => () => void;
      invoke: (channel: string, data?: any) => Promise<any>;
    };
  }
}

export default function App() {
  const {
    activeTab,
    setActiveTab,
    theme,
    activeProject,
    backendConnected,
    liveMode,
    isPipelineRunning,
    pipelineProgress,
    toasts,
    removeToast,
    addLog,
    addNotification,
    addResourceTick,
    setConnectionStatus,
    startPipeline,
    setStageActive,
    setStageComplete,
    setStageFailed,
    resetPipeline,
    updateEngineHealth,
    updateSettings
  } = useDesktopStore();

  useEffect(() => {
    // 1. Fetch initial states from main process
    window.electronAPI.invoke("get-initial-state").then((state) => {
      if (state) {
        updateSettings(state.settings);
        if (state.logHistory) {
          state.logHistory.forEach((log: any) => addLog(log));
        }
      }
    });

    // 2. Set up IPC Event Listeners
    const cleanLogs = window.electronAPI.on("log-stream", (_e, log) => {
      addLog(log);
    });

    const cleanResources = window.electronAPI.on("system-resources", (_e, tick) => {
      addResourceTick(tick);
    });

    const cleanReconnect = window.electronAPI.on("reconnect-status", (_e, status) => {
      setConnectionStatus(status.connected, status.live);
    });

    const cleanNotifications = window.electronAPI.on("notification-stream", (_e, notif) => {
      addNotification(notif);
      // Auto dismiss toast after 4s
      setTimeout(() => {
        removeToast(notif.id);
      }, 4000);
    });

    const cleanEngineHealth = window.electronAPI.on("engine-health-updated", (_e, data) => {
      updateEngineHealth(data.engine, data.status);
    });

    const cleanRuntimeEvents = window.electronAPI.on("runtime-event", (_e, event) => {
      const { type, payload } = event;
      switch (type) {
        case "PipelineStarted":
          startPipeline(payload.pipelineName);
          break;
        case "TaskStarted":
          setStageActive(payload.stageId, payload.stageName);
          break;
        case "TaskCompleted":
          setStageComplete(payload.stageId, payload.duration);
          break;
        case "PipelineCompleted":
          resetPipeline();
          break;
        case "PipelineFailed":
          setStageFailed(payload.stageId, payload.error);
          break;
      }
    });

    return () => {
      cleanLogs();
      cleanResources();
      cleanReconnect();
      cleanNotifications();
      cleanEngineHealth();
      cleanRuntimeEvents();
    };
  }, []);

  const handleTriggerPipeline = () => {
    window.electronAPI.send("trigger-pipeline", { pipelineName: "Viral Finance Short" });
  };

  const handleStopPipeline = () => {
    window.electronAPI.send("stop-pipeline");
  };

  return (
    <div className={`app-container ${theme}`}>
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          <div className="sidebar-header">
            <h1 className="sidebar-title">SHAILY STUDIO</h1>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "4px" }}>
              CONTROL CENTER v1.0.0
            </div>
          </div>
          <nav className="sidebar-nav">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            >
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab("timeline")}
              className={`nav-item ${activeTab === "timeline" ? "active" : ""}`}
            >
              <Clock size={16} />
              <span>Timeline</span>
            </button>
            <button
              onClick={() => setActiveTab("pipeline")}
              className={`nav-item ${activeTab === "pipeline" ? "active" : ""}`}
            >
              <GitFork size={16} />
              <span>Pipeline Viewer</span>
            </button>
            <button
              onClick={() => setActiveTab("workspace")}
              className={`nav-item ${activeTab === "workspace" ? "active" : ""}`}
            >
              <FolderOpen size={16} />
              <span>Workspace</span>
            </button>
            <button
              onClick={() => setActiveTab("knowledge")}
              className={`nav-item ${activeTab === "knowledge" ? "active" : ""}`}
            >
              <Brain size={16} />
              <span>Knowledge Base</span>
            </button>
            <button
              onClick={() => setActiveTab("assistant")}
              className={`nav-item ${activeTab === "assistant" ? "active" : ""}`}
            >
              <Bot size={16} />
              <span>Assistant</span>
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`nav-item ${activeTab === "logs" ? "active" : ""}`}
            >
              <Terminal size={16} />
              <span>System Logs</span>
            </button>
            <button
              onClick={() => setActiveTab("notifications")}
              className={`nav-item ${activeTab === "notifications" ? "active" : ""}`}
            >
              <Bell size={16} />
              <span>Notifications</span>
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
            >
              <Settings size={16} />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="status-badge-container">
            <span className={`status-dot ${isPipelineRunning ? "pulse" : ""}`}></span>
            <span style={{ fontWeight: 600 }}>
              {isPipelineRunning ? "Pipeline Running" : "Engine Standby"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.6 }}>
            <span>Backend:</span>
            <span className={backendConnected ? "text-emerald" : "text-rose"}>
              {backendConnected ? (liveMode ? "LIVE" : "SANDBOX") : "OFFLINE"}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="main-content">
        <header className="top-bar">
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h2 className="top-bar-title">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace("-", " ")}
            </h2>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              Project: <span style={{ color: "#fff", fontWeight: 500 }}>{activeProject}</span>
            </span>
          </div>
          <div className="top-bar-actions">
            {isPipelineRunning ? (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {/* Visual Pipeline Progress */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: "120px" }}>
                  <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
                    Running... {pipelineProgress}%
                  </span>
                  <div style={{ width: "100%", height: "4px", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden", marginTop: "4px" }}>
                    <div style={{ width: `${pipelineProgress}%`, height: "100%", background: "linear-gradient(to right, var(--color-violet), var(--color-cyan))", transition: "width 0.3s ease" }}></div>
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={handleStopPipeline}>
                  <Square size={12} fill="currentColor" />
                  <span>Stop Run</span>
                </button>
              </div>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={handleTriggerPipeline}>
                <Play size={12} fill="currentColor" />
                <span>Trigger Full Pipeline</span>
              </button>
            )}
          </div>
        </header>

        {/* View Pages Router */}
        <div className="panel-body">
          <div className="page-container">
            {activeTab === "dashboard" && <Dashboard />}
            {activeTab === "timeline" && <Timeline />}
            {activeTab === "pipeline" && <PipelineViewer />}
            {activeTab === "workspace" && <Workspace />}
            {activeTab === "knowledge" && <KnowledgeBase />}
            {activeTab === "assistant" && <Assistant />}
            {activeTab === "logs" && <Logs />}
            {activeTab === "notifications" && <NotificationsPanel />}
            {activeTab === "settings" && <SettingsPanel />}
          </div>
        </div>
      </main>

      {/* Floating Toast Notification Bubble Stack */}
      <div className="toasts-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast" onClick={() => removeToast(toast.id)}>
            <div className="toast-icon">
              {toast.type === "success" && <CheckCircle size={16} className="text-emerald" />}
              {toast.type === "error" && <XCircle size={16} className="text-rose" />}
              {toast.type === "warn" && <AlertTriangle size={16} className="text-amber" />}
              {toast.type === "info" && <Info size={16} className="text-cyan" />}
            </div>
            <div className="toast-body">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
