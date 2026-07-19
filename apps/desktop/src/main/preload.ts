import { contextBridge, ipcRenderer } from "electron";

// Safe, structured communication bridge
const electronAPI = {
  send: (channel: string, data?: any) => {
    // Whitelist channels to prevent arbitrary command execution
    const validChannels = [
      "save-window-state",
      "save-layout-settings",
      "export-logs",
      "trigger-pipeline",
      "stop-pipeline",
      "send-assistant-msg",
      "open-workspace-folder",
      "set-active-project",
      "restart-runtime"
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    const validChannels = [
      "runtime-event",
      "system-resources",
      "log-stream",
      "notification-stream",
      "assistant-response",
      "workspace-updated",
      "engine-health-updated",
      "reconnect-status"
    ];
    if (validChannels.includes(channel)) {
      // Strip the event argument to avoid leaks
      const subscription = (_event: any, ...args: any[]) => callback(null, ...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
    return () => {};
  },
  invoke: (channel: string, data?: any) => {
    const validChannels = [
      "get-initial-state",
      "get-logs",
      "get-system-resources",
      "get-workspace",
      "get-knowledge-base",
      "get-memory-optimization",
      "ask-assistant",
      "select-directory"
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Invalid IPC channel: ${channel}`));
  }
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
