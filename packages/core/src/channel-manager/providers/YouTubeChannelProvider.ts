import { IChannelProvider } from "../interfaces";
import { PlatformProvider } from "../PlatformProvider";
import { OAuthToken, ChannelProfile, Playlist, DraftVideo, PlatformCapabilities } from "../models";
import { CapabilityType } from "../CapabilityType";
import { decrypt } from "../../security/encryption";
import { google } from "googleapis";

export class YouTubeChannelProvider implements IChannelProvider {
  public readonly platform = PlatformProvider.YOUTUBE;

  private _getClient(oauth: OAuthToken): any {
    const client = new google.auth.OAuth2(
      process.env.YOUTUBE_OAUTH_CLIENT_ID,
      process.env.YOUTUBE_OAUTH_CLIENT_SECRET,
      process.env.YOUTUBE_OAUTH_REDIRECT_URL
    );
    const accessToken = decrypt(oauth.accessToken);
    const refreshToken = oauth.refreshToken ? decrypt(oauth.refreshToken) : undefined;
    client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: oauth.expiresAt.getTime()
    });
    return client;
  }

  public async fetchProfile(oauth: OAuthToken): Promise<Partial<ChannelProfile>> {
    const auth = this._getClient(oauth);
    const youtube = google.youtube({ version: "v3", auth });
    
    const response = await youtube.channels.list({
      part: ["snippet", "statistics"],
      mine: true
    });
    
    const item = response.data.items?.[0];
    if (!item) {
      throw new Error("No YouTube channel found for current credentials.");
    }
    
    return {
      channelId: item.id || "unknown-yt-channel",
      channelName: item.snippet?.title || "YouTube Channel",
      displayName: item.snippet?.title || "YouTube Channel",
      description: item.snippet?.description || "",
      avatarUrl: item.snippet?.thumbnails?.default?.url || "",
      subscriberCount: parseInt(item.statistics?.subscriberCount || "0", 10),
      videoCount: parseInt(item.statistics?.videoCount || "0", 10),
      viewCount: parseInt(item.statistics?.viewCount || "0", 10),
      language: "en",
      verified: false,
      monetized: true
    };
  }

  public getCapabilities(): PlatformCapabilities {
    return {
      provider: PlatformProvider.YOUTUBE,
      supported: [
        CapabilityType.LONG_VIDEO,
        CapabilityType.SHORTS,
        CapabilityType.LIVE,
        CapabilityType.PLAYLISTS,
        CapabilityType.THUMBNAILS,
        CapabilityType.SUBTITLES,
        CapabilityType.CUSTOM_THUMBNAILS,
        CapabilityType.SCHEDULED_UPLOADS,
        CapabilityType.ANALYTICS,
        CapabilityType.COMMENTS,
        CapabilityType.MEMBERSHIP,
        CapabilityType.MONETIZATION
      ],
      maxFileSizeBytes: 137_438_953_472,
      maxDurationSeconds: 43_200,
      maxTitleLength: 100,
      maxDescriptionLength: 5000,
      maxTagCount: 500,
      supportedResolutions: ["360P","480P","720P","1080P","1440P","4K"],
      supportedFormats: ["mp4","mov","avi","mkv"],
      rateLimit: {
        uploadsPerDay: 6,
        requestsPerMinute: 300,
        requestsPerDay: 10000,
        currentUploadsToday: 0,
        currentRequestsThisMinute: 0
      }
    };
  }

  public async validateToken(oauth: OAuthToken): Promise<{ valid: boolean; expiresInSeconds: number }> {
    const now = Date.now();
    const expiry = oauth.expiresAt.getTime();
    const valid = expiry > now;
    const expiresInSeconds = Math.max(0, Math.floor((expiry - now) / 1000));
    return { valid, expiresInSeconds };
  }

  public async fetchDrafts(oauth: OAuthToken): Promise<DraftVideo[]> {
    return [];
  }

  public async fetchPlaylists(oauth: OAuthToken): Promise<Playlist[]> {
    const auth = this._getClient(oauth);
    const youtube = google.youtube({ version: "v3", auth });
    
    const response = await youtube.playlists.list({
      part: ["snippet", "contentDetails"],
      mine: true,
      maxResults: 50
    });
    
    return (response.data.items || []).map(p => ({
      id: p.id || "",
      channelId: p.snippet?.channelId || "unknown-channel",
      provider: PlatformProvider.YOUTUBE,
      platformPlaylistId: p.id || "",
      title: p.snippet?.title || "",
      description: p.snippet?.description || "",
      videoCount: p.contentDetails?.itemCount || 0,
      visibility: "PUBLIC",
      createdAt: new Date(p.snippet?.publishedAt || Date.now()),
      updatedAt: new Date(p.snippet?.publishedAt || Date.now()),
      lastSyncedAt: new Date()
    }));
  }

  public async ping(): Promise<boolean> {
    try {
      const res = await fetch("https://accounts.google.com/.well-known/openid-configuration", { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }
}
