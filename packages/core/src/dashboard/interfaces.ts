import { DashboardState } from "./DashboardState";
import { DashboardSection } from "./DashboardSection";
import { WidgetState } from "./WidgetState";
import {
  DashboardSnapshot,
  DashboardWidget,
  DashboardMetric,
  DashboardNotification,
  DashboardPanel,
  DashboardLayout,
  DashboardStatistics,
  DashboardHistoryEntry,
  SystemOverview,
  ProviderOverview,
  AnalyticsOverview,
  PipelineOverview,
  FounderOverview
} from "./models";

export interface IDashboardEngine {
  getState(): DashboardState;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  getSnapshot(): DashboardSnapshot;
  getStatistics(): DashboardStatistics;
  
  getOverviewManager(): IOverviewManager;
  getWidgetManager(): IWidgetManager;
  getLayoutManager(): ILayoutManager;
  getMetricManager(): IMetricManager;
  getNotificationManager(): INotificationManager;
  getRefreshManager(): IRefreshManager;
  getCommandCenter(): ICommandCenter;
  getPanelManager(): IPanelManager;
  getStatisticsManager(): IStatisticsManager;
  getHistoryManager(): IHistoryManager;
  
  on(event: string, handler: (payload: any) => void): void;
  off(event: string, handler: (payload: any) => void): void;
}

export interface IOverviewManager {
  generateSystemOverview(): Promise<SystemOverview>;
  generateProviderOverview(): Promise<ProviderOverview>;
  generateAnalyticsOverview(): Promise<AnalyticsOverview>;
  generatePipelineOverview(): Promise<PipelineOverview>;
  generateFounderOverview(): Promise<FounderOverview>;
}

export interface IWidgetManager {
  registerWidget(widget: DashboardWidget): void;
  unregisterWidget(id: string): void;
  getWidget(id: string): DashboardWidget | undefined;
  getWidgetsBySection(section: DashboardSection): DashboardWidget[];
  updateWidgetState(id: string, state: WidgetState): void;
  updateWidgetData(id: string, data: any): void;
}

export interface ILayoutManager {
  setLayout(layout: DashboardLayout): void;
  getLayout(): DashboardLayout;
  validateLayout(layout: DashboardLayout): boolean;
}

export interface IMetricManager {
  recordMetric(name: string, value: number, unit?: string, changePercent?: number): void;
  getMetric(name: string): DashboardMetric | undefined;
  getMetrics(): DashboardMetric[];
}

export interface INotificationManager {
  addNotification(notification: DashboardNotification): void;
  getNotifications(): DashboardNotification[];
  markAsRead(id: string): void;
  clearNotifications(): void;
}

export interface IRefreshManager {
  refreshSection(section: DashboardSection): Promise<void>;
  refreshAll(): Promise<void>;
  setRefreshInterval(ms: number): void;
  getRefreshInterval(): number;
}

export interface ICommandCenter {
  registerCommand(command: string, action: () => Promise<any>): void;
  executeCommand(command: string): Promise<any>;
  getRegisteredCommands(): string[];
}

export interface IPanelManager {
  createPanel(panel: DashboardPanel): void;
  getPanel(id: string): DashboardPanel | undefined;
  togglePanel(id: string): void;
}

export interface IStatisticsManager {
  getStats(): DashboardStatistics;
  incrementRefreshCount(): void;
  incrementCommandExecCount(): void;
  incrementErrorCount(): void;
}

export interface IHistoryManager {
  getHistory(): DashboardHistoryEntry[];
  pushHistory(snapshot: DashboardSnapshot): void;
  clearHistory(): void;
}
