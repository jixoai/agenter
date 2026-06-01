import { describe, expect, test } from "bun:test";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { generatePrincipalKeyPair } from "@agenter/principal-crypto";

import {
  ensureAvatarSeatPrincipal,
  readAvatarSeatDocument,
  resolveAvatarSeatSettingsPath,
  saveAvatarMessageSeatCredential,
  saveAvatarTerminalSeatCredential,
} from "../src/avatar-seat-store";
import {
  resolveWorkspaceAvatarAliasRoot,
  resolveWorkspaceAvatarCanonicalRoot,
  resolveWorkspaceAvatarPrivateRoot,
} from "../src/workspace-system";
import { GLOBAL_WORKSPACE_PATH } from "../src/workspace-target";

describe("Feature: avatar seat identity allocation", () => {
  test("Scenario: Given two fresh seat paths When principals are allocated Then each seat file persists a distinct principal address under by-principal roots with nickname aliases", () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-avatar-seat-"));
    const homeDir = join(root, "home");
    const workspacePath = join(root, "workspace");
    mkdirSync(homeDir, { recursive: true });
    mkdirSync(workspacePath, { recursive: true });

    try {
      const backendPath = resolveAvatarSeatSettingsPath(workspacePath, "backend", homeDir);
      const frontendPath = resolveAvatarSeatSettingsPath(workspacePath, "frontend", homeDir);

      expect(backendPath).not.toBe(frontendPath);
      expect(existsSync(backendPath)).toBeFalse();
      expect(existsSync(frontendPath)).toBeFalse();

      const backendPrincipal = ensureAvatarSeatPrincipal({
        workspacePath,
        avatar: "backend",
        homeDir,
      });
      const frontendPrincipal = ensureAvatarSeatPrincipal({
        workspacePath,
        avatar: "frontend",
        homeDir,
      });

      expect(backendPrincipal.principalId).not.toBe(frontendPrincipal.principalId);

      const backendDoc = readAvatarSeatDocument(workspacePath, "backend", homeDir);
      const frontendDoc = readAvatarSeatDocument(workspacePath, "frontend", homeDir);
      const backendAlias = resolveWorkspaceAvatarAliasRoot(workspacePath, "backend", homeDir);
      const frontendAlias = resolveWorkspaceAvatarAliasRoot(workspacePath, "frontend", homeDir);
      const backendRoot = resolveWorkspaceAvatarPrivateRoot(workspacePath, "backend", homeDir);
      const frontendRoot = resolveWorkspaceAvatarPrivateRoot(workspacePath, "frontend", homeDir);
      const backendCanonicalPath = resolveAvatarSeatSettingsPath(workspacePath, "backend", homeDir);
      const frontendCanonicalPath = resolveAvatarSeatSettingsPath(workspacePath, "frontend", homeDir);

      expect(backendDoc.principalId).toBe(backendPrincipal.principalId);
      expect(frontendDoc.principalId).toBe(frontendPrincipal.principalId);
      expect(backendDoc.principalId).not.toBe(frontendDoc.principalId);
      expect(backendCanonicalPath).toBe(join(backendRoot, "settings.local.json"));
      expect(frontendCanonicalPath).toBe(join(frontendRoot, "settings.local.json"));
      expect(existsSync(backendCanonicalPath)).toBeTrue();
      expect(existsSync(frontendCanonicalPath)).toBeTrue();
      expect(lstatSync(backendAlias).isSymbolicLink()).toBeTrue();
      expect(lstatSync(frontendAlias).isSymbolicLink()).toBeTrue();
      expect(realpathSync(backendAlias)).toBe(backendRoot);
      expect(realpathSync(frontendAlias)).toBe(frontendRoot);
      expect(backendRoot).toBe(realpathSync(resolveWorkspaceAvatarCanonicalRoot(workspacePath, backendPrincipal.principalId, homeDir)));
      expect(frontendRoot).toBe(realpathSync(resolveWorkspaceAvatarCanonicalRoot(workspacePath, frontendPrincipal.principalId, homeDir)));
      expect(backendRoot).toContain(join(".agenter", "avatars", "by-principal"));
      expect(frontendRoot).toContain(join(".agenter", "avatars", "by-principal"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("Scenario: Given a legacy global nickname directory When principal resolution runs Then the backend migrates the directory into canonical by-principal storage and preserves existing files", () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-avatar-seat-"));
    const homeDir = join(root, "home");
    mkdirSync(homeDir, { recursive: true });

    try {
      const legacyPrincipal = generatePrincipalKeyPair();
      const aliasPath = resolveWorkspaceAvatarAliasRoot(GLOBAL_WORKSPACE_PATH, "default", homeDir);
      mkdirSync(aliasPath, { recursive: true });
      writeFileSync(
        join(aliasPath, "settings.local.json"),
        `${JSON.stringify(
          {
            version: 2,
            principalId: legacyPrincipal.principalId,
            algorithm: legacyPrincipal.algorithm,
            publicKey: legacyPrincipal.publicKey,
            privateKey: legacyPrincipal.privateKey,
            messageSeats: {
              "room-main": {
                accessToken: "legacy-token",
                accessRole: "admin",
                state: "active",
                updatedAt: "2026-04-12T00:00:00.000Z",
              },
            },
            terminalSeats: {},
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      writeFileSync(join(aliasPath, "AGENTER.mdx"), "# legacy avatar\n", "utf8");

      const resolved = ensureAvatarSeatPrincipal({
        workspacePath: GLOBAL_WORKSPACE_PATH,
        avatar: "default",
        homeDir,
      });
      const canonicalRoot = resolveWorkspaceAvatarCanonicalRoot(
        GLOBAL_WORKSPACE_PATH,
        legacyPrincipal.principalId,
        homeDir,
      );

      expect(resolved.principalId).toBe(legacyPrincipal.principalId);
      expect(lstatSync(aliasPath).isSymbolicLink()).toBeTrue();
      expect(realpathSync(aliasPath)).toBe(realpathSync(canonicalRoot));
      expect(readAvatarSeatDocument(GLOBAL_WORKSPACE_PATH, "default", homeDir).principalId).toBe(legacyPrincipal.principalId);
      expect(readFileSync(join(canonicalRoot, "AGENTER.mdx"), "utf8")).toBe("# legacy avatar\n");
      expect(readFileSync(join(canonicalRoot, "settings.local.json"), "utf8")).toContain('"legacy-token"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("Scenario: Given accepted remote room and terminal seats When credentials are saved Then authority endpoint metadata persists for later remote client reuse", () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-avatar-seat-"));
    const homeDir = join(root, "home");
    const workspacePath = join(root, "workspace");
    mkdirSync(homeDir, { recursive: true });
    mkdirSync(workspacePath, { recursive: true });

    try {
      saveAvatarMessageSeatCredential({
        workspacePath,
        avatar: "frontend",
        chatId: "room-remote",
        accessToken: "room-token",
        accessRole: "member",
        endpoint: {
          authorityUrl: "http://127.0.0.1:4311/",
          trpcPath: "/trpc",
          acceptPath: "/join",
        },
        homeDir,
      });
      saveAvatarTerminalSeatCredential({
        workspacePath,
        avatar: "frontend",
        terminalId: "term-remote",
        accessToken: "term-token",
        accessRole: "writer",
        endpoint: {
          authorityUrl: "http://127.0.0.1:4322/",
          trpcPath: "/trpc",
          acceptPath: "/join",
        },
        homeDir,
      });

      const doc = readAvatarSeatDocument(workspacePath, "frontend", homeDir);
      expect(doc.messageSeats["room-remote"]?.endpoint).toEqual({
        authorityUrl: "http://127.0.0.1:4311",
        trpcPath: "/trpc",
        acceptPath: "/join",
      });
      expect(doc.terminalSeats["term-remote"]?.endpoint).toEqual({
        authorityUrl: "http://127.0.0.1:4322",
        trpcPath: "/trpc",
        acceptPath: "/join",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
