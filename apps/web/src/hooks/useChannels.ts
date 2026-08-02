import { useState, useEffect, useCallback } from "react";
import { getChannels, disconnectChannel, ChannelConnection } from "@/lib/api";

export function useChannels() {
  const [channels, setChannels] = useState<ChannelConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getChannels();
      setChannels(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch channels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { channels, loading, error, refresh };
}

export function useDisconnectChannel(refreshCallback?: () => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disconnect = useCallback(async (channelId: string) => {
    try {
      setLoading(true);
      setError(null);
      await disconnectChannel(channelId);
      if (refreshCallback) {
        refreshCallback();
      }
    } catch (err: any) {
      setError(err.message || "Failed to disconnect channel");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshCallback]);

  return { disconnect, loading, error };
}
