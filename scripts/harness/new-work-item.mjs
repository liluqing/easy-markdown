#!/usr/bin/env node

import path from "node:path";
import {
  assertSingleLine,
  findRecord,
  nextId,
  parseOptions,
  parseYear,
  readFrontmatter,
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

const usage = `Usage:
  node scripts/harness/new-work-item.mjs --title "Title" --requirement REQ-YYYY-NNN --owner "Owner"

Options:
  --requirement  Accepted/in-progress REQ ID, or explicit "none"
  --owner        Responsible person or role (default: unassigned)
  --year         Four-digit ID year (default: current year)
  --dry-run      Render without writing a file
  --help         Show this help`;

runCli(() => {
  const options = parseOptions(process.argv.slice(2), {
    values: ["title", "requirement", "owner", "year"],
    flags: ["dry-run", "help"],
  });
  if (options.help) {
    console.log(usage);
    return;
  }

  const title = requireText(options, "title");
  const requirement = requireText(options, "requirement");
  const owner = assertSingleLine(
    typeof options.owner === "string" ? options.owner.trim() : "unassigned",
    "owner",
  );
  const year = parseYear(options.year);

  if (owner === "") {
    throw new Error("Owner cannot be empty");
  }

  const requirementsDirectory = path.join(repoRoot, "docs", "requirements");
  if (requirement !== "none") {
    if (!/^REQ-\d{4}-\d{3}$/.test(requirement)) {
      throw new Error(`Invalid requirement ID: ${requirement}`);
    }

    const requirementFile = findRecord(requirementsDirectory, requirement);
    if (!requirementFile) {
      throw new Error(`Requirement does not exist: ${requirement}`);
    }

    const fields = readFrontmatter(requirementFile);
    if (!fields || !new Set(["accepted", "in-progress"]).has(fields.status)) {
      throw new Error(
        `Requirement ${requirement} must be accepted or in-progress before creating work`,
      );
    }
  }

  const activeDirectory = path.join(repoRoot, "docs", "work", "active");
  const archiveDirectory = path.join(repoRoot, "docs", "work", "archive");
  const id = nextId("WORK", year, [activeDirectory, archiveDirectory]);
  const target = path.join(activeDirectory, `${id}-${slugify(title)}.md`);
  const content = renderTemplate(path.join(repoRoot, "docs", "templates", "work-item.md"), {
    ID: id,
    TITLE: title,
    TITLE_YAML: yamlQuoted(title),
    REQUIREMENT: requirement,
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
