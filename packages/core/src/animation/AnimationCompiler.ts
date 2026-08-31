import {
  AnimationKeyframe,
  AnimationActionPreset,
  CameraMotion,
  SceneVisualLayer,
  EasingType
} from "./models";

export interface TransformSample {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export class AnimationCompiler {
  /**
   * Evaluate easing function
   */
  public static evaluateEasing(t: number, easing: EasingType = "linear"): number {
    const clamped = Math.max(0, Math.min(1, t));
    switch (easing) {
      case "easeIn":
        return clamped * clamped;
      case "easeOut":
        return clamped * (2 - clamped);
      case "easeInOut":
        return clamped < 0.5 ? 2 * clamped * clamped : -1 + (4 - 2 * clamped) * clamped;
      case "bounce": {
        let n1 = 7.5625;
        let d1 = 2.75;
        let p = clamped;
        if (p < 1 / d1) {
          return n1 * p * p;
        } else if (p < 2 / d1) {
          p -= 1.5 / d1;
          return n1 * p * p + 0.75;
        } else if (p < 2.5 / d1) {
          p -= 2.25 / d1;
          return n1 * p * p + 0.9375;
        } else {
          p -= 2.625 / d1;
          return n1 * p * p + 0.984375;
        }
      }
      case "elastic":
        return clamped === 0 ? 0 : clamped === 1 ? 1 : -Math.pow(2, 10 * clamped - 10) * Math.sin((clamped * 10 - 10.75) * ((2 * Math.PI) / 3));
      case "step":
        return clamped >= 0.5 ? 1 : 0;
      case "linear":
      default:
        return clamped;
    }
  }

  /**
   * Evaluate transform state at exact timestamp in seconds
   */
  public static sampleLayerTransform(
    layer: SceneVisualLayer,
    timeSeconds: number,
    sceneDurationSeconds: number,
    canvasWidth = 1920,
    canvasHeight = 1080
  ): TransformSample {
    const dur = Math.max(0.1, sceneDurationSeconds);
    const t = Math.max(0, Math.min(dur, timeSeconds));
    const normT = t / dur;

    // 1. If custom keyframes exist, interpolate between keyframes
    if (layer.keyframes && layer.keyframes.length > 0) {
      return this.sampleKeyframes(layer.keyframes, t, canvasWidth, canvasHeight);
    }

    // 2. Default initial position
    const initX = layer.initialPosition?.x ?? 0.5;
    const initY = layer.initialPosition?.y ?? 0.5;
    const startX = layer.movement?.startX ?? initX;
    const startY = layer.movement?.startY ?? initY;
    const endX = layer.movement?.endX ?? startX;
    const endY = layer.movement?.endY ?? startY;

    const preset = layer.actionPreset || "IDLE";
    let curX = startX + (endX - startX) * normT;
    let curY = startY + (endY - startY) * normT;
    let curScale = 1.0;
    let curRot = 0.0;
    let curOpacity = layer.opacity ?? 1.0;

    switch (preset) {
      case "WALK": {
        const stepRate = 2.0; // steps per second
        const bob = Math.abs(Math.sin(t * 2 * Math.PI * stepRate)) * 25;
        curY -= bob / canvasHeight;
        curRot = 6 * Math.sin(t * 2 * Math.PI * stepRate);
        break;
      }
      case "RUN": {
        const runRate = 3.5;
        const bob = Math.abs(Math.sin(t * 2 * Math.PI * runRate)) * 40;
        curY -= bob / canvasHeight;
        curRot = 10 * Math.sin(t * 2 * Math.PI * runRate);
        break;
      }
      case "JUMP": {
        const arc = Math.sin(Math.min(Math.PI, normT * Math.PI));
        curY -= (arc * 0.35); // upward jump 35% height
        curRot = 12 * (1.0 - 2.0 * normT);
        curScale = 1.0 + 0.1 * arc;
        break;
      }
      case "BOUNCE": {
        const bounceRate = 1.5;
        const b = Math.abs(Math.sin(t * 2 * Math.PI * bounceRate)) * 0.15;
        curY -= b;
        curRot = 4 * Math.sin(t * 2 * Math.PI * bounceRate);
        curScale = 1.0 + 0.08 * Math.sin(t * 2 * Math.PI * bounceRate);
        break;
      }
      case "WAVE": {
        const waveRate = 2.5;
        curRot = 14 * Math.sin(t * 2 * Math.PI * waveRate);
        curY += (5 * Math.sin(t * 2 * Math.PI * 2)) / canvasHeight;
        break;
      }
      case "FLOAT": {
        curX += (20 * Math.sin(t * Math.PI * 0.8)) / canvasWidth;
        curY += (30 * Math.cos(t * Math.PI * 1.0)) / canvasHeight;
        curRot = 5 * Math.sin(t * Math.PI * 0.5);
        curScale = 1.0 + 0.04 * Math.sin(t * Math.PI * 0.8);
        break;
      }
      case "SHAKE": {
        curX += (15 * Math.sin(t * 30)) / canvasWidth;
        curY += (12 * Math.cos(t * 35)) / canvasHeight;
        curRot = 4 * Math.sin(t * 25);
        break;
      }
      case "PULSE": {
        curScale = 1.0 + 0.15 * Math.sin(t * 3 * Math.PI);
        break;
      }
      case "ENTER_LEFT": {
        const enterDur = Math.min(1.5, dur * 0.45);
        const p = this.evaluateEasing(t / enterDur, "easeOut");
        const fromX = -0.3;
        curX = fromX + (startX - fromX) * p;
        curRot = 8 * (1 - p);
        break;
      }
      case "ENTER_RIGHT": {
        const enterDur = Math.min(1.5, dur * 0.45);
        const p = this.evaluateEasing(t / enterDur, "easeOut");
        const fromX = 1.3;
        curX = fromX + (startX - fromX) * p;
        curRot = -8 * (1 - p);
        break;
      }
      case "EXIT_LEFT": {
        const exitStart = Math.max(0, dur - 1.5);
        const exitDur = dur - exitStart;
        const p = t < exitStart ? 0 : this.evaluateEasing((t - exitStart) / exitDur, "easeIn");
        const toX = -0.3;
        curX = startX + (toX - startX) * p;
        curRot = -10 * p;
        break;
      }
      case "EXIT_RIGHT": {
        const exitStart = Math.max(0, dur - 1.5);
        const exitDur = dur - exitStart;
        const p = t < exitStart ? 0 : this.evaluateEasing((t - exitStart) / exitDur, "easeIn");
        const toX = 1.3;
        curX = startX + (toX - startX) * p;
        curRot = 10 * p;
        break;
      }
      case "IDLE":
      default: {
        // Subtle breathing / liveliness so no object is ever completely dead static
        curY += (4 * Math.sin(t * Math.PI * 1.2)) / canvasHeight;
        curRot = 1.5 * Math.sin(t * Math.PI * 0.8);
        break;
      }
    }

    return {
      x: curX * canvasWidth,
      y: curY * canvasHeight,
      scale: curScale,
      rotation: curRot,
      opacity: curOpacity
    };
  }

  /**
   * Sample from keyframes list
   */
  private static sampleKeyframes(
    keyframes: AnimationKeyframe[],
    t: number,
    canvasWidth: number,
    canvasHeight: number
  ): TransformSample {
    if (keyframes.length === 1) {
      const k = keyframes[0];
      return {
        x: (k.x ?? 0.5) * (k.x !== undefined && k.x <= 1.0 ? canvasWidth : 1),
        y: (k.y ?? 0.5) * (k.y !== undefined && k.y <= 1.0 ? canvasHeight : 1),
        scale: k.scale ?? 1.0,
        rotation: k.rotation ?? 0.0,
        opacity: k.opacity ?? 1.0
      };
    }

    const sorted = [...keyframes].sort((a, b) => a.timeSeconds - b.timeSeconds);
    if (t <= sorted[0].timeSeconds) {
      const k = sorted[0];
      return {
        x: (k.x ?? 0.5) * (k.x !== undefined && k.x <= 1.0 ? canvasWidth : 1),
        y: (k.y ?? 0.5) * (k.y !== undefined && k.y <= 1.0 ? canvasHeight : 1),
        scale: k.scale ?? 1.0,
        rotation: k.rotation ?? 0.0,
        opacity: k.opacity ?? 1.0
      };
    }
    if (t >= sorted[sorted.length - 1].timeSeconds) {
      const k = sorted[sorted.length - 1];
      return {
        x: (k.x ?? 0.5) * (k.x !== undefined && k.x <= 1.0 ? canvasWidth : 1),
        y: (k.y ?? 0.5) * (k.y !== undefined && k.y <= 1.0 ? canvasHeight : 1),
        scale: k.scale ?? 1.0,
        rotation: k.rotation ?? 0.0,
        opacity: k.opacity ?? 1.0
      };
    }

    // Find segment
    for (let i = 0; i < sorted.length - 1; i++) {
      const k0 = sorted[i];
      const k1 = sorted[i + 1];
      if (t >= k0.timeSeconds && t <= k1.timeSeconds) {
        const segDur = k1.timeSeconds - k0.timeSeconds;
        const rawProgress = segDur > 0 ? (t - k0.timeSeconds) / segDur : 1;
        const p = this.evaluateEasing(rawProgress, k0.easing || "linear");

        const x0 = (k0.x ?? 0.5) * (k0.x !== undefined && k0.x <= 1.0 ? canvasWidth : 1);
        const x1 = (k1.x ?? 0.5) * (k1.x !== undefined && k1.x <= 1.0 ? canvasWidth : 1);
        const y0 = (k0.y ?? 0.5) * (k0.y !== undefined && k0.y <= 1.0 ? canvasHeight : 1);
        const y1 = (k1.y ?? 0.5) * (k1.y !== undefined && k1.y <= 1.0 ? canvasHeight : 1);

        const s0 = k0.scale ?? 1.0;
        const s1 = k1.scale ?? 1.0;
        const r0 = k0.rotation ?? 0.0;
        const r1 = k1.rotation ?? 0.0;
        const o0 = k0.opacity ?? 1.0;
        const o1 = k1.opacity ?? 1.0;

        return {
          x: x0 + (x1 - x0) * p,
          y: y0 + (y1 - y0) * p,
          scale: s0 + (s1 - s0) * p,
          rotation: r0 + (r1 - r0) * p,
          opacity: o0 + (o1 - o0) * p
        };
      }
    }

    return { x: canvasWidth * 0.5, y: canvasHeight * 0.5, scale: 1, rotation: 0, opacity: 1 };
  }

  /**
   * Build dynamic FFmpeg overlay (x, y) expression for an animated character or foreground layer
   */
  public static buildFFmpegOverlayExpression(
    layer: SceneVisualLayer,
    sceneDurationSeconds: number
  ): { xExpr: string; yExpr: string; rotExpr?: string; scaleExpr?: string; opacityExpr?: string } {
    const dur = Math.max(0.1, sceneDurationSeconds);
    const preset = layer.actionPreset || "IDLE";
    const initX = layer.initialPosition?.x ?? 0.5;
    const initY = layer.initialPosition?.y ?? 0.5;
    const startX = layer.movement?.startX ?? initX;
    const startY = layer.movement?.startY ?? initY;
    const endX = layer.movement?.endX ?? startX;
    const endY = layer.movement?.endY ?? startY;

    let xExpr = `(W*${startX.toFixed(3)} + (W*${(endX - startX).toFixed(3)})*(t/${dur.toFixed(3)}) - w/2)`;
    let yExpr = `(H*${startY.toFixed(3)} + (H*${(endY - startY).toFixed(3)})*(t/${dur.toFixed(3)}) - h/2)`;
    let rotExpr: string | undefined = undefined;

    switch (preset) {
      case "WALK": {
        const stepRate = 2.0;
        yExpr = `(${yExpr} - abs(sin(t*2*PI*${stepRate}))*25)`;
        rotExpr = `${(6 * (Math.PI / 180)).toFixed(4)}*sin(t*2*PI*${stepRate})`;
        break;
      }
      case "RUN": {
        const runRate = 3.5;
        yExpr = `(${yExpr} - abs(sin(t*2*PI*${runRate}))*40)`;
        rotExpr = `${(10 * (Math.PI / 180)).toFixed(4)}*sin(t*2*PI*${runRate})`;
        break;
      }
      case "JUMP": {
        yExpr = `(${yExpr} - H*0.35*sin(min(PI, (t/${dur.toFixed(3)})*PI)))`;
        rotExpr = `${(12 * (Math.PI / 180)).toFixed(4)}*(1 - 2*(t/${dur.toFixed(3)}))`;
        break;
      }
      case "BOUNCE": {
        const bounceRate = 1.5;
        yExpr = `(${yExpr} - abs(sin(t*2*PI*${bounceRate}))*(H*0.15))`;
        rotExpr = `${(4 * (Math.PI / 180)).toFixed(4)}*sin(t*2*PI*${bounceRate})`;
        break;
      }
      case "WAVE": {
        rotExpr = `${(14 * (Math.PI / 180)).toFixed(4)}*sin(t*2*PI*2.5)`;
        yExpr = `(${yExpr} + 5*sin(t*2*PI*2))`;
        break;
      }
      case "FLOAT": {
        xExpr = `(${xExpr} + 20*sin(t*PI*0.8))`;
        yExpr = `(${yExpr} + 30*cos(t*PI*1.0))`;
        rotExpr = `${(5 * (Math.PI / 180)).toFixed(4)}*sin(t*PI*0.5)`;
        break;
      }
      case "SHAKE": {
        xExpr = `(${xExpr} + 15*sin(t*30))`;
        yExpr = `(${yExpr} + 12*cos(t*35))`;
        rotExpr = `${(4 * (Math.PI / 180)).toFixed(4)}*sin(t*25)`;
        break;
      }
      case "ENTER_LEFT": {
        const enterDur = Math.min(1.5, dur * 0.45);
        const fromX = -0.3;
        xExpr = `(W*${fromX} + (W*${(startX - fromX).toFixed(3)})*min(1, t/${enterDur.toFixed(3)}) - w/2)`;
        rotExpr = `${(8 * (Math.PI / 180)).toFixed(4)}*(1 - min(1, t/${enterDur.toFixed(3)}))`;
        break;
      }
      case "ENTER_RIGHT": {
        const enterDur = Math.min(1.5, dur * 0.45);
        const fromX = 1.3;
        xExpr = `(W*${fromX} + (W*${(startX - fromX).toFixed(3)})*min(1, t/${enterDur.toFixed(3)}) - w/2)`;
        rotExpr = `-${(8 * (Math.PI / 180)).toFixed(4)}*(1 - min(1, t/${enterDur.toFixed(3)}))`;
        break;
      }
      case "EXIT_RIGHT": {
        const exitStart = Math.max(0, dur - 1.5);
        const exitDur = dur - exitStart;
        const toX = 1.3;
        xExpr = `if(lt(t, ${exitStart.toFixed(3)}), W*${startX.toFixed(3)} - w/2, W*${startX.toFixed(3)} + (W*${(toX - startX).toFixed(3)})*((t - ${exitStart.toFixed(3)})/${exitDur.toFixed(3)}) - w/2)`;
        rotExpr = `${(10 * (Math.PI / 180)).toFixed(4)}*if(lt(t, ${exitStart.toFixed(3)}), 0, (t - ${exitStart.toFixed(3)})/${exitDur.toFixed(3)})`;
        break;
      }
      case "IDLE":
      default: {
        yExpr = `(${yExpr} + 4*sin(t*PI*1.2))`;
        rotExpr = `${(1.5 * (Math.PI / 180)).toFixed(4)}*sin(t*PI*0.8)`;
        break;
      }
    }

    return { xExpr, yExpr, rotExpr };
  }

  /**
   * Build complete FFmpeg filter_complex command for a multi-layered scene
   */
  public static compileSceneFilterGraph(
    layers: SceneVisualLayer[],
    camera: CameraMotion | undefined,
    durationSeconds: number,
    width = 1920,
    height = 1080,
    fps = 24
  ): { filterComplex: string; inputCount: number } {
    const dur = Math.max(0.1, durationSeconds);
    const totalFrames = Math.ceil(fps * dur);
    const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

    const filterLines: string[] = [];

    // Background is layer 0 (input 0)
    // Camera motion applied to background / base canvas
    const camType = camera?.type || "ZOOM_IN";
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

    // Additional layers (characters, midground, foreground)
    for (let i = 1; i < sortedLayers.length; i++) {
      const layer = sortedLayers[i];
      const layerInputIdx = i;
      const targetW = Math.round(width * (layer.initialPosition?.width ?? 0.38));
      const targetH = Math.round(height * (layer.initialPosition?.height ?? 0.55));

      const { xExpr, yExpr, rotExpr } = this.buildFFmpegOverlayExpression(layer, dur);

      let layerChain = `[${layerInputIdx}:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,format=rgba`;
      if (rotExpr) {
        layerChain += `,rotate=a='${rotExpr}':c=none:ow='hypot(iw,ih)':oh='hypot(iw,ih)'`;
      }
      const layerTag = `[lyr${i}]`;
      filterLines.push(`${layerChain}${layerTag}`);

      const nextOut = i === sortedLayers.length - 1 ? "[finalv]" : `[comp${i}]`;
      filterLines.push(
        `${currentOut}${layerTag}overlay=x='${xExpr}':y='${yExpr}':eval=frame${nextOut}`
      );
      currentOut = nextOut;
    }

    // In case there was only background (1 layer)
    if (sortedLayers.length === 1) {
      filterLines.push(`${currentOut}null[finalv]`);
    }

    // Add subtle cinematic fade in/out if length > 1.2s
    const filterComplex = filterLines.join(";\n");
    return { filterComplex, inputCount: sortedLayers.length };
  }
}
