import { ChannelState } from "./ChannelState";
import { BrandTone } from "./BrandTone";
import { BrandPersonality } from "./BrandPersonality";
import { BlueprintState } from "./BlueprintState";
import { AudiencePersonaType } from "./AudiencePersonaType";

export interface ChannelProfile {
  id: string;
  name: string;
  niche: string;
  mission: string;
  vision: string;
  positioning: string;
  valueProposition: string;
  differentiation: string;
}

export interface BrandGuide {
  personality: BrandPersonality;
  tone: BrandTone;
  writingStyle: string;
  communicationRules: string[];
  consistencyRules: string[];
}

export interface VisualIdentity {
  colorPalette: string[];
  designLanguage: string;
  thumbnailStyle: string;
  typographyRules: string[];
  visualConsistency: string;
  animationDirection: string;
  logoGuidance: string;
}

export interface AudiencePersona {
  id: string;
  type: AudiencePersonaType;
  name: string;
  demographics: string;
  painPoints: string[];
  goals: string[];
  interests: string[];
  engagementTriggers: string[];
}

export interface ContentBlueprint {
  id: string;
  state: BlueprintState;
  hookStructure: string;
  openingFormat: string;
  informationFlow: string;
  endingFormat: string;
  ctaStyle: string;
  storyPacing: string;
  retentionCheckpoints: string[];
}

export interface SeriesBlueprint {
  id: string;
  name: string;
  episodeStructure: string;
  seasonPlanning: string;
  playlistMapping: string[];
  crossLinkStrategy: string;
}

export interface PublishingRules {
  uploadRules: string[];
  qualityStandards: string[];
  minimumResearchRequirements: string[];
  thumbnailRules: string[];
  titleRules: string[];
  descriptionRules: string[];
}

export interface ChannelKnowledgeBase {
  identity: ChannelProfile;
  brandGuide: BrandGuide;
  visuals: VisualIdentity;
  personas: AudiencePersona[];
  blueprints: ContentBlueprint[];
  publishingRules: PublishingRules;
  revisionHistory: string[];
}

export interface BlueprintReport {
  id: string;
  timestamp: Date;
  channelSummary: string;
  brandSummary: string;
  audienceSummary: string;
  blueprintSummary: string;
  versionHistory: string[];
}

export interface BlueprintSnapshot {
  channelId: string;
  state: ChannelState;
  knowledgeBase: Readonly<ChannelKnowledgeBase>;
  timestamp: Date;
}
