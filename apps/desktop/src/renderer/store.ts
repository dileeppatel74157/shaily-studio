import { create } from "zustand";

export interface LogItem {
  timestamp: string;
  message: string;
  type: "info" | "success" | "warn" | "error";
  category: string;
}

export interface NotificationItem {
  id: string;
  type: "success" | "warn" | "error" | "info";
  title: string;
  message: string;
  time: string;
}

export interface SystemResourceTick {
  cpu: number;
  ram: number;
  gpu: number;
  vram: number;
  disk: number;
  network: number;
  timestamp: string;
}

interface DesktopStore {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  
  // Settings
  theme: string;
  panelLayout: string;
  activeProject: string;
  selectedWorkspace: string;
  setTheme: (theme: string) => void;
  setPanelLayout: (layout: string) => void;
  setActiveProject: (proj: string) => void;
  setSelectedWorkspace: (workspace: string) => void;
  updateSettings: (settings: Partial<any>) => void;

  // Connection
  backendConnected: boolean;
  liveMode: boolean;
  setConnectionStatus: (connected: boolean, live: boolean) => void;

  // System Resource History (for sparklines)
  resourceHistory: SystemResourceTick[];
  addResourceTick: (tick: SystemResourceTick) => void;

  // Engine Health states
  engineHealth: Record<string, "online" | "offline" | "initializing">;
  updateEngineHealth: (engine: string, status: "online" | "offline" | "initializing") => void;

  // Active Pipeline state
  pipelineName: string;
  isPipelineRunning: boolean;
  currentStageId: string;
  completedStages: string[];
  failedStages: string[];
  stageDurations: Record<string, string>;
  stageErrors: Record<string, string>;
  recoveryHistory: string[];
  pipelineProgress: number;
  startPipeline: (name: string) => void;
  setStageActive: (stageId: string, name: string) => void;
  setStageComplete: (stageId: string, duration: string) => void;
  setStageFailed: (stageId: string, error: string) => void;
  resetPipeline: () => void;

  // Logs list
  logs: LogItem[];
  addLog: (log: LogItem) => void;
  clearLogs: () => void;

  // Notifications
  notifications: NotificationItem[];
  toasts: NotificationItem[];
  addNotification: (notif: NotificationItem) => void;
  removeToast: (id: string) => void;

  // Chat Assistant
  assistantHistory: Array<{ role: "user" | "assistant"; content: string }>;
  addChatMessage: (role: "user" | "assistant", content: string) => void;
}

export const useDesktopStore = create<DesktopStore>((set) => ({
  activeTab: "dashboard",
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Settings
  theme: "dark",
  panelLayout: "default",
  activeProject: "Default Video Project",
  selectedWorkspace: "",
  setTheme: (theme) => set({ theme }),
  setPanelLayout: (panelLayout) => set({ panelLayout }),
  setActiveProject: (activeProject) => set({ activeProject }),
  setSelectedWorkspace: (selectedWorkspace) => set({ selectedWorkspace }),
  updateSettings: (settings) => set((state) => ({ ...state, ...settings })),

  // Connection
  backendConnected: false,
  liveMode: false,
  setConnectionStatus: (backendConnected, liveMode) => set({ backendConnected, liveMode }),

  // Resources
  resourceHistory: [],
  addResourceTick: (tick) =>
    set((state) => {
      const history = [...state.resourceHistory, tick];
      if (history.length > 25) history.shift(); // Keep last 25 ticks
      return { resourceHistory: history };
    }),

  // Engine health initialization
  engineHealth: {
    RuntimeEngine: "online",
    WorkspaceEngine: "online",
    AssistantEngine: "online",
    PipelineEngine: "online",
    TaskSchedulerEngine: "online",
    KnowledgeBaseEngine: "online",
    MemoryEngine: "online",
  },
  updateEngineHealth: (engine, status) =>
    set((state) => ({
      engineHealth: { ...state.engineHealth, [engine]: status },
    })),

  // Pipeline Execution states
  pipelineName: "",
  isPipelineRunning: false,
  currentStageId: "",
  completedStages: [],
  failedStages: [],
  stageDurations: {},
  stageErrors: {},
  recoveryHistory: [],
  pipelineProgress: 0,

  startPipeline: (name) =>
    set({
      pipelineName: name,
      isPipelineRunning: true,
      currentStageId: "",
      completedStages: [],
      failedStages: [],
      stageDurations: {},
      stageErrors: {},
      recoveryHistory: [],
      pipelineProgress: 0,
    }),

  setStageActive: (stageId, name) =>
    set((state) => {
      const totalStages = 13;
      const index = [
        "research",
        "strategy",
        "channel",
        "script",
        "production",
        "generation",
        "composition",
        "rendering",
        "quality",
        "publishing",
        "analytics",
        "learning",
        "optimization",
      ].indexOf(stageId);
      const progress = index !== -1 ? Math.round(((index + 0.5) / totalStages) * 100) : state.pipelineProgress;
      
      return {
        currentStageId: stageId,
        pipelineProgress: progress,
      };
    }),

  setStageComplete: (stageId, duration) =>
    set((state) => {
      const totalStages = 13;
      const index = [
        "research",
        "strategy",
        "channel",
        "script",
        "production",
        "generation",
        "composition",
        "rendering",
        "quality",
        "publishing",
        "analytics",
        "learning",
        "optimization",
      ].indexOf(stageId);
      const progress = index !== -1 ? Math.round(((index + 1) / totalStages) * 100) : state.pipelineProgress;

      return {
        completedStages: [...state.completedStages, stageId],
        stageDurations: { ...state.stageDurations, [stageId]: duration },
        pipelineProgress: progress,
      };
    }),

  setStageFailed: (stageId, error) =>
    set((state) => ({
      failedStages: [...state.failedStages, stageId],
      stageErrors: { ...state.stageErrors, [stageId]: error },
      recoveryHistory: [...state.recoveryHistory, `Recovering from failure at stage: ${stageId}. Initiating retry...`],
    })),

  resetPipeline: () =>
    set({
      isPipelineRunning: false,
      currentStageId: "",
      pipelineProgress: 0,
    }),

  // Logs list
  logs: [],
  addLog: (log) =>
    set((state) => {
      const newLogs = [...state.logs, log];
      if (newLogs.length > 250) newLogs.shift();
      return { logs: newLogs };
    }),
  clearLogs: () => set({ logs: [] }),

  // Notifications
  notifications: [],
  toasts: [],
  addNotification: (notif) =>
    set((state) => {
      // Add to full list
      const notifications = [notif, ...state.notifications].slice(0, 50);
      // Add to active toast bubbles
      const toasts = [...state.toasts, notif];
      return { notifications, toasts };
    }),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  // Chat history
  assistantHistory: [
    {
      role: "assistant",
      content: "Hello! I am your AI assistant. How can I help you operate Shaily Studio today?",
    },
  ],
  addChatMessage: (role, content) =>
    set((state) => ({
      assistantHistory: [...state.assistantHistory, { role, content }],
    })),
}));
