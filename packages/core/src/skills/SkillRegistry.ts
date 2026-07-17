import { ISkillRegistry } from "./ISkillRegistry";
import { ISkill } from "./ISkill";
import { SkillSnapshot } from "./SkillSnapshot";
import { SkillExecutionResult } from "./SkillExecutionResult";
import { SkillState } from "./SkillState";
import { SkillContext } from "./SkillContext";
import { SkillValidator } from "./SkillValidator";
import { DuplicateSkillException, InvalidSkillStateException, deepFreeze } from "./types";

export class SkillRegistry implements ISkillRegistry {
  private readonly _skills = new Map<string, ISkill>();

  constructor(private readonly _context: SkillContext) {}

  public async register(skill: ISkill): Promise<void> {
    if (this._skills.has(skill.id)) {
      throw new DuplicateSkillException(skill.id);
    }

    // Validate manifest
    SkillValidator.validateManifest(skill.manifest);

    this._skills.set(skill.id, skill);

    // Validate dependencies across all registered skills
    try {
      SkillValidator.validateDependencies(Array.from(this._skills.values()));
    } catch (err) {
      this._skills.delete(skill.id);
      throw err;
    }

    // Publish event
    if (this._context.eventBus) {
      await this._context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "SkillInstalled",
        timestamp: new Date(),
        correlationId: "corr-skills",
        source: "SkillRegistry",
        payload: { skillId: skill.id },
        metadata: {},
      });
    }
  }

  public async unregister(id: string): Promise<void> {
    if (!this._skills.has(id)) {
      return;
    }
    const skill = this._skills.get(id)!;
    await skill.stop();
    this._skills.delete(id);
  }

  public async update(skill: ISkill): Promise<void> {
    if (!this._skills.has(skill.id)) {
      throw new Error(`Skill with ID ${skill.id} is not registered.`);
    }

    SkillValidator.validateManifest(skill.manifest);

    const old = this._skills.get(skill.id)!;
    this._skills.set(skill.id, skill);

    try {
      SkillValidator.validateDependencies(Array.from(this._skills.values()));
    } catch (err) {
      this._skills.set(skill.id, old);
      throw err;
    }
  }

  public list(): ReadonlyArray<ISkill> {
    return Array.from(this._skills.values());
  }

  public search(query: string): ReadonlyArray<ISkill> {
    const q = query.toLowerCase();
    return Array.from(this._skills.values()).filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.manifest.metadata.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  public get(id: string): ISkill | undefined {
    return this._skills.get(id);
  }

  public has(id: string): boolean {
    return this._skills.has(id);
  }

  public async load(id: string): Promise<void> {
    const skill = this._skills.get(id);
    if (!skill) {
      throw new Error(`Skill ${id} not found.`);
    }

    if (skill.state === SkillState.CREATED) {
      await skill.initialize();
    }

    if (this._context.eventBus) {
      await this._context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "SkillLoaded",
        timestamp: new Date(),
        correlationId: "corr-skills",
        source: "SkillRegistry",
        payload: { skillId: id },
        metadata: {},
      });
    }
  }

  public async unload(id: string): Promise<void> {
    const skill = this._skills.get(id);
    if (!skill) {
      throw new Error(`Skill ${id} not found.`);
    }

    await skill.stop();

    if (this._context.eventBus) {
      await this._context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "SkillUnloaded",
        timestamp: new Date(),
        correlationId: "corr-skills",
        source: "SkillRegistry",
        payload: { skillId: id },
        metadata: {},
      });
    }
  }

  public async reload(id: string): Promise<void> {
    await this.unload(id);
    await this.load(id);
  }

  public async execute(id: string, input?: unknown): Promise<SkillExecutionResult> {
    const skill = this._skills.get(id);
    if (!skill) {
      throw new Error(`Skill ${id} not found.`);
    }

    // Validate parameters
    for (const cap of skill.manifest.capabilities) {
      SkillValidator.validateParameters(cap.parameters, input);
    }

    // Validate permissions
    const requiredPermissions = skill.manifest.permissions.map((p) => p.name);
    const grantedPermissions = (this._context.config.get("permissions") as string[]) || [];
    SkillValidator.validatePermissions(requiredPermissions, grantedPermissions);

    const result = await skill.execute(input);

    // Event & Memory recording
    if (result.success) {
      if (this._context.eventBus) {
        await this._context.eventBus.publish({
          id: "evt-" + Math.random().toString(36).substring(2, 11),
          name: "SkillExecuted",
          timestamp: new Date(),
          correlationId: "corr-skills",
          source: "SkillRegistry",
          payload: { skillId: id, executionId: result.executionId },
          metadata: {},
        });
      }
    } else {
      if (this._context.eventBus) {
        await this._context.eventBus.publish({
          id: "evt-" + Math.random().toString(36).substring(2, 11),
          name: "SkillFailed",
          timestamp: new Date(),
          correlationId: "corr-skills",
          source: "SkillRegistry",
          payload: { skillId: id, executionId: result.executionId, error: result.error },
          metadata: {},
        });
      }
    }

    await this.recordMemory(id, result.success, result.runtimeMs, input, result.error);

    return result;
  }

  private async recordMemory(
    skillId: string,
    success: boolean,
    runtimeMs: number,
    input: unknown,
    error?: string
  ): Promise<void> {
    if (!this._context.memoryStore) return;
    try {
      const namespace = "skills";
      const key = `${skillId}:history`;
      const entry = await this._context.memoryStore.get(namespace, key);
      let history: any[] = [];
      if (entry && entry.value && (entry.value as any).executionHistory) {
        history = [...(entry.value as any).executionHistory];
      }

      history.push({
        executionId: "exec-" + Math.random().toString(36).substring(2, 11),
        timestamp: new Date(),
        input,
        success,
        runtimeMs,
        error,
      });

      const totalRuns = history.length;
      const successfulRuns = history.filter((h) => h.success).length;
      const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;
      const totalRuntime = history.reduce((acc, h) => acc + h.runtimeMs, 0);
      const averageRuntime = totalRuns > 0 ? totalRuntime / totalRuns : 0;
      const lastExecution = new Date();

      await this._context.memoryStore.set(namespace, key, {
        executionHistory: history,
        successRate,
        averageRuntime,
        lastExecution,
      });
    } catch (e) {
      this._context.logger.error(
        `Failed to record skill execution memory for ${skillId}`,
        {},
        e as Error
      );
    }
  }

  public snapshot(): SkillSnapshot {
    const list = Array.from(this._skills.values()).map((s) => ({
      id: s.id,
      name: s.name,
      state: s.state,
      manifest: s.manifest,
    }));
    return deepFreeze({
      timestamp: new Date(),
      count: list.length,
      skills: list,
    });
  }
}
