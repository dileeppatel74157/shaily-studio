-- Migration version 6: create_youtube_tables
-- Up Migration

CREATE TABLE IF NOT EXISTS channel_connections (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    subscriber_count INTEGER DEFAULT 0,
    video_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    connected_at TEXT NOT NULL,
    last_synced_at TEXT,
    status TEXT NOT NULL DEFAULT 'CONNECTED'
);

CREATE INDEX IF NOT EXISTS idx_channel_connections_platform ON channel_connections(platform);
CREATE INDEX IF NOT EXISTS idx_channel_connections_status ON channel_connections(status);

CREATE TABLE IF NOT EXISTS oauth_credentials (
    channel_id TEXT PRIMARY KEY REFERENCES channel_connections(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type TEXT DEFAULT 'Bearer',
    expires_at TEXT NOT NULL,
    scopes TEXT,
    issued_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_credentials_expires_at ON oauth_credentials(expires_at);

CREATE TABLE IF NOT EXISTS youtube_uploads (
    request_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    video_id TEXT,
    uploaded_at TEXT NOT NULL,
    title TEXT,
    published_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_youtube_uploads_status ON youtube_uploads(status);

CREATE TABLE IF NOT EXISTS channel_sync_jobs (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    status TEXT NOT NULL,
    synced_items TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_channel_sync_jobs_channel_id ON channel_sync_jobs(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_sync_jobs_status ON channel_sync_jobs(status);
