interface CommitPayload {
  plainText: string;
  commit: () => Promise<void> | void;
}

interface CommitterOptions {
  debounceMs: number;
  throttleMs: number;
}

export class Committer {
  private pending: CommitPayload | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastCommittedPlain = "";

  constructor(private readonly options: CommitterOptions) {}

  schedule(payload: CommitPayload): void {
    this.pending = payload;
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      void this.flush();
    }, this.options.debounceMs);

    if (this.throttleTimer === null) {
      this.throttleTimer = setTimeout(() => {
        void this.flush();
      }, this.options.throttleMs);
    }
  }

  async flush(force = false): Promise<void> {
    if (this.pending === null) {
      this.clearTimers();
      return;
    }

    const payload = this.pending;
    this.pending = null;
    this.clearTimers();

    if (!force && payload.plainText === this.lastCommittedPlain) {
      return;
    }

    await payload.commit();
    this.lastCommittedPlain = payload.plainText;
  }

  async forceCommit(): Promise<void> {
    await this.flush(true);
  }

  stop(): void {
    this.pending = null;
    this.clearTimers();
  }

  private clearTimers(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.throttleTimer !== null) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
  }
}
