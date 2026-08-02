import { encrypt, decrypt } from "./security/encryption";
import { YouTubeChannelProvider } from "./channel-manager/providers/YouTubeChannelProvider";
import { YouTubeIntegrationEngine } from "./youtube-integration/YouTubeIntegrationEngine";
import { PlatformProvider } from "./channel-manager/PlatformProvider";
import { CapabilityType } from "./channel-manager/CapabilityType";

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ PASSED: ${label}`);
  } else {
    console.error(`  ✗ FAILED: ${label}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log("\n=== START YOUTUBE REAL INTEGRATION VERIFICATION TESTS ===\n");

  // 1. Encryption / Decryption Verification
  console.log("1. Verification of Token Encryption/Decryption...");
  const rawToken = "ya29.a0AcE-ot3456789-fake-google-token-xyz-12345";
  const encrypted = encrypt(rawToken);
  assert(encrypted !== rawToken, "Encrypted token should not match raw token");
  assert(encrypted.includes(":"), "Encrypted format should contain IV separator");
  const decrypted = decrypt(encrypted);
  assert(decrypted === rawToken, "Decrypted token should match original raw token");

  // 2. YouTubeChannelProvider Verification
  console.log("2. Verification of YouTubeChannelProvider...");
  const provider = new YouTubeChannelProvider();
  assert(provider.platform === PlatformProvider.YOUTUBE, "Provider platform should be YOUTUBE");
  
  const caps = provider.getCapabilities();
  assert(caps.supported.includes(CapabilityType.LONG_VIDEO), "Capabilities should support LONG_VIDEO");
  assert(caps.supported.includes(CapabilityType.THUMBNAILS), "Capabilities should support THUMBNAILS");

  // 3. YouTubeIntegrationEngine Sub-managers Verification
  console.log("3. Verification of YouTubeIntegrationEngine sub-managers...");
  const mockContext = {
    eventBus: {
      publish: async () => {}
    }
  };
  const engine = new YouTubeIntegrationEngine(mockContext);
  await engine.initialize();
  
  const auth = engine.getAuthenticationManager();
  assert(!auth.isAuthorized(), "Engine should start unauthorized");

  console.log("\n=== ALL YOUTUBE INTEGRATION TESTS PASSED SUCCESSFULLY ===\n");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
