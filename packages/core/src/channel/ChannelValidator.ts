import { ChannelValidationException } from "./types";
import { ChannelKnowledgeBase, ContentBlueprint, AudiencePersona } from "./models";

export class ChannelValidator {
  public static validateRequest(id: string, niche: string): void {
    if (!id) {
      throw new ChannelValidationException("Channel ID is required.");
    }
    if (!niche) {
      throw new ChannelValidationException("Niche description is required.");
    }
  }

  public static validateKnowledgeBase(kb: ChannelKnowledgeBase): void {
    // 1. Missing Brand Data check
    if (!kb.identity || !kb.identity.name || !kb.identity.niche) {
      throw new ChannelValidationException("Missing identity profile name or niche.");
    }
    if (!kb.brandGuide || !kb.brandGuide.personality || !kb.brandGuide.tone || !kb.brandGuide.writingStyle) {
      throw new ChannelValidationException("Missing brand guide personality, tone, or writing style.");
    }
    if (!kb.visuals || !kb.visuals.colorPalette || kb.visuals.colorPalette.length === 0) {
      throw new ChannelValidationException("Missing visual identity color palette.");
    }

    // 2. Invalid Blueprints check
    if (!kb.blueprints || kb.blueprints.length === 0) {
      throw new ChannelValidationException("Content blueprints list cannot be empty.");
    }
    for (const blueprint of kb.blueprints) {
      this.validateBlueprint(blueprint);
    }

    // 3. Invalid Audience Profiles check
    if (!kb.personas || kb.personas.length === 0) {
      throw new ChannelValidationException("Audience personas cannot be empty.");
    }
    for (const persona of kb.personas) {
      this.validatePersona(persona);
    }

    // 4. Empty Publishing Rules check
    if (
      !kb.publishingRules ||
      !kb.publishingRules.uploadRules ||
      kb.publishingRules.uploadRules.length === 0
    ) {
      throw new ChannelValidationException("Publishing rules uploadRules cannot be empty.");
    }

    // 5. Circular references check in metadata/blueprints
    this.checkCircularReferences(kb);
  }

  private static validateBlueprint(blueprint: ContentBlueprint): void {
    if (!blueprint.hookStructure) {
      throw new ChannelValidationException(`Invalid blueprint "${blueprint.id}": missing hook structure.`);
    }
    if (!blueprint.informationFlow) {
      throw new ChannelValidationException(`Invalid blueprint "${blueprint.id}": missing information flow.`);
    }
    if (!blueprint.storyPacing) {
      throw new ChannelValidationException(`Invalid blueprint "${blueprint.id}": missing story pacing.`);
    }
  }

  private static validatePersona(persona: AudiencePersona): void {
    if (!persona.demographics) {
      throw new ChannelValidationException(`Invalid persona "${persona.id}": missing demographics.`);
    }
    if (!persona.painPoints || persona.painPoints.length === 0) {
      throw new ChannelValidationException(`Invalid persona "${persona.id}": missing pain points.`);
    }
    if (!persona.goals || persona.goals.length === 0) {
      throw new ChannelValidationException(`Invalid persona "${persona.id}": missing viewer goals.`);
    }
  }

  private static checkCircularReferences(obj: any, seen = new Set<any>()): void {
    if (obj === null || typeof obj !== "object") {
      return;
    }
    if (seen.has(obj)) {
      throw new ChannelValidationException("Circular reference detected in channel knowledge base.");
    }
    seen.add(obj);
    for (const key of Object.keys(obj)) {
      // Avoid tracking context/logger circulars if present
      if (key === "context" || key === "logger") continue;
      this.checkCircularReferences(obj[key], seen);
    }
    seen.delete(obj);
  }
}
