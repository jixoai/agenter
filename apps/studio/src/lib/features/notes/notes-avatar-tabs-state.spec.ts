import { describe, expect, test } from "vitest";

import {
  createNotesAvatarTabEntry,
  removeNotesAvatarTab,
  upsertNotesAvatarTab,
  type NotesAvatarTabEntry,
} from "./notes-avatar-tabs-state";

describe("Feature: Notes avatar tab presence", () => {
  test("Scenario: Given one avatar notes tab is revisited When upserting it again Then the workbench keeps one avatar-scoped entry", () => {
    const current: NotesAvatarTabEntry[] = [
      createNotesAvatarTabEntry({
        avatarNickname: "default",
      }),
    ];

    const next = upsertNotesAvatarTab(current, {
      avatarNickname: "default",
    });

    expect(next.entry).toEqual(
      createNotesAvatarTabEntry({
        avatarNickname: "default",
      }),
    );
    expect(next.entries).toEqual([
      createNotesAvatarTabEntry({
        avatarNickname: "default",
      }),
    ]);
  });

  test("Scenario: Given multiple avatar notes tabs When closing one avatar tab Then durable NoteSystem facts stay reopenable through remaining tab entries", () => {
    const current: NotesAvatarTabEntry[] = [
      createNotesAvatarTabEntry({
        avatarNickname: "default",
      }),
      createNotesAvatarTabEntry({
        avatarNickname: "architect",
      }),
    ];

    expect(
      removeNotesAvatarTab(
        current,
        createNotesAvatarTabEntry({
          avatarNickname: "default",
        }).id,
      ),
    ).toEqual([
      createNotesAvatarTabEntry({
        avatarNickname: "architect",
      }),
    ]);
  });
});
