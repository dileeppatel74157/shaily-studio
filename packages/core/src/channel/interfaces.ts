import {
  ChannelProfile,
  BrandGuide,
  ContentBlueprint,
  AudiencePersona,
  ChannelKnowledgeBase,
  BlueprintReport,
  BlueprintSnapshot,
  VisualIdentity,
  PublishingRules,
} from "./models";

export interface IChannelEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  generate(id: string, niche: string, options?: Record<string, any>): Promise<ChannelKnowledgeBase>;
  getSnapshot(channelId: string): BlueprintSnapshot;
  getHistory(): ChannelKnowledgeBase[];
}

export interface IBrandEngine {
  generateBrandGuide(niche: string): Promise<BrandGuide>;
  generateVisualIdentity(niche: string): Promise<VisualIdentity>;
}

export interface IBlueprintEngine {
  generateContentBlueprint(id: string): Promise<ContentBlueprint>;
  generatePublishingRules(): Promise<PublishingRules>;
}

export interface IPersonaEngine {
  generatePersonas(niche: string): Promise<AudiencePersona[]>;
}
