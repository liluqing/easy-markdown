#!/usr/bin/env node

import path from "node:path";
import {
  assertSingleLine,
  nextId,
  parseOptions,
  parseYear,
  relativeToRoot,
  renderTemplate,
  repoRoot,
  requireText,
  runCli,
  slugify,
  today,
  writeNewFile,
  yamlQuoted,
} from "./lib.mjs";

const allowedTypes = new Set([
  "feature",
  "bug",
  "improvement",
  "enabler",
  "discovery",
  "maintenance",
]);
const allowedPriorities = new Set(["P0", "P1", "P2", "P3"]);

const usage = `Usage:
  node scripts/harness/new-requirement.mjs --title "Title" --type feature --owner "Owner"

Options:
  --type       feature|bug|improvement|enabler|discovery|maintenance (default: feature)
  --priority   P0|P1|P2|P3 (default: P1)
  --owner      Responsible person or role (default: unassigned)
  --year       Four-digit ID year (default: current year)
  --dry-run    Render without writing a file
  --help       Show this help`;

runCli(() => {
  const options = parseOptions(process.argv.slice(2), {
    values: ["title", "type", "priority", "owner", "year"],
    flags: ["dry-run", "help"],
  });
  if (options.help) {
    console.log(usage);
    return;
  }

  const title = requireText(options, "title");
  const type = typeof options.type === "string" ? options.type : "feature";
  const priority = typeof options.priority === "string" ? options.priority : "P1";
  const owner = assertSingleLine(
    typeof options.owner === "string" ? options.owner.trim() : "unassigned",
    "owner",
  );
  const year = parseYear(options.year);

  if (!allowedTypes.has(type)) {
    throw new Error(`Invalid requirement type: ${type}`);
  }
  if (!allowedPriorities.has(priority)) {
    throw new Error(`Invalid priority: ${priority}`);
  }
  if (owner === "") {
    throw new Error("Owner cannot be empty");
  }

  const requirementsDirectory = path.join(repoRoot, "docs", "requirements");
  const id = nextId("REQ", year, [requirementsDirectory]);
  const target = path.join(requirementsDirectory, `${id}-${slugify(title)}.md`);
  const content = renderTemplate(path.join(repoRoot, "docs", "templates", "requirement.md"), {
    ID: id,
    TITLE: title,
    TITLE_YAML: yamlQuoted(title),
    TYPE: type,
    PRIORITY: priority,
    OWNER: owner,
    OWNER_YAML: yamlQuoted(owner),
    DATE: today(),
  });

  if (options["dry-run"]) {
    console.log(`DRY RUN: would create ${relativeToRoot(target)}`);
    console.log(content);
    return;
  }

  writeNewFile(target, content);
  console.log(`Created ${relativeToRoot(target)}`);
});
