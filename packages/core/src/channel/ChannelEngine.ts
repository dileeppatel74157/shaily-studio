import { IChannelEngine } from "./interfaces";
import { ChannelState } from "./ChannelState";
import { BrandTone } from "./BrandTone";
import { BrandPersonality } from "./BrandPersonality";
import { BlueprintState } from "./BlueprintState";
import { AudiencePersonaType } from "./AudiencePersonaType";
import {
  ChannelProfile,
  BrandGuide,
  VisualIdentity,
  AudiencePersona,
  ContentBlueprint,
  SeriesBlueprint,
  PublishingRules,
  ChannelKnowledgeBase,
  BlueprintReport,
  BlueprintSnapshot,
} from "./models";
import {
  IBrandEngine,
  IBlueprintEngine,
  IPersonaEngine,
} from "./interfaces";
import { ChannelValidator } from "./ChannelValidator";
import {
  ChannelException,
  ChannelValidationException,
  InvalidChannelStateException,
  DuplicateChannelException,
  deepFreeze,
} from "./types";

export class ChannelEngine implements IChannelEngine {
  private _state = ChannelState.CREATED;
  private readonly _kbHistory: ChannelKnowledgeBase[] = [];
  private readonly _snapshots = new Map<string, BlueprintSnapshot>();

  private readonly _brandEngine: IBrandEngine;
  private readonly _blueprintEngine: IBlueprintEngine;
  private readonly _personaEngine: IPersonaEngine;

  constructor(
    public readonly context: any,
    public readonly configuration?: any,
    public readonly metadata: Record<string, unknown> = {},
    brandEngine?: IBrandEngine,
    blueprintEngine?: IBlueprintEngine,
    personaEngine?: IPersonaEngine
  ) {
    this._brandEngine = brandEngine || {
      generateBrandGuide: async (niche) => ({
        personality: BrandPersonality.EXPERT,
        tone: BrandTone.EDUCATIONAL,
        writingStyle: "Clear, structured, code-first tutorial style.",
        communicationRules: ["Always explain the 'why' before the code.", "Avoid condescending phrasing."],
        consistencyRules: ["No third-party proprietary frameworks without disclosure."],
      }),
      generateVisualIdentity: async (niche) => ({
        colorPalette: ["#1e1e2e", "#cdd6f4", "#89b4fa"], // Dracula/Catppuccin vibes
        designLanguage: "Sleek Dark Mode, high-contrast, modern typography.",
        thumbnailStyle: "Minimal text, prominent syntax snippet, clean icons.",
        typographyRules: ["Headers: Outfit / Inter", "Code: Fira Code / JetBrains Mono"],
        visualConsistency: "Apply subtle background grids and terminal frames.",
        animationDirection: "Smooth 60fps transitions, code fade-ins, terminal syntax highlighting draws.",
        logoGuidance: "Monochrome logo with bracket motifs.",
      }),
    };

    this._blueprintEngine = blueprintEngine || {
      generateContentBlueprint: async (id) => ({
        id: "blueprint-" + id,
        state: BlueprintState.ACTIVE,
        hookStructure: "0-10s: Show the final working output. 10-30s: Highlight the developer pain point resolved.",
        openingFormat: "Standard: 'In this video, we build X using Y. Let's look at the schema...'",
        informationFlow: "1. Problem definition, 2. Live coding step-by-step, 3. Testing/verification, 4. Performance analysis.",
        endingFormat: "Quick recap, CTA to subscribe or check repo link.",
        ctaStyle: "Low friction, contextual: 'Clone the repo below and try running the test cases yourself.'",
        storyPacing: "Fast-paced, jump-cut silence, zoom in on critical code blocks.",
        retentionCheckpoints: ["Live coding transition", "Verification test suite run"],
      }),
      generatePublishingRules: async () => ({
        uploadRules: ["Publish Thursdays at 3 PM EST", "Cross-post to Twitter/Reddit post-publish."],
        qualityStandards: ["Audio noise-floor below -60dB", "Font size in terminal at least 16px."],
        minimumResearchRequirements: ["Check competitor view-to-subscriber ratios", "Run keyword volume checks."],
        thumbnailRules: ["Never use clickbait faces", "Use exact matching topic code syntax in graphic."],
        titleRules: ["Format: 'Build X with Y: A Step-by-Step Guide'", "Keep under 60 characters."],
        descriptionRules: ["Link to GitHub repo on line 1", "Add chapter timestamps on line 10."],
      }),
    };

    this._personaEngine = personaEngine || {
      generatePersonas: async (niche) => [
        {
          id: "persona-1",
          type: AudiencePersonaType.PRIMARY,
          name: "Saurabh the Software Engineer",
          demographics: "22-35, Mid-level developer, working in TS/JS.",
          painPoints: ["Boilerplate setup takes too long", "Hard to find deep-dive production architecture tutorials."],
          goals: ["Wants to learn advanced type-safety patterns", "Wants to build frameworks from scratch."],
          interests: ["TypeScript compiler", "System architecture", "Neovim configs"],
          engagementTriggers: ["Code repository links", "High-density technical deep-dives"],
        },
      ],
    };
  }

  public get state(): ChannelState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== ChannelState.CREATED) {
      throw new InvalidChannelStateException("engine", "initialize", this._state);
    }
    this._state = ChannelState.INITIALIZED;
    if (this.context.logger) {
      this.context.logger.info("ChannelEngine initialized.");
    }
  }

  public async start(): Promise<void> {
    if (this._state !== ChannelState.INITIALIZED && this._state !== ChannelState.STOPPED) {
      throw new InvalidChannelStateException("engine", "start", this._state);
    }
    this._state = ChannelState.RUNNING;
    if (this.context.logger) {
      this.context.logger.info("ChannelEngine started.");
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== ChannelState.RUNNING) {
      throw new InvalidChannelStateException("engine", "stop", this._state);
    }
    this._state = ChannelState.STOPPED;
    if (this.context.logger) {
      this.context.logger.info("ChannelEngine stopped.");
    }
  }

  public getSnapshot(channelId: string): BlueprintSnapshot {
    const snapshot = this._snapshots.get(channelId);
    if (!snapshot) {
      throw new ChannelException(`No snapshot found for channel "${channelId}"`);
    }
    return snapshot;
  }

  public getHistory(): ChannelKnowledgeBase[] {
    return [...this._kbHistory];
  }

  public async generate(id: string, niche: string, options?: Record<string, any>): Promise<ChannelKnowledgeBase> {
    if (this._state !== ChannelState.RUNNING) {
      throw new InvalidChannelStateException(id, "generate", this._state);
    }

    // Validate request parameters
    ChannelValidator.validateRequest(id, niche);

    // Duplicate detection in local history
    const isDup = this._kbHistory.some((kb) => kb.identity.id === id || kb.identity.niche.toLowerCase() === niche.toLowerCase());
    if (isDup) {
      throw new DuplicateChannelException(id);
    }

    // Duplicate detection in Memory Engine
    if (this.context.memoryStore) {
      const existing = await this.context.memoryStore.get("channel-memory", `identity:${niche}`);
      if (existing) {
        if (options?.allowCached) {
          if (this.context.logger) {
            this.context.logger.info(`Returning cached channel profile for: ${niche}`);
          }
          return existing.value as ChannelKnowledgeBase;
        } else {
          throw new ChannelException(`Duplicate channel profile detected in Memory Store for: ${niche}`);
        }
      }
    }

    // Publish event ChannelStarted
    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-channel-start-" + Math.random().toString(36).substring(2, 11),
        name: "ChannelStarted",
        timestamp: new Date(),
        correlationId: options?.correlationId || "corr-channel-" + id,
        source: "ChannelEngine",
        payload: { channelId: id, niche },
        metadata: {},
      });
    }

    try {
      this._state = ChannelState.IDENTITY_GENERATION;
      const identity: ChannelProfile = {
        id,
        name: options?.name || "Shaily Studio Tech",
        niche,
        mission: `Help developers master ${niche} with zero boilerplate and maximum depth.`,
        vision: `Become the primary engineering channel for advanced developer concepts in ${niche}.`,
        positioning: "Advanced Code-First Deep Dives.",
        valueProposition: "Step-by-step engineering without skipping the details.",
        differentiation: "No clickbait, high code density, complete GitHub repos.",
      };

      this._state = ChannelState.BRAND_BUILDING;
      const brandGuide = await this._brandEngine.generateBrandGuide(niche);

      this._state = ChannelState.VISUAL_GENERATION;
      const visuals = await this._brandEngine.generateVisualIdentity(niche);

      this._state = ChannelState.PERSONA_BUILDING;
      const personas = await this._personaEngine.generatePersonas(niche);

      this._state = ChannelState.BLUEPRINT_GENERATION;
      const blueprint = await this._blueprintEngine.generateContentBlueprint(id);
      const blueprints = [blueprint];

      this._state = ChannelState.RULES_GENERATION;
      const publishingRules = await this._blueprintEngine.generatePublishingRules();

      this._state = ChannelState.KNOWLEDGE_BASE_CREATION;
      const kb: ChannelKnowledgeBase = {
        identity,
        brandGuide,
        visuals,
        personas,
        blueprints,
        publishingRules,
        revisionHistory: ["Initial version generated."],
      };

      // Optimization Engine adaptation using Memory/Research
      this._state = ChannelState.OPTIMIZATION;
      if (this.context.memoryStore) {
        const winningBrandData = await this.context.memoryStore.get("channel-memory", "winning-brand-tones");
        if (winningBrandData && winningBrandData.value) {
          const list = winningBrandData.value as string[];
          if (list.includes(brandGuide.tone)) {
            kb.revisionHistory.push(`Optimized brand guidelines based on winning tone: ${brandGuide.tone}`);
          }
        }
      }

      // Validate output
      ChannelValidator.validateKnowledgeBase(kb);

      const snapshot: BlueprintSnapshot = {
        channelId: id,
        state: ChannelState.COMPLETED,
        knowledgeBase: kb,
        timestamp: new Date(),
      };

      // Freeze snapshot
      deepFreeze(snapshot);
      this._snapshots.set(id, snapshot);

      // Store in memory & history
      this._kbHistory.push(kb);

      if (this.context.memoryStore) {
        await this.context.memoryStore.set(
          "channel-memory",
          `identity:${niche}`,
          kb,
          { channelId: id, niche }
        );
      }

      // Publish event ChannelCompleted
      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-channel-complete-" + Math.random().toString(36).substring(2, 11),
          name: "ChannelCompleted",
          timestamp: new Date(),
          correlationId: options?.correlationId || "corr-channel-" + id,
          source: "ChannelEngine",
          payload: { channelId: id },
          metadata: {},
        });
      }

      // Link brand guide & blueprints to script generation automatically if scriptEngine is available
      if (this.context.scriptEngine && options?.generateScriptFromBlueprint) {
        try {
          await this.context.scriptEngine.generate({
            id: "scr-chan-linked-" + id,
            type: "TUTORIAL" as any,
            topic: niche,
            blueprintId: kb.blueprints[0]?.id,
            state: "CREATED" as any,
            timestamp: new Date()
          });
        } catch (e) {
          // Ignore
        }
      }

      // Link brand guide & blueprints to asset planning automatically if assetEngine is available
      if (this.context.assetEngine && options?.generateAssetPlanFromBlueprint) {
        try {
          await this.context.assetEngine.generate({
            id: "ass-chan-linked-" + id,
            scriptId: "scr-chan-linked-" + id,
            state: "CREATED" as any,
            timestamp: new Date()
          });
        } catch (e) {
          // Ignore
        }
      }

      // Link brand guide & blueprints to production planning automatically if productionEngine is available
      if (this.context.productionEngine && options?.generateProductionPlanFromBlueprint) {
        try {
          await this.context.productionEngine.generate({
            id: "prod-chan-linked-" + id,
            scriptId: "scr-chan-linked-" + id,
            state: "CREATED" as any,
            timestamp: new Date()
          });
        } catch (e) {
          // Ignore
        }
      }

      this._state = ChannelState.RUNNING; // restore state
      return kb;
    } catch (error: any) {
      this._state = ChannelState.FAILED;
      
      // Publish event ChannelFailed
      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-channel-fail-" + Math.random().toString(36).substring(2, 11),
          name: "ChannelFailed",
          timestamp: new Date(),
          correlationId: options?.correlationId || "corr-channel-" + id,
          source: "ChannelEngine",
          payload: { channelId: id, error: error.message },
          metadata: {},
        });
      }
      throw error;
    }
  }
}
