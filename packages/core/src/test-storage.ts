import { StorageBuilder } from "./storage/StorageBuilder";
import { StorageContext } from "./storage/StorageContext";
import { StorageBucket } from "./storage/StorageBucket";
import { StorageObject } from "./storage/StorageObject";
import { StorageQuery } from "./storage/StorageQuery";
import { StorageResult } from "./storage/StorageResult";
import { StorageProvider } from "./storage/StorageProvider";
import { StorageState } from "./storage/StorageState";
import { StorageValidator } from "./storage/StorageValidator";
import {
  StorageException,
  StorageValidationException,
  InvalidStorageStateException,
} from "./storage/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

// Custom mock provider to verify delegation
class MockCustomStorageProvider implements StorageProvider {
  public readonly name = "custom-mock";
  public bucketCreated = false;
  public objectPut = false;

  public async createBucket(bucket: StorageBucket): Promise<void> {
    this.bucketCreated = true;
  }
  public async deleteBucket(bucketId: string): Promise<void> {}
  public hasBucket(bucketId: string): boolean {
    return true;
  }
  public getBucket(bucketId: string): StorageBucket | undefined {
    return { id: bucketId, name: "Mock Bucket" };
  }
  public listBuckets(): readonly StorageBucket[] {
    return [];
  }
  public async putObject(bucketId: string, object: StorageObject): Promise<void> {
    this.objectPut = true;
  }
  public getObject(bucketId: string, objectId: string): StorageObject | undefined {
    return undefined;
  }
  public async deleteObject(bucketId: string, objectId: string): Promise<void> {}
  public listObjects(bucketId: string, query?: StorageQuery): readonly StorageResult[] {
    return [];
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START STORAGE FRAMEWORK VERIFICATION TESTS ===");

  const context: StorageContext = {
    env: "production",
    namespace: "studio-assets",
    metadata: { version: "1.0.0" },
  };

  // ==========================================
  // 1. Builder Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("1. Running Builder Validation...");

  // Valid construction
  const storage = new StorageBuilder()
    .withContext(context)
    .withMetadata({ tier: "premium" })
    .build();

  assert(storage !== null, "Storage instance must be successfully constructed");

  // Invalid construction (missing context)
  try {
    new StorageBuilder().build();
    throw new Error("Should have rejected build with missing context");
  } catch (err: unknown) {
    assert(
      err instanceof StorageValidationException,
      "Expected StorageValidationException for missing context"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Builder Validation.");

  // ==========================================
  // 2. Lifecycle Transition Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("2. Running Lifecycle Transition Validation...");

  const testStorage = new StorageBuilder().withContext(context).build();

  // Try calling runtime operation in CREATED state
  try {
    testStorage.hasBucket("b1");
    throw new Error("Should have prevented hasBucket in CREATED state");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidStorageStateException,
      "Expected InvalidStorageStateException for CREATED state"
    );
  }

  // CREATED -> READY
  await testStorage.initialize();

  // Try illegal transition READY -> STOPPED
  try {
    await testStorage.stop();
    throw new Error("Should have prevented READY -> STOPPED");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidStorageStateException,
      "Expected InvalidStorageStateException for READY -> STOPPED"
    );
  }

  // READY -> RUNNING
  await testStorage.start();

  // Try illegal transition RUNNING -> READY
  try {
    await testStorage.initialize();
    throw new Error("Should have prevented RUNNING -> READY");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidStorageStateException,
      "Expected InvalidStorageStateException for RUNNING -> READY"
    );
  }

  // RUNNING -> STOPPED
  await testStorage.stop();

  // Once stopped, operations must fail
  try {
    testStorage.hasBucket("b1");
    throw new Error("Should have prevented hasBucket in STOPPED state");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidStorageStateException,
      "Expected InvalidStorageStateException for STOPPED state"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Lifecycle State Transition and exception rules.");

  // ==========================================
  // 3. Bucket Registration
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("3. Running Bucket Registration...");

  const activeStorage = new StorageBuilder().withContext(context).build();
  await activeStorage.initialize();
  await activeStorage.start();

  const bucket1: StorageBucket = {
    id: "bucket.images",
    name: "User Profile Images",
  };

  await activeStorage.createBucket(bucket1);
  assert(activeStorage.hasBucket("bucket.images"), "Should record bucket.images");
  assert(activeStorage.getBucket("bucket.images")?.name === "User Profile Images", "Get bucket matches name");
  assert(activeStorage.listBuckets().length === 1, "List buckets count is 1");

  // Duplicate bucket ID prevention
  try {
    await activeStorage.createBucket(bucket1);
    throw new Error("Should have prevented duplicate bucket creation");
  } catch (err: unknown) {
    assert(
      err instanceof StorageValidationException,
      "Expected StorageValidationException for duplicate bucket ID"
    );
  }

  // Delete bucket
  await activeStorage.deleteBucket("bucket.images");
  assert(!activeStorage.hasBucket("bucket.images"), "Bucket deleted successfully");
  assert(activeStorage.listBuckets().length === 0, "Buckets list is empty");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified bucket creation, duplicate prevention, deletion.");

  // ==========================================
  // 4. Object Storage
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("4. Running Object Storage...");

  await activeStorage.createBucket({ id: "media", name: "Media Assets" });

  const obj1: StorageObject = {
    id: "profile.png",
    bucketId: "media",
    content: "binary-content-string",
    metadata: {
      contentType: "image/png",
      size: 1024,
      created: new Date(),
      updated: new Date(),
      tags: ["user", "avatar"],
    },
  };

  await activeStorage.putObject("media", obj1);
  const fetchedObj = activeStorage.getObject("media", "profile.png");
  assert(fetchedObj !== undefined, "Object successfully saved");
  assert(fetchedObj!.content === "binary-content-string", "Content matches");
  assert(fetchedObj!.metadata.size === 1024, "Size matches");

  // Duplicate object ID prevention
  try {
    await activeStorage.putObject("media", obj1);
    throw new Error("Should have prevented duplicate object ID inside bucket");
  } catch (err: unknown) {
    assert(
      err instanceof StorageValidationException,
      "Expected StorageValidationException for duplicate object ID"
    );
  }

  // Target bucket mismatch validation
  try {
    const mismatchObj: StorageObject = {
      ...obj1,
      id: "other.png",
      bucketId: "media",
    };
    await activeStorage.putObject("other-bucket", mismatchObj);
    throw new Error("Should have rejected target bucket mismatch");
  } catch (err: unknown) {
    assert(
      err instanceof StorageValidationException,
      "Expected StorageValidationException for target bucket mismatch"
    );
  }

  // Delete object
  await activeStorage.deleteObject("media", "profile.png");
  assert(activeStorage.getObject("media", "profile.png") === undefined, "Object deleted successfully");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified put, get, delete, and duplicate object prevention.");

  // ==========================================
  // 5. Query Engine
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("5. Running Query Engine...");

  await activeStorage.createBucket({ id: "docs", name: "Documents" });

  const nowTime = new Date();
  const doc1: StorageObject = {
    id: "invoice-01.pdf",
    bucketId: "docs",
    content: "invoice-pdf",
    metadata: {
      contentType: "application/pdf",
      size: 500,
      created: new Date(nowTime.getTime() - 2000), // 2 seconds ago
      updated: nowTime,
      tags: ["finance", "invoice"],
      custom: { department: "billing" },
    },
  };

  const doc2: StorageObject = {
    id: "invoice-02.pdf",
    bucketId: "docs",
    content: "invoice-pdf-2",
    metadata: {
      contentType: "application/pdf",
      size: 750,
      created: new Date(nowTime.getTime() - 1000), // 1 second ago
      updated: nowTime,
      tags: ["finance", "invoice", "urgent"],
      custom: { department: "billing" },
    },
  };

  const doc3: StorageObject = {
    id: "memo-draft.txt",
    bucketId: "docs",
    content: "memo-text",
    metadata: {
      contentType: "text/plain",
      size: 200,
      created: nowTime,
      updated: nowTime,
      tags: ["internal"],
      custom: { department: "hr" },
    },
  };

  await activeStorage.putObject("docs", doc1);
  await activeStorage.putObject("docs", doc2);
  await activeStorage.putObject("docs", doc3);

  // Prefix query
  let results = activeStorage.listObjects("docs", { prefix: "invoice-" });
  assert(results.length === 2, "Prefix filter: should return 2 invoice PDFs");
  assert(results[0].objectId === "invoice-01.pdf", "Sorted correctly (invoice-01)");
  assert(results[1].objectId === "invoice-02.pdf", "Sorted correctly (invoice-02)");

  // Tags query
  results = activeStorage.listObjects("docs", { tags: ["invoice", "urgent"] });
  assert(results.length === 1, "Tags filter: should return 1 urgent invoice");
  assert(results[0].objectId === "invoice-02.pdf", "Correct urgent invoice matches");

  // Created Before query
  results = activeStorage.listObjects("docs", { createdBefore: new Date(nowTime.getTime() - 500) });
  assert(results.length === 2, "CreatedBefore filter: should return 2 older PDFs");

  // Created After query
  results = activeStorage.listObjects("docs", { createdAfter: new Date(nowTime.getTime() - 1500) });
  assert(results.length === 2, "CreatedAfter filter: should return 2 newer docs");

  // Metadata key/value query
  results = activeStorage.listObjects("docs", { metadata: { department: "billing" } });
  assert(results.length === 2, "Metadata filter: should return 2 billing docs");

  results = activeStorage.listObjects("docs", { metadata: { department: "hr" } });
  assert(results.length === 1, "Metadata filter: should return 1 hr doc");
  assert(results[0].objectId === "memo-draft.txt", "Matches hr doc ID");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified metadata filters, prefixes, tags, timestamps.");

  // ==========================================
  // 6. Provider Delegation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("6. Running Provider Delegation...");

  const mockProvider = new MockCustomStorageProvider();
  const delegatedStorage = new StorageBuilder()
    .withContext(context)
    .withProvider(mockProvider)
    .build();

  await delegatedStorage.initialize();
  await delegatedStorage.start();

  await delegatedStorage.createBucket({ id: "delegated", name: "Delegated Bucket" });
  assert(mockProvider.bucketCreated === true, "createBucket delegated to custom provider");

  const mockObj: StorageObject = {
    id: "obj1",
    bucketId: "delegated",
    content: "test",
    metadata: { size: 4, created: new Date(), updated: new Date() },
  };

  await delegatedStorage.putObject("delegated", mockObj);
  assert(mockProvider.objectPut === true, "putObject delegated to custom provider");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified injected provider delegation.");

  // ==========================================
  // 7. Snapshot Immutability Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("7. Running Snapshot Immutability Validation...");

  const snap = activeStorage.snapshot();

  // Try mutating snapshot root
  try {
    (snap as any).timestamp = new Date(0);
    throw new Error("Should have thrown error on modifying snapshot root");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen snapshot root");
  }

  // Try mutating snapshot buckets list
  try {
    (snap.buckets as any)[0] = null;
    throw new Error("Should have thrown error on modifying snapshot buckets");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen snapshot buckets");
  }

  // Try mutating bucket properties
  try {
    (snap.buckets[0] as any).name = "hacked";
    throw new Error("Should have thrown error on modifying snapshot bucket name");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen bucket object");
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified deep freeze immutability.");

  // ==========================================
  // 8. Validator Rule Checks
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("8. Running Validator Rule Checks...");

  // Invalid ID checks (spaces)
  try {
    StorageValidator.validateIdentifier("invalid bucket name space", "Bucket ID");
    throw new Error("Should have rejected space in ID");
  } catch (err: unknown) {
    assert(
      err instanceof StorageValidationException,
      "Expected StorageValidationException for space in ID"
    );
  }

  // Invalid ID checks (symbols)
  try {
    StorageValidator.validateIdentifier("invalid_bucket_@_char", "Bucket ID");
    throw new Error("Should have rejected special symbol in ID");
  } catch (err: unknown) {
    assert(
      err instanceof StorageValidationException,
      "Expected StorageValidationException for special symbol in ID"
    );
  }

  // Invalid object metadata size
  try {
    const invalidObj: StorageObject = {
      id: "test",
      bucketId: "media",
      content: "test",
      metadata: { size: -50, created: new Date(), updated: new Date() }, // size < 0!
    };
    StorageValidator.validateObject(invalidObj);
    throw new Error("Should have rejected negative metadata size");
  } catch (err: unknown) {
    assert(
      err instanceof StorageValidationException,
      "Expected StorageValidationException for negative object size"
    );
  }

  // eslint-disable-next-line no-console
  console.log("   ✓ Verified validator rule constraints.");

  // eslint-disable-next-line no-console
  console.log("=== ALL STORAGE FRAMEWORK VERIFICATION TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
