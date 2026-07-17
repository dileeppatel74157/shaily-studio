import { Skill, SkillExecutorFn } from "./Skill";
import { SkillManifest } from "./SkillManifest";
import { SkillContext } from "./SkillContext";
import { SkillConfiguration } from "./SkillConfiguration";
import { SkillType } from "./SkillType";
import { SkillScope } from "./SkillScope";
import { SkillVisibility } from "./SkillVisibility";
import { SkillVersion } from "./SkillVersion";
import { SkillAuthor } from "./SkillAuthor";

export class SkillBuilder {
  private _id!: string;
  private _name!: string;
  private _description: string = "";
  private _version: string = "1.0.0";
  private _author: string | SkillAuthor = "Unknown";
  private _type: SkillType = SkillType.CUSTOM;
  private _scope: SkillScope = SkillScope.PRIVATE;
  private _visibility: SkillVisibility = SkillVisibility.PRIVATE;
  private _tags: string[] = [];
  private _capabilities: any[] = [];
  private _dependencies: any[] = [];
  private _requirements: any[] = [];
  private _permissions: any[] = [];
  private _context!: SkillContext;
  private _executor!: SkillExecutorFn;
  private _configuration?: SkillConfiguration;

  public withId(id: string): this {
    this._id = id;
    return this;
  }

  public withName(name: string): this {
    this._name = name;
    return this;
  }

  public withDescription(description: string): this {
    this._description = description;
    return this;
  }

  public withVersion(version: string): this {
    this._version = version;
    return this;
  }

  public withAuthor(author: string | SkillAuthor): this {
    this._author = author;
    return this;
  }

  public withType(type: SkillType): this {
    this._type = type;
    return this;
  }

  public withScope(scope: SkillScope): this {
    this._scope = scope;
    return this;
  }

  public withVisibility(visibility: SkillVisibility): this {
    this._visibility = visibility;
    return this;
  }

  public withTags(tags: string[]): this {
    this._tags = tags;
    return this;
  }

  public addCapability(capability: any): this {
    this._capabilities.push(capability);
    return this;
  }

  public addDependency(dependency: any): this {
    this._dependencies.push(dependency);
    return this;
  }

  public addRequirement(requirement: any): this {
    this._requirements.push(requirement);
    return this;
  }

  public addPermission(permission: any): this {
    this._permissions.push(permission);
    return this;
  }

  public withContext(context: SkillContext): this {
    this._context = context;
    return this;
  }

  public withExecutor(executor: SkillExecutorFn): this {
    this._executor = executor;
    return this;
  }

  public withConfiguration(configuration: SkillConfiguration): this {
    this._configuration = configuration;
    return this;
  }

  public build(): Skill {
    if (!this._id) throw new Error("Skill ID is required");
    if (!this._name) throw new Error("Skill name is required");
    if (!this._context) throw new Error("Context is required");
    if (!this._executor) throw new Error("Executor function is required");

    const parsedVersion =
      typeof this._version === "string" ? SkillVersion.parse(this._version) : this._version;
    const parsedAuthor = typeof this._author === "string" ? { name: this._author } : this._author;

    const manifest: SkillManifest = {
      metadata: {
        id: this._id,
        name: this._name,
        description: this._description,
        version: parsedVersion,
        author: parsedAuthor,
        type: this._type,
        scope: this._scope,
        visibility: this._visibility,
        tags: this._tags,
      },
      capabilities: this._capabilities,
      dependencies: this._dependencies,
      requirements: this._requirements,
      permissions: this._permissions,
    };

    return new Skill(manifest, this._context, this._executor, this._configuration);
  }
}
