import { create } from "zustand";
import { TaskPayload } from "@shaily/shared";

interface StudioState {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  simulatedTasks: TaskPayload[];
  addSimulatedTask: (task: TaskPayload) => void;
  clearTasks: () => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  activeTab: "dashboard",
  setActiveTab: (tab) => set({ activeTab: tab }),
  simulatedTasks: [],
  addSimulatedTask: (task) =>
    set((state) => ({
      simulatedTasks: [task, ...state.simulatedTasks].slice(0, 20),
    })),
  clearTasks: () => set({ simulatedTasks: [] }),
}));
