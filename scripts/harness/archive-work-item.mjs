#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  findRecord,
  parseOptions,
  readFrontmatter,
  relativeToRoot,
  repoRoot,
  requireText,
  runCli,
} from "./lib.mjs";

const usage = `Usage:
  node scripts/harness/archive-work-item.mjs --id WORK-YYYY-NNN

Options:
  --dry-run  Validate and show the move without changing files
  --help     Show this help`;

runCli(() => {
  const options = parseOptions(process.argv.slice(2), {
    values: ["id"],
    flags: ["dry-run", "help"],
  });
  if (options.help) {
    console.log(usage);
    return;
  }

  const id = requireText(options, "id");
  if (!/^WORK-\d{4}-\d{3}$/.test(id)) {
    throw new Error(`Invalid work item ID: ${id}`);
  }

  const activeDirectory = path.join(repoRoot, "docs", "work", "active");
  const archiveDirectory = path.join(repoRoot, "docs", "work", "archive");
  const source = findRecord(activeDirectory, id);
  if (!source) {
    throw new Error(`Active work item does not exist: ${id}`);
  }

  const fields = readFrontmatter(source);
  if (!fields || !new Set(["done", "abandoned"]).has(fields.status)) {
    throw new Error(`Work item ${id} must be done or abandoned before archiving`);
  }

  const target = path.join(archiveDirectory, path.basename(source));
  if (fs.existsSync(target)) {
    throw new Error(`Archive target already exists: ${relativeToRoot(target)}`);
  }

  if (options["dry-run"]) {
    console.log(`DRY RUN: would move ${relativeToRoot(source)} -> ${relativeToRoot(target)}`);
    return;
  }

  fs.mkdirSync(archiveDirectory, { recursive: true });
  fs.renameSync(source, target);
  console.log(`Archived ${relativeToRoot(target)}`);
});
