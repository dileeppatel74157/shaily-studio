"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@shaily/ui";
import { Sparkles, AlertCircle, Lock, User, Terminal } from "lucide-react";

let API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
if (typeof window !== "undefined" && API_URL.includes("://api:")) {
  API_URL = API_URL.replace("://api:", "://localhost:");
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!username || !password) {
      setError("Please fill in all fields.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.token) {
        setError(data.error || data.detail || "Invalid username or password");
        setIsLoading(false);
        return;
      }

      localStorage.setItem("shaily_auth_token", data.token);
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Login connection failure", err);
      setError("Connection to auth server failed. Please ensure the backend is running.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl -z-10"></div>

      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-zinc-900 border border-zinc-800 mb-2">
            <Sparkles className="w-8 h-8 text-violet-500" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-100 via-zinc-300 to-zinc-500 bg-clip-text text-transparent font-display">
            Shaily Studio
          </h1>
          <p className="text-sm text-zinc-400">
            AI Content Command Center
          </p>
        </div>

        <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-md">
          <CardHeader className="p-6 border-b border-zinc-850">
            <CardTitle className="text-lg flex items-center space-x-2 text-zinc-200">
              <Terminal size={18} className="text-violet-400" />
              <span>Console Access</span>
            </CardTitle>
            <CardDescription className="text-xs text-zinc-450">
              Authenticate to connect your personal AI content engines.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg border border-rose-950 bg-rose-950/20 text-rose-400 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-2xs text-zinc-450 font-bold uppercase tracking-wider block">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter admin username"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-3 py-2 text-sm text-zinc-350 focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder-zinc-600"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-2xs text-zinc-450 font-bold uppercase tracking-wider block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-3 py-2 text-sm text-zinc-350 focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder-zinc-600"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs flex items-center justify-center gap-2 h-10 rounded-lg px-6 transition-colors duration-150"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
