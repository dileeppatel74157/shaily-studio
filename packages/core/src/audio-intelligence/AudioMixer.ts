/**
 * Audio Mixer & Ducking Engine
 * Assembles multi-track FFmpeg audio filtergraphs with automated dynamic
 * volume ducking of music during narration, adelay offsets, looping, and channel mixing.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AudioTimeline, AudioSegment } from "./models";

const execFilePromise = promisify(execFile);

function ensureFfmpegPath(): void {
  const ffmpegDir = "C:\\Users\\asus\\AppData\\Local\\DigitalWave\\DW Free Video Downloader";
  if (fs.existsSync(ffmpegDir) && !process.env.PATH?.includes(ffmpegDir)) {
    process.env.PATH = `${ffmpegDir};${process.env.PATH}`;
  }
}

export class AudioMixer {
  /**
   * Mixes an AudioTimeline into a single raw audio WAV track using FFmpeg.
   */
  public static async mixTimeline(
    timeline: AudioTimeline,
    outputPath: string
  ): Promise<string> {
    ensureFfmpegPath();
    const fsDir = path.dirname(outputPath);
    fs.mkdirSync(fsDir, { recursive: true });

    // Collect active audio segments across all tracks
    const allSegments: { segment: AudioSegment; trackKind: string }[] = [];
    const narrationSegments: AudioSegment[] = [];

    for (const track of timeline.tracks) {
      if (track.isMuted) continue;
      for (const seg of track.segments) {
        if (seg.filePath && fs.existsSync(seg.filePath)) {
          allSegments.push({ segment: seg, trackKind: track.kind });
          if (track.kind === "NARRATION") {
            narrationSegments.push(seg);
          }
        }
      }
    }

    // If no active audio segments, generate silent master
    if (allSegments.length === 0) {
      await execFilePromise("ffmpeg", [
        "-y",
        "-f", "lavfi",
        "-i", `anullsrc=r=${timeline.sampleRate}:cl=${timeline.channels === 1 ? "mono" : "stereo"}`,
        "-t", timeline.totalDurationSeconds.toFixed(3),
        outputPath
      ]);
      return outputPath;
    }

    const audioInputs: string[] = [];
    const filterParts: string[] = [];

    for (let i = 0; i < allSegments.length; i++) {
      const { segment, trackKind } = allSegments[i];
      if (trackKind === "MUSIC" && segment.metadata?.loop !== false) {
        audioInputs.push("-stream_loop", "-1", "-i", segment.filePath);
      } else {
        audioInputs.push("-i", segment.filePath);
      }

      const delayMs = Math.max(0, Math.round(segment.startTimeSeconds * 1000));
      const filters: string[] = [];

      // 1. Resample to standard rate
      filters.push(`aresample=${timeline.sampleRate}`);

      // 2. Channel normalization (ensure stereo/mono consistency)
      if (timeline.channels === 2) {
        filters.push("aformat=channel_layouts=stereo");
      }

      // 3. Dynamic Ducking for Music when narration is speaking
      if (trackKind === "MUSIC" && segment.duckWithNarration && narrationSegments.length > 0) {
        const nominalVol = segment.volume || 0.2;
        const duckVol = segment.duckVolume || (nominalVol * 0.35);

        // Build ducking conditions
        const duckConditions = narrationSegments.map(n => {
          const start = Math.max(0, n.startTimeSeconds - 0.15).toFixed(2);
          const end = (n.startTimeSeconds + n.durationSeconds + 0.2).toFixed(2);
          return `between(t,${start},${end})`;
        }).join("+");

        filters.push(`volume='if(gt(${duckConditions},0),${duckVol.toFixed(3)},${nominalVol.toFixed(3)})':eval=frame`);
      } else {
        const vol = segment.volume ?? 1.0;
        if (Math.abs(vol - 1.0) > 0.01) {
          filters.push(`volume=${vol.toFixed(3)}`);
        }
      }

      // 4. Delay / Offset
      if (delayMs > 0) {
        if (timeline.channels === 2) {
          filters.push(`adelay=${delayMs}|${delayMs}`);
        } else {
          filters.push(`adelay=${delayMs}`);
        }
      }

      filterParts.push(`[${i}:a]${filters.join(",")}[a${i}]`);
    }

    // 5. Combine and Mix all streams with anullsrc base track to guarantee exact duration
    const durStr = timeline.totalDurationSeconds.toFixed(3);
    filterParts.unshift(`anullsrc=r=${timeline.sampleRate}:cl=stereo,atrim=0:${durStr}[base]`);
    const inputLabels = "[base]" + Array.from({ length: allSegments.length }, (_, i) => `[a${i}]`).join("");
    filterParts.push(`${inputLabels}amix=inputs=${allSegments.length + 1}:duration=first:dropout_transition=2[outa]`);




    const filterComplex = filterParts.join(";");

    const ffmpegArgs = [
      "-y",
      ...audioInputs,
      "-filter_complex", filterComplex,
      "-map", "[outa]",
      "-t", timeline.totalDurationSeconds.toFixed(3),
      outputPath
    ];

    try {
      await execFilePromise("ffmpeg", ffmpegArgs);
    } catch (err: any) {
      console.error("AudioMixer FFmpeg error:", err.message, err.stderr);
      throw err;
    }
    return outputPath;
  }
}

