import { IAssistantEngine } from "./interfaces";
import { AssistantEngine } from "./AssistantEngine";
import { UserPreferences } from "./models";
import { ResponseType } from "./ResponseType";
import { AssistantValidationException } from "./types";

export class AssistantBuilder {
  private _context?: any;
  private _preferences?: UserPreferences;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withPreferences(preferences: UserPreferences): this {
    this._preferences = preferences;
    return this;
  }

  public build(): IAssistantEngine {
    if (!this._context) {
      throw new AssistantValidationException("AssistantContext is required to build AssistantEngine.");
    }

    const preferences: UserPreferences = this._preferences || {
      defaultOutputFormat: ResponseType.TEXT,
      autoExecute: true
    };

    return new AssistantEngine(this._context, preferences);
  }
}
