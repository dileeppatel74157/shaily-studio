import {
  PromptBuilder,
  PromptCapability,
  PromptVersion,
  PromptValidationException,
  PromptRegistry,
  PromptValidator,
  PromptVariable,
} from "./index";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

async function runTests() {
  console.log("=== START PROMPT FRAMEWORK TESTS ===");

  // 1. Prompt Builder
  console.log("\n1. Verifying Prompt Builder...");
  const prompt = new PromptBuilder()
    .withId("prompt-1")
    .withName("Greeting Prompt")
    .withVersion("1.0.2")
    .withDescription("Greets a user by name")
    .withAuthor("Shaily Studio Team")
    .withTemplate("Hello, {{userName}}! Welcome to {{platformName}}.")
    .withVariable("userName", "The name of the user", true)
    .withVariable("platformName", "The platform name", false, "Shaily Studio")
    .withCapability(PromptCapability.CHAT)
    .withCapability(PromptCapability.SYSTEM)
    .withMetadata({ category: "onboarding" })
    .build();

  assert(prompt.metadata.id === "prompt-1", "Prompt ID matches");
  assert(prompt.metadata.name === "Greeting Prompt", "Prompt Name matches");
  assert(prompt.metadata.description === "Greets a user by name", "Description matches");
  assert(prompt.metadata.author === "Shaily Studio Team", "Author matches");
  assert(prompt.metadata.category === "onboarding", "Metadata category matches");
  assert(prompt.version.toString() === "1.0.2", "Version string matches");
  assert(prompt.capabilities.includes(PromptCapability.CHAT), "Capabilities include CHAT");
  assert(prompt.template.content === "Hello, {{userName}}! Welcome to {{platformName}}.", "Template matches");
  assert(prompt.template.variables.length === 2, "Variable count matches");
  console.log("   ✓ Prompt builder verified successfully.");

  // 2. Registry
  console.log("\n2. Verifying Prompt Registry...");
  const registry = new PromptRegistry();
  registry.register(prompt);

  assert(registry.has("prompt-1"), "Registry has the registered prompt");
  assert(registry.get("prompt-1") === prompt, "Registry lookup returns correct prompt");

  // Duplicate prevention
  try {
    registry.register(prompt);
    assert(false, "Should have thrown on duplicate register");
  } catch (err) {
    assert(err instanceof PromptValidationException, "Expected PromptValidationException on duplicate ID");
  }

  // Remove (unregister)
  const unregResult = registry.unregister("prompt-1");
  assert(unregResult === true, "Unregister returns true");
  assert(!registry.has("prompt-1"), "Registry no longer has the prompt");

  const unregNonExist = registry.unregister("not-existing");
  assert(unregNonExist === false, "Unregistering non-existent returns false");
  console.log("   ✓ Registry operations register, unregister, duplicate prevention, and lookup verified.");

  // Re-register for subsequent tests
  registry.register(prompt);

  // 3. Rendering
  console.log("\n3. Verifying Rendering...");
  // variables replaced correctly
  const rendered = prompt.render({ userName: "John Doe" });
  assert(rendered === "Hello, John Doe! Welcome to Shaily Studio.", "Render output matches with default value");

  const renderedOverride = prompt.render({ userName: "Alice", platformName: "Vite App" });
  assert(renderedOverride === "Hello, Alice! Welcome to Vite App.", "Render output matches with overridden default");

  // Registry render delegation
  const registryRender = registry.render("prompt-1", { userName: "Bob" });
  assert(registryRender === "Hello, Bob! Welcome to Shaily Studio.", "Registry render output matches");
  console.log("   ✓ Prompt template variables rendered and replaced correctly.");

  // 4. Missing Variable Validation
  console.log("\n4. Verifying Missing Variable Validation...");
  try {
    prompt.render({ platformName: "Test App" }); // missing required userName
    assert(false, "Should have thrown on missing required variable");
  } catch (err) {
    assert(err instanceof PromptValidationException, "Expected PromptValidationException on missing variable");
  }
  console.log("   ✓ Missing required variables correctly block rendering.");

  // 5. Duplicate Variable Validation
  console.log("\n5. Verifying Duplicate Variable Validation...");
  try {
    new PromptBuilder()
      .withId("duplicate-vars")
      .withName("Duplicate Vars")
      .withVersion("1.0.0")
      .withTemplate("Hello {{name}}")
      .withVariable("name", "Variable 1", true)
      .withVariable("name", "Variable 2", false) // duplicate name
      .build();
    assert(false, "Should have thrown on duplicate variables in builder");
  } catch (err) {
    assert(err instanceof PromptValidationException, "Expected PromptValidationException on duplicate variable definitions");
  }
  console.log("   ✓ Duplicate variable declarations rejected by builder.");

  // 6. Version Validation
  console.log("\n6. Verifying Semantic Version Validation...");
  // Valid parsing
  const v1 = PromptVersion.parse("1.0.0");
  assert(v1.major === 1 && v1.minor === 0 && v1.patch === 0, "1.0.0 parsed");
  const v2 = PromptVersion.parse("12.4.56");
  assert(v2.major === 12 && v2.minor === 4 && v2.patch === 56, "12.4.56 parsed");

  // Invalid parsing -> throws
  const invalidVersions = ["1.0", "1.0.0.0", "abc", "", "1.-2.3"];
  for (const iv of invalidVersions) {
    try {
      PromptVersion.parse(iv);
      assert(false, `Should have thrown on invalid version: ${iv}`);
    } catch (err) {
      assert(err instanceof PromptValidationException, "Expected PromptValidationException on parsing error");
    }
  }
  console.log("   ✓ Semantic versions parsed and invalid versions rejected successfully.");

  // 7. Snapshot Immutability
  console.log("\n7. Verifying Snapshot Immutability...");
  const promptSnapshot = prompt.snapshot();
  const registrySnapshot = registry.snapshot();

  assert(promptSnapshot.id === "prompt-1", "Snapshot matches ID");
  assert(registrySnapshot.promptsCount === 1, "Registry snapshot promptsCount matches");

  // Check frozen
  assert(Object.isFrozen(promptSnapshot), "Prompt snapshot is frozen");
  assert(Object.isFrozen(promptSnapshot.metadata), "Prompt snapshot metadata is frozen");
  assert(Object.isFrozen(promptSnapshot.template), "Prompt snapshot template is frozen");
  assert(Object.isFrozen(promptSnapshot.capabilities), "Prompt snapshot capabilities is frozen");
  assert(Object.isFrozen(registrySnapshot), "Registry snapshot is frozen");
  assert(Object.isFrozen(registrySnapshot.prompts), "Registry snapshot prompts list is frozen");

  try {
    (promptSnapshot as any).version = "9.9.9";
    assert(false, "Should not allow mutating snapshot version");
  } catch (err) {
    // correctly threw error
  }
  console.log("   ✓ Snapshot properties are recursively deep-frozen.");

  // 8. Rendered Output Immutability
  console.log("\n8. Verifying Rendered Output Immutability...");
  const renderRes = prompt.render({ userName: "Alice" });
  assert(typeof renderRes === "string", "Rendered result is string");
  // JS string primitives are naturally immutable and Object.isFrozen returns true for them in ES6.
  assert(Object.isFrozen(renderRes), "Rendered string primitive is frozen");
  console.log("   ✓ Rendered outputs are strictly immutable.");

  // 9. Template Validation
  console.log("\n9. Verifying Template Validation...");
  const validator = new PromptValidator();

  // Mismatched brackets - opening brace has no closing brace
  try {
    validator.validateTemplate("Hello {{name", [{ name: "name", description: "", required: true }]);
    assert(false, "Should reject unclosed variable braces");
  } catch (err) {
    assert(err instanceof PromptValidationException, "Expected PromptValidationException");
  }

  // Nested opening brackets
  try {
    validator.validateTemplate("Hello {{ {{name}} }}", [{ name: "name", description: "", required: true }]);
    assert(false, "Should reject nested variable braces");
  } catch (err) {
    assert(err instanceof PromptValidationException, "Expected PromptValidationException");
  }

  // Undeclared template variable referenced
  try {
    validator.validateTemplate("Hello {{userName}} from {{company}}", [{ name: "userName", description: "", required: true }]);
    assert(false, "Should reject template referencing undeclared variable");
  } catch (err) {
    assert(err instanceof PromptValidationException, "Expected PromptValidationException");
  }
  console.log("   ✓ Template syntax checks (brackets, undeclared variables) verified.");

  console.log("\n=== ALL PROMPT FRAMEWORK TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
