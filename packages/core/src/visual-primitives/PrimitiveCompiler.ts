/**
 * Universal Visual Primitive Compiler
 * Compiles SceneVisualPlans into VisualPrimitives and translates VisualPrimitives
 * into multi-layer FFmpeg filtergraphs with animated mathematical expressions.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  VisualPrimitive,
  VisualPrimitiveType,
  VisualPrimitiveAnimation,
  PrimitiveAnimationBehavior,
  ScenePrimitiveComposition
} from "./models";
import {
  SceneVisualPlan,
  VisualStylePlan,
  DataVisualizationSpec,
  OverlaySpec
} from "../visual-intelligence/models";
import { CameraMotion, SceneVisualLayer } from "../animation/models";
import { PrimitiveRenderer } from "./PrimitiveRenderer";

export class PrimitiveCompiler {
  /**
   * Translates a SceneVisualPlan and style settings into a clean list of VisualPrimitives.
   */
  public static planToPrimitives(
    plan: SceneVisualPlan,
    stylePlan?: VisualStylePlan,
    sceneDuration = 5,
    canvasWidth = 1920,
    canvasHeight = 1080
  ): VisualPrimitive[] {
    const primitives: VisualPrimitive[] = [];
    const dur = Math.max(0.5, sceneDuration);

    const primaryColor = stylePlan?.colorDirection.primary || "#38BDF8";
    const accentColor = stylePlan?.colorDirection.accent || "#F59E0B";
    const bgCard = "rgba(15, 23, 42, 0.88)";
    const textColor = stylePlan?.colorDirection.text || "#F8FAFC";

    // 1. Data Visualizations
    if (plan.dataVisualizations && plan.dataVisualizations.length > 0) {
      for (const dv of plan.dataVisualizations) {
        const primType = this.mapDataVisToPrimitiveType(dv);
        const animBehavior: PrimitiveAnimationBehavior =
          dv.animation === "DRAW" ? "REVEAL" :
          dv.animation === "COUNT_UP" ? "COUNT_UP" :
          dv.animation === "PULSE" ? "PULSE" :
          dv.animation === "REVEAL" ? "REVEAL" : "FADE_IN";

        const normPos = dv.position || {
          x: 0.5,
          y: 0.52,
          width: primType === "NUMBER_COUNTER" || primType === "PERCENTAGE_INDICATOR" ? 0.38 : 0.62,
          height: primType === "NUMBER_COUNTER" || primType === "PERCENTAGE_INDICATOR" ? 0.35 : 0.52
        };

        const metadata = this.buildDataVisMetadata(dv, stylePlan);

        primitives.push({
          id: dv.id || `prim-dv-${Math.random().toString(36).substring(2, 7)}`,
          type: primType,
          position: normPos,
          dimensions: {
            width: Math.round((normPos.width ?? 0.6) * canvasWidth),
            height: Math.round((normPos.height ?? 0.5) * canvasHeight)
          },
          startTime: 0.5,
          duration: dur - 0.5,
          zIndex: 10,
          opacity: 1.0,
          style: {
            primaryColor,
            accentColor,
            backgroundColor: bgCard,
            textColor,
            borderRadius: 20
          },
          animation: {
            behavior: animBehavior,
            durationSeconds: 1.0,
            delaySeconds: 0.5
          },
          metadata
        });
      }
    }

    // 2. Overlays
    if (plan.overlays && plan.overlays.length > 0) {
      for (const ov of plan.overlays) {
        const primType = this.mapOverlayToPrimitiveType(ov);
        const animBehavior: PrimitiveAnimationBehavior =
          ov.animation === "SLIDE_UP" ? "SLIDE_UP" :
          ov.animation === "ZOOM_IN" ? "SCALE_IN" :
          ov.animation === "POP" ? "PULSE" : "FADE_IN";

        const pos = this.mapOverlayPosition(ov.position || "LOWER_THIRD", primType);

        primitives.push({
          id: ov.id || `prim-ov-${Math.random().toString(36).substring(2, 7)}`,
          type: primType,
          position: pos,
          dimensions: {
            width: Math.round((pos.width ?? 0.5) * canvasWidth),
            height: Math.round((pos.height ?? 0.2) * canvasHeight)
          },
          startTime: 0.3,
          duration: dur - 0.3,
          zIndex: 20,
          opacity: 1.0,
          style: {
            primaryColor,
            accentColor,
            backgroundColor: bgCard,
            textColor,
            borderRadius: 16
          },
          animation: {
            behavior: animBehavior,
            durationSeconds: 0.8,
            delaySeconds: 0.3
          },
          metadata: {
            headline: ov.text,
            subheadline: ov.subtext,
            categoryBadge: ov.type,
            title: ov.text,
            body: ov.subtext || "",
            value: ov.text,
            label: ov.subtext || "",
            header: ov.text,
            detail: ov.subtext || "",
            text: ov.text,
            subtitle: ov.subtext
          }
        });
      }
    }

    // 3. Characters
    if (plan.layers && plan.layers.length > 0) {
      for (const l of plan.layers) {
        if (l.layerType === "CHARACTER") {
          primitives.push({
            id: l.id,
            type: "CHARACTER",
            position: {
              x: l.initialPosition?.x ?? 0.35,
              y: l.initialPosition?.y ?? 0.65,
              width: l.initialPosition?.width ?? 0.35,
              height: l.initialPosition?.height ?? 0.52
            },
            dimensions: {
              width: Math.round((l.initialPosition?.width ?? 0.35) * canvasWidth),
              height: Math.round((l.initialPosition?.height ?? 0.52) * canvasHeight)
            },
            startTime: 0.0,
            duration: dur,
            zIndex: l.zIndex || 5,
            opacity: l.opacity ?? 1.0,
            style: {
              primaryColor: accentColor
            },
            animation: {
              behavior: (l.actionPreset as any) || "WALK",
              durationSeconds: dur
            },
            metadata: {
              characterId: l.characterId || "char-main",
              characterName: l.name || "Protagonist",
              assetUrl: l.assetUrl,
              movement: l.movement,
              actionPreset: l.actionPreset
            }
          });
        }
      }
    }

    // Sort by z-index
    return primitives.sort((a, b) => a.zIndex - b.zIndex);
  }

  private static mapDataVisToPrimitiveType(dv: DataVisualizationSpec): VisualPrimitiveType {
    switch (dv.type) {
      case "CHART":
        if (dv.chartType === "BAR") return "BAR_CHART";
        if (dv.chartType === "AREA") return "AREA_CHART";
        if (dv.chartType === "DONUT" || dv.chartType === "PIE") return "DONUT_CHART";
        return "LINE_CHART";
      case "COUNTER":
        return "NUMBER_COUNTER";
      case "INDICATOR":
        return "PERCENTAGE_INDICATOR";
      case "TIMELINE":
        return "TIMELINE";
      case "STATISTIC_CALLOUT":
      case "COMPARISON_CARD":
        return "STAT_CARD";
      case "MAP":
      case "DIAGRAM":
      default:
        return "INFO_CARD";
    }
  }

  private static mapOverlayToPrimitiveType(ov: OverlaySpec): VisualPrimitiveType {
    switch (ov.type) {
      case "LOWER_THIRD":
        return "LOWER_THIRD";
      case "BADGE":
        return "STAT_CARD";
      case "CALLOUT":
        return "CALLOUT";
      case "INFOGRAPHIC_CARD":
        return "INFO_CARD";
      case "HEADLINE":
      case "SUBTITLE":
        return "TEXT";
      default:
        return "INFO_CARD";
    }
  }

  private static mapOverlayPosition(
    pos: string,
    primType: VisualPrimitiveType
  ): { x: number; y: number; width: number; height: number } {
    switch (pos) {
      case "TOP_LEFT":
        return { x: 0.22, y: 0.16, width: 0.35, height: 0.16 };
      case "TOP_RIGHT":
        return { x: 0.78, y: 0.16, width: 0.35, height: 0.16 };
      case "BOTTOM_LEFT":
        return { x: 0.25, y: 0.82, width: 0.42, height: 0.20 };
      case "BOTTOM_RIGHT":
        return { x: 0.75, y: 0.82, width: 0.42, height: 0.20 };
      case "CENTER":
        return { x: 0.50, y: 0.50, width: 0.50, height: 0.30 };
      case "LOWER_THIRD":
      default:
        return { x: 0.32, y: 0.82, width: 0.54, height: 0.18 };
    }
  }

  private static buildDataVisMetadata(dv: DataVisualizationSpec, stylePlan?: VisualStylePlan): any {
    if (dv.type === "CHART") {
      let dataPoints = dv.data;
      if (!Array.isArray(dataPoints)) {
        dataPoints = [
          { label: "Year 1", value: 100, color: stylePlan?.colorDirection.primary || "#38BDF8" },
          { label: "Year 5", value: 85, color: stylePlan?.colorDirection.secondary || "#818CF8" },
          { label: "Year 10", value: 65, color: stylePlan?.colorDirection.accent || "#F43F5E" }
        ];
      }
      return {
        title: dv.title || "Financial Progression",
        subtitle: dv.subtitle,
        unit: dv.unit || "",
        dataPoints
      };
    } else if (dv.type === "COUNTER") {
      const d = (dv.data as any) || {};
      return {
        startValue: 0,
        targetValue: typeof d.value === "number" ? d.value : 100,
        prefix: d.prefix || "",
        suffix: d.suffix || dv.unit || "",
        label: dv.title || "Total Value"
      };
    } else if (dv.type === "INDICATOR") {
      const d = (dv.data as any) || {};
      return {
        percentage: typeof d.current === "number" ? Math.round(d.current * 50) : 75,
        label: dv.title || "Key Indicator",
        subtext: dv.subtitle || dv.unit || "Anomaly"
      };
    } else if (dv.type === "TIMELINE") {
      const d = (dv.data as any) || {};
      return {
        title: dv.title || "Chronology",
        milestones: Array.isArray(d.milestones) ? d.milestones : [
          { dateOrEra: "Era 1", title: "Inception" },
          { dateOrEra: "Era 2", title: "Expansion", isHighlighted: true },
          { dateOrEra: "Era 3", title: "Consolidation" }
        ]
      };
    } else if (dv.type === "MAP") {

      return {
        title: dv.title || "Territorial Map Expansion",
        body: "Visualizing key regional hubs, defensive fortifications, and trade routes across the empire.",
        tag: "GEOGRAPHIC BOUNDARIES"
      };
    }
    return {
      title: dv.title || "Information Summary",
      body: dv.subtitle || "Structured metric analysis"
    };
  }

  /**
   * Generate dynamic FFmpeg overlay mathematical expressions for a primitive
   */
  public static buildPrimitiveOverlayExpression(
    primitive: VisualPrimitive,
    sceneDurationSeconds: number
  ): { xExpr: string; yExpr: string; rotExpr?: string; alphaExpr?: string } {
    const dur = Math.max(0.1, sceneDurationSeconds);
    const st = primitive.startTime || 0;
    const pDur = primitive.duration || (dur - st);
    const targetX = primitive.position.x;
    const targetY = primitive.position.y;
    const anim = primitive.animation?.behavior || "FADE_IN";
    const animDur = primitive.animation?.durationSeconds || 0.8;

    let xExpr = `(W*${targetX.toFixed(3)} - w/2)`;
    let yExpr = `(H*${targetY.toFixed(3)} - h/2)`;
    let rotExpr: string | undefined = undefined;
    let alphaExpr: string | undefined = undefined;

    switch (anim) {
      case "SLIDE_UP": {
        const startY = 1.3;
        yExpr = `if(lt(t, ${st.toFixed(3)}), H*${startY}, if(lt(t, ${(st + animDur).toFixed(3)}), (H*${startY} + (H*${(targetY - startY).toFixed(3)})*((t - ${st.toFixed(3)})/${animDur.toFixed(3)}) - h/2), (H*${targetY.toFixed(3)} - h/2)))`;
        break;
      }
      case "SLIDE_DOWN": {
        const startY = -0.3;
        yExpr = `if(lt(t, ${st.toFixed(3)}), H*${startY}, if(lt(t, ${(st + animDur).toFixed(3)}), (H*${startY} + (H*${(targetY - startY).toFixed(3)})*((t - ${st.toFixed(3)})/${animDur.toFixed(3)}) - h/2), (H*${targetY.toFixed(3)} - h/2)))`;
        break;
      }
      case "SLIDE_LEFT": {
        const startX = 1.3;
        xExpr = `if(lt(t, ${st.toFixed(3)}), W*${startX}, if(lt(t, ${(st + animDur).toFixed(3)}), (W*${startX} + (W*${(targetX - startX).toFixed(3)})*((t - ${st.toFixed(3)})/${animDur.toFixed(3)}) - w/2), (W*${targetX.toFixed(3)} - w/2)))`;
        break;
      }
      case "SLIDE_RIGHT": {
        const startX = -0.3;
        xExpr = `if(lt(t, ${st.toFixed(3)}), W*${startX}, if(lt(t, ${(st + animDur).toFixed(3)}), (W*${startX} + (W*${(targetX - startX).toFixed(3)})*((t - ${st.toFixed(3)})/${animDur.toFixed(3)}) - w/2), (W*${targetX.toFixed(3)} - w/2)))`;
        break;
      }
      case "PULSE": {
        yExpr = `(${yExpr} + 6*sin((t - ${st.toFixed(3)})*4*PI))`;
        rotExpr = `${(1.5 * (Math.PI / 180)).toFixed(4)}*sin((t - ${st.toFixed(3)})*4*PI)`;
        break;
      }
      case "WALK": {
        const move = primitive.metadata?.movement || { startX: 0.15, startY: targetY, endX: 0.85, endY: targetY };
        xExpr = `(W*${move.startX.toFixed(3)} + (W*${(move.endX - move.startX).toFixed(3)})*(t/${dur.toFixed(3)}) - w/2)`;
        yExpr = `(H*${targetY.toFixed(3)} - abs(sin(t*2*PI*2.0))*25 - h/2)`;
        rotExpr = `${(6 * (Math.PI / 180)).toFixed(4)}*sin(t*2*PI*2.0)`;
        break;
      }
      case "FADE_IN":
      default: {
        // Subtle floating liveliness so cards look cinematic
        yExpr = `(${yExpr} + 3*sin((t - ${st.toFixed(3)})*PI*0.8))`;
        break;
      }
    }

    return { xExpr, yExpr, rotExpr, alphaExpr };
  }

  /**
   * Compiles a scene with its background and visual primitives into a complete FFmpeg filtergraph.
   */
  public static compileFilterGraph(
    primitives: VisualPrimitive[],
    cameraMotion: CameraMotion | undefined,
    durationSeconds: number,
    width = 1920,
    height = 1080,
    fps = 24
  ): { filterComplex: string; inputCount: number } {
    const dur = Math.max(0.1, durationSeconds);
    const totalFrames = Math.ceil(fps * dur);
    const sorted = [...primitives].sort((a, b) => a.zIndex - b.zIndex);

    const filterLines: string[] = [];

    // Layer 0: Background (Input 0) with camera motion
    const camType = cameraMotion?.type || "ZOOM_IN";
    const zoomW = Math.round(width * 1.25);
    const zoomH = Math.round(height * 1.25);
    let bgFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;

    if (camType === "ZOOM_IN" || camType === "KEN_BURNS") {
      bgFilter = `scale=${zoomW}:${zoomH},zoompan=z='zoom+0.0008':d=${totalFrames}:s=${width}x${height}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
    } else if (camType === "ZOOM_OUT") {
      bgFilter = `scale=${zoomW}:${zoomH},zoompan=z='if(lte(zoom,1.0),1.15,zoom-0.0008)':d=${totalFrames}:s=${width}x${height}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
    } else if (camType === "PAN_LEFT") {
      bgFilter = `scale=${zoomW}:${zoomH},zoompan=z=1.15:d=${totalFrames}:s=${width}x${height}:x='(1-on/${totalFrames})*(iw-iw/zoom)':y='(ih-ih/zoom)/2'`;
    } else if (camType === "PAN_RIGHT") {
      bgFilter = `scale=${zoomW}:${zoomH},zoompan=z=1.15:d=${totalFrames}:s=${width}x${height}:x='(on/${totalFrames})*(iw-iw/zoom)':y='(ih-ih/zoom)/2'`;
    } else if (camType === "CAMERA_SHAKE") {
      bgFilter = `scale=${zoomW}:${zoomH},zoompan=z=1.1:d=${totalFrames}:s=${width}x${height}:x='iw/2-(iw/zoom/2)+sin(on*2)*10':y='ih/2-(ih/zoom/2)+cos(on*2.5)*8'`;
    } else {
      bgFilter = `scale=${zoomW}:${zoomH},zoompan=z='zoom+0.0004':d=${totalFrames}:s=${width}x${height}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
    }

    filterLines.push(`[0:v]${bgFilter},format=rgba[bg]`);
    let currentOut = "[bg]";

    // Additional layers (1..N)
    for (let i = 0; i < sorted.length; i++) {
      const prim = sorted[i];
      const inputIdx = i + 1;
      const targetW = prim.dimensions?.width || Math.round((prim.position.width ?? 0.5) * width);
      const targetH = prim.dimensions?.height || Math.round((prim.position.height ?? 0.3) * height);

      const { xExpr, yExpr, rotExpr } = this.buildPrimitiveOverlayExpression(prim, dur);

      let layerChain = `[${inputIdx}:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,format=rgba`;
      if (rotExpr) {
        layerChain += `,rotate=a='${rotExpr}':c=none:ow='hypot(iw,ih)':oh='hypot(iw,ih)'`;
      }

      // Add fade in/out on the layer if requested
      const st = prim.startTime || 0;
      const animDur = prim.animation?.durationSeconds || 0.6;
      if (prim.animation?.behavior === "FADE_IN" || !prim.animation) {
        layerChain += `,fade=in:st=${st.toFixed(3)}:d=${animDur.toFixed(3)}:alpha=1`;
      } else if (prim.animation?.behavior === "FADE_OUT") {
        const fadeOutStart = Math.max(0, dur - animDur);
        layerChain += `,fade=out:st=${fadeOutStart.toFixed(3)}:d=${animDur.toFixed(3)}:alpha=1`;
      }

      const layerTag = `[prim${i}]`;
      filterLines.push(`${layerChain}${layerTag}`);

      const nextOut = i === sorted.length - 1 ? "[finalv]" : `[comp${i}]`;
      filterLines.push(
        `${currentOut}${layerTag}overlay=x='${xExpr}':y='${yExpr}':eval=frame:enable='between(t,${st.toFixed(3)},${(st + (prim.duration || dur)).toFixed(3)})'${nextOut}`
      );
      currentOut = nextOut;
    }

    if (sorted.length === 0) {
      filterLines.push(`${currentOut}null[finalv]`);
    }

    const filterComplex = filterLines.join(";\n");
    return { filterComplex, inputCount: sorted.length + 1 };
  }
}
