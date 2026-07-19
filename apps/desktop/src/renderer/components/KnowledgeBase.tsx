import React, { useState } from "react";
import { useDesktopStore } from "../store";
import { Brain, Sparkles, Database, Trash, RefreshCw } from "lucide-react";

export default function KnowledgeBase() {
  const { addLog } = useDesktopStore();
  const [compressing, setCompressing] = useState(false);

  // Mock knowledge documents list
  const docList = [
    { name: "shaily_os_spec.md", type: "System Documentation", tokens: 8200, vectors: 28 },
    { name: "finance_trends_july.json", type: "Research Ingestion", tokens: 14500, vectors: 49 },
    { name: "short_form_hook_principles.txt", type: "Creative Asset", tokens: 4120, vectors: 12 },
    { name: "channel_publishing_rules.json", type: "Platform Specs", tokens: 9100, vectors: 30 }
  ];

  const handleCompressMemory = () => {
    setCompressing(true);
    addLog("Initiating vector memory maintenance sequence...", "warn", "Memory");
    
    setTimeout(() => {
      addLog("Scanned 119 embedding nodes. Found 4 redundant clusters.", "info", "Memory");
    }, 1000);

    setTimeout(() => {
      addLog("Applied CompressionStrategy: Grouping semantic chains.", "info", "Memory");
    }, 2000);

    setTimeout(() => {
      addLog("Vector cleanup finished. DB size reduced by 14.8MB.", "success", "Memory");
      setCompressing(false);
    }, 3200);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "24px" }}>
      {/* Document Catalog */}
      <div className="glass-card">
        <div className="card-header">
          <h3 className="card-title">
            <Brain size={16} className="text-cyan" />
            <span>KnowledgeBase Catalog</span>
          </h3>
        </div>
        <div className="card-content" style={{ padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)", opacity: 0.6 }}>
                <th style={{ padding: "12px 20px" }}>Document Name</th>
                <th style={{ padding: "12px 20px" }}>Category</th>
                <th style={{ padding: "12px 20px" }}>Vectors</th>
              </tr>
            </thead>
            <tbody>
              {docList.map((doc, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                  <td style={{ padding: "12px 20px", fontWeight: 600 }}>{doc.name}</td>
                  <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>{doc.type}</td>
                  <td style={{ padding: "12px 20px", fontFamily: "var(--font-mono)", color: "var(--color-cyan)" }}>
                    {doc.vectors} nodes
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Memory Maintenance Controls Column */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Knowledge Stats */}
        <div className="glass-card">
          <div className="card-header">
            <h3 className="card-title">
              <Database size={16} className="text-violet" />
              <span>RAG Vector Database Details</span>
            </h3>
          </div>
          <div className="card-content" style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.8rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Embedding Model:</span>
              <span style={{ fontWeight: 600 }}>text-embedding-3-small</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Total Graph Nodes:</span>
              <span style={{ fontWeight: 600 }}>119</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Relationships Count:</span>
              <span style={{ fontWeight: 600 }}>384 edges</span>
            </div>
          </div>
        </div>

        {/* Maintenance Actions */}
        <div className="glass-card">
          <div className="card-header">
            <h3 className="card-title">
              <Sparkles size={16} className="text-amber" />
              <span>Memory Optimization Controls</span>
            </h3>
          </div>
          <div className="card-content" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "8px" }}>
              Flush unused semantic embeddings, merge duplicate context chunks, and optimize relationship edges to reduce vector token search overhead.
            </p>
            <button className="btn btn-primary" onClick={handleCompressMemory} disabled={compressing} style={{ width: "100%" }}>
              {compressing ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              <span>{compressing ? "Optimizing Database..." : "Optimize Vector DB"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
