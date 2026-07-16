import { IPromptRegistry } from "./IPromptRegistry";
import { PromptTemplate } from "./PromptTemplate";
import { PromptExecution } from "./PromptExecution";
import { PromptSnapshot } from "./PromptSnapshot";
import { PromptContext } from "./PromptContext";
import { PromptState } from "./PromptState";
import { PromptValidator } from "./PromptValidator";
import { PromptRenderer } from "./PromptRenderer";
import {
  InvalidPromptStateException,
  PromptValidationException,
  deepFreeze,
} from "./types";

function getLatestVersion(templates: PromptTemplate[]): PromptTemplate {
  const sorted = [...templates].sort((a, b) => {
    const parseVer = (v: string) => v.split(".").map(Number);
    const aParts = parseVer(a.version);
    const bParts = parseVer(b.version);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) {
        return bVal - aVal; // Descending sort
      }
    }
    return 0;
  });
  return sorted[0];
}

export class PromptRegistry implements IPromptRegistry {
  private _state: PromptState = PromptState.CREATED;
  private _initializedAt?: Date;
  private _startedAt?: Date;
  private _stoppedAt?: Date;
  private _renderedCount = 0;
  // key: "promptId:version", value: PromptTemplate
  private readonly _templates = new Map<string, PromptTemplate>();

  constructor(
    private readonly _context?: PromptContext,
    private readonly _metadata: Record<string, unknown> = {}
  ) {
    if (_context) {
      PromptValidator.validateContext(_context);
    }
  }

  public get state(): PromptState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== PromptState.CREATED) {
      throw new InvalidPromptStateException("initialize", this._state);
    }
    this._state = PromptState.INITIALIZING;
    try {
      this._initializedAt = new Date();
      this._state = PromptState.READY;
    } catch (err) {
      this._state = PromptState.FAILED;
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== PromptState.READY) {
      throw new InvalidPromptStateException("start", this._state);
    }
    try {
      this._startedAt = new Date();
      this._state = PromptState.RUNNING;
    } catch (err) {
      this._state = PromptState.FAILED;
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== PromptState.RUNNING) {
      throw new InvalidPromptStateException("stop", this._state);
    }
    try {
      this._stoppedAt = new Date();
      this._state = PromptState.STOPPED;
    } catch (err) {
      this._state = PromptState.FAILED;
      throw err;
    }
  }

  public async register(
    templateOrPrompt: PromptTemplate | any
  ): Promise<void> {
    if (this._state !== PromptState.RUNNING && this._state !== PromptState.READY) {
      throw new InvalidPromptStateException("register", this._state);
    }

    // Extract template if a legacy Prompt is passed
    let template: PromptTemplate;
    if (templateOrPrompt && (templateOrPrompt.template || typeof templateOrPrompt.render === "function")) {
      template = templateOrPrompt.template || templateOrPrompt;
    } else {
      template = templateOrPrompt;
    }

    PromptValidator.validateTemplate(template);

    const key = `${template.id}:${template.version}`;
    if (this._templates.has(key)) {
      throw new PromptValidationException(
        `duplicate IDs: Prompt template with ID "${template.id}" and version "${template.version}" is already registered.`
      );
    }

    // Wrap the template to include legacy render and content methods
    const compatTemplate: PromptTemplate = {
      ...template,
      render: (variables: Record<string, unknown>) => {
        if (template.content !== undefined) {
          return PromptRenderer.renderLegacy(template.content, variables, template.variables);
        }
        return PromptRenderer.render(template, variables).userPrompt || "";
      }
    };

    this._templates.set(key, deepFreeze(compatTemplate));

    if (this._context?.messageBus) {
      await this._context.messageBus.publish({
        id: "msg-" + Date.now(),
        type: "prompt.registered",
        payload: { promptId: template.id, version: template.version },
      });
    }
  }

  public async unregister(
    promptId: string
  ): Promise<void> {
    if (this._state !== PromptState.RUNNING && this._state !== PromptState.READY) {
      throw new InvalidPromptStateException("unregister", this._state);
    }

    let deleted = false;
    for (const key of this._templates.keys()) {
      if (key.startsWith(`${promptId}:`)) {
        this._templates.delete(key);
        deleted = true;
      }
    }

    if (!deleted) {
      throw new PromptValidationException(`Prompt template with ID "${promptId}" not found.`);
    }

    if (this._context?.messageBus) {
      await this._context.messageBus.publish({
        id: "msg-" + Date.now(),
        type: "prompt.unregistered",
        payload: { promptId },
      });
    }
  }

  public has(
    promptId: string
  ): boolean {
    for (const key of this._templates.keys()) {
      if (key.startsWith(`${promptId}:`)) {
        const t = this._templates.get(key);
        if (t && t.enabled) {
          return true;
        }
      }
    }
    return false;
  }

  public get(
    promptId: string
  ): PromptTemplate | undefined {
    const list: PromptTemplate[] = [];
    for (const key of this._templates.keys()) {
      if (key.startsWith(`${promptId}:`)) {
        const t = this._templates.get(key);
        if (t && t.enabled) {
          list.push(t);
        }
      }
    }
    if (list.length === 0) return undefined;
    return deepFreeze(getLatestVersion(list));
  }

  public list(): readonly PromptTemplate[] {
    const list = Array.from(this._templates.values()).map((t) => deepFreeze(t));
    return deepFreeze(list);
  }

  public async render(
    promptId: string,
    variables?: Record<string, unknown>
  ): Promise<PromptExecution> {
    if (this._state !== PromptState.RUNNING && this._state !== PromptState.READY) {
      throw new InvalidPromptStateException("render", this._state);
    }

    const template = this.get(promptId);
    if (!template) {
      throw new PromptValidationException(`Prompt template with ID "${promptId}" not found.`);
    }

    const execution = PromptRenderer.render(template, variables);
    this._renderedCount++;

    if (this._context?.messageBus) {
      await this._context.messageBus.publish({
        id: "msg-" + Date.now(),
        type: "prompt.rendered",
        payload: { promptId, version: template.version },
      });
    }

    return deepFreeze(execution);
  }

  public snapshot(): PromptSnapshot {
    const snap: PromptSnapshot = {
      id: "prompt-registry",
      state: this._state,
      initializedAt: this._initializedAt,
      startedAt: this._startedAt,
      stoppedAt: this._stoppedAt,
      templateCount: this._templates.size,
      renderedCount: this._renderedCount,
      metadata: { ...this._metadata },
      timestamp: new Date(),
      // Backward compatibility
      promptsCount: this._templates.size,
    };
    return deepFreeze(snap);
  }
}
