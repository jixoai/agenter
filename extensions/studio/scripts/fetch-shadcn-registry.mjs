import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const outputRoot = join(packageRoot, "src/lib/components/ui");
const componentsConfigPath = join(packageRoot, "components.json");

const usage = () => {
	console.error("usage: node scripts/fetch-shadcn-registry.mjs <component> [component...]");
	process.exit(1);
};

const args = process.argv.slice(2).map((value) => value.trim()).filter(Boolean);
if (args.length === 0) {
	usage();
}

const componentConfig = JSON.parse(await readFile(componentsConfigPath, "utf8"));
const aliasMap = {
	UTILS: componentConfig.aliases?.utils ?? "$lib/utils",
	LIB: componentConfig.aliases?.lib ?? "$lib",
	HOOKS: componentConfig.aliases?.hooks ?? "$lib/hooks",
	COMPONENTS: componentConfig.aliases?.components ?? "$lib/components",
	UI: componentConfig.aliases?.ui ?? "$lib/components/ui",
};

const fetched = new Set();
const queue = [...args];
const devDependencies = new Set();

const replaceAliases = (content) =>
	content.replace(/\$([A-Z_]+)\$/g, (_match, key) => {
		return aliasMap[key] ?? _match;
	});

while (queue.length > 0) {
	const name = queue.shift();
	if (!name || fetched.has(name)) {
		continue;
	}
	fetched.add(name);
	const response = await fetch(`https://shadcn-svelte.com/registry/${name}.json`);
	if (!response.ok) {
		throw new Error(`failed to fetch registry item '${name}' (${response.status})`);
	}
	const item = await response.json();
	for (const dependency of item.registryDependencies ?? []) {
		queue.push(dependency);
	}
	for (const dependency of item.dependencies ?? []) {
		devDependencies.add(dependency);
	}
	for (const dependency of item.devDependencies ?? []) {
		devDependencies.add(dependency);
	}
	for (const file of item.files ?? []) {
		if (typeof file.target !== "string" || typeof file.content !== "string") {
			continue;
		}
		const targetPath = join(outputRoot, file.target);
		await mkdir(dirname(targetPath), { recursive: true });
		await writeFile(targetPath, replaceAliases(file.content), "utf8");
	}
}

const sortedDependencies = [...devDependencies].sort();
console.log(
	JSON.stringify(
		{
			fetched: [...fetched].sort(),
			devDependencies: sortedDependencies,
		},
		null,
		2,
	),
);
