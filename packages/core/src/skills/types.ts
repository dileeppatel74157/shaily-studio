export class SkillException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SkillValidationException extends SkillException {
  constructor(message: string) {
    super(message);
  }
}

export class DuplicateSkillException extends SkillException {
  constructor(skillId: string) {
    super(`Skill with ID "${skillId}" is already registered.`);
  }
}

export class SkillDependencyException extends SkillException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidSkillStateException extends SkillException {
  constructor(skillId: string, action: string, currentState: string) {
    super(
      `Cannot perform "${action}" on skill "${skillId}" because it is currently in state "${currentState}".`
    );
  }
}

export function deepFreeze<T>(obj: any): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    if (
      obj.hasOwnProperty(prop) &&
      obj[prop] !== null &&
      (typeof obj[prop] === "object" || typeof obj[prop] === "function") &&
      !Object.isFrozen(obj[prop])
    ) {
      deepFreeze(obj[prop]);
    }
  });
  return obj;
}
