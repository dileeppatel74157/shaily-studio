import { IStudio } from "../studio/IStudio";
import { PlatformSnapshot } from "./PlatformSnapshot";

export interface IPlatform {
  readonly studio: IStudio;

  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  snapshot(): PlatformSnapshot;
}
