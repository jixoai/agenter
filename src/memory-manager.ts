import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { isObjectiveFact, ObjectiveFact } from "./types";
import { ensureDir, safeJsonParse, splitKeywords, normalizeText } from "./utils";
import { VectorIndex } from "./vector-index";

interface SearchTrace {
  facts: ObjectiveFact[];
  tool_calls: string[];
}

export class MemoryManager {
  private readonly storageDir: string;
  private readonly filePath: string;
  private vectorIndex: VectorIndex | null = null;
  private vectorIndexPromise: Promise<VectorIndex | null> | null = null;

  constructor(storageDir?: string) {
    const baseDir = storageDir ?? path.join(os.homedir(), ".agenter-demo");
    this.storageDir = baseDir;
    this.filePath = path.join(baseDir, "mid_term.jsonl");
  }

  get path(): string {
    return this.filePath;
  }

  async appendFact(fact: ObjectiveFact): Promise<void> {
    await this.ensureStorage();
    const line = `${JSON.stringify(fact)}\n`;
    await fs.appendFile(this.filePath, line, "utf-8");

    const index = await this.getVectorIndex();
    if (index) {
      try {
        await index.upsertFact(fact);
      } catch {
        // Ignore vector indexing failures
      }
    }
  }

  async readAllFacts(): Promise<ObjectiveFact[]> {
    await this.ensureStorage();
    const content = await fs.readFile(this.filePath, "utf-8");
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const facts: ObjectiveFact[] = [];
    for (const line of lines) {
      const parsed = safeJsonParse(line);
      if (isObjectiveFact(parsed)) {
        facts.push(parsed);
      }
    }
    return facts;
  }

  async getRecentFacts(limit: number): Promise<ObjectiveFact[]> {
    const facts = await this.readAllFacts();
    return facts.slice(Math.max(0, facts.length - limit));
  }

  async getFactsSince(timestamp: number): Promise<ObjectiveFact[]> {
    const facts = await this.readAllFacts();
    return facts.filter((fact) => fact.timestamp >= timestamp);
  }

  async searchFacts(query: string, limit: number): Promise<ObjectiveFact[]> {
    const result = await this.searchFactsWithTrace(query, limit);
    return result.facts;
  }

  async searchFactsWithTrace(query: string, limit: number): Promise<SearchTrace> {
    const toolCalls: string[] = [];
    const allFacts = await this.readAllFacts();
    const mapById = new Map(allFacts.map((fact) => [fact.id, fact] as const));

    const index = await this.getVectorIndex();
    let vectorFacts: ObjectiveFact[] = [];
    if (index) {
      const ids = await index.querySimilar(query, limit);
      vectorFacts = ids.map((id) => mapById.get(id)).filter((fact): fact is ObjectiveFact => Boolean(fact));
      toolCalls.push(`VectorIndex.query(text="${query}", limit=${limit}) -> ${vectorFacts.length} facts`);
    }

    const remaining = Math.max(0, limit - vectorFacts.length);
    let keywordFacts: ObjectiveFact[] = [];
    if (remaining > 0) {
      keywordFacts = this.keywordSearch(allFacts, query, remaining);
      toolCalls.push(
        `MemoryManager.keywordSearch(query="${query}", limit=${remaining}) -> ${keywordFacts.length} facts`
      );
    }

    const merged = new Map<string, ObjectiveFact>();
    for (const fact of [...vectorFacts, ...keywordFacts]) {
      merged.set(fact.id, fact);
    }

    return {
      facts: Array.from(merged.values()),
      tool_calls: toolCalls,
    };
  }

  async hasUserMessage(content: string): Promise<boolean> {
    const facts = await this.readAllFacts();
    return facts.some((fact) => fact.type === "USER_MSG" && fact.content === content);
  }

  async reset(): Promise<void> {
    await ensureDir(this.storageDir);
    await fs.writeFile(this.filePath, "", "utf-8");
    const index = await this.getVectorIndex();
    if (index) {
      try {
        await index.reset();
      } catch {
        // Ignore reset failures
      }
    }
  }

  private keywordSearch(facts: ObjectiveFact[], query: string, limit: number): ObjectiveFact[] {
    const keywords = splitKeywords(query);
    if (keywords.length === 0) {
      return [];
    }
    return facts
      .map((fact) => {
        const text = normalizeText(fact.content);
        const score = keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0);
        return { fact, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.fact);
  }

  private async ensureStorage(): Promise<void> {
    await ensureDir(this.storageDir);
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, "", "utf-8");
    }
  }

  private async getVectorIndex(): Promise<VectorIndex | null> {
    if (this.vectorIndex) return this.vectorIndex;
    if (!this.vectorIndexPromise) {
      this.vectorIndexPromise = VectorIndex.fromEnv();
    }
    this.vectorIndex = await this.vectorIndexPromise;
    return this.vectorIndex;
  }
}
