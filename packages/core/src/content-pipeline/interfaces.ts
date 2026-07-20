import { ContentPipelineState } from "./ContentPipelineState";
import { ContentStage } from "./ContentStage";
import { RenderQuality } from "./RenderQuality";
import {
  Storyboard,
  Scene,
  Shot,
  VoiceSegment,
  Subtitle,
  MusicTrack,
  SoundEffect,
  VideoSegment,
  CompositionTimeline,
  GeneratedAsset,
  RenderReport,
  QualityReport,
  PublishingPackage,
  ExecutionSnapshot,
  ContentPipelineStatistics
} from "./models";

export interface IContentPipelineEngine {
  getState(): ContentPipelineState;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;

  execute(scriptId: string, projectId: string): Promise<PublishingPackage>;
  getSnapshot(): ExecutionSnapshot;
  getStatistics(): ContentPipelineStatistics;

  // Managers
  getStoryboardManager(): IStoryboardManager;
  getScenePlanner(): IScenePlanner;
  getImageGenerationManager(): IImageGenerationManager;
  getVoiceGenerationManager(): IVoiceGenerationManager;
  getMusicGenerationManager(): IMusicGenerationManager;
  getSfxGenerationManager(): ISfxGenerationManager;
  getVideoGenerationManager(): IVideoGenerationManager;
  getCompositionManager(): ICompositionManager;
  getRenderManager(): IRenderManager;
  getQualityManager(): IQualityManager;

  // Events
  on(event: string, handler: (payload: any) => void): void;
  off(event: string, handler: (payload: any) => void): void;
}

export interface IStoryboardManager {
  generateStoryboard(scriptId: string, projectId: string): Promise<Storyboard>;
  getStoryboard(storyboardId: string): Storyboard | undefined;
}

export interface IScenePlanner {
  planScenes(storyboardId: string): Promise<Scene[]>;
}

export interface IImageGenerationManager {
  generateImages(scenes: Scene[]): Promise<GeneratedAsset[]>;
}

export interface IVoiceGenerationManager {
  generateVoice(scenes: Scene[]): Promise<VoiceSegment[]>;
}

export interface IMusicGenerationManager {
  generateMusic(prompt: string, durationSeconds: number): Promise<MusicTrack>;
}

export interface ISfxGenerationManager {
  generateSfx(scenes: Scene[]): Promise<SoundEffect[]>;
}

export interface IVideoGenerationManager {
  generateVideos(scenes: Scene[]): Promise<VideoSegment[]>;
}

export interface ICompositionManager {
  assembleTimeline(
    scenes: Scene[],
    images: GeneratedAsset[],
    videos: VideoSegment[],
    voice: VoiceSegment[],
    music: MusicTrack,
    sfx: SoundEffect[]
  ): Promise<CompositionTimeline>;
}

export interface IRenderManager {
  render(timeline: CompositionTimeline, quality: RenderQuality): Promise<RenderReport>;
}

export interface IQualityManager {
  review(timeline: CompositionTimeline, report: RenderReport): Promise<QualityReport>;
}
