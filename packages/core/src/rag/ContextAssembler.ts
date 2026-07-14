import { RetrievedDocument } from "./RetrievedDocument";

export class ContextAssembler {
  public assemble(
    documents: readonly RetrievedDocument[],
    maxChunks?: number,
    maxCharacters?: number
  ): string {
    let selected = [...documents];
    if (maxChunks !== undefined && maxChunks >= 0) {
      selected = selected.slice(0, maxChunks);
    }

    let contextText = selected.map((d) => d.text).join("\n\n");

    if (
      maxCharacters !== undefined &&
      maxCharacters >= 0 &&
      contextText.length > maxCharacters
    ) {
      contextText = contextText.slice(0, maxCharacters);
    }

    return contextText;
  }
}
