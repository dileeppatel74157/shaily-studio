import { DashboardSnapshot, DashboardWidget, DashboardLayout, DashboardNotification } from "./models";
import { WidgetType } from "./WidgetType";
import { LayoutMode } from "./LayoutMode";
import { DashboardSection } from "./DashboardSection";
import { DashboardException, WidgetException, LayoutException } from "./exceptions";

export class DashboardValidator {
  public validate(snapshot: DashboardSnapshot): void {
    if (!snapshot) {
      throw new DashboardException("Dashboard snapshot is null or undefined.");
    }

    // 1. Overview status must be defined.
    if (!snapshot.overview.status) {
      throw new DashboardException("Overview status is required.");
    }

    // 2. System health score must be between 0 and 100.
    if (snapshot.overview.healthScore < 0 || snapshot.overview.healthScore > 100) {
      throw new DashboardException(`System health score must be between 0 and 100. Got: ${snapshot.overview.healthScore}`);
    }

    // 3. CPU usage must be between 0 and 100.
    if (snapshot.overview.cpuUsage < 0 || snapshot.overview.cpuUsage > 100) {
      throw new DashboardException(`CPU usage must be between 0 and 100. Got: ${snapshot.overview.cpuUsage}`);
    }

    // 4. RAM usage must be between 0 and 100.
    if (snapshot.overview.ramUsage < 0 || snapshot.overview.ramUsage > 100) {
      throw new DashboardException(`RAM usage must be between 0 and 100. Got: ${snapshot.overview.ramUsage}`);
    }

    // 5. GPU usage must be between 0 and 100.
    if (snapshot.overview.gpuUsage < 0 || snapshot.overview.gpuUsage > 100) {
      throw new DashboardException(`GPU usage must be between 0 and 100. Got: ${snapshot.overview.gpuUsage}`);
    }

    // 6. System uptime must be non-negative.
    if (snapshot.overview.uptimeSeconds < 0) {
      throw new DashboardException(`System uptime cannot be negative. Got: ${snapshot.overview.uptimeSeconds}`);
    }

    // 7. Widget IDs unique
    const widgetIds = new Set<string>();
    for (const widget of snapshot.widgets) {
      if (widgetIds.has(widget.id)) {
        throw new WidgetException(`Widget ID is not unique: ${widget.id}`);
      }
      widgetIds.add(widget.id);
      this.validateWidget(widget);
    }

    // 8. Dashboard contains overview section
    const hasOverview = snapshot.widgets.some(w => w.section === DashboardSection.OVERVIEW);
    if (!hasOverview) {
      throw new DashboardException("Dashboard must contain at least one widget in the OVERVIEW section.");
    }

    // 9. Notifications valid
    for (const notif of snapshot.notifications) {
      this.validateNotification(notif);
    }
  }

  // 10-12. Widget validation
  public validateWidget(widget: DashboardWidget): void {
    if (!widget.id) {
      throw new WidgetException("Widget ID is required.");
    }
    if (!widget.name) {
      throw new WidgetException(`Widget name is required for widget ${widget.id}.`);
    }
    if (!widget.type || !Object.values(WidgetType).includes(widget.type)) {
      throw new WidgetException(`Widget has invalid type: ${widget.type}`);
    }

    // 13. Charts have datasets
    if (widget.type === WidgetType.CHART) {
      const data = widget.data;
      if (!data || !Array.isArray(data.datasets) || data.datasets.length === 0) {
        throw new WidgetException(`Chart widget ${widget.id} must have a non-empty datasets array.`);
      }
      for (const dataset of data.datasets) {
        if (!dataset.label) {
          throw new WidgetException(`Chart dataset in widget ${widget.id} is missing a label.`);
        }
        if (!Array.isArray(dataset.data)) {
          throw new WidgetException(`Chart dataset ${dataset.label} in widget ${widget.id} must have data values.`);
        }
        // 14. Chart datasets must match labels length if labels are specified
        if (data.labels && dataset.data.length !== data.labels.length) {
          throw new WidgetException(`Chart dataset ${dataset.label} length (${dataset.data.length}) in widget ${widget.id} does not match labels length (${data.labels.length}).`);
        }
      }
    }
  }

  // 15-18. Layout validation
  public validateLayout(layout: DashboardLayout, registeredWidgetIds: Set<string>): boolean {
    if (!layout) {
      throw new LayoutException("Layout is undefined.");
    }
    if (layout.columns <= 0 || layout.rows <= 0) {
      throw new LayoutException(`Layout dimensions must be positive. Got columns: ${layout.columns}, rows: ${layout.rows}`);
    }

    // Coordinates grid bounds check
    if (layout.mode === LayoutMode.GRID) {
      const occupiedCells = new Map<string, string>(); // coordinate "x,y" -> widgetId
      
      for (const item of layout.widgets) {
        if (!registeredWidgetIds.has(item.widgetId)) {
          throw new LayoutException(`Widget in layout does not exist in registry: ${item.widgetId}`);
        }
        if (item.x < 0 || item.y < 0 || item.w <= 0 || item.h <= 0) {
          throw new LayoutException(`Invalid layout coordinates for widget ${item.widgetId}: x=${item.x}, y=${item.y}, w=${item.w}, h=${item.h}`);
        }
        if (item.x + item.w > layout.columns) {
          throw new LayoutException(`Widget ${item.widgetId} exceeds layout width boundary.`);
        }
        if (item.y + item.h > layout.rows) {
          throw new LayoutException(`Widget ${item.widgetId} exceeds layout height boundary.`);
        }

        // Check overlaps
        for (let dx = 0; dx < item.w; dx++) {
          for (let dy = 0; dy < item.h; dy++) {
            const key = `${item.x + dx},${item.y + dy}`;
            if (occupiedCells.has(key)) {
              throw new LayoutException(`Widget overlap detected at cell (${item.x + dx}, ${item.y + dy}) between ${occupiedCells.get(key)} and ${item.widgetId}`);
            }
            occupiedCells.set(key, item.widgetId);
          }
        }
      }
    }
    return true;
  }

  // 19. Refresh interval positive
  public validateRefreshInterval(intervalMs: number): void {
    if (intervalMs <= 0) {
      throw new DashboardException(`Refresh interval must be a positive integer. Got: ${intervalMs}`);
    }
  }

  // 20. Notifications validity check
  public validateNotification(notif: DashboardNotification): void {
    if (!notif.id) {
      throw new DashboardException("Notification ID is required.");
    }
    if (!notif.title || !notif.message) {
      throw new DashboardException(`Notification ${notif.id} is missing title or message.`);
    }
    const severities = ["info", "warning", "error", "critical"];
    if (!severities.includes(notif.severity)) {
      throw new DashboardException(`Notification ${notif.id} has invalid severity: ${notif.severity}`);
    }
  }

  // 21. CommandCenter commands registration check
  public validateCommandsRegistered(commands: string[]): void {
    if (commands.length === 0) {
      throw new DashboardException("No founder quick action commands are registered.");
    }
  }

  // 22. Metrics initialized check
  public validateMetricsInitialized(metrics: string[]): void {
    const requiredMetrics = ["cpu_usage", "ram_usage", "gpu_usage"];
    for (const req of requiredMetrics) {
      if (!metrics.includes(req)) {
        throw new DashboardException(`Required system metric not initialized: ${req}`);
      }
    }
  }
}
