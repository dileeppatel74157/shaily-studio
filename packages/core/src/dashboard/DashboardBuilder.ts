import { IDashboardEngine } from "./interfaces";
import { DashboardEngine } from "./DashboardEngine";
import { DashboardWidget, DashboardLayout } from "./models";
import { DashboardException } from "./exceptions";

export class DashboardBuilder {
  private _context?: any;
  private _layout?: DashboardLayout;
  private _refreshIntervalMs = 0;
  private readonly _widgets: DashboardWidget[] = [];

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withLayout(layout: DashboardLayout): this {
    this._layout = layout;
    return this;
  }

  public withRefreshInterval(ms: number): this {
    this._refreshIntervalMs = ms;
    return this;
  }

  public withWidget(widget: DashboardWidget): this {
    this._widgets.push(widget);
    return this;
  }

  public build(): IDashboardEngine {
    if (!this._context) {
      throw new DashboardException("Context is required to build DashboardEngine.");
    }

    const engine = new DashboardEngine(this._context);
    
    // Register custom widgets
    for (const widget of this._widgets) {
      engine.getWidgetManager().registerWidget(widget);
    }

    // Set custom layout if specified
    if (this._layout) {
      engine.getLayoutManager().setLayout(this._layout);
    }

    // Set refresh interval
    if (this._refreshIntervalMs > 0) {
      engine.getRefreshManager().setRefreshInterval(this._refreshIntervalMs);
    }

    return engine;
  }
}
