import { DashboardState } from "./DashboardState";
import { DashboardSection } from "./DashboardSection";
import { WidgetType } from "./WidgetType";
import { WidgetState } from "./WidgetState";
import { RefreshMode } from "./RefreshMode";
import { LayoutMode } from "./LayoutMode";

export interface DashboardSnapshot {
  timestamp: Date;
  state: DashboardState;
  overview: SystemOverview;
  providers: ProviderOverview;
  analytics: AnalyticsOverview;
  pipeline: PipelineOverview;
  founder: FounderOverview;
  statistics: DashboardStatistics;
  widgets: DashboardWidget[];
  notifications: DashboardNotification[];
  configuration: ConfigSummary;
}

export interface DashboardWidget {
  id: string;
  name: string;
  type: WidgetType;
  section: DashboardSection;
  state: WidgetState;
  refreshMode: RefreshMode;
  lastRefreshed: Date;
  data: any;
}

export interface DashboardCard {
  id: string;
  title: string;
  value: string | number;
  changePercent?: number;
  icon?: string;
  status?: string;
}

export interface DashboardLayout {
  mode: LayoutMode;
  columns: number;
  rows: number;
  widgets: {
    widgetId: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }[];
}

export interface DashboardNotification {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "error" | "critical";
  timestamp: Date;
  read: boolean;
}

export interface DashboardMetric {
  name: string;
  value: number;
  unit?: string;
  changePercent?: number;
}

export interface DashboardChart {
  id: string;
  title: string;
  type: string;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
  }[];
}

export interface DashboardPanel {
  id: string;
  title: string;
  widgets: DashboardWidget[];
  collapsed?: boolean;
}

export interface SystemOverview {
  status: string;
  activeEngines: string[];
  cpuUsage: number;
  ramUsage: number;
  gpuUsage: number;
  uptimeSeconds: number;
  runningTasks: number;
  queueSize: number;
  healthScore: number;
}

export interface ProviderOverview {
  providers: ProviderMetric[];
  totalCostUsd: number;
  fallbackStats: Record<string, number>;
}

export interface AnalyticsOverview {
  views: number;
  ctr: number;
  retentionRate: number;
  subscribers: number;
  revenueEstimate: number;
  growthRate: number;
  bestVideos: string[];
  worstVideos: string[];
  trends: Record<string, number[]>;
}

export interface PipelineOverview {
  activeProjects: number;
  storyboardsCount: number;
  scriptsCount: number;
  renderingProgress: number;
  generatedAssetsCount: number;
  publishingStatus: string;
  latestVideos: string[];
}

export interface FounderOverview {
  quickActions: string[];
  systemUptime: number;
  activeTasks: string[];
}

export interface DashboardStatistics {
  refreshCount: number;
  commandExecCount: number;
  errorCount: number;
  lastEventTime?: Date;
}

export interface DashboardHistoryEntry {
  timestamp: Date;
  snapshot: DashboardSnapshot;
}

export interface StoryboardSummary {
  id: string;
  projectId: string;
  scenesCount: number;
  status: string;
}

export interface ScriptSummary {
  id: string;
  title: string;
  version: string;
  wordCount: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  updatedAt: Date;
}

export interface AssetSummary {
  id: string;
  type: string;
  sizeBytes: number;
  url?: string;
}

export interface ProviderMetric {
  name: string;
  status: "online" | "offline" | "degraded";
  latencyMs: number;
  costUsd: number;
  tokenUsage: number;
  qualityScore: number;
}

export interface CostBreakdown {
  provider: string;
  costUsd: number;
  currency: string;
}

export interface LatencyReport {
  provider: string;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

export interface QualityMetric {
  dimension: string;
  score: number;
}

export interface ExperimentSummary {
  id: string;
  name: string;
  status: string;
  improvementPercent: number;
}

export interface ABTestSummary {
  id: string;
  variantA: string;
  variantB: string;
  confidence: number;
  winner?: string;
}

export interface LogSummary {
  level: string;
  count: number;
  lastMessage?: string;
}

export interface ErrorSummary {
  category: string;
  message: string;
  occurrences: number;
}

export interface ConfigSummary {
  theme: "light" | "dark" | "system";
  activeProviders: string[];
  dbType: string;
  workspacePath: string;
  securityLevel: string;
}

export interface SecurityConfigSummary {
  apiKeysConfigured: string[];
  mfaEnabled: boolean;
  sslRequired: boolean;
}

export interface WidgetData {
  widgetId: string;
  timestamp: Date;
  payload: any;
}
