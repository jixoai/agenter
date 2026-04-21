export interface AttentionContextTemplateSlot {
  name: string;
  readonly: boolean;
}

export const DEFAULT_ATTENTION_CONTEXT_TEMPLATE = `<Slot name="default"/>`;

const SLOT_TAG_PATTERN = /<Slot\s+([^>]*?)\/>/gu;
const NAME_ATTRIBUTE_PATTERN = /\bname\s*=\s*["']([^"']+)["']/u;
const READONLY_ATTRIBUTE_PATTERN = /\breadonly\b/u;

export const normalizeAttentionContextTemplate = (template?: string): string => {
  if (typeof template !== "string" || template.trim().length === 0) {
    return DEFAULT_ATTENTION_CONTEXT_TEMPLATE;
  }
  return template;
};

export const listAttentionContextTemplateSlots = (template: string): AttentionContextTemplateSlot[] => {
  const normalized = normalizeAttentionContextTemplate(template);
  const slots: AttentionContextTemplateSlot[] = [];
  for (const match of normalized.matchAll(SLOT_TAG_PATTERN)) {
    const rawAttributes = match[1] ?? "";
    const nameMatch = rawAttributes.match(NAME_ATTRIBUTE_PATTERN);
    const name = nameMatch?.[1]?.trim() ?? "";
    if (name.length === 0) {
      continue;
    }
    slots.push({
      name,
      readonly: READONLY_ATTRIBUTE_PATTERN.test(rawAttributes),
    });
  }
  return slots;
};

export const getAttentionContextTemplateSlot = (
  template: string,
  slotName: string,
): AttentionContextTemplateSlot | null => {
  const normalizedSlotName = slotName.trim();
  if (normalizedSlotName.length === 0) {
    return null;
  }
  const match = listAttentionContextTemplateSlots(template).find((slot) => slot.name === normalizedSlotName);
  return match ? { ...match } : null;
};

export const deriveAttentionContextContent = (template: string, slots: Record<string, string>): string => {
  const normalized = normalizeAttentionContextTemplate(template);
  return normalized.replaceAll(SLOT_TAG_PATTERN, (_rawMatch, rawAttributes: string) => {
    const nameMatch = rawAttributes.match(NAME_ATTRIBUTE_PATTERN);
    const name = nameMatch?.[1]?.trim() ?? "";
    if (name.length === 0) {
      return "";
    }
    return slots[name] ?? "";
  });
};

export const initializeAttentionContextSlots = (input: {
  template?: string;
  slots?: Record<string, string>;
  legacyContent?: string;
}): Record<string, string> => {
  const template = normalizeAttentionContextTemplate(input.template);
  const declaredSlots = listAttentionContextTemplateSlots(template);
  const next: Record<string, string> = {};
  for (const slot of declaredSlots) {
    next[slot.name] = input.slots?.[slot.name] ?? (slot.name === "default" ? input.legacyContent ?? "" : "");
  }
  if (declaredSlots.length === 0 && input.legacyContent) {
    next.default = input.legacyContent;
  }
  return next;
};
