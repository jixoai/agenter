const normalizeText = (value: string): string => value.replace(/\s+/gu, " ").trim();

const matchesExpected = (value: string, expected: string | RegExp): boolean => {
	if (expected instanceof RegExp) {
		expected.lastIndex = 0;
		return expected.test(value);
	}
	return value.includes(expected);
};

const collectDeepText = (node: ParentNode): string[] => {
	const texts: string[] = [];
	const normalized = normalizeText(node.textContent ?? "");
	if (normalized.length > 0) {
		texts.push(normalized);
	}
	const descendants = "children" in node ? Array.from(node.children) : [];
	for (const child of descendants) {
		if (child.shadowRoot) {
			texts.push(...collectDeepText(child.shadowRoot));
		}
		texts.push(...collectDeepText(child));
	}
	return texts;
};

export const containsVisibleTextDeep = (root: ParentNode, expected: string | RegExp): boolean => {
	return collectDeepText(root).some((value) => matchesExpected(value, expected));
};
