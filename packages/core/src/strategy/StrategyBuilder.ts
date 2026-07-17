import { StrategyEngine } from "./StrategyEngine";
import {
  IPillarBuilder,
  ISeriesPlanner,
  ISchedulePlanner,
  ICalendarGenerator,
} from "./interfaces";

export class StrategyBuilder {
  private _context?: any;
  private _configuration?: any;
  private _metadata: Record<string, unknown> = {};
  private _pillarBuilder?: IPillarBuilder;
  private _seriesPlanner?: ISeriesPlanner;
  private _schedulePlanner?: ISchedulePlanner;
  private _calendarGenerator?: ICalendarGenerator;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withConfiguration(configuration: any): this {
    this._configuration = configuration;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...metadata };
    return this;
  }

  public withPillarBuilder(builder: IPillarBuilder): this {
    this._pillarBuilder = builder;
    return this;
  }

  public withSeriesPlanner(planner: ISeriesPlanner): this {
    this._seriesPlanner = planner;
    return this;
  }

  public withSchedulePlanner(planner: ISchedulePlanner): this {
    this._schedulePlanner = planner;
    return this;
  }

  public withCalendarGenerator(generator: ICalendarGenerator): this {
    this._calendarGenerator = generator;
    return this;
  }

  public build(): StrategyEngine {
    if (!this._context) {
      throw new Error("Context is required to build a StrategyEngine.");
    }
    return new StrategyEngine(
      this._context,
      this._configuration,
      this._metadata,
      this._pillarBuilder,
      this._seriesPlanner,
      this._schedulePlanner,
      this._calendarGenerator
    );
  }
}
