"use client";

import React from "react";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@shaily/ui";
import { Youtube, Trash2, ShieldCheck, Sparkles } from "lucide-react";

interface ChannelCardProps {
  channel: {
    id: string;
    provider: string;
    profile: {
      channelName: string;
      avatarUrl?: string;
      subscriberCount: number;
      videoCount: number;
    };
    health: {
      isHealthy: boolean;
    };
  };
  onDisconnect: (id: string) => void;
}

export default function ChannelCard({ channel, onDisconnect }: ChannelCardProps) {
  return (
    <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm flex flex-col justify-between overflow-hidden">
      <CardHeader className="p-6 pb-4 border-b border-zinc-850 bg-zinc-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-rose-600/10 text-rose-500 flex items-center justify-center border border-rose-500/10">
              <Youtube size={22} />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold truncate max-w-[140px]">
                {channel.profile.channelName}
              </CardTitle>
              <CardDescription className="text-3xs font-mono truncate max-w-[140px]">
                ID: {channel.id}
              </CardDescription>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
              channel.health.isHealthy
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse"
            }`}
          >
            {channel.health.isHealthy ? "Healthy" : "Attention"}
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6 flex-1 flex flex-col justify-between">
        {/* Profile Statistics */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="bg-zinc-950/40 border border-zinc-850 p-2.5 rounded-lg">
            <span className="text-[10px] text-zinc-550 uppercase font-bold tracking-wider block">Subscribers</span>
            <span className="text-sm font-bold font-mono text-zinc-200 mt-0.5">
              {channel.profile.subscriberCount.toLocaleString()}
            </span>
          </div>
          <div className="bg-zinc-950/40 border border-zinc-850 p-2.5 rounded-lg">
            <span className="text-[10px] text-zinc-550 uppercase font-bold tracking-wider block">Videos</span>
            <span className="text-sm font-bold font-mono text-zinc-200 mt-0.5">
              {channel.profile.videoCount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Channel Intelligence (Preview Fields for Analytics Engine) */}
        <div className="bg-zinc-950/60 border border-zinc-850 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-900 pb-1.5 mb-1.5">
            <Sparkles size={11} className="text-violet-400" />
            <span>Channel Intelligence</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] text-zinc-450 leading-relaxed">
            <div>
              <span className="text-zinc-550 font-medium">Uploads:</span> <span className="font-mono text-zinc-350">0</span>
            </div>
            <div>
              <span className="text-zinc-550 font-medium">Views:</span> <span className="font-mono text-zinc-350">0</span>
            </div>
            <div>
              <span className="text-zinc-550 font-medium">Weekly Growth:</span> <span className="font-mono text-zinc-350">-</span>
            </div>
            <div className="col-span-2">
              <span className="text-zinc-550 font-medium">AI Strategy:</span> <span className="text-zinc-400">Not generated yet</span>
            </div>
          </div>
        </div>

        {/* OAuth Validity & Disconnect Option */}
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400/80">
            <ShieldCheck size={12} />
            <span>OAuth Token Active & Valid</span>
          </div>

          <Button
            variant="outline"
            className="w-full border-zinc-800 bg-zinc-950 text-rose-400 hover:bg-rose-900/10 hover:text-rose-300 font-medium text-xs h-9 flex items-center justify-center gap-2 rounded-lg cursor-pointer"
            onClick={() => onDisconnect(channel.id)}
          >
            <Trash2 size={13} />
            <span>Disconnect Channel</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
