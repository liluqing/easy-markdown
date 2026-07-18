#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  atomicReplaceFile,
  filesIn,
  nextAdrNumber,
  parseOptions,
  relativeToRoot,
  renderTemplate,
  repoRoot,
  requireText,
  runCli,
  slugify,
  today,
  writeNewFile,
} from "./lib.mjs";

const usage = `Usage:
  node scripts/harness/new-adr.mjs --title "Decision title"

Options:
  --dry-run  Render without writing the ADR or index
  --help     Show this help`;

const indexStart = "<!-- ADR_INDEX_START -->";
const indexEnd = "<!-- ADR_INDEX_END -->";

function adrTitle(file) {
  return fs.readFileSync(file, "utf8").match(/^#\s+ADR-\d{4}[：:]\s*(.+)$/m)?.[1]?.trim() ?? null;
}

function escapeLinkLabel(value) {
  return value.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function renderIndex(indexPath, adrDirectory) {
  const current = fs.readFileSync(indexPath, "utf8");
  const start = current.indexOf(indexStart);
  const end = current.indexOf(indexEnd);
  if (start < 0 || end < 0 || end < start) {
    throw new Error("ADR index is missing its managed index markers");
  }

  const entries = filesIn(adrDirectory, (name) => /^\d{4}-.+\.md$/.test(name))
    .sort((left, right) => path.basename(left).localeCompare(path.basename(right), "en"))
    .map((file) => {
      const number = path.basename(file).slice(0, 4);
      const title = adrTitle(file);
      if (!title) {
        throw new Error(`Cannot read ADR title from ${path.basename(file)}`);
      }
      return `- [ADR-${number}：${escapeLinkLabel(title)}](${path.basename(file)})`;
    })
    .join("\n");

  const before = current.slice(0, start + indexStart.length);
  const after = current.slice(end);
  return `${before}\n${entries}\n${after}`;
}

runCli(() => {
  const options = parseOptions(process.argv.slice(2), {
    values: ["title"],
    flags: ["dry-run", "help"],
  });
  if (options.help) {
    console.log(usage);
    return;
  }

  const title = requireText(options, "title");
  const adrDirectory = path.join(repoRoot, "docs", "technical", "adr");
  const indexPath = path.join(adrDirectory, "README.md");
  const existing = filesIn(adrDirectory, (name) => /^\d{4}-.+\.md$/.test(name)).find(
    (file) => adrTitle(file) === title,
  );

  if (existing) {
    if (options["dry-run"]) {
      console.log(`DRY RUN: ADR already exists at ${relativeToRoot(existing)}`);
      return;
    }
    atomicReplaceFile(indexPath, renderIndex(indexPath, adrDirectory));
    console.log(`ADR already exists at ${relativeToRoot(existing)}; synchronized ADR index`);
    return;
  }

  const number = nextAdrNumber(adrDirectory);
  const target = path.join(adrDirectory, `${number}-${slugify(title)}.md`);
  const content = renderTemplate(path.join(repoRoot, "docs", "templates", "adr.md"), {
    NUMBER: number,
    TITLE: title,
    DATE: today(),
  });

  if (options["dry-run"]) {
    console.log(`DRY RUN: would create ${relativeToRoot(target)}`);
    console.log(content);
    return;
  }

  renderIndex(indexPath, adrDirectory);
  writeNewFile(target, content);
  try {
    atomicReplaceFile(indexPath, renderIndex(indexPath, adrDirectory));
  } catch (error) {
    fs.rmSync(target);
    throw error;
  }

  console.log(`Created ${relativeToRoot(target)} and updated ADR index`);
});
