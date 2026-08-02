"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SYSTEM_VERSION } from "@shaily/core/client";
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Radio,
  Workflow,
  Share2,
  BrainCircuit,
  BarChart3,
  Settings,
  FolderKanban
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Command Chat", href: "/chat", icon: MessageSquare },
    { name: "Missions", href: "/missions", icon: FolderKanban },
    { name: "AI Agents", href: "/agents", icon: Bot },
    { name: "Channels", href: "/channels", icon: Radio },
    { name: "Content Pipeline", href: "/pipeline", icon: Workflow },
    { name: "Publishing Center", href: "/publishing", icon: Share2 },
    { name: "Memory System", href: "/memory", icon: BrainCircuit },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    { name: "System Settings", href: "/settings", icon: Settings }
  ];

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col justify-between h-full shrink-0 select-none">
      <div>
        <div className="h-16 flex items-center px-6 border-b border-zinc-800">
          <Link href="/" className="hover:opacity-90">
            <h1 className="text-xl font-bold tracking-tight font-display bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              SHAILY STUDIO
            </h1>
          </Link>
        </div>
        <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-zinc-900 text-white border border-zinc-800"
                    : "text-zinc-400 hover:bg-zinc-900/50 hover:text-white"
                }`}
              >
                <Icon size={18} className={isActive ? "text-violet-400" : ""} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-zinc-800 text-xs text-zinc-500">
        <div className="flex items-center space-x-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>AI Content OS Active</span>
        </div>
        <div className="font-mono text-[10px]">v{SYSTEM_VERSION}</div>
      </div>
    </aside>
  );
}
