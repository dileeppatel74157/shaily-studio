"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@shaily/ui";
import { addMission } from "@/lib/api";
import { Send, Bot, User, CheckCircle2, XCircle, RefreshCw, Compass } from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  plan?: {
    title: string;
    steps: Array<{ id: string; name: string; status: "pending" | "approved" | "rejected" }>;
  };
}

export default function CommandChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m-init",
      sender: "bot",
      text: "Hello! I am your AI Command Assistant. Provide a high-level command to execute content creation pipelines. (e.g. 'Create a documentary video about Jabalpur history and upload to YouTube')"
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: input
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsTyping(true);

    // Simulate SSE token stream or plan construction
    setTimeout(() => {
      setIsTyping(false);
      
      const botResponse: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: "bot",
        text: `I have constructed a workflow plan to process your request: "${currentInput}". Please review the required agent actions and approve to initiate.`,
        plan: {
          title: "Autonomous Content Workflow Plan",
          steps: [
            { id: "step-1", name: "Research historical archives on Jabalpur Forts", status: "pending" },
            { id: "step-2", name: "Write narration voiceover script in Hindi", status: "pending" },
            { id: "step-3", name: "Compile cinematic media slides using Image Generation", status: "pending" },
            { id: "step-4", name: "Publish final video to YouTube channel", status: "pending" }
          ]
        }
      };

      setMessages((prev) => [...prev, botResponse]);
    }, 1500);
  };

  const handleStepAction = async (messageId: string, stepId: string, action: "approve" | "reject") => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId && msg.plan) {
          return {
            ...msg,
            plan: {
              ...msg.plan,
              steps: msg.plan.steps.map((st) =>
                st.id === stepId ? { ...st, status: action === "approve" ? "approved" : "rejected" } : st
              )
            }
          };
        }
        return msg;
      })
    );

    // Find the message and check if all steps are approved
    const targetMsg = messages.find(m => m.id === messageId);
    if (targetMsg && targetMsg.plan && action === "approve") {
      const step = targetMsg.plan.steps.find(st => st.id === stepId);
      if (step) {
        // Trigger a background task simulation
        try {
          await addMission({
            name: `${step.name} (Pipeline Task)`,
            agent: "Autonomous Agent Flow",
            status: "running",
            progress: 25,
            logs: [`Initiated approved step: ${step.name}`]
          });
        } catch (err) {
          console.error(err);
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] space-y-6">
      {/* Scrollable Viewport */}
      <div className="flex-1 overflow-y-auto border border-zinc-800 bg-zinc-950/20 rounded-2xl p-6 space-y-6 min-h-[300px]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-4 max-w-3xl ${
              msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                msg.sender === "user"
                  ? "bg-zinc-800 text-zinc-300"
                  : "bg-violet-600/20 text-violet-400 border border-violet-500/20"
              }`}
            >
              {msg.sender === "user" ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className="space-y-4">
              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-zinc-900 text-zinc-200 border border-zinc-800"
                    : "bg-zinc-950 text-zinc-350 border border-zinc-900"
                }`}
              >
                {msg.text}
              </div>

              {/* Approval Plan Widget */}
              {msg.plan && (
                <Card className="bg-zinc-950 border-zinc-850 shadow-lg">
                  <CardHeader className="p-4 border-b border-zinc-850">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Compass size={14} className="text-violet-400" />
                      {msg.plan.title}
                    </CardTitle>
                    <CardDescription className="text-2xs">
                      Human-in-the-loop verification required before agent execution.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {msg.plan.steps.map((step) => (
                      <div
                        key={step.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-zinc-900 bg-zinc-900/10 text-xs"
                      >
                        <span className="font-medium text-zinc-350">{step.name}</span>
                        <div className="flex items-center space-x-2">
                          {step.status === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-800/50 hover:bg-emerald-900/20 hover:text-emerald-400 bg-zinc-900/50 text-zinc-400"
                                onClick={() => handleStepAction(msg.id, step.id, "approve")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-rose-800/50 hover:bg-rose-900/20 hover:text-rose-400 bg-zinc-900/50 text-zinc-400"
                                onClick={() => handleStepAction(msg.id, step.id, "reject")}
                              >
                                Reject
                              </Button>
                            </>
                          ) : step.status === "approved" ? (
                            <span className="text-2xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                              <CheckCircle2 size={10} /> Approved
                            </span>
                          ) : (
                            <span className="text-2xs bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                              <XCircle size={10} /> Rejected
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-start gap-4 max-w-3xl mr-auto">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-violet-600/20 text-violet-400 border border-violet-500/20 animate-pulse">
              <Bot size={16} />
            </div>
            <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-2xl text-xs flex items-center space-x-2 text-zinc-500">
              <RefreshCw size={12} className="animate-spin text-violet-400" />
              <span>Analyzing requirements and drafting workflow plan...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSubmit} className="flex gap-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI Command Center to build, generate, or publish content..."
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <Button
          type="submit"
          className="bg-violet-600 hover:bg-violet-500 text-white px-5 rounded-xl flex items-center gap-2 h-12"
          disabled={isTyping || !input.trim()}
        >
          <Send size={16} />
          <span>Execute</span>
        </Button>
      </form>
    </div>
  );
}
