import { KnowledgeDocument } from "./KnowledgeDocument";
import { KnowledgeQuery } from "./KnowledgeQuery";
import { KnowledgeResult } from "./KnowledgeResult";
import { deepFreeze } from "./types";

export class KnowledgeSearch {
  public search(
    documents: readonly KnowledgeDocument[],
    query: KnowledgeQuery
  ): KnowledgeResult[] {
    const results: KnowledgeResult[] = [];

    // Filter documents by collection and metadata first
    const filteredDocs = documents.filter((doc) => {
      if (query.collection !== undefined && doc.collection !== query.collection) {
        return false;
      }
      if (query.metadata !== undefined) {
        for (const [key, value] of Object.entries(query.metadata)) {
          if (doc.metadata[key] === undefined) {
            return false;
          }
          if (JSON.stringify(doc.metadata[key]) !== JSON.stringify(value)) {
            return false;
          }
        }
      }
      return true;
    });

    // Match chunks in filtered documents
    for (const doc of filteredDocs) {
      for (const chunk of doc.chunks) {
        let score = 1.0;
        let isMatch = true;

        if (query.keyword && query.keyword.trim() !== "") {
          const chunkTextLower = chunk.text.toLowerCase();
          const queryTextLower = query.keyword.toLowerCase().trim();

          if (query.exact) {
            // Exact matching
            if (chunkTextLower.includes(queryTextLower)) {
              score = 10.0;
            } else {
              isMatch = false;
            }
          } else {
            // Term frequency/keyword match score
            const queryTerms = queryTextLower.split(/\s+/).filter((t) => t.length > 0);
            if (queryTerms.length > 0) {
              let matchCount = 0;
              for (const term of queryTerms) {
                if (chunkTextLower.includes(term)) {
                  matchCount++;
                }
              }
              if (matchCount > 0) {
                score = matchCount / queryTerms.length;
              } else {
                isMatch = false;
              }
            }
          }
        }

        if (isMatch) {
          results.push({
            documentId: doc.id,
            chunkId: chunk.id,
            text: chunk.text,
            score,
            metadata: doc.metadata,
          });
        }
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return deepFreeze(results);
  }
}
