import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const toStamp = (): string => new Date().toISOString().replaceAll(":", "-");

export class ArtifactStore {
  private readonly artifactsDir: string;

  constructor(baseDir: string) {
    this.artifactsDir = join(baseDir, "artifacts");
    mkdirSync(this.artifactsDir, { recursive: true });
  }

  save(kind: string, payload: unknown): string {
    const filePath = join(this.artifactsDir, `${kind}-${toStamp()}.json`);
    writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    return filePath;
  }

  saveText(kind: string, content: string, extension = "txt"): string {
    const filePath = join(this.artifactsDir, `${kind}-${toStamp()}.${extension}`);
    writeFileSync(filePath, content, "utf8");
    return filePath;
  }
}
