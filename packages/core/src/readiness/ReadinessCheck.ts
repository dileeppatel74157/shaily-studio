import { ReadinessContext } from "./ReadinessContext";
import { ReadinessResult } from "./ReadinessResult";

export interface ReadinessCheck {
  readonly id: string;
  readonly name: string;
  execute(context: ReadinessContext): Promise<ReadinessResult>;
}
