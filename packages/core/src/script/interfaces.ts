import {
  ScriptRequest,
  ScriptResponse,
  ScriptSnapshot,
  ScriptOutline,
  StoryMap,
  ScriptSection,
  ScriptScene,
  DialogueBlock,
  RetentionPoint,
} from "./models";

export interface IScriptEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  generate(request: ScriptRequest): Promise<ScriptResponse>;
  getSnapshot(scriptId: string): ScriptSnapshot;
  getHistory(): ScriptResponse[];
}

export interface IStoryEngine {
  generateStoryMap(topic: string): Promise<StoryMap>;
}

export interface IHookEngine {
  generateHooks(topic: string): Promise<RetentionPoint[]>;
}

export interface IScenePlanner {
  planScenes(outline: ScriptOutline, sections: ScriptSection[]): Promise<ScriptScene[]>;
}

export interface IDialogueEngine {
  generateDialogue(scenes: ScriptScene[]): Promise<DialogueBlock[]>;
}
