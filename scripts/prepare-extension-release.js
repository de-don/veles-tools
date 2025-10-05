#!/usr/bin/env node
// @ts-check

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const versionArg = process.argv[2];

if (typeof versionArg !== 'string' || versionArg.trim() === '') {
  throw new Error('Release version is required as the first argument.');
}

const releaseVersion = versionArg.trim();

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const manifestPath = resolve(process.cwd(), 'extension', 'manifest.json');
const manifestContent = readFileSync(manifestPath, 'utf8');
const manifestData = JSON.parse(manifestContent);

if (!isRecord(manifestData)) {
  throw new Error('Extension manifest must be a JSON object.');
}

manifestData.version = releaseVersion;

writeFileSync(manifestPath, `${JSON.stringify(manifestData, null, 2)}\n`, 'utf8');

const artifactsDir = resolve(process.cwd(), 'release-artifacts');
if (!existsSync(artifactsDir)) {
  mkdirSync(artifactsDir, { recursive: true });
}

const archiveName = `veles-tools-${releaseVersion}.zip`;
const archivePath = join(artifactsDir, archiveName);

if (existsSync(archivePath)) {
  rmSync(archivePath);
}

const extensionDir = resolve(process.cwd(), 'extension');
const itemsToArchive = readdirSync(extensionDir);

if (itemsToArchive.length === 0) {
  throw new Error('Extension directory is empty, cannot create an archive.');
}

const zipArgs = ['-r', archivePath, ...itemsToArchive, '-x', '*.DS_Store'];
const zipResult = spawnSync('zip', zipArgs, {
  cwd: extensionDir,
  stdio: 'inherit'
});

if (zipResult.error instanceof Error) {
  throw zipResult.error;
}

if (zipResult.status !== 0) {
  throw new Error('Failed to create extension archive.');
}
