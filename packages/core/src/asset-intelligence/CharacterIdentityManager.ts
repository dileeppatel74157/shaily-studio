/**
 * Canonical Character Identity Manager
 * Manages consistent character identities, descriptions, canonical assets,
 * and expressions across scenes and projects.
 *
 * Domain-agnostic: handles kids characters, historical figures, documentary presenters, and avatars.
 */

import { IntelligentAsset } from "./models";

export interface CanonicalCharacterProfile {
  characterId: string;
  name: string;
  description: string;
  visualPrompt: string;
  style: string;
  canonicalAsset?: IntelligentAsset;
  variants: Map<string, IntelligentAsset>; // e.g. "happy", "serious", "wave" -> asset
  createdAt: Date;
}

export class CharacterIdentityManager {
  private readonly _characters = new Map<string, CanonicalCharacterProfile>();

  /**
   * Registers or updates a character profile.
   */
  public registerCharacter(
    characterId: string,
    name: string,
    description: string,
    visualPrompt: string,
    style = "2D Character"
  ): CanonicalCharacterProfile {
    let char = this._characters.get(characterId);
    if (!char) {
      char = {
        characterId,
        name,
        description,
        visualPrompt,
        style,
        variants: new Map(),
        createdAt: new Date()
      };
      this._characters.set(characterId, char);
    } else {
      char.name = name;
      char.description = description;
      char.visualPrompt = visualPrompt;
    }
    return char;
  }

  /**
   * Retrieves a character profile by id.
   */
  public getCharacter(characterId: string): CanonicalCharacterProfile | undefined {
    return this._characters.get(characterId);
  }

  /**
   * Binds the canonical root asset to a character.
   */
  public setCanonicalAsset(characterId: string, asset: IntelligentAsset): void {
    const char = this._characters.get(characterId);
    if (char) {
      char.canonicalAsset = asset;
    }
  }

  /**
   * Retrieves the canonical root asset for a character.
   */
  public getCanonicalAsset(characterId: string): IntelligentAsset | undefined {
    return this._characters.get(characterId)?.canonicalAsset;
  }

  /**
   * Records a variant/expression asset for a character.
   */
  public setVariantAsset(characterId: string, expression: string, asset: IntelligentAsset): void {
    const char = this._characters.get(characterId);
    if (char) {
      char.variants.set(expression.toLowerCase(), asset);
    }
  }

  /**
   * Retrieves a variant asset or falls back to canonical root asset.
   */
  public getVariantAsset(characterId: string, expression?: string): IntelligentAsset | undefined {
    const char = this._characters.get(characterId);
    if (!char) return undefined;
    if (expression && char.variants.has(expression.toLowerCase())) {
      return char.variants.get(expression.toLowerCase());
    }
    return char.canonicalAsset;
  }

  /**
   * Lists all registered characters.
   */
  public listCharacters(): CanonicalCharacterProfile[] {
    return Array.from(this._characters.values());
  }

  /**
   * Clears character registry.
   */
  public clear(): void {
    this._characters.clear();
  }
}
