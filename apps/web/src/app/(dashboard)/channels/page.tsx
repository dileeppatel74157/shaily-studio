"use client";

import React, { useState, useEffect } from "react";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@shaily/ui";
import { getChannels, disconnectChannel, ChannelConnection } from "@/lib/api";
import { Radio, Plus, Trash2, ShieldCheck, HelpCircle, Youtube, Instagram, Film, Video } from "lucide-react";

export default function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const loadChannels = async () => {
    try {
      setIsLoading(true);
      const ch = await getChannels();
      setChannels(ch);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, []);

  const handleConnectYouTube = () => {
    window.location.href = `${API_URL}/api/channels/connect/youtube`;
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect this channel? This will revoke active API tokens.")) return;
    try {
      setActionError(null);
      await disconnectChannel(id);
      setChannels((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      setActionError(err.message || "Failed to disconnect channel.");
    }
  };

  const isYouTubeConnected = channels.some((c) => c.platform === "YOUTUBE");
  const youtubeChannel = channels.find((c) => c.platform === "YOUTUBE");

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-bold tracking-tight text-zinc-100">Publishing Streams</h3>
        <p className="text-zinc-400 text-sm mt-1">
          Link content channels and manage API authorization. Stored tokens are fully encrypted via AES-256-CBC.
        </p>
      </div>

      {actionError && (
        <div className="p-4 rounded-xl border border-rose-900 bg-rose-950/20 text-rose-400 text-xs">
          {actionError}
        </div>
      )}

      {/* Connection Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* YouTube Card */}
        <Card className="bg-zinc-900/30 border-zinc-800 flex flex-col justify-between">
          <CardHeader className="p-6 pb-4 border-b border-zinc-850">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-rose-600/10 text-rose-500 flex items-center justify-center border border-rose-500/10">
                  <Youtube size={22} />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">YouTube Data API</CardTitle>
                  <CardDescription className="text-2xs">Video uploads, playlists</CardDescription>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                  isYouTubeConnected
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-zinc-800 text-zinc-400 border border-zinc-700/50"
                }`}
              >
                {isYouTubeConnected ? "Connected" : "Inactive"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-6">
            <div className="text-xs text-zinc-400 leading-relaxed">
              {isYouTubeConnected && youtubeChannel ? (
                <div className="space-y-3">
                  <div className="bg-zinc-950/50 border border-zinc-850 p-3 rounded-lg font-mono">
                    <div className="text-[10px] text-zinc-550 uppercase font-bold">Display Name</div>
                    <div className="text-zinc-200 mt-0.5 truncate">{youtubeChannel.display_name}</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400/80">
                    <ShieldCheck size={12} />
                    <span>OAuth OAuth2 Token Valid</span>
                  </div>
                </div>
              ) : (
                <p>Integrate your YouTube channels to enable direct uploads, description templates, automated captions, and playlist management.</p>
              )}
            </div>

            {isYouTubeConnected && youtubeChannel ? (
              <Button
                variant="outline"
                className="w-full border-zinc-800 bg-zinc-950 text-rose-400 hover:bg-rose-900/10 hover:text-rose-300 font-medium text-xs h-9 flex items-center justify-center gap-2"
                onClick={() => handleDisconnect(youtubeChannel.id)}
              >
                <Trash2 size={13} />
                <span>Disconnect Channel</span>
              </Button>
            ) : (
              <Button
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs h-9 flex items-center justify-center gap-2"
                onClick={handleConnectYouTube}
              >
                <Plus size={14} />
                <span>Connect YouTube Channel</span>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Instagram Reels Card */}
        <Card className="bg-zinc-900/10 border-zinc-900 opacity-60 flex flex-col justify-between">
          <CardHeader className="p-6 pb-4 border-b border-zinc-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-purple-600/10 text-purple-400 flex items-center justify-center border border-purple-500/10">
                  <Instagram size={22} />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Instagram Reels</CardTitle>
                  <CardDescription className="text-2xs">Social Reels, Carousels</CardDescription>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-850 text-zinc-500 border border-zinc-800">
                Planned
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col justify-between">
            <p className="text-xs text-zinc-500 leading-relaxed">
              Instagram Graph API integration is scheduled for Sprint 3. Enables autonomous short-form Reels and video publishing.
            </p>
            <Button
              disabled
              className="w-full bg-zinc-900 border border-zinc-850 text-zinc-500 font-medium text-xs h-9"
            >
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        {/* TikTok Card */}
        <Card className="bg-zinc-900/10 border-zinc-900 opacity-60 flex flex-col justify-between">
          <CardHeader className="p-6 pb-4 border-b border-zinc-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-teal-600/10 text-teal-400 flex items-center justify-center border border-teal-500/10">
                  <Film size={22} />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">TikTok Creator API</CardTitle>
                  <CardDescription className="text-2xs">Short video posts</CardDescription>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-850 text-zinc-500 border border-zinc-800">
                Planned
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col justify-between">
            <p className="text-xs text-zinc-500 leading-relaxed">
              TikTok Publishing API supports automation workflows for video queues. Scheduled for post-Sprint 3.
            </p>
            <Button
              disabled
              className="w-full bg-zinc-900 border border-zinc-850 text-zinc-500 font-medium text-xs h-9"
            >
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
