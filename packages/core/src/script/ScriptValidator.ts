import { ScriptValidationException } from "./types";
import { ScriptRequest, ScriptResponse, ScriptScene, ScriptSection, DialogueBlock } from "./models";

export class ScriptValidator {
  public static validateRequest(request: ScriptRequest): void {
    if (!request.id) {
      throw new ScriptValidationException("Request ID is required.");
    }
    if (!request.type) {
      throw new ScriptValidationException("Script Type is required.");
    }
    if (!request.topic) {
      throw new ScriptValidationException("Script topic cannot be empty.");
    }
  }

  public static validateResponse(response: ScriptResponse): void {
    if (!response.scriptId) {
      throw new ScriptValidationException("Response scriptId is required.");
    }

    const sections = response.sections;
    const scenes = response.scenes;
    const dialogue = response.dialogue;

    // 1. Missing sections check
    const sectionNames = sections.map((s) => s.name);
    if (!sectionNames.includes("INTRODUCTION")) {
      throw new ScriptValidationException("Missing INTRODUCTION section.");
    }
    if (!sectionNames.includes("MAIN")) {
      throw new ScriptValidationException("Missing MAIN section.");
    }
    if (!sectionNames.includes("CTA")) {
      throw new ScriptValidationException("Missing CTA section.");
    }

    // 2. Invalid ordering check
    const introIdx = sectionNames.indexOf("INTRODUCTION");
    const mainIdx = sectionNames.indexOf("MAIN");
    const ctaIdx = sectionNames.indexOf("CTA");

    if (introIdx > mainIdx) {
      throw new ScriptValidationException("INTRODUCTION cannot be placed after MAIN.");
    }
    if (mainIdx > ctaIdx) {
      throw new ScriptValidationException("MAIN cannot be placed after CTA.");
    }

    // 3. Duplicate scenes check
    const sceneIds = new Set<string>();
    for (const scene of scenes) {
      if (sceneIds.has(scene.id)) {
        throw new ScriptValidationException(`Duplicate scene ID detected: ${scene.id}`);
      }
      sceneIds.add(scene.id);
    }

    // 4. Empty dialogue check
    for (const block of dialogue) {
      if (!block.text || block.text.trim().length === 0) {
        throw new ScriptValidationException(`Dialogue block "${block.id}" has empty text.`);
      }
    }

    // 5. Timing conflicts check
    const totalSectionTime = sections.reduce((acc, s) => acc + s.durationSeconds, 0);
    if (totalSectionTime !== response.outline.durationSeconds) {
      throw new ScriptValidationException(
        `Timing Conflict: Total section duration (${totalSectionTime}s) does not match outline duration (${response.outline.durationSeconds}s).`
      );
    }

    for (const block of dialogue) {
      if (block.startTimeSeconds + block.durationSeconds > response.outline.durationSeconds) {
        throw new ScriptValidationException(
          `Timing Conflict: Dialogue block "${block.id}" extends beyond outline total duration.`
        );
      }
    }

    const sceneMap = new Map<string, { scene: ScriptScene; index: number }>();
    scenes.forEach((s, idx) => sceneMap.set(s.id, { scene: s, index: idx }));

    for (const s of scenes) {
      for (const depId of s.dependencies) {
        const dep = sceneMap.get(depId);
        if (!dep) {
          throw new ScriptValidationException(`Invalid dependency: Scene "${s.id}" depends on non-existent scene "${depId}".`);
        }
        if (dep.index >= sceneMap.get(s.id)!.index) {
          throw new ScriptValidationException(
            `Timing/Order Conflict: Scene "${s.id}" depends on scene "${depId}" which runs later in the timeline.`
          );
        }
      }
    }

    // 6. Circular dependency check
    this.validateDependencies(scenes);
  }

  public static validateDependencies(scenes: ScriptScene[]): void {
    const sceneMap = new Map<string, ScriptScene>();
    for (const s of scenes) {
      sceneMap.set(s.id, s);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const checkCycle = (id: string) => {
      if (recStack.has(id)) {
        throw new ScriptValidationException(`Circular dependency detected in scenes: loop contains "${id}"`);
      }
      if (!visited.has(id)) {
        visited.add(id);
        recStack.add(id);
        const s = sceneMap.get(id);
        if (s) {
          for (const depId of s.dependencies) {
            checkCycle(depId);
          }
        }
        recStack.delete(id);
      }
    };

    for (const s of scenes) {
      checkCycle(s.id);
    }
  }
}
