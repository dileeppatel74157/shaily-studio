const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    }
  });

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

// In-memory mocks for demo compatibility
let mockMissions: Mission[] = [
  {
    id: "miss-1",
    name: "Jabalpur History Video",
    agent: "Ideator / Researcher",
    status: "running",
    progress: 65,
    logs: [
      "Initialized search for Jabalpur heritage sites...",
      "Extracted historical notes on Madan Mahal Fort.",
      "Generating narration transcript in Hindi..."
    ],
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString()
  },
  {
    id: "miss-2",
    name: "Ancient India Documentary",
    agent: "Publisher Agent",
    status: "completed",
    progress: 100,
    logs: [
      "Completed visual compilation.",
      "Uploaded draft to YouTube.",
      "Successfully published and indexed video."
    ],
    timestamp: new Date(Date.now() - 1000 * 3600 * 3).toISOString()
  },
  {
    id: "miss-3",
    name: "AI News Channel Weekly",
    agent: "Scriptwriter / Editor",
    status: "pending",
    progress: 0,
    logs: [
      "Enqueued for processing. Waiting for voice segment generation..."
    ],
    timestamp: new Date().toISOString()
  }
];

let mockMemories: Record<string, MemoryItem[]> = {
  user: [
    { id: "u-1", key: "Language", value: "Hindi" },
    { id: "u-2", key: "Style", value: "Documentary" },
    { id: "u-3", key: "Voice Accent", value: "Deep Male" }
  ],
  channel: [
    { id: "c-1", key: "Target Audience", value: "History & culture enthusiasts" },
    { id: "c-2", key: "Preferred Topics", value: "Indian historical events, forts, legends" }
  ],
  project: [
    { id: "p-1", key: "Rendering Resolution", value: "1080p Cinematic" },
    { id: "p-2", key: "Background Soundtrack", value: "Classical Indian Orchestral" }
  ]
};

export async function getMissions(): Promise<Mission[]> {
  return new Promise((resolve) => setTimeout(() => resolve(mockMissions), 150));
}

export async function addMission(mission: Omit<Mission, "id" | "timestamp">): Promise<Mission> {
  const newMission: Mission = {
    ...mission,
    id: `miss-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString()
  };
  mockMissions = [newMission, ...mockMissions];
  return newMission;
}

export async function getMemories(category: "user" | "channel" | "project"): Promise<MemoryItem[]> {
  return new Promise((resolve) => setTimeout(() => resolve(mockMemories[category] || []), 150));
}

export async function saveMemory(category: "user" | "channel" | "project", key: string, value: string): Promise<MemoryItem> {
  const newItem = {
    id: `${category[0]}-${Math.random().toString(36).substr(2, 9)}`,
    key,
    value
  };
  mockMemories[category] = [...mockMemories[category], newItem];
  return newItem;
}

export async function deleteMemory(category: "user" | "channel" | "project", id: string): Promise<boolean> {
  mockMemories[category] = mockMemories[category].filter(item => item.id !== id);
  return true;
}
