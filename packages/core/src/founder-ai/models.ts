import { FounderAIState } from "./FounderAIState";
import { FounderMode } from "./FounderMode";
import { FounderGoalType } from "./FounderGoalType";
import { DecisionPriority } from "./DecisionPriority";
import { ExecutionMode } from "./ExecutionMode";
import { RecommendationState } from "./RecommendationState";

export interface FounderProfile {
  id: string;
  name: string;
  preferences: FounderPreference;
  workingHours: string; // e.g. "09:00-18:00"
  preferredProviders: string[];
  businessGoals: string[];
  activeProjects: string[];
}

export interface FounderGoal {
  id: string;
  title: string;
  type: FounderGoalType;
  priority: number; // e.g. 1 to 10
  progressPercent: number;
  deadline: Date;
  status: "active" | "archived" | "completed";
}

export interface FounderDecision {
  id: string;
  title: string;
  alternatives: string[];
  priority: DecisionPriority;
  scores: Record<string, number>;
  estimatedImpact: number; // e.g. 1 to 100
  estimatedRisk: number;
  chosenOption?: string;
  reason?: string;
  timestamp: Date;
}

export interface FounderTask {
  id: string;
  name: string;
  projectId: string;
  priority: number;
  completed: boolean;
}

export interface FounderSession {
  id: string;
  mode: FounderMode;
  startedAt: Date;
  completedAt?: Date;
}

export interface FounderRoutine {
  id: string;
  name: string;
  mode: ExecutionMode;
  schedule: string;
}

export interface FounderMemory {
  id: string;
  key: string;
  value: any;
  timestamp: Date;
}

export interface FounderPreference {
  theme: "dark" | "light";
  enableNotifications: boolean;
  alertOnRiskPercent: number;
}

export interface FounderInsight {
  id: string;
  niche: string;
  bestPostingTime: string;
  hooksPerformance: Record<string, number>;
  weakestContentUrl?: string;
  budgetSaved: number;
  productivityScore: number;
}

export interface FounderRecommendation {
  id: string;
  title: string;
  suggestion: string;
  confidence: number;
  state: RecommendationState;
  timestamp: Date;
}

export interface FounderExecutionPlan {
  id: string;
  goalId: string;
  steps: string[];
  mode: ExecutionMode;
  deadline: Date;
}

export interface FounderObjective {
  id: string;
  name: string;
  metricTarget: number;
  metricCurrent: number;
}

export interface FounderDailyBrief {
  briefDate: Date;
  priorities: string[];
  blockedTasksCount: number;
  upcomingDeadlinesCount: number;
  healthScore: number;
}

export interface FounderRisk {
  id: string;
  category: string;
  impactScore: number;
  probabilityScore: number;
}

export interface FounderOpportunity {
  id: string;
  title: string;
  estimatedGrowthPercent: number;
}

export interface FounderFocusArea {
  id: string;
  niche: string;
  priorityLevel: number;
}

export interface FounderContext {
  namespace: string;
  activeMode: FounderMode;
  env: string;
}

export interface FounderStatistics {
  tasksCompleted: number;
  goalsCompleted: number;
  projectsActive: number;
  hoursSaved: number;
  tokensUsed: number;
  moneySpent: number;
  videosCreated: number;
  postsPublished: number;
  analyticsReportsRun: number;
  optimizationRuns: number;
}

export interface FounderSnapshot {
  timestamp: Date;
  state: FounderAIState;
  profile: FounderProfile;
  goals: FounderGoal[];
  decisions: FounderDecision[];
  insights: FounderInsight[];
  statistics: FounderStatistics;
}

export interface FounderMission {
  missionId: string;
  statement: string;
}

export interface FounderStrategy {
  strategyId: string;
  pillar: string;
  tasksLinked: string[];
}

export interface FounderReflection {
  id: string;
  content: string;
  timestamp: Date;
}

export interface FounderNotification {
  id: string;
  message: string;
  read: boolean;
}

export interface FounderTimeline {
  events: { time: Date; name: string }[];
}

export interface FounderExecutionHistory {
  executionsCount: number;
  avgDurationMs: number;
}

export interface FounderConversation {
  id: string;
  messages: { sender: string; text: string }[];
}

export interface FounderProject {
  id: string;
  name: string;
  status: string;
}

export interface FounderPriorityQueue {
  name: string;
  tasks: FounderTask[];
}

export interface FounderDecisionHistory {
  decisions: FounderDecision[];
}

export interface FounderDashboard {
  refreshTimestamp: Date;
  widgetsCount: number;
}

export interface FounderStatus {
  status: "idle" | "busy" | "offline";
}

export interface FounderHealth {
  score: number;
  status: string;
}

export interface FounderSummary {
  summaryText: string;
  timestamp: Date;
}

export interface FounderCheckpoint {
  id: string;
  name: string;
  timestamp: Date;
}

export interface FounderReport {
  id: string;
  title: string;
  createdAt: Date;
}
