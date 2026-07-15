export interface RuntimeSessionDescriptor {
  readonly id: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
