import React from "react";
import { useDesktopStore, SystemResourceTick } from "../store";
import { CheckCircle2, Cpu, HardDrive, Wifi, ShieldAlert } from "lucide-react";

export default function ResourceMonitor() {
  const { resourceHistory } = useDesktopStore();

  // Helper to generate SVG path from resource key
  const generateSvgPath = (key: keyof SystemResourceTick, width = 340, height = 60) => {
    if (resourceHistory.length < 2) return { linePath: "", fillPath: "" };

    const maxTicks = 25;
    const points = resourceHistory.map((tick, index) => {
      const val = (tick[key] as number) || 0;
      const x = (index / (maxTicks - 1)) * width;
      // Clamp between 0 and 100
      const y = height - (Math.min(Math.max(val, 0), 100) / 100) * (height - 4) - 2;
      return { x, y };
    });

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const fillPath = `${linePath} L ${width.toFixed(1)} ${height.toFixed(1)} L 0 ${height.toFixed(1)} Z`;

    return { linePath, fillPath };
  };

  const currentStats = resourceHistory[resourceHistory.length - 1] || {
    cpu: 0,
    ram: 0,
    gpu: 0,
    vram: 0,
    disk: 0,
    network: 0,
  };

  // Provider registries
  const providers = [
    { name: "OpenAI GPT-4o", status: "Active", latency: "142ms", tokenAccrual: "2,410" },
    { name: "Google Gemini 1.5 Pro", status: "Active", latency: "210ms", tokenAccrual: "1,200" },
    { name: "xAI Grok 2", status: "Active", latency: "185ms", tokenAccrual: "850" },
    { name: "Ollama Llama 3.1 (Local)", status: "Standby", latency: "0ms", tokenAccrual: "352" },
    { name: "NVIDIA NIM (Local Composition)", status: "Active", latency: "42ms", tokenAccrual: "0" }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 4 Primary Resource Sparklines */}
      <div className="grid-2">
        {/* CPU Sparkline */}
        <div className="glass-card chart-container" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Cpu size={14} className="text-violet" /> CPU Util
            </span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem" }}>
              {currentStats.cpu}%
            </span>
          </div>
          <svg className="sparkline-svg">
            <defs>
              <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-violet)" stopOpacity="0.4"/>
                <stop offset="100%" stopColor="var(--color-violet)" stopOpacity="0.0"/>
              </linearGradient>
            </defs>
            <path className="sparkline-gradient" d={generateSvgPath("cpu").fillPath} fill="url(#cpuGrad)" />
            <path className="sparkline-path" d={generateSvgPath("cpu").linePath} stroke="var(--color-violet)" />
          </svg>
        </div>

        {/* RAM Sparkline */}
        <div className="glass-card chart-container" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <HardDrive size={14} className="text-cyan" /> System RAM
            </span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem" }}>
              {currentStats.ram}%
            </span>
          </div>
          <svg className="sparkline-svg">
            <defs>
              <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-cyan)" stopOpacity="0.4"/>
                <stop offset="100%" stopColor="var(--color-cyan)" stopOpacity="0.0"/>
              </linearGradient>
            </defs>
            <path className="sparkline-gradient" d={generateSvgPath("ram").fillPath} fill="url(#ramGrad)" />
            <path className="sparkline-path" d={generateSvgPath("ram").linePath} stroke="var(--color-cyan)" />
          </svg>
        </div>

        {/* GPU Sparkline */}
        <div className="glass-card chart-container" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Cpu size={14} className="text-emerald" /> GPU Acceleration
            </span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem" }}>
              {currentStats.gpu}%
            </span>
          </div>
          <svg className="sparkline-svg">
            <defs>
              <linearGradient id="gpuGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-emerald)" stopOpacity="0.4"/>
                <stop offset="100%" stopColor="var(--color-emerald)" stopOpacity="0.0"/>
              </linearGradient>
            </defs>
            <path className="sparkline-gradient" d={generateSvgPath("gpu").fillPath} fill="url(#gpuGrad)" />
            <path className="sparkline-path" d={generateSvgPath("gpu").linePath} stroke="var(--color-emerald)" />
          </svg>
        </div>

        {/* VRAM Sparkline */}
        <div className="glass-card chart-container" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <HardDrive size={14} className="text-amber" /> VRAM Memory
            </span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem" }}>
              {currentStats.vram}%
            </span>
          </div>
          <svg className="sparkline-svg">
            <defs>
              <linearGradient id="vramGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-amber)" stopOpacity="0.4"/>
                <stop offset="100%" stopColor="var(--color-amber)" stopOpacity="0.0"/>
              </linearGradient>
            </defs>
            <path className="sparkline-gradient" d={generateSvgPath("vram").fillPath} fill="url(#vramGrad)" />
            <path className="sparkline-path" d={generateSvgPath("vram").linePath} stroke="var(--color-amber)" />
          </svg>
        </div>
      </div>

      {/* Network & Disk info cards */}
      <div className="grid-2">
        <div className="stat-card" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Wifi size={18} className="text-cyan" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 500 }}>NETWORK LOAD</span>
              <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>{currentStats.network} Mbps</span>
            </div>
          </div>
          <span style={{ fontSize: "10px", color: "var(--color-emerald)", fontWeight: 600 }}>STABLE</span>
        </div>

        <div className="stat-card" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <HardDrive size={18} className="text-violet" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 500 }}>CACHE DISK SPACE</span>
              <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>{currentStats.disk}% utilized</span>
            </div>
          </div>
          <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600 }}>120 GB FREE</span>
        </div>
      </div>

      {/* Provider Accruals Grid */}
      <div className="glass-card">
        <div className="card-header">
          <h3 className="card-title">Active AI Model Providers</h3>
        </div>
        <div className="card-content" style={{ padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)", opacity: 0.6 }}>
                <th style={{ padding: "12px 24px", fontWeight: 500 }}>Provider Engine</th>
                <th style={{ padding: "12px 24px", fontWeight: 500 }}>Latency</th>
                <th style={{ padding: "12px 24px", fontWeight: 500 }}>Tokens Accrued</th>
                <th style={{ padding: "12px 24px", fontWeight: 500 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                  <td style={{ padding: "12px 24px", fontWeight: 600 }}>{p.name}</td>
                  <td style={{ padding: "12px 24px", fontFamily: "var(--font-mono)" }}>{p.latency}</td>
                  <td style={{ padding: "12px 24px", fontFamily: "var(--font-mono)" }}>{p.tokenAccrual} T</td>
                  <td style={{ padding: "12px 24px" }}>
                    <span className={p.status === "Active" ? "text-emerald" : "text-secondary"} style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className={p.status === "Active" ? "stage-status-indicator success" : "stage-status-indicator pending"} style={{ width: "4px", height: "4px" }}></span>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
