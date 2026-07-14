export interface ServerMetadata {
  readonly id: string;
  readonly environment: string;
  readonly version: string;
  readonly port: number;
  readonly host: string;
  readonly [key: string]: any;
}
