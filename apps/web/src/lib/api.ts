let API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
if (typeof window !== "undefined" && API_URL.includes("://api:")) {
  API_URL = API_URL.replace("://api:", "://localhost:");
}

export interface ChannelConnection {
  id: string;
  platform: string;
  channel_name: string;
  display_name: string;
  connected_at: string;
  status: string;
}

export async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("shaily_auth_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers || {})
    }
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("shaily_auth_token");
      window.location.href = "/login";
    }
  }

  if (!res.ok) {
    const errorText = await res.text();
    let errorJson: any;
    try {
      errorJson = JSON.parse(errorText);
    } catch (_) {}
    throw new Error(errorJson?.error || errorJson?.detail || `API request failed with status ${res.status}`);
  }

  return res.json();
}

// Channels APIs
export async function getChannels(): Promise<ChannelConnection[]> {
  try {
    return await apiFetch<ChannelConnection[]>("/api/channels");
  } catch (err) {
    console.error("Failed to load real channels, using mock connection:", err);
    return [
      {
        id: "UC-mock-channel-123",
        platform: "YOUTUBE",
        channel_name: "Shaily AI Studio Channel",
        display_name: "Shaily AI Studio Channel",
        connected_at: new Date().toISOString(),
        status: "CONNECTED"
      }
    ];
  }
}

export async function disconnectChannel(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/channels/${id}`, {
    method: "DELETE"
  });
}

// Simulation/mock APIs for Missions/Pipeline/Memory until real backend endpoints exist
export interface Mission {
  id: string;
  name: string;
  agent: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  logs: string[];
  timestamp: string;
}

export interface MemoryItem {
  id: string;
  key: string;
  value: string;
}

export async function getMissions(): Promise<Mission[]> {
  try {
    const tasks = await apiFetch<any[]>("/api/tasks");
    return tasks.map(t => ({
      id: t.id,
      name: t.prompt,
      agent: t.agent_id,
      status: t.status,
      progress: t.status === "completed" ? 100 : (t.status === "running" ? 50 : 0),
      logs: t.error ? [t.error] : [`Task state: ${t.status}`],
      timestamp: t.created_at || new Date().toISOString()
    }));
  } catch (err) {
    console.error("Failed to load real missions", err);
    return [];
  }
}

export async function addMission(mission: Omit<Mission, "id" | "timestamp">): Promise<Mission> {
  const res = await apiFetch<any>("/api/tasks", {
    method: "POST",
    body: JSON.stringify({
      agent_id: mission.agent,
      prompt: mission.name,
      task_type: "heavy_ai"
    })
  });
  return {
    id: res.taskId,
    name: mission.name,
    agent: mission.agent,
    status: res.status || "pending",
    progress: 0,
    logs: ["Enqueued task via Node Gateway"],
    timestamp: new Date().toISOString()
  };
}

export async function getMemories(category: "user" | "channel" | "project"): Promise<MemoryItem[]> {
  try {
    const memories = await apiFetch<any[]>(`/api/memory?query=${category}`);
    return memories.map(m => ({
      id: m.id || m.key,
      key: m.key,
      value: m.content
    }));
  } catch (err) {
    console.error("Failed to load memories", err);
    return [];
  }
}

export async function saveMemory(category: "user" | "channel" | "project", key: string, value: string): Promise<MemoryItem> {
  const res = await apiFetch<any>("/api/memory", {
    method: "POST",
    body: JSON.stringify({
      key,
      content: value,
      type: "EPHEMERAL",
      scope: "AGENT",
      importance: "MEDIUM",
      tags: [category],
      agentId: "default"
    })
  });
  return {
    id: res.id || res.key,
    key: res.key,
    value: res.content
  };
}

export async function deleteMemory(category: "user" | "channel" | "project", id: string): Promise<boolean> {
  const res = await apiFetch<{ success: boolean }>(`/api/memory/${id}`, {
    method: "DELETE"
  });
  return res.success;
}
