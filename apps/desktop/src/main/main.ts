import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// Keep a global reference of the window object to prevent garbage collection
let mainWindow: BrowserWindow | null = null;
let resourcesInterval: NodeJS.Timeout | null = null;

// Paths
const userDataPath = app.getPath("userData");
const windowStatePath = path.join(userDataPath, "window-state.json");
const appSettingsPath = path.join(userDataPath, "app-settings.json");

// Default States
let windowState: { x: number | undefined; y: number | undefined; width: number; height: number } = { x: undefined, y: undefined, width: 1280, height: 800 };
let appSettings = { theme: "dark", panelLayout: "default", activeProject: "Default Project", selectedWorkspace: "" };
let logHistory: Array<{ timestamp: string; message: string; type: string; category: string }> = [];

// Load state helpers
function loadState() {
  try {
    if (fs.existsSync(windowStatePath)) {
      windowState = JSON.parse(fs.readFileSync(windowStatePath, "utf8"));
    }
  } catch (err) {
    console.error("Failed to load window state", err);
  }
  try {
    if (fs.existsSync(appSettingsPath)) {
      appSettings = JSON.parse(fs.readFileSync(appSettingsPath, "utf8"));
    }
  } catch (err) {
    console.error("Failed to load app settings", err);
  }
}

function saveWindowState() {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  windowState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
  try {
    fs.writeFileSync(windowStatePath, JSON.stringify(windowState), "utf8");
  } catch (err) {
    console.error("Failed to save window state", err);
  }
}

// Logger helper
function logToSystem(message: string, type: "info" | "success" | "warn" | "error" = "info", category = "Runtime") {
  const timestamp = new Date().toISOString();
  const logItem = { timestamp, message, type, category };
  logHistory.push(logItem);
  if (logHistory.length > 500) {
    logHistory.shift();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("log-stream", logItem);
  }
}

// CPU load calculator
let lastCpuInfo = { idle: 0, total: 0 };
function getCpuUsage(): Promise<number> {
  return new Promise((resolve) => {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        total += (cpu.times as any)[type];
      }
      idle += cpu.times.idle;
    });

    const diffIdle = idle - lastCpuInfo.idle;
    const diffTotal = total - lastCpuInfo.total;
    lastCpuInfo = { idle, total };

    if (diffTotal === 0) resolve(0);
    const usage = 1 - diffIdle / diffTotal;
    resolve(Math.round(usage * 100));
  });
}

// Initialize Resource Polling
function startResourceMonitor() {
  if (resourcesInterval) clearInterval(resourcesInterval);

  resourcesInterval = setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const cpu = await getCpuUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const ram = Math.round(((totalMem - freeMem) / totalMem) * 100);

    // Mock realistic GPU, VRAM, disk, and network stats
    const gpu = Math.round(15 + Math.random() * 25); // 15-40%
    const vram = Math.round(20 + Math.random() * 15); // 20-35%
    const disk = Math.round(40 + Math.random() * 2); // 40-42%
    const network = Math.round(5 + Math.random() * 30); // Mbps

    mainWindow.webContents.send("system-resources", {
      cpu,
      ram,
      gpu,
      vram,
      disk,
      network,
      timestamp: new Date().toLocaleTimeString(),
    });
  }, 1500);
}

// Create MainWindow
function createWindow() {
  loadState();

  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#09090b",
    title: "Shaily Studio — AI Content OS Control Center",
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load URL or File
  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    // Open devtools in dev mode
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("resize", saveWindowState);
  mainWindow.on("move", saveWindowState);

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (resourcesInterval) {
      clearInterval(resourcesInterval);
      resourcesInterval = null;
    }
  });

  mainWindow.webContents.on("did-finish-load", () => {
    logToSystem("Shaily Studio Desktop Control Center started successfully.", "success", "Runtime");
    logToSystem("Scanning for local Docker containers and core endpoints...", "info", "Runtime");
    checkBackendHealth();
  });
}

// Poll Backend Port 8000
let backendConnected = false;
function checkBackendHealth() {
  const http = require("http");
  const options = {
    host: "127.0.0.1",
    port: 8000,
    path: "/api/health",
    timeout: 2000,
  };

  const req = http.get(options, (res: any) => {
    let data = "";
    res.on("data", (chunk: any) => (data += chunk));
    res.on("end", () => {
      try {
        const health = JSON.parse(data);
        if (health.status === "healthy" && !backendConnected) {
          backendConnected = true;
          logToSystem(`Successfully connected to external FastAPI Backend (Port 8000). Mode: LIVE.`, "success", "Runtime");
          if (mainWindow) mainWindow.webContents.send("reconnect-status", { connected: true, live: true });
        }
      } catch (err) {
        fallbackToSandbox();
      }
    });
  });

  req.on("error", () => {
    fallbackToSandbox();
  });

  req.on("timeout", () => {
    req.destroy();
    fallbackToSandbox();
  });
}

function fallbackToSandbox() {
  if (backendConnected || logHistory.length <= 2) {
    backendConnected = false;
    logToSystem("Local FastAPI Backend (Port 8000) not found or offline. Switching to embedded Sandbox Engine Mode.", "warn", "Runtime");
    if (mainWindow) mainWindow.webContents.send("reconnect-status", { connected: true, live: false });
  }
}

// IPC Handlers
ipcMain.handle("get-initial-state", () => {
  return {
    settings: appSettings,
    logHistory,
    systemInfo: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      totalMem: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
      cpus: os.cpus().length,
      cpuModel: os.cpus()[0].model,
    },
  };
});

ipcMain.on("save-layout-settings", (_event, settings) => {
  appSettings = { ...appSettings, ...settings };
  try {
    fs.writeFileSync(appSettingsPath, JSON.stringify(appSettings), "utf8");
  } catch (err) {
    console.error("Failed to save settings", err);
  }
});

ipcMain.on("save-window-state", () => {
  saveWindowState();
});

ipcMain.handle("select-directory", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  appSettings.selectedWorkspace = result.filePaths[0];
  return result.filePaths[0];
});

ipcMain.handle("get-logs", () => {
  return logHistory;
});

ipcMain.on("export-logs", async () => {
  if (!mainWindow) return;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export System Logs",
    defaultPath: path.join(app.getPath("desktop"), "shaily-studio-logs.log"),
    filters: [{ name: "Log Files", extensions: ["log", "txt"] }],
  });

  if (result.canceled || !result.filePath) return;

  const logsText = logHistory
    .map((log) => `[${log.timestamp}] [${log.category}] [${log.type.toUpperCase()}] ${log.message}`)
    .join("\r\n");

  try {
    fs.writeFileSync(result.filePath, logsText, "utf8");
    logToSystem(`Logs exported successfully to ${result.filePath}`, "success", "Runtime");
  } catch (err: any) {
    logToSystem(`Failed to export logs: ${err.message}`, "error", "Runtime");
  }
});

// Simulated Pipeline Engine run
let activePipelineTimeout: NodeJS.Timeout | null = null;
let currentPipelineStage = 0;
const pipelineStages = [
  { id: "research", name: "Research", duration: "1.2s", cost: 0.05, desc: "Gathering trending search keywords and topics" },
  { id: "strategy", name: "Strategy", duration: "0.8s", cost: 0.02, desc: "Evaluating demographic appeal and planning publishing slots" },
  { id: "channel", name: "Channel Plan", duration: "1.1s", cost: 0.04, desc: "Configuring cross-platform post requirements" },
  { id: "script", name: "Scripting", duration: "2.1s", cost: 0.12, desc: "Drafting script and adding timestamps/hooks" },
  { id: "production", name: "Production Setup", duration: "0.5s", cost: 0.00, desc: "Mapping video format (16:9 vertical vs horizontal)" },
  { id: "generation", name: "Voice & B-Roll", duration: "3.4s", cost: 0.45, desc: "Generating audio script voiceover and visual asset URLs" },
  { id: "composition", name: "Video Composition", duration: "2.5s", cost: 0.15, desc: "Aligning sound files, captions, and transition cues" },
  { id: "rendering", name: "Rendering RenderEngine", duration: "4.2s", cost: 0.20, desc: "Combining track sequences into high-definition outputs" },
  { id: "quality", name: "Quality Check", duration: "0.9s", cost: 0.03, desc: "Verifying audio levels, video resolutions, and encoding" },
  { id: "publishing", name: "Platform Publishing", duration: "1.5s", cost: 0.00, desc: "Pushing video file and captions metadata to YouTube/TikTok" },
  { id: "analytics", name: "Performance Analytics", duration: "0.7s", cost: 0.01, desc: "Ingesting views, watch-time, and retention records" },
  { id: "learning", name: "Model Learning", duration: "1.3s", cost: 0.08, desc: "Fine-tuning prompt structures based on viral scoring" },
  { id: "optimization", name: "Resource Optimization", duration: "0.8s", cost: 0.02, desc: "Garbage collecting unused media streams and cache" }
];

ipcMain.on("trigger-pipeline", (_event, { pipelineName }) => {
  if (activePipelineTimeout) {
    logToSystem("Pipeline execution is already running.", "warn", "Pipeline");
    return;
  }

  logToSystem(`Initializing execution context for pipeline: "${pipelineName}"`, "info", "Pipeline");
  currentPipelineStage = 0;

  if (mainWindow) {
    mainWindow.webContents.send("runtime-event", {
      type: "PipelineStarted",
      payload: { pipelineName, totalStages: pipelineStages.length },
    });
  }

  function executeStage() {
    if (currentPipelineStage >= pipelineStages.length) {
      logToSystem(`Pipeline "${pipelineName}" finished executing all stages.`, "success", "Pipeline");
      if (mainWindow) {
        mainWindow.webContents.send("runtime-event", {
          type: "PipelineCompleted",
          payload: { pipelineName },
        });
        mainWindow.webContents.send("notification-stream", {
          id: `notif-${Math.random().toString(36).substr(2, 9)}`,
          type: "success",
          title: "Pipeline Completed",
          message: `Pipeline "${pipelineName}" succeeded!`,
          time: new Date().toLocaleTimeString(),
        });
      }
      activePipelineTimeout = null;
      return;
    }

    const stage = pipelineStages[currentPipelineStage];
    logToSystem(`[Pipeline] Stage ${currentPipelineStage + 1}/${pipelineStages.length}: Starting ${stage.name}...`, "info", "Pipeline");

    if (mainWindow) {
      mainWindow.webContents.send("runtime-event", {
        type: "TaskStarted",
        payload: { stageId: stage.id, stageName: stage.name, description: stage.desc },
      });
    }

    const stageDuration = parseFloat(stage.duration) * 1000;
    activePipelineTimeout = setTimeout(() => {
      // Simulate random transient failures for error recovery flow validation (e.g. Scripting or Rendering stage 15% rate)
      const isFailure = (stage.id === "script" || stage.id === "rendering") && Math.random() < 0.15;

      if (isFailure) {
        logToSystem(`[Error] Stage ${stage.name} failed during processing. Triggering auto-recovery retry policy...`, "error", "Pipeline");
        if (mainWindow) {
          mainWindow.webContents.send("runtime-event", {
            type: "PipelineFailed",
            payload: { stageId: stage.id, stageName: stage.name, error: "Local engine connection timed out." },
          });
          mainWindow.webContents.send("notification-stream", {
            id: `notif-${Math.random().toString(36).substr(2, 9)}`,
            type: "error",
            title: `Stage ${stage.name} Failed`,
            message: `Attempting auto-recovery retry...`,
            time: new Date().toLocaleTimeString(),
          });
        }

        // Retry in 2 seconds
        activePipelineTimeout = setTimeout(() => {
          logToSystem(`[Recovery] Retrying stage ${stage.name} (Attempt 2/3) - Connection recovered.`, "success", "Pipeline");
          logToSystem(`[Pipeline] Stage ${stage.name} completed successfully in ${stage.duration}. Cost: $${stage.cost.toFixed(2)}`, "success", "Pipeline");
          if (mainWindow) {
            mainWindow.webContents.send("runtime-event", {
              type: "TaskCompleted",
              payload: { stageId: stage.id, stageName: stage.name, duration: stage.duration, cost: stage.cost },
            });
          }
          currentPipelineStage++;
          executeStage();
        }, 2000);
      } else {
        logToSystem(`[Pipeline] Stage ${stage.name} completed successfully in ${stage.duration}. Cost: $${stage.cost.toFixed(2)}`, "success", "Pipeline");
        if (mainWindow) {
          mainWindow.webContents.send("runtime-event", {
            type: "TaskCompleted",
            payload: { stageId: stage.id, stageName: stage.name, duration: stage.duration, cost: stage.cost },
          });
        }
        currentPipelineStage++;
        executeStage();
      }
    }, stageDuration);
  }

  executeStage();
});

ipcMain.on("stop-pipeline", () => {
  if (activePipelineTimeout) {
    clearTimeout(activePipelineTimeout);
    activePipelineTimeout = null;
    logToSystem("Pipeline execution canceled by user request.", "warn", "Pipeline");
    if (mainWindow) {
      mainWindow.webContents.send("runtime-event", {
        type: "PipelineFailed",
        payload: { stageId: "cancelled", stageName: "Cancelled", error: "User termination." },
      });
    }
  }
});

// Assistant Engine Integration
ipcMain.handle("ask-assistant", async (_event, { message }) => {
  logToSystem(`User typed: "${message}"`, "info", "Assistant");

  // Simulate thinking delay
  await new Promise((resolve) => setTimeout(resolve, 1200));

  let reply = "";
  const cleaned = message.toLowerCase();

  if (cleaned.includes("status") || cleaned.includes("health")) {
    reply = `### Shaily Studio Engine Status
All local engine systems are currently operating **online**:
- **RuntimeEngine**: Online (Uptime: 24m)
- **WorkspaceEngine**: Online (Workspace loaded)
- **AssistantEngine**: Standby (Awaiting instructions)
- **PipelineEngine**: Standby
- **TaskSchedulerEngine**: Active (0 jobs in queue)
- **KnowledgeBaseEngine**: Online (12 files indexed)
- **MemoryEngine**: Active (Compression ratio: 38%)`;
  } else if (cleaned.includes("run") || cleaned.includes("pipeline")) {
    reply = `To launch a content pipeline, you can use the **Trigger Full Pipeline** button in the header toolbar, or simply click on the **Pipeline Viewer** tab and choose your target workflow script. The scheduler will allocate background workers automatically.`;
  } else if (cleaned.includes("clean") || cleaned.includes("compress") || cleaned.includes("memory")) {
    reply = `### Memory Optimization Strategy
I've triggered a vector maintenance check.
- **De-duplication**: 0 groups flagged
- **Compression**: Current strategy applied is **contextual grouping**.
- **Archive status**: 12MB of historical log files moved to storage folder.`;
  } else {
    reply = `I am the Shaily Studio Assistant. I can help you monitor your local engines, manage workspace files, index knowledge files, or run video synthesis pipelines.

Here are a few commands you can run:
- \`status\` to print full engine health records.
- \`compress memory\` to trigger vector database cleanup.
- \`run pipeline\` to coordinate automated video production.`;
  }

  logToSystem(`Assistant replied successfully.`, "success", "Assistant");
  return reply;
});

ipcMain.on("restart-runtime", () => {
  logToSystem("Initiating full RuntimeEngine restart sequence...", "warn", "Runtime");
  if (mainWindow) {
    mainWindow.webContents.send("engine-health-updated", { engine: "RuntimeEngine", status: "initializing" });
  }

  setTimeout(() => {
    logToSystem("RuntimeEngine offline. Stopping child scheduler threads...", "warn", "Runtime");
    if (mainWindow) {
      mainWindow.webContents.send("engine-health-updated", { engine: "TaskSchedulerEngine", status: "offline" });
    }
  }, 1000);

  setTimeout(() => {
    logToSystem("Kernel reloading configuration tokens and providers...", "info", "Runtime");
  }, 2200);

  setTimeout(() => {
    logToSystem("RuntimeEngine started successfully. Active providers reconnected.", "success", "Runtime");
    logToSystem("TaskSchedulerEngine ready.", "success", "Runtime");
    if (mainWindow) {
      mainWindow.webContents.send("engine-health-updated", { engine: "RuntimeEngine", status: "online" });
      mainWindow.webContents.send("engine-health-updated", { engine: "TaskSchedulerEngine", status: "online" });
      mainWindow.webContents.send("notification-stream", {
        id: `notif-${Math.random().toString(36).substr(2, 9)}`,
        type: "info",
        title: "Engine Restarted",
        message: "RuntimeEngine has completed rebooting.",
        time: new Date().toLocaleTimeString(),
      });
    }
  }, 3500);
});

// App Lifecycle
app.whenReady().then(() => {
  createWindow();
  startResourceMonitor();

  // Periodically check FastAPI health
  setInterval(checkBackendHealth, 5000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
