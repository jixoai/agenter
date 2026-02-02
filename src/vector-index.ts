import { ChromaClient, Collection, Metadata } from "chromadb";
import { ObjectiveFact } from "./types";
import { normalizeText } from "./utils";
import { ensureChromaServer } from "./chroma-server";
import { chromaConfig } from "./env.js";

interface VectorIndexConfig {
  url: string;
  collectionName: string;
  embeddingDim: number;
}

const parseChromaUrl = (raw: string): { host: string; port: number; ssl: boolean } => {
  const url = new URL(raw);
  const ssl = url.protocol === "https:";
  const port = url.port ? Number(url.port) : ssl ? 443 : 80;
  return { host: url.hostname, port, ssl };
};

const stableHash = (text: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const embedText = (text: string, dim: number): number[] => {
  const vector = new Array<number>(dim).fill(0);
  const normalized = normalizeText(text);
  if (!normalized) return vector;
  for (const token of normalized.split(" ")) {
    if (!token) continue;
    const hash = stableHash(token);
    const index = hash % dim;
    vector[index] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm > 0) {
    for (let i = 0; i < vector.length; i += 1) {
      vector[i] = vector[i] / norm;
    }
  }
  return vector;
};

export class VectorIndex {
  private readonly client: ChromaClient;
  private readonly collectionName: string;
  private readonly embeddingDim: number;
  private collection: Collection | null = null;

  private constructor(client: ChromaClient, collectionName: string, embeddingDim: number) {
    this.client = client;
    this.collectionName = collectionName;
    this.embeddingDim = embeddingDim;
  }

  static async fromEnv(): Promise<VectorIndex | null> {
    const url = chromaConfig.url ?? (await ensureChromaServer()) ?? "";
    if (!url) return null;
    const collectionName = chromaConfig.collection;
    const embeddingDim = chromaConfig.embeddingDim;
    const config = parseChromaUrl(url);
    const client = new ChromaClient({ host: config.host, port: config.port, ssl: config.ssl });

    const index = new VectorIndex(client, collectionName, Number.isNaN(embeddingDim) ? 48 : embeddingDim);
    try {
      await client.heartbeat();
    } catch {
      return null;
    }

    try {
      index.collection = await client.getOrCreateCollection({
        name: collectionName,
        embeddingFunction: null,
      });
    } catch {
      return null;
    }

    return index;
  }

  async upsertFact(fact: ObjectiveFact): Promise<void> {
    if (!this.collection) return;
    const metadata: Metadata = {
      type: fact.type,
      timestamp: fact.timestamp,
    };
    const embeddings = [embedText(fact.content, this.embeddingDim)];
    await this.collection.upsert({
      ids: [fact.id],
      embeddings,
      documents: [fact.content],
      metadatas: [metadata],
    });
  }

  async querySimilar(text: string, limit: number): Promise<string[]> {
    if (!this.collection) return [];
    const embeddings = [embedText(text, this.embeddingDim)];
    const result = await this.collection.query({
      queryEmbeddings: embeddings,
      nResults: limit,
      include: ["metadatas", "documents", "distances"],
    });
    const ids = result.ids?.[0];
    if (!ids || !Array.isArray(ids)) return [];
    return ids.filter((id) => typeof id === "string");
  }

  async reset(): Promise<void> {
    await this.client.deleteCollection({ name: this.collectionName });
    this.collection = await this.client.getOrCreateCollection({
      name: this.collectionName,
      embeddingFunction: null,
    });
  }
}
