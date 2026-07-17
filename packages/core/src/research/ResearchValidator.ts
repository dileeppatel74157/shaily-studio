import { ResearchValidationException } from "./types";
import { ResearchRequest, ResearchTopic, ResearchResponse } from "./models";

export class ResearchValidator {
  public static validateRequest(request: ResearchRequest): void {
    if (!request.id) {
      throw new ResearchValidationException("Request ID is required.");
    }
    if (!request.type) {
      throw new ResearchValidationException("Research Type is required.");
    }
    if (!request.channelProfile || Object.keys(request.channelProfile).length === 0) {
      throw new ResearchValidationException("Channel profile cannot be empty.");
    }
    this.detectCircularReferences(request.channelProfile, "request.channelProfile");
  }

  public static validateScores(topic: ResearchTopic): void {
    const scoreFields: Array<keyof ResearchTopic> = [
      "growthScore",
      "competitionScore",
      "trendScore",
      "monetizationScore",
      "audienceMatchScore",
      "confidenceScore",
      "finalScore",
    ];
    for (const field of scoreFields) {
      const val = topic[field];
      if (typeof val !== "number" || val < 0 || val > 1) {
        throw new ResearchValidationException(
          `Score '${field}' must be a number between 0 and 1, got ${val} on topic '${topic.topic}'`
        );
      }
    }
  }

  public static validateTopic(topic: ResearchTopic): void {
    if (!topic.id) throw new ResearchValidationException("Topic ID is required.");
    if (!topic.topic) throw new ResearchValidationException("Topic name is required.");
    if (!topic.category) throw new ResearchValidationException("Topic category is required.");
    if (!topic.metadata) {
      throw new ResearchValidationException("Topic metadata is required.");
    }
    if (Object.keys(topic.metadata).length === 0) {
      throw new ResearchValidationException("Topic metadata cannot be empty.");
    }
    this.validateScores(topic);
    this.detectCircularReferences(topic.metadata, "topic.metadata");
  }

  public static validateResponse(response: ResearchResponse): void {
    if (!response.requestId) {
      throw new ResearchValidationException("Response must have requestId.");
    }
    const hasData = (response.topics && response.topics.length > 0) ||
                    (response.opportunities && response.opportunities.length > 0) ||
                    (response.trendAnalysis && (
                      response.trendAnalysis.trendingTopics.length > 0 ||
                      response.trendAnalysis.risingTopics.length > 0 ||
                      response.trendAnalysis.evergreenTopics.length > 0 ||
                      response.trendAnalysis.seasonalOpportunities.length > 0
                    )) ||
                    (response.competitorProfile && response.competitorProfile.length > 0) ||
                    (response.keywordAnalysis && response.keywordAnalysis.length > 0) ||
                    (response.audienceInsight !== undefined) ||
                    (response.topicClusters && response.topicClusters.length > 0);

    if (!hasData) {
      throw new ResearchValidationException("Research response must contain at least one dataset (empty dataset is invalid).");
    }
    
    if (response.topics && response.topics.length > 0) {
      const topicIds = new Set<string>();
      const topicNames = new Set<string>();
      for (const t of response.topics) {
        this.validateTopic(t);
        if (topicIds.has(t.id)) {
          throw new ResearchValidationException(`Duplicate topic ID detected: ${t.id}`);
        }
        if (topicNames.has(t.topic.toLowerCase())) {
          throw new ResearchValidationException(`Duplicate topic name detected: ${t.topic}`);
        }
        topicIds.add(t.id);
        topicNames.add(t.topic.toLowerCase());
      }
    }
  }

  public static detectCircularReferences(obj: any, path: string, seen = new Set<any>()): void {
    if (obj && typeof obj === "object") {
      if (seen.has(obj)) {
        throw new ResearchValidationException(`Circular reference detected in ${path}`);
      }
      seen.add(obj);
      for (const key of Object.keys(obj)) {
        this.detectCircularReferences(obj[key], `${path}.${key}`, new Set(seen));
      }
    }
  }
}
