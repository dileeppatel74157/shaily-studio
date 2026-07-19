const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

function startVite() {
  console.log("[Runner] Starting Vite Dev Server...");
  const vite = spawn("npx", ["vite"], {
    shell: true,
    cwd: path.resolve(__dirname, ".."),
    stdio: "pipe",
  });

  vite.stdout.on("data", (data) => {
    const str = data.toString();
    console.log(`[Vite] ${str.trim()}`);
    if (str.includes("Local:") || str.includes("localhost:") || str.includes("5173")) {
      console.log("[Runner] Vite Dev Server is ready. Compiling main process...");
      startTsc();
    }
  });

  vite.stderr.on("data", (data) => {
    console.error(`[Vite Error] ${data.toString()}`);
  });

  return vite;
}

let tscStarted = false;
function startTsc() {
  if (tscStarted) return;
  tscStarted = true;

  console.log("[Runner] Compiling Main process TS in watch mode...");
  const tsc = spawn("npx", ["tsc", "-p", "tsconfig.main.json", "--watch"], {
    shell: true,
    cwd: path.resolve(__dirname, ".."),
  });

  // Watch for output dir to be created
  const checkInterval = setInterval(() => {
    const mainJsPath = path.resolve(__dirname, "../dist/main/main.js");
    if (fs.existsSync(mainJsPath)) {
      clearInterval(checkInterval);
      console.log("[Runner] Main process compiled. Launching Electron...");
      startElectron();
    }
  }, 1000);

  return tsc;
}

let electronStarted = false;
function startElectron() {
  if (electronStarted) return;
  electronStarted = true;

  const electron = spawn("npx", ["electron", "."], {
    shell: true,
    cwd: path.resolve(__dirname, ".."),
  });

  electron.on("close", (code) => {
    console.log(`[Electron] Closed with code ${code}. Cleaning up dev processes...`);
    process.exit(code);
  });

  return electron;
}

startVite();
