import { join, resolve } from 'node:path';

import { copyFile, ensureDir, removeFile, repoRoot, resetDir, resizePng, run, writeIco, writeJson } from './icon-build';

type IosIconSpec = {
	filename: string;
	idiom: 'iphone' | 'ipad' | 'ios-marketing';
	pixels: number;
	scale: `${number}x`;
	size: string;
};

const sourceDir = resolve(repoRoot, 'assets/source/master');
const outputs = {
	favicon: resolve(repoRoot, 'assets/favicon'),
	web: resolve(repoRoot, 'assets/app/web'),
	pwa: resolve(repoRoot, 'assets/app/pwa'),
	ios: resolve(repoRoot, 'assets/app/apple/ios/AppIcon.appiconset'),
	macos: resolve(repoRoot, 'assets/app/apple/macos'),
	android: resolve(repoRoot, 'assets/app/android'),
	studioStatic: resolve(repoRoot, 'packages/studio/static'),
	studioIcons: resolve(repoRoot, 'packages/studio/static/icons'),
};
const sourceFiles = {
	core: resolve(sourceDir, 'icon-core.png'),
	coreCompact: resolve(sourceDir, 'icon-core-compact.png'),
	favicon: resolve(sourceDir, 'favicon-source.png'),
	tile: resolve(sourceDir, 'icon-tile.png'),
	maskable: resolve(sourceDir, 'icon-maskable.png'),
	androidBackground: resolve(sourceDir, 'android-adaptive-background.png'),
	androidForeground: resolve(sourceDir, 'android-adaptive-foreground.png'),
};
const themedSourceFiles = {
	dark: {
		favicon: resolve(sourceDir, 'dark', 'favicon-source.png'),
		tile: resolve(sourceDir, 'dark', 'icon-tile.png'),
	},
	light: {
		favicon: resolve(sourceDir, 'light', 'favicon-source.png'),
		tile: resolve(sourceDir, 'light', 'icon-tile.png'),
	},
} as const;

const faviconSizes = [16, 32, 48] as const;
const webIcons = [
	{ filename: 'favicon-16.png', size: 16, source: sourceFiles.favicon },
	{ filename: 'favicon-32.png', size: 32, source: sourceFiles.favicon },
	{ filename: 'apple-touch-icon.png', size: 180, source: sourceFiles.tile },
	{ filename: 'icon-192.png', size: 192, source: sourceFiles.tile },
	{ filename: 'icon-512.png', size: 512, source: sourceFiles.tile },
	{ filename: 'icon-maskable-192.png', size: 192, source: sourceFiles.maskable },
	{ filename: 'icon-maskable-512.png', size: 512, source: sourceFiles.maskable },
] as const;
const iosIcons: readonly IosIconSpec[] = [
	{ filename: 'iphone-notification-20@2x.png', idiom: 'iphone', pixels: 40, scale: '2x', size: '20x20' },
	{ filename: 'iphone-notification-20@3x.png', idiom: 'iphone', pixels: 60, scale: '3x', size: '20x20' },
	{ filename: 'iphone-settings-29@2x.png', idiom: 'iphone', pixels: 58, scale: '2x', size: '29x29' },
	{ filename: 'iphone-settings-29@3x.png', idiom: 'iphone', pixels: 87, scale: '3x', size: '29x29' },
	{ filename: 'iphone-spotlight-40@2x.png', idiom: 'iphone', pixels: 80, scale: '2x', size: '40x40' },
	{ filename: 'iphone-spotlight-40@3x.png', idiom: 'iphone', pixels: 120, scale: '3x', size: '40x40' },
	{ filename: 'iphone-app-60@2x.png', idiom: 'iphone', pixels: 120, scale: '2x', size: '60x60' },
	{ filename: 'iphone-app-60@3x.png', idiom: 'iphone', pixels: 180, scale: '3x', size: '60x60' },
	{ filename: 'ipad-notification-20@1x.png', idiom: 'ipad', pixels: 20, scale: '1x', size: '20x20' },
	{ filename: 'ipad-notification-20@2x.png', idiom: 'ipad', pixels: 40, scale: '2x', size: '20x20' },
	{ filename: 'ipad-settings-29@1x.png', idiom: 'ipad', pixels: 29, scale: '1x', size: '29x29' },
	{ filename: 'ipad-settings-29@2x.png', idiom: 'ipad', pixels: 58, scale: '2x', size: '29x29' },
	{ filename: 'ipad-spotlight-40@1x.png', idiom: 'ipad', pixels: 40, scale: '1x', size: '40x40' },
	{ filename: 'ipad-spotlight-40@2x.png', idiom: 'ipad', pixels: 80, scale: '2x', size: '40x40' },
	{ filename: 'ipad-app-76@1x.png', idiom: 'ipad', pixels: 76, scale: '1x', size: '76x76' },
	{ filename: 'ipad-app-76@2x.png', idiom: 'ipad', pixels: 152, scale: '2x', size: '76x76' },
	{ filename: 'ipad-pro-app-83.5@2x.png', idiom: 'ipad', pixels: 167, scale: '2x', size: '83.5x83.5' },
	{ filename: 'ios-marketing-1024.png', idiom: 'ios-marketing', pixels: 1024, scale: '1x', size: '1024x1024' },
] as const;
const macosIconset = [
	{ filename: 'icon_16x16.png', size: 16 },
	{ filename: 'icon_16x16@2x.png', size: 32 },
	{ filename: 'icon_32x32.png', size: 32 },
	{ filename: 'icon_32x32@2x.png', size: 64 },
	{ filename: 'icon_128x128.png', size: 128 },
	{ filename: 'icon_128x128@2x.png', size: 256 },
	{ filename: 'icon_256x256.png', size: 256 },
	{ filename: 'icon_256x256@2x.png', size: 512 },
	{ filename: 'icon_512x512.png', size: 512 },
	{ filename: 'icon_512x512@2x.png', size: 1024 },
] as const;
const manifest = {
	name: 'Agenter',
	short_name: 'Agenter',
	start_url: '/',
	scope: '/',
	display: 'standalone',
	background_color: '#f3f0ea',
	theme_color: '#f3f0ea',
	icons: [
		{ src: './icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
		{ src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
		{ src: './icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
		{ src: './icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
	],
};

resetDir(outputs.favicon);
resetDir(outputs.web);
resetDir(outputs.pwa);
resetDir(outputs.ios);
resetDir(join(outputs.macos, 'AppIcon.iconset'));
resetDir(outputs.android);
ensureDir(outputs.studioStatic);
resetDir(outputs.studioIcons);
removeFile(join(outputs.studioStatic, 'favicon.ico'));
removeFile(join(outputs.studioStatic, 'site.webmanifest'));

for (const size of faviconSizes) {
	resizePng(sourceFiles.favicon, join(outputs.favicon, `favicon-${size}.png`), size);
}
writeIco(join(outputs.favicon, 'favicon.ico'), faviconSizes.map((size) => join(outputs.favicon, `favicon-${size}.png`)));

copyFile(join(outputs.favicon, 'favicon.ico'), join(outputs.web, 'favicon.ico'));
copyFile(join(outputs.favicon, 'favicon.ico'), join(outputs.studioStatic, 'favicon.ico'));

for (const [themeName, themeSources] of Object.entries(themedSourceFiles) as Array<
	[keyof typeof themedSourceFiles, (typeof themedSourceFiles)[keyof typeof themedSourceFiles]]
>) {
	for (const size of [16, 32] as const) {
		const filename = `favicon-${themeName}-${size}.png`;
		resizePng(themeSources.favicon, join(outputs.web, filename), size);
		copyFile(join(outputs.web, filename), join(outputs.studioIcons, filename));
	}
}

for (const icon of webIcons) {
	const webPath = join(outputs.web, icon.filename);
	const pwaPath = join(outputs.pwa, icon.filename);
	const staticPath = join(outputs.studioIcons, icon.filename);
	resizePng(icon.source, webPath, icon.size);
	copyFile(webPath, pwaPath);
	copyFile(webPath, staticPath);
}

writeJson(join(outputs.web, 'site.webmanifest'), manifest);
writeJson(join(outputs.pwa, 'site.webmanifest'), manifest);
writeJson(join(outputs.studioStatic, 'site.webmanifest'), manifest);

for (const icon of iosIcons) {
	resizePng(sourceFiles.tile, join(outputs.ios, icon.filename), icon.pixels);
}
writeJson(join(outputs.ios, 'Contents.json'), {
	images: iosIcons.map((icon) => ({
		filename: icon.filename,
		idiom: icon.idiom,
		scale: icon.scale,
		size: icon.size,
	})),
	info: { author: 'xcode', version: 1 },
});

const macosIconsetDir = join(outputs.macos, 'AppIcon.iconset');
for (const icon of macosIconset) {
	resizePng(sourceFiles.tile, join(macosIconsetDir, icon.filename), icon.size);
}
run('iconutil', ['-c', 'icns', macosIconsetDir, '-o', join(outputs.macos, 'AppIcon.icns')]);

for (const [filename, source, size] of [
	['ic_launcher-foreground.png', sourceFiles.androidForeground, 432],
	['ic_launcher-background.png', sourceFiles.androidBackground, 432],
	['ic_launcher-192.png', sourceFiles.tile, 192],
	['ic_launcher-512.png', sourceFiles.tile, 512],
	['ic_launcher-maskable-512.png', sourceFiles.maskable, 512],
	['play-store-1024.png', sourceFiles.tile, 1024],
] as const) {
	resizePng(source, join(outputs.android, filename), size);
}

console.log('Generated app icon assets:');
for (const relativePath of [
	'assets/favicon/favicon.ico',
	'assets/app/web/site.webmanifest',
	'assets/app/apple/ios/AppIcon.appiconset',
	'assets/app/apple/macos/AppIcon.icns',
	'assets/app/android',
	'packages/studio/static/favicon.ico',
	'packages/studio/static/site.webmanifest',
]) {
	console.log(`- ${relativePath}`);
}
