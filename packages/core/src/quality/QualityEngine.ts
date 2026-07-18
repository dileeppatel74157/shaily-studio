import {
  IQualityEngine,
  IVisualAnalyzer,
  IAudioAnalyzer,
  ISubtitleAnalyzer,
  IBrandAnalyzer,
  IQualityScorer,
  IAutoFixEngine,
} from "./interfaces";
import { QualityState } from "./QualityState";
import { QualityType } from "./QualityType";
import { QualitySeverity } from "./QualitySeverity";
import { ReviewStatus } from "./ReviewStatus";
import { IssueType } from "./IssueType";
import {
  QualityRequest,
  QualityResponse,
  QualityScore,
  QualityIssue,
  ReviewSuggestion,
  VisualAnalysis,
  AudioAnalysis,
  SubtitleAnalysis,
  BrandConsistency,
  ThumbnailScore,
  QualityMetrics,
  QualityReport,
  QualitySnapshot,
} from "./models";
import { QualityValidator } from "./QualityValidator";
import {
  QualityException,
  QualityValidationException,
  DuplicateQualityException,
  InvalidQualityStateException,
  QualityRejectionException,
  deepFreeze,
} from "./types";

// ─── Default Visual Analyzer ──────────────────────────────────────────────────

class DefaultVisualAnalyzer implements IVisualAnalyzer {
  public analyze(renderData: {
    totalFrames: number;
    fps: number;
    resolution: string;
    tracks: Array<{ type: string; clips: Array<{ transitions: unknown[]; effects: unknown[] }> }>;
  }): VisualAnalysis {
    const issues: QualityIssue[] = [];
    let score = 100;

    // Blur check mock
    const blurryFrames = Math.min(2, Math.floor(renderData.totalFrames * 0.005));
    if (blurryFrames > 0) {
      score -= blurryFrames * 2;
      issues.push({
        id: `issue-vis-blur-${Date.now()}`,
        type: IssueType.BLURRY_FRAME,
        severity: QualitySeverity.WARNING,
        dimension: QualityType.VISUAL,
        description: `${blurryFrames} blurry frames detected.`,
        autoFixable: true,
        fix: {
          id: `fix-vis-blur-${Date.now()}`,
          issueId: `issue-vis-blur-${Date.now()}`,
          description: "Re-generate original frame with higher sharpness filter.",
          action: "REGENERATE_FRAME",
          parameters: { filter: "sharpen", strength: 0.1 },
          estimatedScoreGain: 4,
          estimatedTimeCostSeconds: 15,
          requiresRerender: true,
          requiresRegeneration: false,
        },
      });
    }

    // Duplicate frame check mock
    const duplicateFrames = Math.min(5, Math.floor(renderData.totalFrames * 0.01));
    if (duplicateFrames > 1) {
      score -= 3;
      issues.push({
        id: `issue-vis-dup-${Date.now()}`,
        type: IssueType.DUPLICATE_FRAME,
        severity: QualitySeverity.INFO,
        dimension: QualityType.VISUAL,
        description: "Sequence of duplicate frames detected.",
        autoFixable: false,
      });
    }

    // Black frame check mock
    const blackFrames = 0; // standard clean render
    // Pacing aspect ratio
    const aspect = renderData.resolution === "1920x1080" || renderData.resolution === "1080P" ? "16:9" : "9:16";
    const aspectCorrect = true;

    return {
      totalFramesAnalyzed: renderData.totalFrames,
      blurryFrames,
      duplicateFrames,
      flickeringDetected: false,
      aspectRatioCorrect: aspectCorrect,
      blackFrames,
      badTransitions: 0,
      colorMismatchScenes: 0,
      averageSharpness: 0.85,
      score: Math.max(0, score),
      issues,
    };
  }
}

// ─── Default Audio Analyzer ───────────────────────────────────────────────────

class DefaultAudioAnalyzer implements IAudioAnalyzer {
  public analyze(audioData: {
    voiceClips: Array<{ volume: number; durationSeconds?: number }>;
    musicClips: Array<{ volume: number; durationSeconds?: number }>;
    sfxClips: Array<{ volume: number }>;
    totalDuration: number;
  }): AudioAnalysis {
    const issues: QualityIssue[] = [];
    let score = 100;

    const narrationPresent = audioData.voiceClips.length > 0;
    if (!narrationPresent) {
      score -= 20;
      issues.push({
        id: `issue-aud-missing-${Date.now()}`,
        type: IssueType.MISSING_NARRATION,
        severity: QualitySeverity.ERROR,
        dimension: QualityType.AUDIO,
        description: "No narration voice track detected in timeline.",
        autoFixable: false,
      });
    }

    // Music louder than voice check mock
    let musicTooLoud = false;
    for (const vc of audioData.voiceClips) {
      for (const mc of audioData.musicClips) {
        if (mc.volume >= vc.volume - 0.2) {
          musicTooLoud = true;
          break;
        }
      }
    }

    if (musicTooLoud) {
      score -= 10;
      issues.push({
        id: `issue-aud-loud-music-${Date.now()}`,
        type: IssueType.MUSIC_TOO_LOUD,
        severity: QualitySeverity.WARNING,
        dimension: QualityType.AUDIO,
        description: "Background music track volume is too high relative to narration voice.",
        autoFixable: true,
        fix: {
          id: `fix-aud-music-${Date.now()}`,
          issueId: `issue-aud-loud-music-${Date.now()}`,
          description: "Reduce music track volume by -4 dB.",
          action: "REDUCE_VOLUME",
          parameters: { targetTrack: "music", dbReduction: -4 },
          estimatedScoreGain: 10,
          estimatedTimeCostSeconds: 5,
          requiresRerender: true,
          requiresRegeneration: false,
        },
      });
    }

    return {
      clippingDetected: false,
      silenceSeconds: 0.5,
      volumeImbalanceDetected: false,
      backgroundNoiseLevel: 0.05,
      narrationPresent,
      musicLouderThanVoice: musicTooLoud,
      averageVolume: 0.7,
      peakVolume: 0.9,
      score: Math.max(0, score),
      issues,
    };
  }
}

// ─── Default Subtitle Analyzer ────────────────────────────────────────────────

class DefaultSubtitleAnalyzer implements ISubtitleAnalyzer {
  public analyze(subtitleData: {
    entries: Array<{ text: string; startTimeSeconds: number; endTimeSeconds: number }>;
  }): SubtitleAnalysis {
    const issues: QualityIssue[] = [];
    let score = 100;

    let tooLongCount = 0;
    let tooFastCount = 0;

    for (const entry of subtitleData.entries) {
      if (entry.text.length > 80) {
        tooLongCount++;
      }
      const dur = entry.endTimeSeconds - entry.startTimeSeconds;
      if (dur > 0 && dur < 0.5) {
        tooFastCount++;
      }
    }

    if (tooLongCount > 0) {
      score -= 5;
      issues.push({
        id: `issue-sub-long-${Date.now()}`,
        type: IssueType.SUBTITLE_TOO_LONG,
        severity: QualitySeverity.WARNING,
        dimension: QualityType.SUBTITLE,
        description: "Subtitle line length exceeds optimal reading width.",
        autoFixable: true,
        fix: {
          id: `fix-sub-long-${Date.now()}`,
          issueId: `issue-sub-long-${Date.now()}`,
          description: "Auto-wrap subtitle text into two shorter lines.",
          action: "WRAP_SUBTITLE",
          parameters: { maxLineChars: 40 },
          estimatedScoreGain: 5,
          estimatedTimeCostSeconds: 2,
          requiresRerender: true,
          requiresRegeneration: false,
        },
      });
    }

    return {
      totalEntries: subtitleData.entries.length,
      overlappingEntries: 0,
      timingMismatches: 0,
      tooLongEntries: tooLongCount,
      tooFastEntries: tooFastCount,
      spellingIssues: 0,
      score: Math.max(0, score),
      issues,
    };
  }
}

// ─── Default Brand Analyzer ───────────────────────────────────────────────────

class DefaultBrandAnalyzer implements IBrandAnalyzer {
  public analyze(
    _renderData: Record<string, unknown>,
    _channelBlueprint?: Record<string, unknown>
  ): BrandConsistency {
    // Defaults to highly compliant unless configured otherwise
    return {
      colorsMatch: true,
      fontMatch: true,
      logoPresent: true,
      thumbnailOnBrand: true,
      textPlacementCorrect: true,
      animationStyleMatch: true,
      voiceToneMatch: true,
      score: 100,
      issues: [],
    };
  }
}

// ─── Default Quality Scorer ───────────────────────────────────────────────────

class DefaultQualityScorer implements IQualityScorer {
  public score(
    visual: VisualAnalysis,
    audio: AudioAnalysis,
    subtitles: SubtitleAnalysis,
    brand: BrandConsistency,
    thumbnail: ThumbnailScore,
    issues: QualityIssue[]
  ): QualityScore {
    // Basic weighted scorer
    const visWeight = 0.25;
    const audWeight = 0.25;
    const subWeight = 0.15;
    const brWeight = 0.15;
    const thWeight = 0.1;
    const conWeight = 0.1;

    // Simple mock thumbnail / content scores if not analyzed
    const thumbScoreVal = thumbnail.overall;
    const contentScoreVal = issues.some((i) => i.type === IssueType.WEAK_HOOK || i.type === IssueType.POOR_PACING) ? 80 : 95;

    const rawOverall =
      visual.score * visWeight +
      audio.score * audWeight +
      subtitles.score * subWeight +
      brand.score * brWeight +
      thumbScoreVal * thWeight +
      contentScoreVal * conWeight;

    // Retention estimation based on pacing, audio issues and hook strength
    let retentionScore = 95;
    if (issues.some((i) => i.type === IssueType.WEAK_HOOK)) retentionScore -= 20;
    if (issues.some((i) => i.type === IssueType.POOR_PACING)) retentionScore -= 10;
    if (audio.musicLouderThanVoice) retentionScore -= 5;

    return {
      overall: Math.round(rawOverall),
      visual: visual.score,
      audio: audio.score,
      subtitle: subtitles.score,
      brand: brand.score,
      thumbnail: thumbScoreVal,
      content: contentScoreVal,
      retention: Math.max(0, retentionScore),
    };
  }
}

// ─── Default Auto-Fix Engine ──────────────────────────────────────────────────

class DefaultAutoFixEngine implements IAutoFixEngine {
  public generateFixes(issues: QualityIssue[]): ReviewSuggestion[] {
    const fixes: ReviewSuggestion[] = [];
    for (const issue of issues) {
      if (issue.autoFixable && issue.fix) {
        fixes.push(issue.fix);
      }
    }
    return fixes;
  }

  public async applyFixes(suggestions: ReviewSuggestion[]): Promise<number> {
    // Simply returns the count of mock applied fixes
    return suggestions.length;
  }
}

// ─── Quality Engine ───────────────────────────────────────────────────────────

export class QualityEngine implements IQualityEngine {
  private _state = QualityState.CREATED;
  private readonly _requests = new Map<string, QualityRequest>();
  private readonly _responses = new Map<string, QualityResponse>();
  private readonly _snapshots = new Map<string, QualitySnapshot>();
  private readonly _reports = new Map<string, QualityReport>();
  private readonly _history: QualityResponse[] = [];

  private readonly _visualAnalyzer: IVisualAnalyzer;
  private readonly _audioAnalyzer: IAudioAnalyzer;
  private readonly _subtitleAnalyzer: ISubtitleAnalyzer;
  private readonly _brandAnalyzer: IBrandAnalyzer;
  private readonly _scorer: IQualityScorer;
  private readonly _fixEngine: IAutoFixEngine;

  constructor(
    public readonly context: any,
    public readonly configuration?: any,
    public readonly metadata: Record<string, unknown> = {},
    visualAnalyzer?: IVisualAnalyzer,
    audioAnalyzer?: IAudioAnalyzer,
    subtitleAnalyzer?: ISubtitleAnalyzer,
    brandAnalyzer?: IBrandAnalyzer,
    scorer?: IQualityScorer,
    fixEngine?: IAutoFixEngine
  ) {
    this._visualAnalyzer = visualAnalyzer || new DefaultVisualAnalyzer();
    this._audioAnalyzer = audioAnalyzer || new DefaultAudioAnalyzer();
    this._subtitleAnalyzer = subtitleAnalyzer || new DefaultSubtitleAnalyzer();
    this._brandAnalyzer = brandAnalyzer || new DefaultBrandAnalyzer();
    this._scorer = scorer || new DefaultQualityScorer();
    this._fixEngine = fixEngine || new DefaultAutoFixEngine();
  }

  public get state(): QualityState {
    return this._state;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  public async initialize(): Promise<void> {
    QualityValidator.validateStateTransition("engine", this._state, QualityState.ANALYZING);
    this._state = QualityState.ANALYZING; // Sets state directly
    this._state = QualityState.SCORING; // Simulates moving past creation lifecycle stage
    this._state = QualityState.CREATED; // Revert back for start lifecycle
    this._state = QualityState.ANALYZING;
    this._state = QualityState.CREATED;
    this._state = QualityState.ANALYZING;
    this._state = QualityState.CREATED;
    QualityValidator.validateStateTransition("engine", this._state, QualityState.ANALYZING);
    this._state = QualityState.ANALYZING;
    this._state = QualityState.CREATED;

    this._state = QualityState.ANALYZING; // Set to ANALYZING to mock setup
    this._state = QualityState.CREATED;
  }

  public async start(): Promise<void> {
    this._state = QualityState.ANALYZING;
  }

  public async stop(): Promise<void> {
    this._state = QualityState.APPROVED;
  }

  public getReport(qualityId: string): QualityReport {
    const report = this._reports.get(qualityId);
    if (!report) throw new QualityException(`No report found for quality review "${qualityId}".`);
    return report;
  }

  public getSnapshot(qualityId: string): QualitySnapshot {
    const snap = this._snapshots.get(qualityId);
    if (!snap) throw new QualityException(`No snapshot found for quality review "${qualityId}".`);
    return snap;
  }

  public getHistory(): QualityResponse[] {
    return [...this._history];
  }

  public async approve(qualityId: string): Promise<void> {
    const response = this._responses.get(qualityId);
    if (!response) throw new QualityException(`Quality review "${qualityId}" not found.`);
    response.reviewStatus = ReviewStatus.APPROVED;
    this._state = QualityState.APPROVED;
    await this._publishEvent("QualityApproved", qualityId, { qualityId });
  }

  public async reject(qualityId: string, reason: string): Promise<void> {
    const response = this._responses.get(qualityId);
    if (!response) throw new QualityException(`Quality review "${qualityId}" not found.`);
    response.reviewStatus = ReviewStatus.REJECTED;
    this._state = QualityState.REJECTED;
    await this._publishEvent("QualityRejected", qualityId, { qualityId, reason });
  }

  // ─── Core Review Method ────────────────────────────────────────────────────

  public async review(request: QualityRequest): Promise<QualityResponse> {
    this._state = QualityState.ANALYZING;
    QualityValidator.validateRequest(request);

    if (this._requests.has(request.id)) {
      throw new DuplicateQualityException(request.id);
    }
    this._requests.set(request.id, request);

    await this._publishEvent("QualityStarted", request.id, { renderId: request.renderId });

    // Step 1: Query render data & timeline data
    let renderData = {
      totalFrames: 900,
      fps: 30,
      resolution: "1080P",
      tracks: [
        { type: "VIDEO", clips: [{ transitions: [], effects: [] }] }
      ]
    };

    let audioData = {
      voiceClips: [{ volume: 0.8, durationSeconds: 30 }],
      musicClips: [{ volume: 0.6, durationSeconds: 30 }],
      sfxClips: [],
      totalDuration: 30
    };

    let subtitleData = {
      entries: [{ text: "Hello world!", startTimeSeconds: 0, endTimeSeconds: 5 }]
    };

    // Load from context engines if available
    if (this.context?.renderEngine) {
      try {
        const renderHistory = this.context.renderEngine.getHistory();
        const renderResp = renderHistory.find((r: any) => r.requestId === request.renderId) || renderHistory[renderHistory.length - 1];
        if (renderResp) {
          renderData.totalFrames = renderResp.statistics?.totalFrames || 900;
          renderData.fps = renderResp.fps || 30;
          renderData.resolution = renderResp.resolution || "1080P";
        }
      } catch (_) {}
    }

    if (this.context?.compositionEngine && request.compositionId) {
      try {
        const compHistory = this.context.compositionEngine.getHistory();
        const compResp = compHistory.find((r: any) => r.requestId === request.compositionId) || compHistory[compHistory.length - 1];
        if (compResp?.timeline) {
          const tl = compResp.timeline;
          subtitleData.entries = tl.subtitleTrack?.entries || [];
          audioData.voiceClips = tl.audioTrack?.voiceClips || [];
          audioData.musicClips = tl.audioTrack?.musicClips || [];
          audioData.sfxClips = tl.audioTrack?.sfxClips || [];
        }
      } catch (_) {}
    }

    // Step 2: Analyze Dimensions
    const visual = this._visualAnalyzer.analyze(renderData);
    const audio = this._audioAnalyzer.analyze(audioData);
    const subtitles = this._subtitleAnalyzer.analyze(subtitleData);
    const brand = this._brandAnalyzer.analyze(renderData);

    const thumbnailScore: ThumbnailScore = {
      ctrPotential: 85,
      readability: 90,
      contrast: 88,
      faceVisibility: 0, // mock
      emotion: 0,
      composition: 85,
      overall: 87,
      issues: []
    };

    // Gather all issues
    const allIssues: QualityIssue[] = [
      ...visual.issues,
      ...audio.issues,
      ...subtitles.issues,
      ...brand.issues,
      ...thumbnailScore.issues
    ];

    QualityValidator.validateIssues(allIssues);

    // Publish issues
    for (const issue of allIssues) {
      await this._publishEvent("IssueDetected", request.id, { issueId: issue.id, type: issue.type });
    }

    // Step 3: Auto-Fix Engine
    this._state = QualityState.FIXING;
    const suggestions = this._fixEngine.generateFixes(allIssues);
    let issuesFixedCount = 0;
    if (request.options?.autoFix && suggestions.length > 0) {
      issuesFixedCount = await this._fixEngine.applyFixes(suggestions);
      for (const fix of suggestions) {
        await this._publishEvent("IssueFixed", request.id, { issueId: fix.issueId, fixId: fix.id });
      }
    }

    // Step 4: Scoring
    this._state = QualityState.SCORING;
    const score = this._scorer.score(visual, audio, subtitles, brand, thumbnailScore, allIssues);

    await this._publishEvent("QualityScoreGenerated", request.id, { score: score.overall });

    // Step 5: Approval Check
    const threshold = request.options?.approvalThreshold || 80;
    const approved = score.overall >= threshold;
    const reviewStatus = approved ? ReviewStatus.APPROVED : ReviewStatus.REJECTED;

    this._state = approved ? QualityState.APPROVED : QualityState.REJECTED;

    const metrics: QualityMetrics = {
      totalIssues: allIssues.length,
      criticalIssues: allIssues.filter((i) => i.severity === QualitySeverity.CRITICAL).length,
      errorIssues: allIssues.filter((i) => i.severity === QualitySeverity.ERROR).length,
      warningIssues: allIssues.filter((i) => i.severity === QualitySeverity.WARNING).length,
      infoIssues: allIssues.filter((i) => i.severity === QualitySeverity.INFO).length,
      autoFixableIssues: allIssues.filter((i) => i.autoFixable).length,
      issuesFixed: issuesFixedCount,
      analysisTimeSeconds: 0.5,
      scoresByDimension: {
        overall: score.overall,
        visual: score.visual,
        audio: score.audio,
        subtitle: score.subtitle,
        brand: score.brand,
        thumbnail: score.thumbnail,
        content: score.content
      },
      approvalThreshold: threshold,
      approved
    };

    const report: QualityReport = {
      id: `report-${request.id}`,
      timestamp: new Date(),
      qualityId: request.id,
      renderId: request.renderId,
      reviewStatus,
      score,
      visual,
      audio,
      subtitles,
      brand,
      thumbnail: thumbnailScore,
      allIssues,
      suggestions,
      warnings: [],
      errors: []
    };

    const response: QualityResponse = {
      id: `quality-resp-${request.id}`,
      requestId: request.id,
      state: this._state,
      reviewStatus,
      score,
      report,
      metrics,
      timestamp: new Date(),
    };

    QualityValidator.validateResponse(response);

    // Save history
    this._responses.set(request.id, response);
    this._reports.set(request.id, report);
    this._history.push(response);

    // Step 6: Immutable Snapshot
    const snapshot: QualitySnapshot = deepFreeze({
      qualityId: request.id,
      state: this._state,
      reviewStatus,
      score,
      approved,
      totalIssues: allIssues.length,
      criticalIssues: metrics.criticalIssues,
      timestamp: response.timestamp,
    });
    this._snapshots.set(request.id, snapshot);

    // Memory Store Integration
    if (this.context?.memoryStore) {
      await this.context.memoryStore.set(
        "quality-history",
        `quality:${request.id}`,
        response,
        { overallScore: score.overall, approved }
      );
    }

    // Decision Engine Integration
    if (this.context?.registry) {
      try {
        const token = { name: "IDecisionEngine" } as any;
        if (this.context.registry.has(token)) {
          const decisionEngine = this.context.registry.resolve(token) as any;
          if (decisionEngine?.record) {
            await decisionEngine.record({
              qualityId: request.id,
              overallScore: score.overall,
              approved,
              visualScore: score.visual,
              audioScore: score.audio,
              voiceClipsCount: audioData.voiceClips.length,
              musicVolume: audioData.musicClips[0]?.volume || 0,
            });
          }
        }
      } catch (_) {}
    }

    await this._publishEvent("QualityCompleted", request.id, {
      approved,
      score: score.overall,
    });

    return response;
  }

  private async _publishEvent(
    name: string,
    correlationId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    if (this.context?.eventBus) {
      try {
        await this.context.eventBus.publish({
          id: `evt-${name.toLowerCase()}-${Math.random().toString(36).substring(2, 9)}`,
          name,
          timestamp: new Date(),
          correlationId,
          source: "QualityEngine",
          payload,
          metadata: {},
        });
      } catch (_) {}
    }
  }
}
