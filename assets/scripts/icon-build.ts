import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const repoRoot = resolve(import.meta.dirname, '..', '..');

export const ensureDir = (dirPath: string): void => {
	mkdirSync(dirPath, { recursive: true });
};

export const resetDir = (dirPath: string): void => {
	rmSync(dirPath, { force: true, recursive: true });
	mkdirSync(dirPath, { recursive: true });
};

export const removeFile = (filePath: string): void => {
	rmSync(filePath, { force: true });
};

export const run = (command: string, args: string[]): void => {
	execFileSync(command, args, { stdio: 'inherit' });
};

export const resizePng = (inputPath: string, outputPath: string, size: number): void => {
	ensureDir(dirname(outputPath));
	run('sips', ['-z', String(size), String(size), inputPath, '--out', outputPath]);
};

export const copyFile = (inputPath: string, outputPath: string): void => {
	ensureDir(dirname(outputPath));
	copyFileSync(inputPath, outputPath);
};

export const writeJson = (outputPath: string, value: unknown): void => {
	ensureDir(dirname(outputPath));
	writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const readPngSize = (buffer: Buffer): { width: number; height: number } => {
	const signature = buffer.subarray(0, 8).toString('hex');
	if (signature !== '89504e470d0a1a0a') {
		throw new Error('ICO generation requires PNG inputs');
	}

	return {
		width: buffer.readUInt32BE(16),
		height: buffer.readUInt32BE(20),
	};
};

export const writeIco = (outputPath: string, inputPaths: string[]): void => {
	const pngBuffers = inputPaths.map((inputPath) => readFileSync(inputPath));
	const iconHeader = Buffer.alloc(6);
	iconHeader.writeUInt16LE(0, 0);
	iconHeader.writeUInt16LE(1, 2);
	iconHeader.writeUInt16LE(pngBuffers.length, 4);

	const directoryEntries = pngBuffers.map((buffer, index) => {
		const { width, height } = readPngSize(buffer);
		const entry = Buffer.alloc(16);
		entry.writeUInt8(width >= 256 ? 0 : width, 0);
		entry.writeUInt8(height >= 256 ? 0 : height, 1);
		entry.writeUInt8(0, 2);
		entry.writeUInt8(0, 3);
		entry.writeUInt16LE(1, 4);
		entry.writeUInt16LE(32, 6);
		entry.writeUInt32LE(buffer.length, 8);
		const offset =
			iconHeader.length +
			pngBuffers.length * 16 +
			pngBuffers.slice(0, index).reduce((total, current) => total + current.length, 0);
		entry.writeUInt32LE(offset, 12);
		return entry;
	});

	ensureDir(dirname(outputPath));
	writeFileSync(outputPath, Buffer.concat([iconHeader, ...directoryEntries, ...pngBuffers]));
};
