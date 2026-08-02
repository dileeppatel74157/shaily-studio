"use client";

import React, { useState } from "react";
import { useChannels, useDisconnectChannel } from "@/hooks/useChannels";
import AddChannelButton from "@/components/channels/AddChannelButton";
import ChannelCard from "@/components/channels/ChannelCard";
import { AlertCircle, Loader2, Radio } from "lucide-react";

export default function ChannelsPage() {
  const { channels, loading, error, refresh } = useChannels();
  const { disconnect, loading: isDisconnecting, error: disconnectError } = useDisconnectChannel(refresh);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDisconnect = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect this channel? This will revoke active API tokens.")) return;
    try {
      setActionError(null);
      await disconnect(id);
    } catch (err: any) {
      setActionError(err.message || "Failed to disconnect channel.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header Command Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-6">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-100">Channels Command Center</h3>
          <p className="text-zinc-400 text-sm mt-1">
            Connect and manage multiple publishing accounts. Stored tokens are encrypted via AES-256-CBC.
          </p>
        </div>
        <div className="self-start sm:self-center shrink-0">
          <AddChannelButton />
        </div>
      </div>

      {/* Errors display */}
      {(error || disconnectError || actionError) && (
        <div className="p-4 rounded-xl border border-rose-900 bg-rose-950/20 text-rose-450 text-xs flex items-start gap-2.5">
          <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
          <div>{error || disconnectError || actionError}</div>
        </div>
      )}

      {/* Connected Channels Grid Section */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-450 mb-6">Connected Channels</h4>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="animate-spin text-violet-400" size={32} />
            <span className="text-zinc-500 text-xs font-medium">Loading connected channels...</span>
          </div>
        ) : channels.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-zinc-850 rounded-2xl flex flex-col items-center justify-center space-y-4">
            <Radio className="text-zinc-650" size={36} />
            <div className="space-y-1">
              <p className="text-zinc-400 font-semibold text-sm">No channels connected</p>
              <p className="text-zinc-550 text-xs">Connect your YouTube accounts to enable autonomous uploads and strategy tracking.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {channels.map((ch) => {
              // Transform database channel to card props format
              const channelProps = {
                id: ch.id,
                provider: ch.platform,
                profile: {
                  channelName: ch.display_name || ch.channel_name || "YouTube Channel",
                  subscriberCount: 1582, // Hardcoded mockup fallback stats
                  videoCount: 24,       // Hardcoded mockup fallback stats
                },
                health: {
                  isHealthy: ch.status === "CONNECTED"
                }
              };

              return (
                <ChannelCard
                  key={ch.id}
                  channel={channelProps}
                  onDisconnect={handleDisconnect}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
