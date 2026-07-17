import { IScriptEngine } from "./interfaces";
import { ScriptState } from "./ScriptState";
import { ScriptType } from "./ScriptType";
import { StoryStructure } from "./StoryStructure";
import { SceneType } from "./SceneType";
import { DialogueType } from "./DialogueType";
import {
  ScriptRequest,
  ScriptResponse,
  ScriptOutline,
  StoryMap,
  ScriptSection,
  ScriptScene,
  DialogueBlock,
  RetentionPoint,
  ScriptReport,
  ScriptSnapshot,
} from "./models";
import {
  IStoryEngine,
  IHookEngine,
  IScenePlanner,
  IDialogueEngine,
} from "./interfaces";
import { ScriptValidator } from "./ScriptValidator";
import {
  ScriptException,
  ScriptValidationException,
  InvalidScriptStateException,
  DuplicateScriptException,
  deepFreeze,
} from "./types";

export class ScriptEngine implements IScriptEngine {
  private _state = ScriptState.CREATED;
  private readonly _requests = new Map<string, ScriptRequest>();
  private readonly _history: ScriptResponse[] = [];
  private readonly _snapshots = new Map<string, ScriptSnapshot>();

  private readonly _storyEngine: IStoryEngine;
  private readonly _hookEngine: IHookEngine;
  private readonly _scenePlanner: IScenePlanner;
  private readonly _dialogueEngine: IDialogueEngine;

  constructor(
    public readonly context: any,
    public readonly configuration?: any,
    public readonly metadata: Record<string, unknown> = {},
    storyEngine?: IStoryEngine,
    hookEngine?: IHookEngine,
    scenePlanner?: IScenePlanner,
    dialogueEngine?: IDialogueEngine
  ) {
    this._storyEngine = storyEngine || {
      generateStoryMap: async (topic) => ({
        structure: StoryStructure.PROBLEM_SOLUTION,
        arcPoints: ["Present problem", "Unveil solution", "Analyze benchmarks", "Conclusion"],
        curiosityGaps: ["How to run 20 tests without regressions?", "What does deepFreeze do under the hood?"],
        emotionalPacing: "Rising interest, focused analytical tone.",
        narrativeTransitions: ["So let's see how this works...", "Now we look at the validator rules..."],
      }),
    };

    this._hookEngine = hookEngine || {
      generateHooks: async (topic) => [
        { timeSeconds: 3, type: "RetentionHook", description: "First 3s: Show the passing test output graphics." },
        { timeSeconds: 10, type: "CuriosityLoop", description: "First 10s: Mention secret optimization loops." },
        { timeSeconds: 30, type: "PatternInterrupt", description: "First 30s: Zoom in on terminal compiler error." },
      ],
    };

    this._scenePlanner = scenePlanner || {
      planScenes: async (outline, sections) => [
        { id: "scene-1", type: SceneType.A_ROLL, objective: "Introduce topic", durationSeconds: 20, transition: "Cut", dependencies: [] },
        { id: "scene-2", type: SceneType.SCREENSHARE, objective: "Live coding step", durationSeconds: 30, transition: "Cross-fade", dependencies: ["scene-1"] },
        { id: "scene-3", type: SceneType.A_ROLL, objective: "Summarize and CTA", durationSeconds: 10, transition: "Cut", dependencies: ["scene-2"] },
      ],
    };

    this._dialogueEngine = dialogueEngine || {
      generateDialogue: async (scenes) => [
        { id: "d-1", type: DialogueType.PRESENTER, speaker: "Host", text: "In this tutorial, we will build a content strategy engine from scratch.", startTimeSeconds: 0, durationSeconds: 20 },
        { id: "d-2", type: DialogueType.PRESENTER, speaker: "Host", text: "Here is the schema definitions folder where our TypeScript interfaces sit.", startTimeSeconds: 20, durationSeconds: 30 },
        { id: "d-3", type: DialogueType.PRESENTER, speaker: "Host", text: "Thanks for watching, clone the repo in the link below!", startTimeSeconds: 50, durationSeconds: 10 },
      ],
    };
  }

  public get state(): ScriptState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== ScriptState.CREATED) {
      throw new InvalidScriptStateException("engine", "initialize", this._state);
    }
    this._state = ScriptState.INITIALIZED;
    if (this.context.logger) {
      this.context.logger.info("ScriptEngine initialized.");
    }
  }

  public async start(): Promise<void> {
    if (this._state !== ScriptState.INITIALIZED && this._state !== ScriptState.STOPPED) {
      throw new InvalidScriptStateException("engine", "start", this._state);
    }
    this._state = ScriptState.RUNNING;
    if (this.context.logger) {
      this.context.logger.info("ScriptEngine started.");
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== ScriptState.RUNNING) {
      throw new InvalidScriptStateException("engine", "stop", this._state);
    }
    this._state = ScriptState.STOPPED;
    if (this.context.logger) {
      this.context.logger.info("ScriptEngine stopped.");
    }
  }

  public getSnapshot(scriptId: string): ScriptSnapshot {
    const snapshot = this._snapshots.get(scriptId);
    if (!snapshot) {
      throw new ScriptException(`No snapshot found for script "${scriptId}"`);
    }
    return snapshot;
  }

  public getHistory(): ScriptResponse[] {
    return [...this._history];
  }

  public async generate(request: ScriptRequest): Promise<ScriptResponse> {
    if (this._state !== ScriptState.RUNNING) {
      throw new InvalidScriptStateException(request.id, "generate", this._state);
    }

    // 1. Validate request
    ScriptValidator.validateRequest(request);

    // Duplicate request ID check
    if (this._requests.has(request.id)) {
      throw new DuplicateScriptException(request.id);
    }
    this._requests.set(request.id, request);

    // 2. Duplicate prevention check
    const queryKey = request.topic;
    const isDuplicate = this._history.some(
      (h) => h.scriptId === request.id || h.outline.title.toLowerCase() === queryKey.toLowerCase()
    );
    if (isDuplicate) {
      throw new ScriptException(`Duplicate script generation requested for topic: ${queryKey}`);
    }

    // Check Memory Store
    if (this.context.memoryStore) {
      const existing = await this.context.memoryStore.get("script-memory", `script:${queryKey}`);
      if (existing) {
        if (request.options?.allowCached) {
          if (this.context.logger) {
            this.context.logger.info(`Returning cached script response for: ${queryKey}`);
          }
          return existing.value as ScriptResponse;
        } else {
          throw new ScriptException(`Duplicate script request detected in Memory Store for: ${queryKey}`);
        }
      }
    }

    // Publish event ScriptStarted
    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-script-start-" + Math.random().toString(36).substring(2, 11),
        name: "ScriptStarted",
        timestamp: new Date(),
        correlationId: request.options?.correlationId || "corr-script-" + request.id,
        source: "ScriptEngine",
        payload: { scriptId: request.id, topic: request.topic },
        metadata: {},
      });
    }

    try {
      this._state = ScriptState.ARC_GENERATION;
      const storyMap = await this._storyEngine.generateStoryMap(request.topic);

      this._state = ScriptState.HOOK_BUILDING;
      const hooks = await this._hookEngine.generateHooks(request.topic);

      this._state = ScriptState.SECTION_PLANNING;
      // Section breakdown (1 minute total = 60 seconds)
      const sections: ScriptSection[] = [
        { id: "sec-1", name: "INTRODUCTION", durationSeconds: 20 },
        { id: "sec-2", name: "MAIN", durationSeconds: 30 },
        { id: "sec-3", name: "CTA", durationSeconds: 10 },
      ];

      const outline: ScriptOutline = {
        id: "outline-" + request.id,
        title: `Script on ${request.topic}`,
        topics: [request.topic],
        durationSeconds: 60,
      };

      this._state = ScriptState.SCENE_PLANNING;
      const scenes = await this._scenePlanner.planScenes(outline, sections);

      this._state = ScriptState.DIALOGUE_GENERATION;
      const dialogue = await this._dialogueEngine.generateDialogue(scenes);

      this._state = ScriptState.RETENTION_INSERTION;
      // Combine hooks & mid-video retention points
      const retentionPoints: RetentionPoint[] = [
        ...hooks,
        { timeSeconds: 45, type: "Cliffhanger", description: "What happens if we inject invalid dependencies?" },
      ];

      // Script Optimizer feedback loops
      this._state = ScriptState.OPTIMIZATION;
      if (this.context.memoryStore) {
        const winningStructures = await this.context.memoryStore.get("script-memory", "winning-story-structures");
        if (winningStructures && winningStructures.value) {
          const list = winningStructures.value as string[];
          if (list.includes(storyMap.structure)) {
            storyMap.emotionalPacing = `${storyMap.emotionalPacing} (Optimized based on winning structure)`;
          }
        }
      }

      // If ChannelEngine is available, adapt visual/pacing based on visual identity guidelines
      if (this.context.channelEngine) {
        const history = this.context.channelEngine.getHistory();
        if (history.length > 0) {
          const kb = history[history.length - 1];
          scenes.forEach(s => {
            if (s.type === SceneType.SCREENSHARE) {
              s.objective = `${s.objective} (Using palette: ${kb.visuals.colorPalette.join(", ")})`;
            }
          });
        }
      }

      const report: ScriptReport = {
        id: "rep-scr-" + request.id + "-" + Math.random().toString(36).substring(2, 7),
        timestamp: new Date(),
        outlineSummary: `Script contains ${sections.length} sections and total duration of ${outline.durationSeconds}s.`,
        storySummary: `Story follows ${storyMap.structure} structure with emotional pacing '${storyMap.emotionalPacing}'.`,
        timingSummary: `Scenes: ${scenes.map(s => `${s.id}: ${s.durationSeconds}s`).join(", ")}`,
        retentionAnalysis: `Included ${retentionPoints.length} retention triggers.`,
        revisionHistory: [{ revisionNumber: 1, timestamp: new Date(), changeSummary: "Initial blueprint script generated." }],
      };

      const response: ScriptResponse = {
        scriptId: request.id,
        state: ScriptState.COMPLETED,
        outline,
        storyMap,
        sections,
        scenes,
        dialogue,
        retentionPoints,
        reports: [report],
        timestamp: new Date(),
      };

      // Validator Rules
      ScriptValidator.validateResponse(response);

      // Snapshot & deepFreeze
      const snapshot: ScriptSnapshot = {
        scriptId: request.id,
        state: ScriptState.COMPLETED,
        outline: response.outline,
        sections: response.sections,
        dialogue: response.dialogue,
        timestamp: response.timestamp,
      };
      deepFreeze(snapshot);
      this._snapshots.set(request.id, snapshot);

      // Save history & Memory Store
      this._history.push(response);

      if (this.context.memoryStore) {
        await this.context.memoryStore.set(
          "script-memory",
          `script:${queryKey}`,
          response,
          { scriptId: request.id, duration: outline.durationSeconds }
        );
      }

      // Publish event ScriptCompleted
      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-script-complete-" + Math.random().toString(36).substring(2, 11),
          name: "ScriptCompleted",
          timestamp: new Date(),
          correlationId: request.options?.correlationId || "corr-script-" + request.id,
          source: "ScriptEngine",
          payload: { scriptId: request.id },
          metadata: {},
        });
      }

      // Link completed scripts to asset planning engine automatically if assetEngine is available
      if (this.context.assetEngine && request.options?.generateAssetPlan) {
        try {
          await this.context.assetEngine.generate({
            id: "ass-script-linked-" + request.id,
            scriptId: request.id,
            state: "CREATED" as any,
            timestamp: new Date()
          });
        } catch (e) {
          // Ignore
        }
      }

      this._state = ScriptState.RUNNING; // restore state
      return response;
    } catch (error: any) {
      this._state = ScriptState.FAILED;
      
      // Publish event ScriptFailed
      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-script-fail-" + Math.random().toString(36).substring(2, 11),
          name: "ScriptFailed",
          timestamp: new Date(),
          correlationId: request.options?.correlationId || "corr-script-" + request.id,
          source: "ScriptEngine",
          payload: { scriptId: request.id, error: error.message },
          metadata: {},
        });
      }
      throw error;
    }
  }
}
