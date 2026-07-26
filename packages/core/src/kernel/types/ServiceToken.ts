export class ServiceToken<T> {
  public readonly description: string;
  private readonly _symbol: symbol;

  constructor(description: string) {
    this.description = description;
    this._symbol = Symbol(description);
  }

  // Phantom property to prevent TS from structural type erasure on generic type T
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  private readonly _phantom?: T;
}
