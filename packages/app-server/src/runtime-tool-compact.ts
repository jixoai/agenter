type JsonObject = Record<string, unknown>;
type PrimitiveLiteral = string | number | boolean | null;

type CompactNode =
  | { kind: "string" | "number" | "integer" | "boolean" | "passthrough" }
  | { kind: "const"; value: PrimitiveLiteral }
  | { kind: "enum"; values: readonly PrimitiveLiteral[] }
  | { kind: "array"; item: CompactNode }
  | { kind: "record"; value: CompactNode }
  | { kind: "object"; fields: readonly CompactField[] }
  | { kind: "union"; discriminator: string; variants: readonly CompactVariant[] };

interface CompactField {
  name: string;
  optional: boolean;
  node: CompactNode;
}

interface CompactVariant {
  literal: PrimitiveLiteral;
  fields: readonly CompactField[];
}

export type RuntimeToolCompactAvailability = "Suggested" | "Available";

export interface RuntimeToolCompactSurface {
  root: CompactNode;
  availability: RuntimeToolCompactAvailability;
  topLevelFieldCount: number;
}

const isPlainObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPrimitiveLiteral = (value: unknown): value is PrimitiveLiteral =>
  value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const isInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

const getObject = (value: unknown, key: string): JsonObject | null => {
  if (!isPlainObject(value)) {
    return null;
  }
  const candidate = value[key];
  return isPlainObject(candidate) ? candidate : null;
};

const getArray = (value: unknown, key: string): unknown[] | null => {
  if (!isPlainObject(value)) {
    return null;
  }
  const candidate = value[key];
  return Array.isArray(candidate) ? candidate : null;
};

const getString = (value: unknown, key: string): string | null => {
  if (!isPlainObject(value)) {
    return null;
  }
  const candidate = value[key];
  return typeof candidate === "string" ? candidate : null;
};

const getStringArray = (value: unknown, key: string): string[] => {
  const candidate = getArray(value, key);
  if (!candidate) {
    return [];
  }
  return candidate.filter((item): item is string => typeof item === "string");
};

const getConstLiteral = (value: unknown): PrimitiveLiteral | null => {
  if (!isPlainObject(value) || !("const" in value)) {
    return null;
  }
  return isPrimitiveLiteral(value.const) ? value.const : null;
};

const buildCompactNode = (schema: unknown): CompactNode => {
  if (!isPlainObject(schema) || Object.keys(schema).length === 0) {
    return { kind: "passthrough" };
  }

  const oneOf = getArray(schema, "oneOf");
  if (oneOf) {
    return buildUnionNode(oneOf);
  }

  const enumValues = getArray(schema, "enum");
  if (enumValues && enumValues.every(isPrimitiveLiteral)) {
    return { kind: "enum", values: enumValues };
  }

  const constLiteral = getConstLiteral(schema);
  if (constLiteral !== null) {
    return { kind: "const", value: constLiteral };
  }

  const type = getString(schema, "type");
  if (type === "object" || getObject(schema, "properties") || "additionalProperties" in schema) {
    return buildObjectLikeNode(schema);
  }
  if (type === "array" || "items" in schema) {
    return {
      kind: "array",
      item: buildCompactNode(isPlainObject(schema.items) ? schema.items : {}),
    };
  }
  if (type === "string" || type === "number" || type === "integer" || type === "boolean") {
    return { kind: type };
  }
  return { kind: "passthrough" };
};

const buildObjectLikeNode = (schema: JsonObject): CompactNode => {
  const properties = getObject(schema, "properties");
  if (properties) {
    const required = new Set(getStringArray(schema, "required"));
    const fields = Object.entries(properties).map(
      ([name, propertySchema]): CompactField => ({
        name,
        optional: !required.has(name),
        node: buildCompactNode(propertySchema),
      }),
    );
    return { kind: "object", fields };
  }

  if ("additionalProperties" in schema && schema.additionalProperties !== false) {
    return {
      kind: "record",
      value: buildCompactNode(isPlainObject(schema.additionalProperties) ? schema.additionalProperties : {}),
    };
  }

  return { kind: "object", fields: [] };
};

const buildUnionNode = (variants: readonly unknown[]): CompactNode => {
  const variantObjects = variants.map((variant) => {
    if (!isPlainObject(variant)) {
      throw new Error("runtime compact mode only supports object variants inside oneOf unions");
    }
    const properties = getObject(variant, "properties");
    if (!properties) {
      throw new Error("runtime compact mode only supports oneOf variants with object properties");
    }
    const orderedConstFields = Object.entries(properties).flatMap(([name, propertySchema]) =>
      getConstLiteral(propertySchema) !== null ? [name] : [],
    );
    return {
      schema: variant,
      properties,
      orderedConstFields,
    };
  });

  const discriminator = variantObjects[0]?.orderedConstFields.find((name) =>
    variantObjects.every((variant) => getConstLiteral(variant.properties[name]) !== null),
  );
  if (!discriminator) {
    throw new Error("runtime compact mode requires a discriminated oneOf union");
  }

  const compactVariants = variantObjects.map(({ schema, properties }) => {
    const literal = getConstLiteral(properties[discriminator]);
    if (literal === null) {
      throw new Error(`runtime compact mode could not resolve discriminator literal for ${discriminator}`);
    }
    const required = new Set(getStringArray(schema, "required"));
    return {
      literal,
      fields: Object.entries(properties)
        .filter(([name]) => name !== discriminator)
        .map(
          ([name, propertySchema]): CompactField => ({
            name,
            optional: !required.has(name),
            node: buildCompactNode(propertySchema),
          }),
        ),
    } satisfies CompactVariant;
  });

  return {
    kind: "union",
    discriminator,
    variants: compactVariants,
  };
};

const encodeFieldArray = (fields: readonly CompactField[], input: JsonObject, path: string): unknown[] => {
  const encoded: Array<unknown | undefined> = [];
  for (const field of fields) {
    const value = input[field.name];
    if (value === undefined) {
      if (field.optional) {
        encoded.push(undefined);
        continue;
      }
      throw new Error(`${path}.${field.name} is required for compact encoding`);
    }
    encoded.push(encodeCompactNode(field.node, value, `${path}.${field.name}`));
  }
  let lastDefinedIndex = -1;
  for (let index = encoded.length - 1; index >= 0; index -= 1) {
    if (encoded[index] !== undefined) {
      lastDefinedIndex = index;
      break;
    }
  }
  if (lastDefinedIndex < 0) {
    return [];
  }
  return encoded.slice(0, lastDefinedIndex + 1).map((value) => (value === undefined ? null : value));
};

const decodeFieldArray = (fields: readonly CompactField[], input: readonly unknown[], path: string): JsonObject => {
  if (input.length > fields.length) {
    throw new Error(`${path} received too many compact positions`);
  }
  const output: JsonObject = {};
  for (const [index, field] of fields.entries()) {
    if (index >= input.length) {
      continue;
    }
    const value = input[index];
    if (value === null && field.optional) {
      continue;
    }
    output[field.name] = value === null ? null : decodeCompactNode(field.node, value, `${path}.${field.name}`);
  }
  return output;
};

const encodeCompactNode = (node: CompactNode, input: unknown, path: string): unknown => {
  switch (node.kind) {
    case "string":
    case "number":
    case "integer":
    case "boolean":
    case "passthrough":
      return input;
    case "const":
      if (input !== node.value) {
        throw new Error(`${path} must equal ${JSON.stringify(node.value)} for compact encoding`);
      }
      return input;
    case "enum": {
      const index = node.values.findIndex((value) => Object.is(value, input));
      if (index < 0) {
        throw new Error(`${path} must match one of the declared enum values for compact encoding`);
      }
      return index;
    }
    case "array":
      if (!Array.isArray(input)) {
        throw new Error(`${path} must be an array for compact encoding`);
      }
      return input.map((item, index) => encodeCompactNode(node.item, item, `${path}[${index}]`));
    case "record":
      if (!isPlainObject(input)) {
        throw new Error(`${path} must be an object for compact encoding`);
      }
      return Object.entries(input).map(([key, value]) => [key, encodeCompactNode(node.value, value, `${path}.${key}`)]);
    case "object":
      if (!isPlainObject(input)) {
        throw new Error(`${path} must be an object for compact encoding`);
      }
      return encodeFieldArray(node.fields, input, path);
    case "union": {
      if (!isPlainObject(input)) {
        throw new Error(`${path} must be an object for compact encoding`);
      }
      const literal = input[node.discriminator];
      const variant = node.variants.find((item) => Object.is(item.literal, literal));
      if (!variant) {
        throw new Error(`${path}.${node.discriminator} must match a known union discriminator`);
      }
      return [literal, ...encodeFieldArray(variant.fields, input, path)];
    }
  }
};

const decodeCompactNode = (node: CompactNode, input: unknown, path: string): unknown => {
  switch (node.kind) {
    case "string":
    case "number":
    case "integer":
    case "boolean":
    case "passthrough":
      return input;
    case "const":
      if (!Object.is(input, node.value)) {
        throw new Error(`${path} must equal ${JSON.stringify(node.value)} in compact mode`);
      }
      return input;
    case "enum":
      if (!isInteger(input)) {
        throw new Error(`${path} must be a zero-based enum ordinal in compact mode`);
      }
      if (input < 0 || input >= node.values.length) {
        throw new Error(`${path} enum ordinal is out of range in compact mode`);
      }
      return node.values[input];
    case "array":
      if (!Array.isArray(input)) {
        throw new Error(`${path} must be an array in compact mode`);
      }
      return input.map((item, index) => decodeCompactNode(node.item, item, `${path}[${index}]`));
    case "record":
      if (!Array.isArray(input)) {
        throw new Error(`${path} must be a [[key, value], ...] array in compact mode`);
      }
      return Object.fromEntries(
        input.map((entry, index) => {
          if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string") {
            throw new Error(`${path}[${index}] must be a [key, value] pair in compact mode`);
          }
          return [entry[0], decodeCompactNode(node.value, entry[1], `${path}.${entry[0]}`)];
        }),
      );
    case "object":
      if (!Array.isArray(input)) {
        throw new Error(`${path} must be a positional array in compact mode`);
      }
      return decodeFieldArray(node.fields, input, path);
    case "union": {
      if (!Array.isArray(input)) {
        throw new Error(`${path} must be a positional union array in compact mode`);
      }
      const literal = input[0];
      const variant = node.variants.find((item) => Object.is(item.literal, literal));
      if (!variant) {
        throw new Error(`${path}[0] must match a known union discriminator literal in compact mode`);
      }
      return {
        [node.discriminator]: literal,
        ...decodeFieldArray(variant.fields, input.slice(1), path),
      };
    }
  }
};

const describeFieldToken = (field: CompactField): string =>
  field.node.kind === "const" ? JSON.stringify(field.node.value) : `${field.name}${field.optional ? "?" : ""}`;

const renderVariantShape = (variant: CompactVariant): string => {
  const tokens = [JSON.stringify(variant.literal), ...variant.fields.map((field) => describeFieldToken(field))];
  return `[${tokens.join(", ")}]`;
};

const renderNodeShape = (node: CompactNode): string => {
  switch (node.kind) {
    case "string":
    case "number":
    case "integer":
    case "boolean":
      return node.kind;
    case "passthrough":
      return "value";
    case "const":
      return JSON.stringify(node.value);
    case "enum":
      return node.values.map((value, index) => `${index}=${JSON.stringify(value)}`).join(", ");
    case "array":
      return `[${renderNodeShape(node.item)}, ...]`;
    case "record":
      return `[[key, ${renderNodeShape(node.value)}], ...]`;
    case "object":
      return `[${node.fields.map((field) => describeFieldToken(field)).join(", ")}]`;
    case "union":
      return node.variants.map((variant) => renderVariantShape(variant)).join(" | ");
  }
};

const renderNestedObjectGuide = (label: string, node: CompactNode, indent: string): string[] => {
  if (node.kind !== "object") {
    return [];
  }
  return node.fields.flatMap((field, index) => {
    const line = `${indent}- ${label}[${index}] ${field.name}${field.optional ? "?" : ""}: ${renderNodeShape(field.node)}`;
    return [line, ...renderNestedObjectGuide(`${label}[${index}]`, field.node, `${indent}  `)];
  });
};

export const buildRuntimeToolCompactSurface = (schema: unknown): RuntimeToolCompactSurface => {
  const root = buildCompactNode(schema);
  const topLevelFieldCount = root.kind === "object" ? root.fields.length : 1;
  return {
    root,
    topLevelFieldCount,
    availability: topLevelFieldCount > 0 && topLevelFieldCount <= 4 ? "Suggested" : "Available",
  };
};

export const encodeRuntimeToolCompactPayload = (surface: RuntimeToolCompactSurface, input: unknown): unknown =>
  encodeCompactNode(surface.root, input, "payload");

export const decodeRuntimeToolCompactPayload = (surface: RuntimeToolCompactSurface, input: unknown): unknown =>
  decodeCompactNode(surface.root, input, "payload");

export const pickRuntimeToolCompactExamplePayload = (
  surface: RuntimeToolCompactSurface,
  payloads: readonly unknown[],
): unknown | null => {
  const encodedPayloads = payloads.flatMap((payload) => {
    try {
      return [encodeRuntimeToolCompactPayload(surface, payload)];
    } catch {
      return [];
    }
  });
  if (encodedPayloads.length === 0) {
    return null;
  }
  return encodedPayloads.sort((left, right) => JSON.stringify(left).length - JSON.stringify(right).length)[0] ?? null;
};

export const renderRuntimeToolCompactFieldGuide = (surface: RuntimeToolCompactSurface): string[] => {
  if (surface.root.kind !== "object") {
    return [`- [0] payload: ${renderNodeShape(surface.root)}`];
  }
  return surface.root.fields.flatMap((field, index) => {
    const line = `- [${index}] ${field.name}${field.optional ? "?" : ""}: ${renderNodeShape(field.node)}`;
    return [line, ...renderNestedObjectGuide(field.name, field.node, "  ")];
  });
};
