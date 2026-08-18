import { Gateway } from "./gateway/Gateway";
import { GatewayRequest } from "./gateway/GatewayRequest";
import { GatewayResponse } from "./gateway/GatewayResponse";
import { LoggerBuilder, SilentTransport } from "@shaily/core/api-gateway";
import { DatabaseBuilder, DatabaseProvider } from "@shaily/core/server";
import { JWT } from "./gateway/JWT";
import * as fs from "node:fs";
import * as path from "node:path";
import * as assert from "node:assert";

async function runTests() {
  console.log("=== START VIDEO DELIVERY REGRESSION TESTS ===");

  // 1. Setup Mock/Silent Logger
  const formatter = new (class { format(event: any) { return JSON.stringify(event); } })();
  const logger = new LoggerBuilder()
    .addTransport(new (class { send() {} })())
    .withFormatter(formatter)
    .build();

  // 2. Initialize Database Engine in-memory (SQLite)
  console.log("Initializing Test Database...");
  const dbEngine = new DatabaseBuilder()
    .withContext({ env: "test", namespace: "video-delivery-tests" })
    .withProvider(DatabaseProvider.SQLITE)
    .withFilePath(":memory:")
    .build();
  await dbEngine.initialize();
  await dbEngine.connect();

  const qm = dbEngine.getQueryManager();

  // 3. Setup Gateway Context & Gateway
  const context = {
    logger,
    databaseEngine: dbEngine,
    contentPipelineEngine: {
      context: {
        mediaProviderEngine: {},
        renderEngine: {},
        qualityEngine: {},
        youtubeIntegrationEngine: {}
      }
    }
  };

  const gateway = new Gateway(context as any, "0.0.0.0", 8001);
  await gateway.initialize();
  await gateway.start();

  try {
    // 4. Test Task Retrieval with videoUrl extraction
    console.log("Running Test A: Task videoUrl extraction...");
    
    // Seed database tasks
    const taskId = "task-test-video-123";
    const inputData = {
      videoFileUrl: "file:///C:/Users/asus/AI video OS/shaily studio/storage/media/render-123.mp4",
      title: "Test Video"
    };

    // Intercept query execution to return task mock data because the non-Postgres provider simulates database operations
    const originalExecute = dbEngine.getQueryManager().execute.bind(dbEngine.getQueryManager());
    dbEngine.getQueryManager().execute = async (request: any) => {
      if (request.sql && request.sql.includes("SELECT id, status, prompt, agent_id, input_data")) {
        return {
          id: `resp-${Date.now()}`,
          requestId: request.id,
          rows: [
            {
              id: taskId,
              status: "completed",
              prompt: "Generate a TypeScript tutorial video",
              agent_id: "default-agent",
              input_data: JSON.stringify(inputData),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ],
          durationMs: 0,
          fromCache: false
        };
      }
      return originalExecute(request);
    };

    const jwtSecret = process.env.JWT_SECRET || "shaily-studio-default-jwt-secret-key-12345";
    const token = JWT.sign({ username: "shailyadmin", role: "admin" }, jwtSecret);

    const getTasksReq: GatewayRequest = {
      method: "GET",
      path: "/api/tasks",
      headers: { 
        "host": "localhost:8000",
        "Authorization": `Bearer ${token}`
      },
      query: {},
      params: {},
      body: null,
      correlationId: "corr-1"
    };

    const getTasksRes = await gateway.handle(getTasksReq);
    assert.strictEqual(getTasksRes.status, 200, "Get tasks status should be 200");
    const tasks = getTasksRes.body as any[];
    assert.ok(Array.isArray(tasks), "Response body should be an array of tasks");
    const testTask = tasks.find(t => t.id === taskId);
    assert.ok(testTask, "Task should exist in list");
    assert.strictEqual(
      testTask.videoUrl,
      "http://localhost:8000/api/internal/download-render/render-123.mp4",
      `Expected public videoUrl, got: ${testTask.videoUrl}`
    );
    console.log("  ✓ Test A passed!");

    // 5. Setup temporary render file for download testing
    console.log("Running Test B: Rendering download endpoint...");
    const storageDir = path.join(process.cwd(), "storage", "media");
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const testFile = "render-test-delivery.mp4";
    const testFilePath = path.join(storageDir, testFile);
    
    // Create a 100-byte test file
    const fileContent = Buffer.alloc(100, "A");
    fs.writeFileSync(testFilePath, fileContent);

    // Call without Range header (should return 200 OK with whole file)
    const downloadReq: GatewayRequest = {
      method: "GET",
      path: `/api/internal/download-render/${testFile}`,
      headers: {},
      query: {},
      params: {},
      body: null,
      correlationId: "corr-2"
    };

    const downloadRes = await gateway.handle(downloadReq);
    assert.strictEqual(downloadRes.status, 200, "Download should be 200 OK");
    assert.strictEqual(downloadRes.headers["Content-Type"], "video/mp4", "Content-Type must be video/mp4");
    assert.strictEqual(downloadRes.headers["Content-Length"], "100", "Content-Length must be 100");
    assert.ok(downloadRes.headers["Content-Disposition"].includes("inline"), "Disposition should be inline");
    console.log("  ✓ Whole file download passed!");

    // Call with Range header (should return 206 Partial Content)
    const downloadRangeReq: GatewayRequest = {
      method: "GET",
      path: `/api/internal/download-render/${testFile}`,
      headers: { "Range": "bytes=10-49" },
      query: {},
      params: {},
      body: null,
      correlationId: "corr-3"
    };

    const downloadRangeRes = await gateway.handle(downloadRangeReq);
    assert.strictEqual(downloadRangeRes.status, 206, "Download should be 206 Partial Content");
    assert.strictEqual(downloadRangeRes.headers["Content-Range"], "bytes 10-49/100", "Content-Range mismatch");
    assert.strictEqual(downloadRangeRes.headers["Content-Length"], "40", "Content-Length mismatch");
    assert.strictEqual(downloadRangeRes.headers["Accept-Ranges"], "bytes", "Accept-Ranges should be bytes");
    console.log("  ✓ Byte-range download passed!");

    // Test path traversal protection (should return 400 Bad Request)
    const traversalReq: GatewayRequest = {
      method: "GET",
      path: `/api/internal/download-render/..\\..\\some-file.txt`,
      headers: {},
      query: {},
      params: {},
      body: null,
      correlationId: "corr-4"
    };
    const traversalRes = await gateway.handle(traversalReq);
    assert.strictEqual(traversalRes.status, 400, "Should reject path traversal with 400");
    console.log("  ✓ Path traversal protection passed!");

    // Test invalid range (should return 416 Range Not Satisfiable)
    const invalidRangeReq: GatewayRequest = {
      method: "GET",
      path: `/api/internal/download-render/${testFile}`,
      headers: { "Range": "bytes=200-300" },
      query: {},
      params: {},
      body: null,
      correlationId: "corr-5"
    };
    const invalidRangeRes = await gateway.handle(invalidRangeReq);
    assert.strictEqual(invalidRangeRes.status, 416, "Should return 416 for invalid range");
    console.log("  ✓ Invalid range protection passed!");

    // Clean up test file after a delay to let streams finish/close
    await new Promise((resolve) => setTimeout(resolve, 100));
    fs.rmSync(testFilePath, { force: true });
    console.log("  ✓ Test B passed!");

    console.log("\n=== ALL REGRESSION TESTS PASSED! ===");
  } finally {
    await gateway.stop();
    await dbEngine.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
