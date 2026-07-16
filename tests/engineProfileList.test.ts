import test from "node:test";
import assert from "node:assert/strict";
import { appendEngineProfile, replaceEngineProfile } from "../src/engine/profileList.ts";
import type { EngineProfile } from "../src/engine/types.ts";

function profile(name: string): EngineProfile {
  return {
    name,
    executablePath: "/opt/homebrew/bin/katago",
    modelPath: "/models/model.bin.gz",
    configPath: "/configs/gtp.cfg",
    commandLine: "",
    exists: true
  };
}

test("saving as new keeps configurations with identical paths as separate rows", () => {
  const first = appendEngineProfile([], profile("普通 KataGo"), "profile-1");
  const second = appendEngineProfile(first.profiles, profile("人类 KataGo"), "profile-2");

  assert.equal(second.profiles.length, 2);
  assert.deepEqual(second.profiles.map((item) => item.profileId), ["profile-1", "profile-2"]);
  assert.deepEqual(second.profiles.map((item) => item.name), ["普通 KataGo", "人类 KataGo"]);
});

test("updating replaces only the selected row and preserves its stable id", () => {
  const first = appendEngineProfile([], profile("配置 A"), "profile-1");
  const second = appendEngineProfile(first.profiles, profile("配置 B"), "profile-2");
  const updated = replaceEngineProfile(second.profiles, 1, profile("配置 B（更新）"));

  assert.ok(updated);
  assert.equal(updated.profiles.length, 2);
  assert.equal(updated.profiles[0].name, "配置 A");
  assert.equal(updated.profiles[1].name, "配置 B（更新）");
  assert.equal(updated.profiles[1].profileId, "profile-2");
});

test("saving a dual-model profile preserves human engine fields and mode", () => {
  const dual = {
    ...profile("双模式 KataGo"),
    humanModelPath: "/models/human.bin.gz",
    humanConfigPath: "/configs/human.cfg",
    engineMode: "human" as const
  };
  const saved = appendEngineProfile([], dual, "profile-dual");

  assert.equal(saved.profile.humanModelPath, "/models/human.bin.gz");
  assert.equal(saved.profile.humanConfigPath, "/configs/human.cfg");
  assert.equal(saved.profile.engineMode, "human");
});
