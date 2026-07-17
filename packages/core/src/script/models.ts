import { ScriptState } from "./ScriptState";
import { ScriptType } from "./ScriptType";
import { StoryStructure } from "./StoryStructure";
import { SceneType } from "./SceneType";
import { DialogueType } from "./DialogueType";

export interface ScriptRequest {
  id: string;
  type: ScriptType;
  topic: string;
  blueprintId?: string;
  state: ScriptState;
  timestamp: Date;
  options?: Record<string, any>;
}

export interface ScriptResponse {
  scriptId: string;
  state: ScriptState;
  outline: ScriptOutline;
  storyMap: StoryMap;
  sections: ScriptSection[];
  scenes: ScriptScene[];
  dialogue: DialogueBlock[];
  retentionPoints: RetentionPoint[];
  reports: ScriptReport[];
  timestamp: Date;
}

export interface ScriptOutline {
  id: string;
  title: string;
  topics: string[];
  durationSeconds: number;
}

export interface StoryMap {
  structure: StoryStructure;
  arcPoints: string[];
  curiosityGaps: string[];
  emotionalPacing: string;
  narrativeTransitions: string[];
}

export interface ScriptSection {
  id: string;
  name: "INTRODUCTION" | "CONTEXT" | "MAIN" | "EXAMPLES" | "SUMMARY" | "CTA";
  durationSeconds: number;
}

export interface ScriptScene {
  id: string;
  type: SceneType;
  objective: string;
  durationSeconds: number;
  transition: string;
  dependencies: string[];
}

export interface DialogueBlock {
  id: string;
  type: DialogueType;
  speaker: string;
  text: string;
  startTimeSeconds: number;
  durationSeconds: number;
}

export interface RetentionPoint {
  timeSeconds: number;
  type: string;
  description: string;
}

export interface ScriptRevision {
  revisionNumber: number;
  timestamp: Date;
  changeSummary: string;
}

export interface ScriptReport {
  id: string;
  timestamp: Date;
  outlineSummary: string;
  storySummary: string;
  timingSummary: string;
  retentionAnalysis: string;
  revisionHistory: ScriptRevision[];
}

export interface ScriptSnapshot {
  scriptId: string;
  state: ScriptState;
  outline: Readonly<ScriptOutline>;
  sections: ReadonlyArray<ScriptSection>;
  dialogue: ReadonlyArray<DialogueBlock>;
  timestamp: Date;
}
