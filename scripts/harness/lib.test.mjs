import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { walkFiles } from "./lib.mjs";

test("walkFiles skips common generated directories by default", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "easy-markdown-harness-"));

  try {
    fs.writeFileSync(path.join(root, "source.ts"), "export {};\n");

    for (const directory of [
      ".git",
      "node_modules",
      ".pnpm-store",
      "dist",
      ".vite",
      ".turbo",
      ".parcel-cache",
      "coverage",
      "test-results",
      "playwright-report",
      "target",
      ".cache",
    ]) {
      const generated = path.join(root, directory);
      fs.mkdirSync(generated, { recursive: true });
      fs.writeFileSync(path.join(generated, "generated.js"), Buffer.from([0xff]));
    }

    assert.deepEqual(
      walkFiles(root).map((file) => path.relative(root, file)),
      ["source.ts"],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("walkFiles preserves explicit skip-directory overrides", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "easy-markdown-harness-"));

  try {
    fs.mkdirSync(path.join(root, "custom"), { recursive: true });
    fs.mkdirSync(path.join(root, "target"), { recursive: true });
    fs.writeFileSync(path.join(root, "custom", "skip.txt"), "skip\n");
    fs.writeFileSync(path.join(root, "target", "include.txt"), "include\n");

    assert.deepEqual(
      walkFiles(root, { skipDirectories: ["custom"] }).map((file) =>
        path.relative(root, file),
      ),
      [path.join("target", "include.txt")],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
