import React, { useState } from "react";
import { useDesktopStore } from "../store";
import { Settings, Save, Check } from "lucide-react";

export default function SettingsPanel() {
  const {
    theme,
    panelLayout,
    activeProject,
    setTheme,
    setPanelLayout,
    setActiveProject,
    updateSettings
  } = useDesktopStore();

  const [localProject, setLocalProject] = useState(activeProject);
  const [showSavedToast, setShowSavedToast] = useState(false);

  const handleSaveSettings = () => {
    setActiveProject(localProject);
    const settings = {
      theme,
      panelLayout,
      activeProject: localProject,
    };
    // Send via IPC to save in main process
    window.electronAPI.send("save-layout-settings", settings);

    setShowSavedToast(true);
    setTimeout(() => {
      setShowSavedToast(false);
    }, 2000);
  };

  return (
    <div className="glass-card">
      <div className="card-header">
        <h3 className="card-title">
          <Settings size={16} className="text-violet" />
          <span>System Configurations & UI Settings</span>
        </h3>
      </div>
      <div className="card-content" style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "600px" }}>
        
        {/* Project Name Selection */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>
            ACTIVE PROJECT NAME
          </label>
          <input
            type="text"
            value={localProject}
            onChange={(e) => setLocalProject(e.target.value)}
            className="chat-input"
            style={{ borderRadius: "var(--radius-sm)" }}
          />
        </div>

        {/* Theme Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>
            INTERFACE THEME
          </label>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className={`filter-tab ${theme === "dark" ? "active" : ""}`}
              onClick={() => setTheme("dark")}
              style={{ flexGrow: 1, padding: "8px", textAlign: "center" }}
            >
              Glass Dark (Default)
            </button>
            <button
              className={`filter-tab ${theme === "cyberpunk" ? "active" : ""}`}
              onClick={() => setTheme("cyberpunk")}
              style={{ flexGrow: 1, padding: "8px", textAlign: "center" }}
            >
              Neon Cyber
            </button>
          </div>
        </div>

        {/* Panel Layout preset */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>
            LAYOUT PRESET
          </label>
          <select
            value={panelLayout}
            onChange={(e) => setPanelLayout(e.target.value)}
            className="chat-input"
            style={{ borderRadius: "var(--radius-sm)", height: "38px" }}
          >
            <option value="default">Default Columns (Balanced)</option>
            <option value="compact">Compact View (Denser grids)</option>
            <option value="wide">Wide Screen (Max content widths)</option>
          </select>
        </div>

        {/* Auto reconnect Config */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>
            LOCAL CORE GATEWAY ENDPOINT
          </label>
          <input
            type="text"
            defaultValue="http://127.0.0.1:8000"
            disabled
            className="chat-input"
            style={{ borderRadius: "var(--radius-sm)", opacity: 0.5, cursor: "not-allowed" }}
          />
          <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
            Local-only communication. Automatically polls and reconnects to FastAPI backend (Port 8000).
          </span>
        </div>

        {/* Actions bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "10px" }}>
          <button className="btn btn-primary" onClick={handleSaveSettings} style={{ padding: "10px 24px" }}>
            <Save size={14} />
            <span>Save Settings</span>
          </button>
          
          {showSavedToast && (
            <span className="text-emerald" style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Check size={14} />
              Settings saved locally!
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
