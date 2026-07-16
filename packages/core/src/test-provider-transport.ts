import { ProviderTransport } from "./providers/transport/ProviderTransport";
import { TransportBuilder } from "./providers/transport/TransportBuilder";
import { TransportError } from "./providers/transport/types";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

async function runTests() {
  console.log("=== START PROVIDER TRANSPORT TESTS ===");

  const originalFetch = global.fetch;

  // 1. Test Successful Execution
  console.log("1. Running Successful Execution Test...");
  let fetchCallCount = 0;
  global.fetch = async (url: any, options: any) => {
    fetchCallCount++;
    const headers = new Headers();
    headers.set("content-type", "application/json");
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers,
      json: async () => ({ result: "success" }),
    } as any;
  };

  const transport = new TransportBuilder()
    .withId("test-transport")
    .withBaseUrl("https://api.example.com")
    .withContext({ env: "test", namespace: "default" })
    .build();

  const response = await transport.execute({
    id: "req-1",
    url: "https://api.example.com/test",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { data: "test-data" },
  });

  assert(response.status === 200, "Should get 200 status");
  assert(response.body.result === "success", "Should get JSON body content");
  assert(fetchCallCount === 1, "Should have made 1 fetch call");
  console.log("✓ Successful Execution Test passed.");

  // 2. Test Retries on 429 / 503
  console.log("\n2. Running Retries (429/503) Test...");
  fetchCallCount = 0;
  global.fetch = async (url: any, options: any) => {
    fetchCallCount++;
    if (fetchCallCount < 3) {
      const headers = new Headers();
      headers.set("retry-after", "1");
      return {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers,
      } as any;
    }
    const headers = new Headers();
    headers.set("content-type", "application/json");
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers,
      json: async () => ({ result: "retry-success" }),
    } as any;
  };

  const retryTransport = new TransportBuilder()
    .withId("retry-transport")
    .withBaseUrl("https://api.example.com")
    .withMaxRetries(3)
    .withBackoffFactor(0.1) // short delay
    .withContext({ env: "test", namespace: "default" })
    .build();

  const retryResponse = await retryTransport.execute({
    id: "req-2",
    url: "https://api.example.com/retry",
    method: "GET",
  });

  assert(retryResponse.status === 200, "Should get 200 status after retries");
  assert(retryResponse.body.result === "retry-success", "Should get success JSON content");
  assert(fetchCallCount === 3, "Should have made 3 fetch calls (2 retries)");
  console.log("✓ Retries (429/503) Test passed.");

  // 3. Test Timeout Handling
  console.log("\n3. Running Timeout Handling Test...");
  global.fetch = async (url: any, options: any) => {
    const signal = options.signal;
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        reject(new DOMException("The user aborted a request.", "AbortError"));
      };
      if (signal.aborted) {
        return onAbort();
      }
      signal.addEventListener("abort", onAbort);
      setTimeout(() => {
        resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          headers: new Headers(),
          json: async () => ({}),
        } as any);
      }, 500);
    });
  };

  const timeoutTransport = new TransportBuilder()
    .withId("timeout-transport")
    .withBaseUrl("https://api.example.com")
    .withTimeout(100) // short timeout
    .withContext({ env: "test", namespace: "default" })
    .build();

  try {
    await timeoutTransport.execute({
      id: "req-3",
      url: "https://api.example.com/timeout",
      method: "GET",
    });
    assert(false, "Should have timed out and thrown TransportError");
  } catch (err: any) {
    assert(err instanceof TransportError, "Should throw TransportError");
    assert(err.status === 408, "Should have status 408 for timeout");
  }
  console.log("✓ Timeout Handling Test passed.");

  // 4. Test SSE Stream Parser
  console.log("\n4. Running SSE Stream Parser Test...");
  global.fetch = async (url: any, options: any) => {
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode("data: {\"content\":\"H\"}\n\n"),
      encoder.encode("data: {\"content\":\"e\"}\n\n"),
      encoder.encode("data: {\"content\":\"l\"}\n\n"),
      encoder.encode("data: {\"content\":\"l\"}\n\n"),
      encoder.encode("data: {\"content\":\"o\"}\n\n"),
      encoder.encode("data: [DONE]\n\n"),
    ];

    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
          // Yield execution to simulate chunk arrivals
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        controller.close();
      },
    });

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      body: stream,
    } as any;
  };

  const streamTransport = new TransportBuilder()
    .withId("stream-transport")
    .withBaseUrl("https://api.example.com")
    .withContext({ env: "test", namespace: "default" })
    .build();

  const streamGen = streamTransport.stream({
    id: "req-4",
    url: "https://api.example.com/stream",
    method: "POST",
  });

  let outputText = "";
  for await (const chunk of streamGen) {
    outputText += chunk.body?.content || "";
  }

  assert(outputText === "Hello", "Should receive complete stream content");
  console.log("✓ SSE Stream Parser Test passed.");

  // Restore fetch
  global.fetch = originalFetch;
  console.log("\n=== ALL PROVIDER TRANSPORT TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
