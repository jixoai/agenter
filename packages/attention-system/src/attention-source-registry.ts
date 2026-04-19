export interface AttentionSourceNamespaceRegistration<TRef = unknown> {
  namespace: string;
  parse: (src: string) => TRef | null;
  format: (ref: TRef) => string;
  key?: (ref: TRef) => string;
  bucket?: (ref: TRef) => string | null;
  sourceId?: (ref: TRef) => string | null;
  compare?: (left: TRef, right: TRef) => number;
}

export interface AttentionSourceResolution<TRef = unknown> {
  namespace: string;
  src: string;
  ref: TRef;
  registration: AttentionSourceNamespaceRegistration<TRef>;
}

const NAMESPACE_PATTERN = /^[a-z][a-z0-9_-]*$/u;

export const parseAttentionSourceNamespace = (src: string): string | null => {
  const separatorIndex = src.indexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }
  const namespace = src.slice(0, separatorIndex);
  return NAMESPACE_PATTERN.test(namespace) ? namespace : null;
};

const normalizeNamespace = (namespace: string): string => {
  const normalized = namespace.trim();
  if (!NAMESPACE_PATTERN.test(normalized)) {
    throw new Error(`invalid attention source namespace: ${namespace}`);
  }
  return normalized;
};

export class AttentionSourceRegistry {
  private readonly registrations = new Map<string, AttentionSourceNamespaceRegistration<unknown>>();

  register<TRef>(registration: AttentionSourceNamespaceRegistration<TRef>): void {
    const namespace = normalizeNamespace(registration.namespace);
    if (this.registrations.has(namespace)) {
      throw new Error(`attention source namespace already registered: ${namespace}`);
    }
    this.registrations.set(namespace, registration as AttentionSourceNamespaceRegistration<unknown>);
  }

  get(namespace: string): AttentionSourceNamespaceRegistration<unknown> | undefined {
    return this.registrations.get(normalizeNamespace(namespace));
  }

  listNamespaces(): string[] {
    return [...this.registrations.keys()].sort((left, right) => left.localeCompare(right));
  }

  resolve(src: string): AttentionSourceResolution<unknown> | null {
    const namespace = parseAttentionSourceNamespace(src);
    if (!namespace) {
      return null;
    }
    const registration = this.registrations.get(namespace);
    if (!registration) {
      return null;
    }
    const ref = registration.parse(src);
    if (ref === null) {
      return null;
    }
    return {
      namespace,
      src,
      ref,
      registration,
    };
  }

  format<TRef>(namespace: string, ref: TRef): string {
    const registration = this.get(namespace);
    if (!registration) {
      throw new Error(`attention source namespace not registered: ${namespace}`);
    }
    return (registration as AttentionSourceNamespaceRegistration<TRef>).format(ref);
  }

  key(src: string): string {
    const resolved = this.resolve(src);
    if (!resolved) {
      return src;
    }
    return resolved.registration.key?.(resolved.ref) ?? resolved.src;
  }

  bucket(src: string): string | null {
    const resolved = this.resolve(src);
    if (!resolved) {
      return null;
    }
    return resolved.registration.bucket?.(resolved.ref) ?? null;
  }

  sourceId(src: string): string | null {
    const resolved = this.resolve(src);
    if (!resolved) {
      return null;
    }
    return resolved.registration.sourceId?.(resolved.ref) ?? null;
  }

  compare(leftSrc: string, rightSrc: string): number | null {
    const left = this.resolve(leftSrc);
    const right = this.resolve(rightSrc);
    if (!left || !right || left.namespace !== right.namespace) {
      return null;
    }
    if (!left.registration.compare) {
      return null;
    }
    return left.registration.compare(left.ref, right.ref);
  }
}
