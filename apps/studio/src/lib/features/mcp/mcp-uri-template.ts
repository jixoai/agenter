type ResourceTemplateExpression = {
  operator: "" | "+" | "#" | "." | "/" | ";" | "?" | "&";
  names: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readStringField = (value: unknown, key: string): string | null => {
  if (!isRecord(value)) {
    return null;
  }
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : null;
};

const parseResourceTemplateExpression = (expression: string): ResourceTemplateExpression => {
  const operator = (
    ["+", "#", ".", "/", ";", "?", "&"].includes(expression[0] ?? "") ? expression[0] : ""
  ) as ResourceTemplateExpression["operator"];
  const body = operator ? expression.slice(1) : expression;
  const names = body
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => part.replace(/\*$/u, "").split(":", 1)[0] ?? "")
    .filter((part) => part.length > 0);
  return {
    operator,
    names,
  };
};

const parseResourceTemplate = (template: string): Array<string | ResourceTemplateExpression> => {
  const parts: Array<string | ResourceTemplateExpression> = [];
  let cursor = 0;
  const pattern = /\{([^{}]+)\}/gu;
  for (const match of template.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      parts.push(template.slice(cursor, index));
    }
    parts.push(parseResourceTemplateExpression(match[1] ?? ""));
    cursor = index + match[0].length;
  }
  if (cursor < template.length) {
    parts.push(template.slice(cursor));
  }
  return parts;
};

const encodeTemplateValue = (value: string, operator: ResourceTemplateExpression["operator"]): string => {
  if (operator === "+" || operator === "#") {
    return encodeURI(value);
  }
  return encodeURIComponent(value);
};

const resolveTemplateValue = (
  operator: ResourceTemplateExpression["operator"],
  name: string,
  value: string,
): string => {
  if (operator === "/") {
    const segments = value
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .filter((segment) => segment.length > 0);
    return segments.length > 0 ? `/${segments.join("/")}` : "";
  }
  if (operator === ";") {
    return `;${name}=${encodeTemplateValue(value, operator)}`;
  }
  if (operator === "?") {
    return `?${name}=${encodeTemplateValue(value, operator)}`;
  }
  if (operator === "&") {
    return `&${name}=${encodeTemplateValue(value, operator)}`;
  }
  if (operator === ".") {
    return `.${encodeTemplateValue(value, operator)}`;
  }
  return encodeTemplateValue(value, operator);
};

export const readResourceTemplateUriTemplate = (value: unknown): string | null => readStringField(value, "uriTemplate");

export const readResourceTemplateFieldNames = (value: unknown): string[] => {
  const template = readResourceTemplateUriTemplate(value);
  if (!template) {
    return [];
  }
  const names = new Set<string>();
  for (const part of parseResourceTemplate(template)) {
    if (typeof part === "string") {
      continue;
    }
    for (const name of part.names) {
      names.add(name);
    }
  }
  return [...names];
};

export const buildResourceTemplateDraft = (value: unknown): Record<string, string> =>
  Object.fromEntries(readResourceTemplateFieldNames(value).map((name) => [name, ""]));

export const buildResourceTemplateUri = (value: unknown, argumentsInput: Record<string, string>): string | null => {
  const template = readResourceTemplateUriTemplate(value);
  if (!template) {
    return null;
  }
  let resolved = "";
  for (const part of parseResourceTemplate(template)) {
    if (typeof part === "string") {
      resolved += part;
      continue;
    }
    const output = part.names
      .map((name) => {
        const candidate = argumentsInput[name];
        if (typeof candidate !== "string" || candidate.trim().length === 0) {
          return null;
        }
        return resolveTemplateValue(part.operator, name, candidate.trim());
      })
      .filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
    if (output.length === 0) {
      return null;
    }
    if (part.operator === "?" || part.operator === "&") {
      const joined = output
        .map((entry) => (entry.startsWith("?") || entry.startsWith("&") ? entry.slice(1) : entry))
        .join("&");
      resolved += part.operator === "?" ? `?${joined}` : `&${joined}`;
      continue;
    }
    if (part.operator === ";") {
      resolved += output.join("");
      continue;
    }
    if (part.operator === "#") {
      resolved += `#${output.join(",")}`;
      continue;
    }
    resolved += output.join(part.operator === "/" || part.operator === "." ? "" : ",");
  }
  return resolved;
};
