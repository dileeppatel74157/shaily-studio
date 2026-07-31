# Owner Integration Guide: Shaily Studio Personal AI OS

This guide provides instructions for setting up, configuring, and verifying the personal AI operating system for Shaily Studio.

## Step 1: Environment

1. Copy the `.env.example` file in the project root to create your private `.env` file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in the placeholders with your personal API credentials.

---

## Step 2: Database

Shaily Studio uses PostgreSQL (e.g., Supabase or a local installation) for persistence.

1. Ensure PostgreSQL is installed and running.
2. Create a database (e.g., `shaily_studio_dev`).
3. Set the `DATABASE_URL` environment variable:
   ```env
   DATABASE_URL=postgresql://<username>:<password>@<host>:<port>/<dbname>
   ```
4. Run the initialization migrations automatically on startup or manually:
   ```bash
   npx tsx packages/core/src/database/run-migrations.ts
   ```

---

## Step 3: AI Providers

Configure the API keys for the language models you wish to use:

*   **Google Gemini**:
    *   Set `GEMINI_API_KEY` in `.env`.
    *   Obtain from: [Google AI Studio](https://aistudio.google.com/).
*   **OpenAI**:
    *   Set `OPENAI_API_KEY` in `.env`.
    *   Obtain from: [OpenAI Platform](https://platform.openai.com/).
*   **Nvidia NIM**:
    *   Set `NVIDIA_API_KEY` in `.env`.
    *   Obtain from: [NVIDIA Build](https://build.nvidia.com/).
*   **Grok (xAI)**:
    *   Set `GROK_API_KEY` in `.env`.
    *   Obtain from: [xAI Console](https://console.x.ai/).
*   **Ollama (Local)**:
    *   Ensure Ollama is running locally (`ollama serve`).
    *   Set `OLLAMA_BASE_URL=http://localhost:11434`.

---

## Step 4: Media Providers

Configure media generation providers for images, voices, and music:

*   **OpenAI DALL-E (Image)**: Uses `OPENAI_API_KEY`.
*   **ElevenLabs (Voice)**:
    *   Set `ELEVENLABS_API_KEY` in `.env`.
    *   Obtain from: [ElevenLabs Profile](https://elevenlabs.io/).
*   **Suno / MusicGen (Music/SFX)**:
    *   Set `SUNO_API_KEY` or `MUSICGEN_API_KEY` in `.env` if using cloud endpoints.

---

## Step 5: Storage

Assets (images, audio files, and rendered videos) are persisted locally by default, managed by the local workspace `FileSystemStorageProvider`.

### Environment Configuration

The local storage provider and bucket names are configured via the following environment variables:

```env
# Storage Provider (e.g., 'local')
STORAGE_PROVIDER=local

# Local File System path for storage
LOCAL_STORAGE_PATH=./storage

# Configured bucket subdirectory names
STORAGE_BUCKET_IMAGES=images
STORAGE_BUCKET_VIDEOS=videos
STORAGE_BUCKET_AUDIO=audio
STORAGE_BUCKET_EXPORTS=exports
STORAGE_BUCKET_THUMBNAILS=thumbnails
STORAGE_BUCKET_TEMP=temp
STORAGE_BUCKET_CACHE=cache
```

1. Ensure the directory specified in `LOCAL_STORAGE_PATH` exists. It will be created automatically on application startup if it doesn't exist.
2. The system automatically initializes and structures the configured bucket folders within this directory.
3. If cloud buckets are needed, configure S3 compatibility parameters under the `STORAGE_PROVIDER` block in your `.env`.

---

## Step 6: YouTube

To authorize video publishing and fetch channel analytics:

1. Obtain a YouTube API Key from [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **YouTube Data API v3** in your project.
3. Configure `YOUTUBE_API_KEY` in `.env`.
4. Run the OAuth authentication helper to authorize your personal channel session:
   ```bash
   npx tsx packages/core/src/youtube-integration/authenticate.ts
   ```

---

## Step 7: Health Checks

Before launching the full OS pipeline, run the automated health check to verify system readiness:

```bash
npx tsx packages/core/src/readiness/verify-health.ts
```

This verifies:
- Database connectivity
- Local storage write/read permissions
- Registered AI providers' availability
- Environment variable completeness

---

## Step 8: Run Commands

Run individual components or test flows using `npx tsx`:

*   **Database Tests**:
    ```bash
    npx tsx packages/core/src/test-database.ts
    ```
*   **Storage Tests**:
    ```bash
    npx tsx packages/core/src/test-storage.ts
    ```
*   **AI Provider Tests**:
    ```bash
    npx tsx packages/core/src/test-openai-provider.ts
    npx tsx packages/core/src/test-google-provider.ts
    ```
*   **Run Full Pipeline (E2E Orchestration)**:
    ```bash
    npx tsx packages/core/src/test-e2e-integration.ts
    ```

---

## Step 9: Production Validation

To validate all 12 engines together under real-world simulated conditions, execute the end-to-end integration test:

```bash
npx tsx packages/core/src/test-e2e-integration.ts
```

---

## Step 10: Expected Output

When running the E2E integration test, you should see the following logs outputting sequentially, indicating a successful run:

```
=== START FULL END-TO-END SYSTEM ORCHESTRATION TEST ===
1. Instantiating all 12 OS Engines...
2. Initializing and starting all engines...
Step 2: Researching trending topics...
Step 3: Creating content strategy pillars and series...
Step 4: Writing intelligence script draft...
Step 5: Planning and scheduling production tasks...
Step 6: Generating high-quality media assets...
Step 7: Composing and synchronizing media timeline...
Step 8: Rendering the timeline into a final output video file...
Step 9: Running automated QA check on rendered output...
Step 10: Authorizing and uploading video to personal channel...
Step 11: Initializing and gathering publishing analytics...
Step 12: Updating learning feedback loops...
=== ALL 12 PIPELINE ENGINES EXECUTED AND E2E VERIFICATION COMPLETED SUCCESSFULLY ===
```
