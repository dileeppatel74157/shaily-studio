/**
 * Audio Timeline Compiler
 * Transforms narration, music, and SFX assets into a synchronized,
 * deterministic multi-track AudioTimeline with ducking specifications.
 */

import {
  AudioTimeline,
  AudioTrack,
  AudioSegment,
  NarrationSegmentSpec,
  MusicPlanSpec,
  SFXCueSpec
} from "./models";

export class AudioTimelineCompiler {
  /**
   * Compiles individual audio assets into an authoritative AudioTimeline.
   */
  public static compileTimeline(params: {
    timelineId?: string;
    totalDurationSeconds: number;
    narrationSegments: NarrationSegmentSpec[];
    musicSpec?: MusicPlanSpec;
    sfxCues?: SFXCueSpec[];
    sampleRate?: number;
    channels?: number;
  }): AudioTimeline {
    const totalDuration = params.totalDurationSeconds || 20;
    const sampleRate = params.sampleRate || 48000;
    const channels = params.channels || 2;
    const tracks: AudioTrack[] = [];

    // 1. Narration Track
    const narrationSegments: AudioSegment[] = [];
    for (const seg of params.narrationSegments) {
      if (seg.filePath || seg.audioUrl) {
        narrationSegments.push({
          id: seg.id,
          kind: "NARRATION",
          filePath: seg.filePath || "",
          publicUrl: seg.audioUrl || "",
          startTimeSeconds: seg.startOffsetSeconds || 0,
          durationSeconds: seg.actualDurationSeconds || seg.expectedDurationSeconds || 5,
          volume: 1.0,
          fadeInSeconds: 0.05,
          fadeOutSeconds: 0.05,
          metadata: {
            speakerId: seg.speakerId,
            voiceId: seg.voiceId,
            sceneId: seg.sceneId
          }
        });
      }
    }

    tracks.push({
      id: "track-narration",
      name: "Voice Narration",
      kind: "NARRATION",
      segments: narrationSegments,
      volume: 1.0
    });

    // 2. Music Track (with ducking enabled)
    if (params.musicSpec && (params.musicSpec.filePath || params.musicSpec.audioUrl)) {
      const musicVol = params.musicSpec.volume || 0.2;
      const musicSegments: AudioSegment[] = [
        {
          id: params.musicSpec.id,
          kind: "MUSIC",
          filePath: params.musicSpec.filePath || "",
          publicUrl: params.musicSpec.audioUrl || "",
          startTimeSeconds: 0,
          durationSeconds: totalDuration,
          volume: musicVol,
          fadeInSeconds: params.musicSpec.fadeInSeconds || 0.5,
          fadeOutSeconds: params.musicSpec.fadeOutSeconds || 1.0,
          duckWithNarration: true,
          duckVolume: Number((musicVol * 0.35).toFixed(3)), // Duck to 35% of nominal volume during speech
          metadata: {
            title: params.musicSpec.title,
            genre: params.musicSpec.genreStyle,
            loop: params.musicSpec.loop
          }
        }
      ];

      tracks.push({
        id: "track-music",
        name: "Background Music",
        kind: "MUSIC",
        segments: musicSegments,
        volume: musicVol
      });
    }

    // 3. SFX Track
    if (params.sfxCues && params.sfxCues.length > 0) {
      const sfxSegments: AudioSegment[] = [];
      for (const sfx of params.sfxCues) {
        if (sfx.filePath || sfx.audioUrl) {
          sfxSegments.push({
            id: sfx.id,
            kind: "SFX",
            filePath: sfx.filePath || "",
            publicUrl: sfx.audioUrl || "",
            startTimeSeconds: sfx.triggerOffsetSeconds || 0,
            durationSeconds: sfx.durationSeconds || 1.0,
            volume: sfx.volume || 0.5,
            metadata: {
              cue: sfx.semanticCue,
              sceneId: sfx.sceneId
            }
          });
        }
      }

      tracks.push({
        id: "track-sfx",
        name: "Sound Effects",
        kind: "SFX",
        segments: sfxSegments,
        volume: 0.8
      });
    }

    return {
      id: params.timelineId || `audio-tl-${Date.now()}`,
      tracks,
      totalDurationSeconds: totalDuration,
      sampleRate,
      channels,
      isMastered: false
    };
  }
}
