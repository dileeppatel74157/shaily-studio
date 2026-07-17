import {
  AssetRequest,
  AssetResponse,
  ProductionSnapshot,
  ProductionAsset,
  AssetPrompt,
  StyleGuide,
  CharacterProfile,
  MediaTimeline,
} from "./models";

export interface IAssetEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  generate(request: AssetRequest): Promise<AssetResponse>;
  getSnapshot(productionId: string): ProductionSnapshot;
  getHistory(): AssetResponse[];
}

export interface IPromptEngine {
  generatePrompts(asset: ProductionAsset): Promise<AssetPrompt[]>;
}

export interface IStyleEngine {
  generateStyleGuide(niche: string): Promise<StyleGuide>;
}

export interface ICharacterEngine {
  generateCharacterProfiles(niche: string): Promise<CharacterProfile[]>;
}

export interface ITimelinePlanner {
  generateTimeline(assets: ProductionAsset[]): Promise<MediaTimeline>;
}
