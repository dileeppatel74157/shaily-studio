import { AgentMetadata } from "@shaily/shared";

export const SYSTEM_VERSION = "1.0.0";

export const DEFAULT_AGENTS: AgentMetadata[] = [
  {
    id: "agent-ideator",
    name: "Topic Ideator",
    role: "Content Ideation",
    description: "Generates high-engagement content ideas and angles based on trending topics.",
    version: "1.0.0",
    capabilities: ["trend-analysis", "headline-generation"],
  },
  {
    id: "agent-writer",
    name: "Script Writer",
    role: "Scripting and Copywriting",
    description: "Turns ideas into full video scripts optimized for visual storytelling.",
    version: "1.0.0",
    capabilities: ["script-writing", "pacing-optimization"],
  },
  {
    id: "agent-editor",
    name: "Video Orchestrator",
    role: "Video Editing Coordinator",
    description: "Coordinates raw video assets and stitches them into final sequences.",
    version: "1.0.0",
    capabilities: ["timeline-generation", "asset-indexing"],
  },
];
