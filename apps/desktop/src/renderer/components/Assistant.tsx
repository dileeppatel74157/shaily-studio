import React, { useState, useRef, useEffect } from "react";
import { useDesktopStore } from "../store";
import { Send, Bot, User, Loader2 } from "lucide-react";

export default function Assistant() {
  const { assistantHistory, addChatMessage } = useDesktopStore();
  const [inputValue, setInputValue] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [assistantHistory, isThinking]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isThinking) return;

    const userMessage = inputValue;
    setInputValue("");
    addChatMessage("user", userMessage);
    setIsThinking(true);

    try {
      const response = await window.electronAPI.invoke("ask-assistant", { message: userMessage });
      addChatMessage("assistant", response || "No response received.");
    } catch (err: any) {
      addChatMessage("assistant", `Error executing command: ${err.message}`);
    } finally {
      setIsThinking(false);
    }
  };

  // Basic custom markdown parser for JSX formatting
  const parseMarkdown = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      // 1. Headers ###
      if (line.startsWith("### ")) {
        return <h3 key={idx} style={{ marginTop: "12px", marginBottom: "6px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "4px" }}>{line.slice(4)}</h3>;
      }
      // 2. Bold text **abc**
      if (line.startsWith("- ")) {
        const content = line.slice(2);
        return <li key={idx} style={{ marginLeft: "14px", listStyleType: "square", marginBottom: "4px" }}>{parseInlineStyles(content)}</li>;
      }
      return <p key={idx} style={{ margin: "6px 0", lineHeight: "1.5" }}>{parseInlineStyles(line)}</p>;
    });
  };

  const parseInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} style={{ color: "#fff", fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", backgroundColor: "rgba(0,0,0,0.4)", padding: "2px 6px", borderRadius: "3px", border: "1px solid var(--border-color)", color: "var(--color-cyan)" }}>{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  return (
    <div className="glass-card assistant-chat" style={{ height: "calc(100vh - 160px)" }}>
      <div className="card-header">
        <div style={{ display: "flex", flexDirection: "column" }}>
          <h3 className="card-title">
            <Bot size={16} className="text-violet" />
            <span>AssistantEngine Terminal</span>
          </h3>
          <span style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Natural language interface to local engines
          </span>
        </div>
      </div>

      <div className="card-content" style={{ flexGrow: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "16px" }}>
        {/* Messages Chat box */}
        <div className="chat-history">
          {assistantHistory.map((msg, idx) => (
            <div key={idx} className={`chat-bubble ${msg.role}`} style={{ display: "flex", gap: "10px", width: "100%", maxWidth: "100%" }}>
              <div style={{ flexShrink: 0, marginTop: "2px" }}>
                {msg.role === "assistant" ? (
                  <Bot size={14} className="text-violet" />
                ) : (
                  <User size={14} className="text-cyan" />
                )}
              </div>
              <div style={{ flexGrow: 1 }}>
                {msg.role === "assistant" ? parseMarkdown(msg.content) : msg.content}
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="chat-bubble assistant" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <Loader2 size={14} className="animate-spin text-violet" />
              <span style={{ fontStyle: "italic", color: "var(--text-secondary)" }}>Thinking...</span>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Chat input box */}
        <form onSubmit={handleSendMessage} className="chat-input-area">
          <input
            type="text"
            placeholder="Ask about engine statuses, trigger data compression, or type 'status'..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isThinking}
            className="chat-input"
          />
          <button type="submit" className="btn btn-primary" disabled={isThinking || !inputValue.trim()} style={{ padding: "0 18px" }}>
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
