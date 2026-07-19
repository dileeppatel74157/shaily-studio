import { ISettingsEngine } from "./interfaces";
import { SettingsEngine } from "./SettingsEngine";
import { SettingsValidationException } from "./types";

export class SettingsBuilder {
  private _context?: any;
  private _settingsFilePath?: string;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withSettingsFilePath(path: string): this {
    this._settingsFilePath = path;
    return this;
  }

  public build(): ISettingsEngine {
    if (!this._context) {
      throw new SettingsValidationException("SettingsContext (context) is required to build SettingsEngine.");
    }

    return new SettingsEngine(this._context, this._settingsFilePath);
  }
}
