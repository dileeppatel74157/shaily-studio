import { Storyboard, ContentValidationReport, CompositionTimeline, PublishingPackage } from "./models";
import { ValidationException } from "./types";
import { RenderQuality } from "./RenderQuality";

export class ContentPipelineValidator {

  public static validate(storyboard: Storyboard, timeline: CompositionTimeline, pack: PublishingPackage): ContentValidationReport {
    const issues: Array<{ rule: string; message: string; severity: "WARNING" | "CRITICAL" }> = [];

    // 1. Storyboard exists
    if (!storyboard) {
      issues.push({ rule: "STORYBOARD_EXISTS", message: "Storyboard is missing.", severity: "CRITICAL" });
    }

    // 2. Scenes not empty
    if (!storyboard.scenes || storyboard.scenes.length === 0) {
      issues.push({ rule: "SCENES_NOT_EMPTY", message: "Storyboard scenes are empty.", severity: "CRITICAL" });
    }

    // 3. Every scene has duration
    if (storyboard.scenes) {
      for (const scene of storyboard.scenes) {
        if (scene.durationSeconds <= 0) {
          issues.push({ rule: "SCENE_DURATION_POSITIVE", message: `Scene ${scene.sceneNumber} duration is not positive.`, severity: "CRITICAL" });
        }
      }
    }

    // 4. Total duration > 0
    if (storyboard.totalDurationSeconds <= 0) {
      issues.push({ rule: "TOTAL_DURATION_POSITIVE", message: "Total duration must be positive.", severity: "CRITICAL" });
    }

    // 5. Image prompt exists
    if (storyboard.scenes) {
      for (const scene of storyboard.scenes) {
        for (const shot of scene.shots) {
          if (!shot.visualPrompt || shot.visualPrompt.trim() === "") {
            issues.push({ rule: "IMAGE_PROMPT_EXISTS", message: `Shot ${shot.id} visual prompt is missing.`, severity: "CRITICAL" });
          }
        }
      }
    }

    // 6. Timeline contiguous
    if (timeline && timeline.durationSeconds <= 0) {
      issues.push({ rule: "TIMELINE_CONTIGUOUS", message: "Timeline duration must be positive.", severity: "CRITICAL" });
    }

    // 7. Render quality valid
    if (pack.metadata?.renderQuality && !Object.values(RenderQuality).includes(pack.metadata.renderQuality as RenderQuality)) {
      issues.push({ rule: "RENDER_QUALITY_VALID", message: "Render quality is invalid.", severity: "CRITICAL" });
    }

    // 8. Project ID is set
    if (!pack.projectId || pack.projectId.trim() === "") {
      issues.push({ rule: "PROJECT_ID_SET", message: "Project ID is not set.", severity: "CRITICAL" });
    }

    // 9. Package complete
    if (!pack.videoFileUrl || !pack.thumbnail || !pack.title || !pack.description) {
      issues.push({ rule: "PACKAGE_COMPLETE", message: "Publishing package is incomplete.", severity: "CRITICAL" });
    }

    // 10. Assets unique
    const assetIds = new Set<string>();
    if (timeline?.tracks) {
      for (const track of timeline.tracks) {
        for (const asset of track.assets) {
          if (assetIds.has(asset.id)) {
            issues.push({ rule: "ASSETS_UNIQUE", message: `Duplicate asset reference found: ${asset.id}`, severity: "WARNING" });
          }
          assetIds.add(asset.id);
        }
      }
    }

    // 11. No missing references
    if (storyboard.scenes && timeline?.tracks) {
      const sceneIds = new Set(storyboard.scenes.map(s => s.id));
      for (const track of timeline.tracks) {
        for (const asset of track.assets) {
          if (asset.meta?.sceneId && !sceneIds.has(asset.meta.sceneId)) {
            issues.push({ rule: "NO_MISSING_REFERENCES", message: `Asset ${asset.id} references non-existent scene ${asset.meta.sceneId}`, severity: "CRITICAL" });
          }
        }
      }
    }

    // 12. CameraMovement has pan/zoom
    if (storyboard.scenes) {
      for (const scene of storyboard.scenes) {
        for (const shot of scene.shots) {
          if (!shot.camera || shot.camera.pan === undefined || shot.camera.zoom === undefined) {
            issues.push({ rule: "CAMERA_MOVEMENT_PAN_ZOOM", message: `Shot ${shot.id} camera movement pan/zoom undefined.`, severity: "WARNING" });
          }
        }
      }
    }

    // 13. Audio tracks volume valid
    if (timeline?.tracks) {
      for (const track of timeline.tracks) {
        if (track.type === "MUSIC" || track.type === "SFX") {
          for (const asset of track.assets) {
            if (asset.meta?.volume !== undefined && asset.meta.volume <= 0) {
              issues.push({ rule: "AUDIO_VOLUME_POSITIVE", message: `Audio asset ${asset.id} volume is not positive.`, severity: "WARNING" });
            }
          }
        }
      }
    }

    // 14. Thumbnail variants exist
    if (pack.thumbnail && (!pack.thumbnail.variants || pack.thumbnail.variants.length === 0)) {
      issues.push({ rule: "THUMBNAIL_VARIANTS_EXIST", message: "Thumbnail variants package is empty.", severity: "WARNING" });
    }

    // 15. Hashtags are non-empty
    if (pack.tags && pack.tags.length === 0) {
      issues.push({ rule: "HASHTAGS_NOT_EMPTY", message: "Tags array is empty.", severity: "WARNING" });
    }

    // 16. Captions file URL valid
    if (pack.captionsSrtUrl && !pack.captionsSrtUrl.endsWith(".srt")) {
      issues.push({ rule: "CAPTIONS_SRT_VALID", message: "Captions SRT file URL does not end with .srt", severity: "CRITICAL" });
    }

    // 17. Storyboard totalScenes matches actual length
    if (storyboard.scenes && storyboard.totalScenes !== storyboard.scenes.length) {
      issues.push({ rule: "STORYBOARD_TOTAL_SCENES_MATCH", message: "Storyboard totalScenes mismatch with actual scene count.", severity: "CRITICAL" });
    }

    // 18. Analytics seed present
    if (!pack.analyticsSeed || Object.keys(pack.analyticsSeed).length === 0) {
      issues.push({ rule: "ANALYTICS_SEED_PRESENT", message: "Analytics seed config is missing.", severity: "WARNING" });
    }

    // 19. Audio loops defined
    if (timeline?.tracks) {
      for (const track of timeline.tracks) {
        if (track.type === "MUSIC") {
          for (const asset of track.assets) {
            if (asset.meta?.loop === undefined) {
              issues.push({ rule: "AUDIO_LOOP_DEFINED", message: `Music asset ${asset.id} loop flag is undefined.`, severity: "WARNING" });
            }
          }
        }
      }
    }

    // 20. Video tracks resolution and fps defined
    if (timeline?.tracks) {
      for (const track of timeline.tracks) {
        if (track.type === "VIDEO") {
          for (const asset of track.assets) {
            if (!asset.meta?.resolution || !asset.meta?.fps) {
              issues.push({ rule: "VIDEO_METADATA_DEFINED", message: `Video asset ${asset.id} resolution or fps is missing.`, severity: "WARNING" });
            }
          }
        }
      }
    }

    const valid = !issues.some(i => i.severity === "CRITICAL");
    return {
      valid,
      issues,
      timestamp: new Date()
    };
  }

  public static assertValid(storyboard: Storyboard, timeline: CompositionTimeline, pack: PublishingPackage): void {
    const report = this.validate(storyboard, timeline, pack);
    if (!report.valid) {
      const crit = report.issues.find(i => i.severity === "CRITICAL");
      throw new ValidationException(`Validation failed: ${crit?.message}`);
    }
  }
}
