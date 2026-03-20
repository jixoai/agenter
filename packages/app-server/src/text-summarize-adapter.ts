import { chat, type AnyTextAdapter, type StreamChunk, type SummarizationOptions, type SummarizationResult } from "@tanstack/ai";
import { BaseSummarizeAdapter } from "@tanstack/ai/adapters";

export class TextBackedSummarizeAdapter extends BaseSummarizeAdapter<string, Record<string, never>> {
  readonly name: string;

  constructor(
    private readonly textAdapter: AnyTextAdapter,
    model: string,
    name = "text-backed",
  ) {
    super({}, model);
    this.name = name;
  }

  async summarize(options: SummarizationOptions): Promise<SummarizationResult> {
    let summary = "";
    let model = options.model;
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    for await (const chunk of this.summarizeStream(options)) {
      if (chunk.type === "TEXT_MESSAGE_CONTENT") {
        summary = chunk.content || `${summary}${chunk.delta}`;
        model = chunk.model || model;
      }
      if (chunk.type === "RUN_FINISHED" && chunk.usage) {
        usage = chunk.usage;
      }
    }

    return {
      id: "",
      model,
      summary,
      usage,
    };
  }

  async *summarizeStream(options: SummarizationOptions): AsyncIterable<StreamChunk> {
    yield* chat({
      adapter: this.textAdapter,
      messages: [{ role: "user", content: options.text }],
      systemPrompts: [this.buildPrompt(options)],
      maxTokens: options.maxLength,
      temperature: 0.3,
      stream: true,
    });
  }

  private buildPrompt(options: SummarizationOptions): string {
    let prompt = "You are a professional summarizer. ";
    switch (options.style) {
      case "bullet-points":
        prompt += "Provide a summary in bullet point format. ";
        break;
      case "paragraph":
        prompt += "Provide a summary in paragraph format. ";
        break;
      case "concise":
        prompt += "Provide a very concise summary in 1-2 sentences. ";
        break;
      default:
        prompt += "Provide a clear and concise summary. ";
    }
    if (options.focus && options.focus.length > 0) {
      prompt += `Focus on the following aspects: ${options.focus.join(", ")}. `;
    }
    if (options.maxLength) {
      prompt += `Keep the summary under ${options.maxLength} tokens. `;
    }
    return prompt;
  }
}
