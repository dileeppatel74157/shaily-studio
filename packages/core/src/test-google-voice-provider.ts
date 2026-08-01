import { GeminiVoiceProvider, GeminiVoiceBuilder } from "@shaily/provider-google";
import { ProviderContext, IProviderTransport, ProviderResponse } from "@shaily/core";
import { StorageBuilder } from "./storage/StorageBuilder";
import { GatewayEngine } from "./ai-gateway/GatewayEngine";
import { GatewayRequest } from "./ai-gateway/models";
import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";

class MockVoiceTransport implements IProviderTransport {
  public readonly id = "mock-voice-transport";
  public readonly baseUrl = "https://generativelanguage.googleapis.com";
  public lastRequest: any;
  public ttsResponseBody: any = {
    candidates: [
      {
        content: {
          parts: [
            {
              inlineData: {
                mimeType: "audio/mp3",
                data: Buffer.from("mock-audio-generated-bytes").toString("base64")
              }
            }
          ]
        }
      }
    ]
  };
  public sttResponseBody: any = {
    candidates: [
      {
        content: {
          parts: [
            {
              text: "Hello and welcome to Shaily Studio"
            }
          ]
        }
      }
    ]
  };

  public async execute(request: any): Promise<any> {
    this.lastRequest = request;
    if (request.body?.generationConfig?.responseModalities?.includes("AUDIO")) {
      return {
        body: this.ttsResponseBody,
        latency: 150
      };
    } else {
      return {
        body: this.sttResponseBody,
        latency: 220
      };
    }
  }

  public async *stream(request: any): AsyncGenerator<any> {
    yield { body: {} };
  }
}

async function runTests() {
  console.log("=== START GEMINI VOICE PROVIDER TESTS ===");

  const storage = new StorageBuilder()
    .withContext({ env: "test", namespace: "test-audio" })
    .build();

  await storage.initialize();
  await storage.start();

  const context: ProviderContext = {
    env: "test",
    namespace: "default",
    metadata: {},
    storage
  } as any;

  const config = {
    apiKey: "AIzaSyFakeVoiceKey123",
    settings: {}
  };

  // 1. Instantiation and Builder
  console.log("Testing provider instantiation and builder...");
  const transport = new MockVoiceTransport();
  const provider = new GeminiVoiceBuilder()
    .withId("gemini-voice-test")
    .withName("Google Gemini Voice Test")
    .withContext(context)
    .withConfiguration(config)
    .withTransport(transport)
    .build();

  await provider.initialize();
  await provider.start();

  assert.strictEqual(provider.id, "gemini-voice-test");
  assert.strictEqual(provider.capabilities.length, 1);
  assert.strictEqual(provider.capabilities[0], "Audio");

  // 2. Text-to-Speech Execution and Storage
  console.log("Testing Text-to-Speech (TTS)...");
  const ttsResponse = await provider.execute({
    model: "gemini-tts-1",
    prompt: "Welcome to Shaily Studio voice AI.",
    voiceParams: {
      mode: "tts",
      voiceId: "en-US-Neural2-F",
      languageCode: "en-US",
      speed: 1.0,
      pitch: 0.0,
      outputFormat: "mp3"
    }
  } as any);

  assert.ok(transport.lastRequest, "Transport execute should have been called for TTS");
  assert.ok(transport.lastRequest.url.includes("generateContent"), "Should hit generateContent endpoint");
  assert.strictEqual(transport.lastRequest.body.contents[0].parts[0].text, "Welcome to Shaily Studio voice AI.");
  assert.strictEqual(transport.lastRequest.body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, "Puck");
  
  // Storage verify for TTS
  assert.strictEqual(ttsResponse.storageBucket, "audio");
  assert.ok(ttsResponse.content.startsWith("audio/speech-"), "Audio path should start with audio/speech-");
  const storedObject = storage.getObject("audio", ttsResponse.content.replace("audio/", ""));
  assert.ok(storedObject, "TTS audio object should exist in storage");
  assert.strictEqual(storedObject.content.toString(), "mock-audio-generated-bytes");

  // 3. Speech-to-Text Execution and Storage
  console.log("Testing Speech-to-Text (STT)...");
  const sttResponse = await provider.execute({
    model: "gemini-stt-1",
    voiceParams: {
      mode: "stt",
      audioUrl: ttsResponse.content,
      languageCode: "en-US",
      sampleRate: 16000,
      outputFormat: "mp3"
    }
  } as any);

  assert.ok(transport.lastRequest.url.includes("generateContent"), "Should hit generateContent endpoint");
  assert.strictEqual(sttResponse.content, "Hello and welcome to Shaily Studio");
  
  // Storage verify for STT
  assert.strictEqual(sttResponse.storageBucket, "audio");
  assert.ok(sttResponse.storedSubtitlePath.startsWith("audio/transcript-"), "Subtitle path should start with audio/transcript-");
  const storedSubtitle = storage.getObject("audio", sttResponse.storedSubtitlePath.replace("audio/", ""));
  assert.ok(storedSubtitle, "STT subtitle object should exist in storage");
  assert.ok(storedSubtitle.content.toString().includes("Hello and welcome to Shaily Studio"), "Subtitle content should match");

  // 4. Gateway Integration and Routing
  console.log("Testing Gateway integration and routing...");
  const gatewayContext = {
    logger: {
      info: () => {},
      warn: (msg: string) => console.log(`[WARN LOG] ${msg}`),
      error: () => {}
    },
    eventBus: {
      publish: async () => {}
    },
    resolve: (name: string) => {
      if (name === "IStorage") return storage;
      return null;
    }
  };

  const gateway = new GatewayEngine(gatewayContext as any, {
    environment: "test",
    defaultTimeoutMs: 5000,
    maxRetries: 3,
    routingStrategy: "priority" as any,
    retryPolicy: "exponential" as any,
    circuitBreakerThreshold: 5,
    enableCostTracking: true,
    enableUsageMonitor: true
  });
  await gateway.initialize();
  await gateway.start();

  // Verify registration
  const registry = gateway.getRegistry();
  const geminiVoiceCap = registry.getCapabilities("gemini-voice");
  const elevenlabsVoiceCap = registry.getCapabilities("elevenlabs-voice");
  const openaiVoiceCap = registry.getCapabilities("openai-voice");

  assert.ok(geminiVoiceCap, "gemini-voice should be registered");
  assert.ok(elevenlabsVoiceCap, "elevenlabs-voice should be registered");
  assert.ok(openaiVoiceCap, "openai-voice should be registered");

  assert.strictEqual(geminiVoiceCap.supportsVoice, true, "gemini-voice should support voice");
  assert.strictEqual(elevenlabsVoiceCap.supportsVoice, true, "elevenlabs-voice should support voice");
  assert.strictEqual(openaiVoiceCap.supportsVoice, true, "openai-voice should support voice");

  // Route request and execute
  console.log("Testing routing of voice request...");
  const voiceReq: GatewayRequest = {
    requestId: "req-voice-1",
    providerId: "",
    model: "gemini-tts-1",
    prompt: "Gateway synthesizes voice",
    stream: false,
    requestType: "voice",
    voiceParams: {
      mode: "tts",
      outputFormat: "mp3"
    }
  };

  const routeResponse = await gateway.execute(voiceReq);
  console.log("routeResponse:", JSON.stringify(routeResponse, null, 2));
  assert.strictEqual(routeResponse.providerId, "gemini-voice", "Should route voice request to primary provider");
  assert.ok(routeResponse.content.startsWith("audio/speech-"), "Response should generate voice audio path");
  assert.strictEqual(routeResponse.assets?.length, 1);
  assert.strictEqual(routeResponse.assets[0].type, "VOICE");

  // 5. Falling back: gemini-voice -> elevenlabs-voice -> openai-voice
  console.log("Testing voice fallbacks...");
  // We can simulate gemini-voice failing by forcing its adapter to throw
  const geminiAdapter = gateway.getAdapter("gemini-voice") as any;
  geminiAdapter.execute = async () => {
    throw new Error("Gemini temporary voice API limit exceeded");
  };

  const routeResponse2 = await gateway.execute(voiceReq);
  assert.strictEqual(routeResponse2.providerId, "elevenlabs-voice", "Should fallback to elevenlabs-voice when gemini-voice fails");

  // Now fail elevenlabs-voice too
  const elevenlabsAdapter = gateway.getAdapter("elevenlabs-voice") as any;
  elevenlabsAdapter.execute = async () => {
    throw new Error("ElevenLabs authentication failed");
  };

  const routeResponse3 = await gateway.execute(voiceReq);
  assert.strictEqual(routeResponse3.providerId, "openai-voice", "Should fallback to openai-voice when both gemini and elevenlabs fail");

  console.log("=== ALL GEMINI VOICE PROVIDER TESTS PASSED SUCCESSFULLY ===");
  await storage.stop();
  await gateway.stop();
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
