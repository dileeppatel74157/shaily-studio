import { IKernel } from "./IKernel";
import { Kernel } from "./Kernel";
import { KernelContext } from "./KernelContext";
import { KernelValidationException } from "./types";

export class KernelBuilder {
  private _context?: KernelContext;
  private _metadata: Record<string, unknown> = {};

  public withContext(context: KernelContext): this {
    this._context = context;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): IKernel {
    if (!this._context) {
      throw new KernelValidationException("KernelContext is required to build Kernel.");
    }

    return new Kernel(
      this._context,
      this._metadata
    );
  }
}
