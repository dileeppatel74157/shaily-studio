"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@shaily/ui";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3, TrendingUp, Users, Eye, Sparkles } from "lucide-react";

const chartData = [
  { day: "Mon", views: 2400, subscribers: 12 },
  { day: "Tue", views: 1398, subscribers: 8 },
  { day: "Wed", views: 9800, subscribers: 35 },
  { day: "Thu", views: 3908, subscribers: 18 },
  { day: "Fri", views: 4800, subscribers: 22 },
  { day: "Sat", views: 3800, subscribers: 15 },
  { day: "Sun", views: 11200, subscribers: 48 }
];

export default function AnalyticsIntelligence() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-bold tracking-tight text-zinc-100">Analytics & Insights</h3>
        <p className="text-zinc-400 text-sm mt-1">
          Review subscriber growth, channel metrics, and AI optimization suggestions.
        </p>
      </div>

      {/* Stats Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-zinc-900/30 border-zinc-850">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-3xs text-zinc-450 font-bold uppercase tracking-wider block">Total Views</span>
              <span className="text-xl font-bold font-mono">37,306</span>
              <span className="text-2xs text-emerald-400 flex items-center gap-1"><TrendingUp size={10} /> +18.4% this week</span>
            </div>
            <Eye className="text-violet-400" size={24} />
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/30 border-zinc-850">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-3xs text-zinc-450 font-bold uppercase tracking-wider block">Total Subscribers</span>
              <span className="text-xl font-bold font-mono">1,582</span>
              <span className="text-2xs text-emerald-400 flex items-center gap-1"><TrendingUp size={10} /> +8.2% this week</span>
            </div>
            <Users className="text-violet-400" size={24} />
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/30 border-zinc-850">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-3xs text-zinc-450 font-bold uppercase tracking-wider block">Avg. Video Retention</span>
              <span className="text-xl font-bold font-mono">68.5%</span>
              <span className="text-2xs text-emerald-400 flex items-center gap-1"><TrendingUp size={10} /> +2.1% this week</span>
            </div>
            <BarChart3 className="text-violet-400" size={24} />
          </CardContent>
        </Card>
      </div>

      {/* Main Chart and Recommendation Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Performance Chart */}
        <div className="lg:col-span-2">
          <Card className="bg-zinc-900/30 border-zinc-800 h-full">
            <CardHeader className="p-6 border-b border-zinc-850">
              <CardTitle className="text-sm font-semibold">Channel Views Growth</CardTitle>
              <CardDescription className="text-2xs">Daily performance timeline</CardDescription>
            </CardHeader>
            <CardContent className="p-6 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="#52525b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "8px" }}
                    labelStyle={{ color: "#a1a1aa", fontSize: "10px", fontWeight: "bold" }}
                    itemStyle={{ color: "#e4e4e7", fontSize: "12px" }}
                  />
                  <Area type="monotone" dataKey="views" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorViews)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* AI Recommendations Panel */}
        <div>
          <Card className="bg-zinc-900/30 border-zinc-800 h-full flex flex-col justify-between">
            <CardHeader className="p-6 border-b border-zinc-850">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles size={16} className="text-violet-400" />
                <span>AI Insights & Strategy</span>
              </CardTitle>
              <CardDescription className="text-2xs">Autonomous performance recommendations</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="p-4 rounded-xl border border-zinc-850 bg-zinc-950/40 space-y-2">
                <span className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Insight</span>
                <p className="text-xs text-zinc-350 leading-relaxed font-semibold">
                  Your historical documentary content performs 40% better than average.
                </p>
                <p className="text-2xs text-zinc-500">
                  Viewer retention peaks on Indian history topics.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-zinc-850 bg-zinc-950/40 space-y-2">
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Recommendation</span>
                <p className="text-xs text-zinc-350 leading-relaxed font-semibold">
                  Schedule more Maratha history and ancient fort documentaries.
                </p>
                <p className="text-2xs text-zinc-500">
                  Target upload times: Sunday 6:00 PM (highest engagement).
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
