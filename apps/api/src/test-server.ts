import { ServerBuilder } from "./server/ServerBuilder";
import { ServerState } from "./server/ServerState";
import { HttpMethod } from "./server/HttpMethod";
import { HttpResponse } from "./server/HttpResponse";
import { HttpRequest } from "./server/HttpRequest";
import { RouteDefinition } from "./server/RouteDefinition";
import { MiddlewareDefinition } from "./server/MiddlewareDefinition";
import { ServerValidator } from "./server/ServerValidator";
import {
  InvalidServerStateException,
  ServerValidationException,
} from "./server/types";
import {
  LoggerBuilder,
  ConsoleTransport,
  JsonFormatter,
  ConfigBuilder,
} from "@shaily/core";
import * as http from "http";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

async function runTests() {
  console.log("=== START REST API FOUNDATION TESTS ===");

  // Build logger and config for dependency injection
  const formatter = new JsonFormatter();
  const logger = new LoggerBuilder()
    .addTransport(new ConsoleTransport(formatter))
    .withFormatter(formatter)
    .build();

  const config = await new ConfigBuilder({}).build();

  // 1. Builder Verification
  console.log("\n1. Verifying Server Builder...");
  const server = new ServerBuilder()
    .withEnvironment("staging")
    .withHost("127.0.0.1")
    .withPort(8999)
    .withLogger(logger)
    .withConfig(config)
    .withMetadata({ version: "1.2.3-beta", appName: "Shaily Studio Test API" })
    .build();

  assert(server.id !== undefined && server.id.length === 36, "Server ID should be generated v4 UUID");
  assert(server.version === "1.2.3-beta", "Server version matches");
  assert(server.environment === "staging", "Server environment matches");
  assert(server.port === 8999, "Server port matches");
  assert(server.host === "127.0.0.1", "Server host matches");
  assert(server.state === ServerState.CREATED, "Initial state should be CREATED");
  console.log("   ✓ Builder generated valid instance.");

  // 2. Lifecycle Transitions & State Machine
  console.log("\n2. Verifying Lifecycle Transitions...");
  // Start before initialize -> fail
  try {
    await server.start();
    assert(false, "Should not allow starting before initialize");
  } catch (err) {
    assert(err instanceof InvalidServerStateException, "Expected InvalidServerStateException");
  }

  // Stop before start -> fail
  try {
    await server.stop();
    assert(false, "Should not allow stopping before start");
  } catch (err) {
    assert(err instanceof InvalidServerStateException, "Expected InvalidServerStateException");
  }

  // Initialize
  await server.initialize();
  assert(server.state === ServerState.READY, "State should be READY after initialize");

  // Double initialize -> fail
  try {
    await server.initialize();
    assert(false, "Should not allow double initialize");
  } catch (err) {
    assert(err instanceof InvalidServerStateException, "Expected InvalidServerStateException");
  }

  // Register routes/middlewares after run or during READY?
  // We can register during CREATED or READY. Let's register a test route
  const testRoute: RouteDefinition = {
    id: "test-get",
    path: "/test",
    method: HttpMethod.GET,
    handler: (req) => HttpResponse.create().withStatus(200).json({ success: true }),
    metadata: { description: "Test Route" },
  };
  server.registerRoute(testRoute);

  // Start the server
  await server.start();
  assert(server.state === ServerState.RUNNING, "State should be RUNNING after start");

  // Double start -> fail
  try {
    await server.start();
    assert(false, "Should not allow double start");
  } catch (err) {
    assert(err instanceof InvalidServerStateException, "Expected InvalidServerStateException");
  }

  // Register route while running -> fail
  try {
    server.registerRoute({
      id: "late-route",
      path: "/late",
      method: HttpMethod.GET,
      handler: (req) => HttpResponse.create(),
      metadata: {},
    });
    assert(false, "Should not allow registering route while running");
  } catch (err) {
    assert(err instanceof InvalidServerStateException, "Expected InvalidServerStateException");
  }

  // Stop the server
  await server.stop();
  assert(server.state === ServerState.STOPPED, "State should be STOPPED after stop");

  // Double stop -> fail
  try {
    await server.stop();
    assert(false, "Should not allow double stop");
  } catch (err) {
    assert(err instanceof InvalidServerStateException, "Expected InvalidServerStateException");
  }
  console.log("   ✓ State machine transitions validated successfully.");

  // 3. Route Registry and Duplicate Route Rejection
  console.log("\n3. Verifying Route Registry & Duplicate Rejection...");
  const freshServer = new ServerBuilder()
    .withLogger(logger)
    .withConfig(config)
    .build();

  freshServer.registerRoute({
    id: "route-1",
    path: "/users/:id",
    method: HttpMethod.GET,
    handler: (req) => HttpResponse.create(),
    metadata: {},
  });

  // Try duplicate route (same path and method) -> fail
  try {
    freshServer.registerRoute({
      id: "route-2",
      path: "/users/:id",
      method: HttpMethod.GET,
      handler: (req) => HttpResponse.create(),
      metadata: {},
    });
    assert(false, "Should not allow duplicate route");
  } catch (err) {
    assert(err instanceof ServerValidationException, "Expected ServerValidationException on duplicate route");
  }

  // Verify route lookup & parameter parsing
  const registry = (freshServer as any)._routeRegistry;
  const match = registry.lookup(HttpMethod.GET, "/users/12345");
  assert(match !== null, "Route should match");
  assert(match.route.id === "route-1", "Matched route ID should be 'route-1'");
  assert(match.params.id === "12345", "Parsed parameter 'id' should be '12345'");

  // No match route lookup
  const mismatch = registry.lookup(HttpMethod.POST, "/users/12345");
  assert(mismatch === null, "Route should not match different HTTP method");

  const mismatchPath = registry.lookup(HttpMethod.GET, "/users/12345/posts");
  assert(mismatchPath === null, "Route should not match with different path length");

  console.log("   ✓ Route registry lookups and duplicate route rejection verified.");

  // 4. Middleware Pipeline (Ordering, Short-circuit, Failure propagation)
  console.log("\n4. Verifying Middleware Pipeline...");
  const trace: string[] = [];

  const mw1: MiddlewareDefinition = {
    id: "mw1",
    handler: async (req, next) => {
      trace.push("mw1-start");
      const res = await next();
      trace.push("mw1-end");
      return res;
    },
    metadata: { order: 1 },
  };

  const mw2: MiddlewareDefinition = {
    id: "mw2",
    handler: async (req, next) => {
      trace.push("mw2-start");
      const res = await next();
      trace.push("mw2-end");
      return res;
    },
    metadata: { order: 2 },
  };

  const pipelineServer = new ServerBuilder()
    .withLogger(logger)
    .withConfig(config)
    .withPort(9092)
    .withMiddleware(mw1)
    .withMiddleware(mw2)
    .withRoute({
      id: "handler-route",
      path: "/hello",
      method: HttpMethod.GET,
      handler: (req) => {
        trace.push("handler-executed");
        return HttpResponse.create().withStatus(200).withBody("Hello World");
      },
      metadata: {},
    })
    .build();

  await pipelineServer.initialize();
  await pipelineServer.start();

  // Simulate a request passing through pipeline
  const pipeline = (pipelineServer as any)._middlewarePipeline;
  const mockReq = new HttpRequest({}, {}, {}, null, HttpMethod.GET, "/hello", pipelineServer.context);
  const matchedRoute = (pipelineServer as any)._routeRegistry.lookup(HttpMethod.GET, "/hello");

  assert(matchedRoute !== null, "Route should exist");

  const finalResponse = await pipeline.execute(mockReq, async (currentReq: HttpRequest) => {
    return await matchedRoute.route.handler(currentReq);
  });

  assert(finalResponse.status === 200, "Response status matches");
  assert(finalResponse.body === "Hello World", "Response body matches");

  // Trace should be mw1-start -> mw2-start -> handler-executed -> mw2-end -> mw1-end
  assert(trace.length === 5, "Trace length matches");
  assert(trace[0] === "mw1-start", "mw1-start is first");
  assert(trace[1] === "mw2-start", "mw2-start is second");
  assert(trace[2] === "handler-executed", "handler is third");
  assert(trace[3] === "mw2-end", "mw2-end is fourth");
  assert(trace[4] === "mw1-end", "mw1-end is fifth");
  console.log("   ✓ Middleware ordering verified.");

  // Test Duplicate Middleware ID prevention
  try {
    new ServerBuilder()
      .withLogger(logger)
      .withConfig(config)
      .withMiddleware(mw1)
      .withMiddleware({
        id: "mw1", // duplicate id
        handler: async (req, next) => next(),
        metadata: {},
      })
      .build();
    assert(false, "Should have rejected duplicate middleware ID");
  } catch (err) {
    assert(err instanceof ServerValidationException, "Expected ServerValidationException on duplicate middleware ID");
  }
  console.log("   ✓ Middleware duplicate ID rejection verified.");

  // Test Short-circuiting behavior
  const shortCircuitTrace: string[] = [];
  const shortCircuitServer = new ServerBuilder()
    .withLogger(logger)
    .withConfig(config)
    .withPort(9093)
    .withMiddleware({
      id: "sc-middleware",
      handler: async (req, next) => {
        shortCircuitTrace.push("sc-middleware");
        // Short circuit and return a response directly
        return HttpResponse.create().withStatus(401).withBody("Unauthorized");
      },
      metadata: {},
    })
    .withRoute({
      id: "sc-route",
      path: "/sc",
      method: HttpMethod.GET,
      handler: (req) => {
        shortCircuitTrace.push("sc-handler");
        return HttpResponse.create().withStatus(200).withBody("OK");
      },
      metadata: {},
    })
    .build();

  await shortCircuitServer.initialize();
  await shortCircuitServer.start();

  const scRoute = (shortCircuitServer as any)._routeRegistry.lookup(HttpMethod.GET, "/sc");
  const scReq = new HttpRequest({}, {}, {}, null, HttpMethod.GET, "/sc", shortCircuitServer.context);
  const scResponse = await (shortCircuitServer as any)._middlewarePipeline.execute(scReq, async (currentReq: HttpRequest) => {
    return await scRoute.route.handler(currentReq);
  });

  assert(scResponse.status === 401, "Should return short-circuited status");
  assert(scResponse.body === "Unauthorized", "Should return short-circuited body");
  assert(shortCircuitTrace.length === 1 && shortCircuitTrace[0] === "sc-middleware", "Route handler should not have executed");
  console.log("   ✓ Middleware short-circuiting verified.");

  // Test Failure propagation
  const errorServer = new ServerBuilder()
    .withLogger(logger)
    .withConfig(config)
    .withPort(9094)
    .withMiddleware({
      id: "error-mw",
      handler: async (req, next) => {
        throw new Error("Middleware error!");
      },
      metadata: {},
    })
    .build();

  await errorServer.initialize();
  await errorServer.start();

  const errReq = new HttpRequest({}, {}, {}, null, HttpMethod.GET, "/err", errorServer.context);
  try {
    await (errorServer as any)._middlewarePipeline.execute(errReq, async () => {
      return HttpResponse.create();
    });
    assert(false, "Should have thrown middleware error");
  } catch (err: any) {
    assert(err.message === "Middleware error!", "Error should propagate from middleware");
  }
  console.log("   ✓ Middleware failure propagation verified.");

  // Clean up running test servers
  await pipelineServer.stop();
  await shortCircuitServer.stop();
  await errorServer.stop();

  // 5. Snapshot Immutability
  console.log("\n5. Verifying Snapshot Immutability...");
  const snapServer = new ServerBuilder()
    .withLogger(logger)
    .withConfig(config)
    .withEnvironment("testing")
    .withPort(9091)
    .withHost("localhost")
    .build();

  await snapServer.initialize();
  await snapServer.start();

  const snapshot = snapServer.snapshot();
  assert(snapshot.state === ServerState.RUNNING, "Snapshot state should be RUNNING");
  assert(snapshot.port === 9091, "Snapshot port should be 9091");
  assert(snapshot.host === "localhost", "Snapshot host should be 'localhost'");
  assert(snapshot.environment === "testing", "Snapshot env matches");

  // Verify Object.isFrozen
  assert(Object.isFrozen(snapshot), "Snapshot object must be frozen");
  assert(Object.isFrozen(snapshot.metadata), "Snapshot metadata must be frozen");

  try {
    (snapshot as any).port = 80;
    assert(false, "Should not allow mutating snapshot port");
  } catch (err) {
    // correctly threw error
  }
  await snapServer.stop();
  console.log("   ✓ Snapshot data matches and is fully frozen.");

  // 6. Validator Checks
  console.log("\n6. Verifying Validator checks...");
  const validator = new ServerValidator();

  // Empty path check
  try {
    validator.validateRoute({
      id: "r1",
      path: "",
      method: HttpMethod.GET,
      handler: () => HttpResponse.create(),
      metadata: {},
    });
    assert(false, "Validator should reject empty path");
  } catch (err) {
    assert(err instanceof ServerValidationException, "Expected ServerValidationException");
  }

  // Path must start with '/'
  try {
    validator.validateRoute({
      id: "r1",
      path: "users",
      method: HttpMethod.GET,
      handler: () => HttpResponse.create(),
      metadata: {},
    });
    assert(false, "Validator should reject path not starting with '/'");
  } catch (err) {
    assert(err instanceof ServerValidationException, "Expected ServerValidationException");
  }

  // Invalid HTTP method check
  try {
    validator.validateRoute({
      id: "r1",
      path: "/users",
      method: "INVALID" as any,
      handler: () => HttpResponse.create(),
      metadata: {},
    });
    assert(false, "Validator should reject invalid HTTP method");
  } catch (err) {
    assert(err instanceof ServerValidationException, "Expected ServerValidationException");
  }

  // Invalid port check
  try {
    validator.validateMetadata({
      id: "srv",
      environment: "test",
      version: "1.0.0",
      port: 999999, // invalid port
      host: "localhost",
    });
    assert(false, "Validator should reject invalid port");
  } catch (err) {
    assert(err instanceof ServerValidationException, "Expected ServerValidationException");
  }
  console.log("   ✓ Validator rule enforcement verified.");

  // 7. Real Start/Stop Listening (Integrative HTTP Request/Response check)
  console.log("\n7. Verifying Real HTTP Start/Stop and Request/Response handling...");
  const httpPort = 12345;
  const runningServer = new ServerBuilder()
    .withEnvironment("production")
    .withHost("127.0.0.1")
    .withPort(httpPort)
    .withLogger(logger)
    .withConfig(config)
    .withRoute({
      id: "api-hello",
      path: "/api/hello",
      method: HttpMethod.GET,
      handler: (req) => {
        return HttpResponse.create()
          .withStatus(200)
          .withHeader("x-custom-test", "shaily")
          .json({ message: "Hello from Shaily Studio API Foundation" });
      },
      metadata: {},
    })
    .withRoute({
      id: "api-echo",
      path: "/api/echo/:id",
      method: HttpMethod.POST,
      handler: (req) => {
        return HttpResponse.create()
          .withStatus(201)
          .json({
            idParam: req.params.id,
            queryVal: req.query.name,
            requestBody: req.body,
          });
      },
      metadata: {},
    })
    .build();

  await runningServer.initialize();
  await runningServer.start();

  // Test GET request
  const getPromise = new Promise<void>((resolve, reject) => {
    http.get(`http://127.0.0.1:${httpPort}/api/hello`, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          assert(res.statusCode === 200, "HTTP status code should be 200");
          assert(res.headers["x-custom-test"] === "shaily", "Custom header should be present");
          assert(res.headers["content-type"] === "application/json", "Content-Type should be application/json");
          const bodyObj = JSON.parse(data);
          assert(bodyObj.message === "Hello from Shaily Studio API Foundation", "Body content matches");
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });

  await getPromise;
  console.log("   ✓ HTTP GET integration test passed.");

  // Test POST request with JSON body, path params and query parameters
  const postPromise = new Promise<void>((resolve, reject) => {
    const postData = JSON.stringify({ framework: "pure-node-di" });
    const reqOptions = {
      hostname: "127.0.0.1",
      port: httpPort,
      path: "/api/echo/987?name=shaily-user",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          assert(res.statusCode === 201, "HTTP status code should be 201");
          const bodyObj = JSON.parse(data);
          assert(bodyObj.idParam === "987", "Path parameter parsed successfully");
          assert(bodyObj.queryVal === "shaily-user", "Query parameter parsed successfully");
          assert(bodyObj.requestBody.framework === "pure-node-di", "JSON body parsed successfully");
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });

  await postPromise;
  console.log("   ✓ HTTP POST integration test (JSON body, query parameters, path parameters) passed.");

  // Test 404 Route Not Found
  const notFoundPromise = new Promise<void>((resolve, reject) => {
    http.get(`http://127.0.0.1:${httpPort}/api/not-existing-path`, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          assert(res.statusCode === 404, "HTTP status code should be 404");
          const bodyObj = JSON.parse(data);
          assert(bodyObj.error !== undefined, "Error payload should be present");
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });

  await notFoundPromise;
  console.log("   ✓ HTTP 404 response handler passed.");

  await runningServer.stop();
  console.log("   ✓ HTTP server stopped listening successfully.");

  console.log("\n=== ALL REST API FOUNDATION TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
