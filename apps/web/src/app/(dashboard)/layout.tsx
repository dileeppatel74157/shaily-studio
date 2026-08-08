"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import { usePathname, useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("shaily_auth_token");
    if (!token) {
      router.push("/login");
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  if (isAuthenticated === null) {
    return (
      <div className="flex h-screen bg-black items-center justify-center text-zinc-400 font-sans">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-6 h-6 border-2 border-t-transparent border-violet-500 rounded-full animate-spin"></div>
          <span className="text-xs tracking-wider uppercase font-semibold text-zinc-500 animate-pulse">Checking credentials...</span>
        </div>
      </div>
    );
  }

  const getPageTitle = () => {
    switch (pathname) {
      case "/dashboard":
        return "Overview";
      case "/chat":
        return "Command Chat";
      case "/missions":
        return "Missions Manager";
      case "/agents":
        return "AI Agents";
      case "/channels":
        return "Channels";
      case "/pipeline":
        return "Content Pipeline";
      case "/publishing":
        return "Publishing Center";
      case "/memory":
        return "Memory System";
      case "/analytics":
        return "Analytics Intelligence";
      case "/settings":
        return "System Settings";
      default:
        return "Console";
    }
  };

  return (
    <div className="flex h-screen bg-black overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col bg-zinc-950/50 overflow-y-auto">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-950/30 backdrop-blur-md sticky top-0 z-40">
          <h2 className="text-lg font-semibold tracking-tight">
            {getPageTitle()} View
          </h2>
          <div className="flex items-center space-x-4 text-xs text-zinc-400">
            <span className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>API Gateway: Active</span>
            </span>
          </div>
        </header>
        <main className="p-8 max-w-7xl mx-auto w-full space-y-8 flex-1 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
