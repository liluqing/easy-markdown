#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  filesIn,
  readFrontmatter,
  relativeToRoot,
  repoRoot,
  walkFiles,
} from "./lib.mjs";

const errors = [];
const warnings = [];

const requiredPaths = [
  "AGENTS.md",
  "CONTRIBUTING.md",
  "README.md",
  ".editorconfig",
  ".gitattributes",
  ".gitignore",
  ".agents/skills/grilling/SKILL.md",
  ".agents/skills/grilling/agents/openai.yaml",
  ".agents/skills/manage-repository-harness/SKILL.md",
  ".agents/skills/manage-repository-harness/agents/openai.yaml",
  "docs/harness/README.md",
  "docs/harness/user-agent-interaction.md",
  "docs/harness/git-workflow.md",
  "docs/harness/git-policy.json",
  "docs/harness/development-workflow.md",
  "docs/harness/engineering-standards.md",
  "docs/harness/document-governance.md",
  "docs/harness/quality-gates.md",
  "docs/harness/agent-handoff.md",
  "docs/requirements/README.md",
  "docs/work/README.md",
  "docs/work/active/README.md",
  "docs/templates/requirement.md",
  "docs/templates/work-item.md",
  "docs/templates/adr.md",
  "research/README.md",
  "scripts/harness/lib.mjs",
  "scripts/harness/new-requirement.mjs",
  "scripts/harness/new-work-item.mjs",
  "scripts/harness/new-adr.mjs",
  "scripts/harness/archive-work-item.mjs",
  "scripts/harness/check-harness.mjs",
];

for (const requiredPath of requiredPaths) {
  if (!fs.existsSync(path.join(repoRoot, requiredPath))) {
    errors.push(`Missing required Harness file: ${requiredPath}`);
  }
}

const requiredContent = new Map([
  [
    "AGENTS.md",
    [
      "docs/harness/git-workflow.md",
      "exact base SHA",
      "预先 modified/staged/untracked",
      "重大/紧急变更永不自动 merge",
      "当前 protected tip",
      "任何 fetch/push 前",
    ],
  ],
  [
    "CONTRIBUTING.md",
    ["docs/harness/git-workflow.md", "当前 protected tip", "`abandoned` 永不 Ready/merge"],
  ],
  [
    ".agents/skills/manage-repository-harness/SKILL.md",
    [
      "../../../docs/harness/git-workflow.md",
      "standing Git workflow",
      "exact base SHA",
      "branch-point base",
      "bootstrap-limited",
      "`abandoned` is a separate terminal state",
      "Before any network access",
    ],
  ],
  ["docs/harness/user-agent-interaction.md", ["(git-workflow.md)"]],
  ["docs/harness/development-workflow.md", ["(git-workflow.md)"]],
  [
    "docs/harness/quality-gates.md",
    ["(git-workflow.md)", "exact head", "### 放弃终态", "归档后的最终仓库状态"],
  ],
  [
    "docs/harness/agent-handoff.md",
    ["(git-workflow.md)", "`abandoned` 不满足 DoD"],
  ],
  [
    "docs/harness/git-workflow.md",
    [
      "## 7. 动作与询问矩阵",
      "自动 Squash Merge",
      "bootstrap 受限模式",
      "分支点 base、当前 protected tip 与候选规则三者的交集",
      "owned_paths",
      "不提供“仍然纳入”选项",
      "expected head SHA",
      "实际 merge 结果的真源",
      "`abandoned` 不表示 DoD",
      "可写或高权限 token",
      "approved_url_rewrites",
      "任何网络访问前",
    ],
  ],
]);

for (const [requiredPath, markers] of requiredContent) {
  const absolute = path.join(repoRoot, requiredPath);
  if (!fs.existsSync(absolute)) {
    continue;
  }
  const content = fs.readFileSync(absolute, "utf8");
  for (const marker of markers) {
    if (!content.includes(marker)) {
      errors.push(`${requiredPath} is missing required Git workflow marker: ${marker}`);
    }
  }
}

const gitPolicyPath = path.join(repoRoot, "docs", "harness", "git-policy.json");
if (fs.existsSync(gitPolicyPath)) {
  let policy;
  try {
    policy = JSON.parse(fs.readFileSync(gitPolicyPath, "utf8"));
  } catch (error) {
    errors.push(`docs/harness/git-policy.json is not valid JSON: ${error.message}`);
  }

  if (policy) {
    const requiredPolicyFields = [
      "schema_version",
      "mode",
      "protected_branch",
      "canonical_repository",
      "approved_fetch_urls",
      "approved_push_urls",
      "approved_url_rewrites",
      "allowed_remote_url_schemes",
      "allowed_agent_push_ref_prefixes",
      "governance_paths",
      "remote_execution_paths",
      "untrusted_branch_ci",
      "max_auto_stage_file_bytes",
      "allowed_binary_globs",
      "required_checks",
      "auto_merge_change_classes",
      "merge_method",
      "require_non_author_approval",
      "dismiss_stale_approvals",
      "require_expected_head",
    ];
    for (const field of requiredPolicyFields) {
      if (!Object.hasOwn(policy, field)) {
        errors.push(`docs/harness/git-policy.json is missing field: ${field}`);
      }
    }

    const arrayFields = [
      "approved_fetch_urls",
      "approved_push_urls",
      "approved_url_rewrites",
      "allowed_remote_url_schemes",
      "allowed_agent_push_ref_prefixes",
      "governance_paths",
      "remote_execution_paths",
      "allowed_binary_globs",
      "required_checks",
      "auto_merge_change_classes",
    ];
    for (const field of arrayFields) {
      if (!Array.isArray(policy[field])) {
        errors.push(`docs/harness/git-policy.json field ${field} must be an array`);
      }
    }

    if (policy.schema_version !== 1) {
      errors.push("docs/harness/git-policy.json has unsupported schema_version");
    }
    if (!new Set(["bootstrap-limited", "active"]).has(policy.mode)) {
      errors.push(`docs/harness/git-policy.json has invalid mode: ${policy.mode}`);
    }
    if (policy.protected_branch !== "main") {
      errors.push("docs/harness/git-policy.json protected_branch must be main");
    }
    if (policy.merge_method !== "squash") {
      errors.push("docs/harness/git-policy.json merge_method must be squash");
    }
    if (
      !Number.isInteger(policy.max_auto_stage_file_bytes) ||
      policy.max_auto_stage_file_bytes <= 0
    ) {
      errors.push(
        "docs/harness/git-policy.json max_auto_stage_file_bytes must be a positive integer",
      );
    }
    for (const field of [
      "require_non_author_approval",
      "dismiss_stale_approvals",
      "require_expected_head",
    ]) {
      if (policy[field] !== true) {
        errors.push(`docs/harness/git-policy.json field ${field} must be true`);
      }
    }

    if (
      Array.isArray(policy.allowed_agent_push_ref_prefixes) &&
      !policy.allowed_agent_push_ref_prefixes.includes("refs/heads/codex/")
    ) {
      errors.push(
        "docs/harness/git-policy.json must allow the refs/heads/codex/ branch prefix",
      );
    }
    const requiredGovernancePaths = [
      "AGENTS.md",
      "**/AGENTS.md",
      "CONTRIBUTING.md",
      ".agents/skills/**",
      "docs/harness/**",
      "docs/requirements/README.md",
      "docs/work/README.md",
      "docs/templates/**",
      "scripts/harness/**",
      "CODEOWNERS",
      ".github/CODEOWNERS",
      ".gitlab/CODEOWNERS",
      "docs/CODEOWNERS",
    ];
    if (Array.isArray(policy.governance_paths)) {
      for (const requiredPath of requiredGovernancePaths) {
        if (!policy.governance_paths.includes(requiredPath)) {
          errors.push(
            `docs/harness/git-policy.json governance_paths is missing ${requiredPath}`,
          );
        }
      }
    }
    const requiredRemoteExecutionPaths = [
      ".github/workflows/**",
      ".github/actions/**",
      ".gitlab-ci.yml",
      ".gitlab/ci/**",
      "scripts/**",
      "package.json",
      "Cargo.toml",
    ];
    if (Array.isArray(policy.remote_execution_paths)) {
      for (const requiredPath of requiredRemoteExecutionPaths) {
        if (!policy.remote_execution_paths.includes(requiredPath)) {
          errors.push(
            `docs/harness/git-policy.json remote_execution_paths is missing ${requiredPath}`,
          );
        }
      }
    }
    if (Array.isArray(policy.auto_merge_change_classes)) {
      for (const requiredClass of ["trivial", "standard"]) {
        if (!policy.auto_merge_change_classes.includes(requiredClass)) {
          errors.push(
            `docs/harness/git-policy.json auto_merge_change_classes is missing ${requiredClass}`,
          );
        }
      }
      for (const forbiddenClass of ["significant", "emergency"]) {
        if (policy.auto_merge_change_classes.includes(forbiddenClass)) {
          errors.push(
            `docs/harness/git-policy.json must not auto-merge ${forbiddenClass} changes`,
          );
        }
      }
    }

    if (
      Array.isArray(policy.allowed_remote_url_schemes) &&
      (policy.allowed_remote_url_schemes.length === 0 ||
        policy.allowed_remote_url_schemes.some(
          (scheme) => !new Set(["https", "ssh"]).has(scheme),
        ))
    ) {
      errors.push(
        "docs/harness/git-policy.json allowed_remote_url_schemes must contain only https/ssh and not be empty",
      );
    }
    if (Array.isArray(policy.approved_url_rewrites)) {
      for (const [index, rewrite] of policy.approved_url_rewrites.entries()) {
        if (
          rewrite === null ||
          typeof rewrite !== "object" ||
          Array.isArray(rewrite) ||
          !new Set(["insteadOf", "pushInsteadOf"]).has(rewrite.kind) ||
          typeof rewrite.match !== "string" ||
          rewrite.match.trim() === "" ||
          typeof rewrite.replacement !== "string" ||
          rewrite.replacement.trim() === ""
        ) {
          errors.push(
            `docs/harness/git-policy.json approved_url_rewrites[${index}] is invalid`,
          );
        }
      }
    }

    const requiredCiPolicy = {
      production_secrets: "forbidden",
      token_permissions: "read-only",
      persist_credentials: false,
      external_includes: "immutable-pinned",
      privileged_branch_execution: "forbidden",
    };
    if (
      policy.untrusted_branch_ci === null ||
      typeof policy.untrusted_branch_ci !== "object" ||
      Array.isArray(policy.untrusted_branch_ci)
    ) {
      errors.push("docs/harness/git-policy.json untrusted_branch_ci must be an object");
    } else {
      for (const [field, expected] of Object.entries(requiredCiPolicy)) {
        if (policy.untrusted_branch_ci[field] !== expected) {
          errors.push(
            `docs/harness/git-policy.json untrusted_branch_ci.${field} must be ${JSON.stringify(expected)}`,
          );
        }
      }
    }

    if (policy.mode === "bootstrap-limited") {
      if (policy.canonical_repository !== null) {
        errors.push(
          "docs/harness/git-policy.json canonical_repository must be null in bootstrap-limited mode",
        );
      }
      for (const field of [
        "approved_fetch_urls",
        "approved_push_urls",
        "approved_url_rewrites",
        "required_checks",
      ]) {
        if (Array.isArray(policy[field]) && policy[field].length !== 0) {
          errors.push(
            `docs/harness/git-policy.json field ${field} must be empty in bootstrap-limited mode`,
          );
        }
      }
    }

    if (policy.mode === "active") {
      if (
        typeof policy.canonical_repository !== "string" ||
        policy.canonical_repository.trim() === ""
      ) {
        errors.push(
          "docs/harness/git-policy.json active mode requires canonical_repository",
        );
      }
      for (const field of ["approved_fetch_urls", "approved_push_urls", "required_checks"]) {
        if (!Array.isArray(policy[field]) || policy[field].length === 0) {
          errors.push(`docs/harness/git-policy.json active mode requires non-empty ${field}`);
        }
      }
    }

    for (const field of ["approved_fetch_urls", "approved_push_urls"]) {
      if (!Array.isArray(policy[field])) {
        continue;
      }
      for (const url of policy[field]) {
        if (typeof url !== "string" || url.trim() === "") {
          errors.push(`docs/harness/git-policy.json ${field} contains an invalid URL`);
        } else if (/^[a-z]+:\/\/[^/@\s]+:[^/@\s]+@/i.test(url)) {
          errors.push(`docs/harness/git-policy.json ${field} must not embed credentials`);
        } else {
          const explicitScheme = url.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1]?.toLowerCase();
          const scheme =
            explicitScheme ?? (/^[^@\s]+@[^:\s]+:.+$/.test(url) ? "ssh" : null);
          if (
            scheme === null ||
            !Array.isArray(policy.allowed_remote_url_schemes) ||
            !policy.allowed_remote_url_schemes.includes(scheme)
          ) {
            errors.push(
              `docs/harness/git-policy.json ${field} contains a disallowed or ambiguous URL scheme`,
            );
          }
        }
      }
    }

    if (Array.isArray(policy.approved_url_rewrites)) {
      for (const [index, rewrite] of policy.approved_url_rewrites.entries()) {
        for (const field of ["match", "replacement"]) {
          const value = rewrite?.[field];
          if (
            typeof value === "string" &&
            /^[a-z]+:\/\/[^/@\s]+:[^/@\s]+@/i.test(value)
          ) {
            errors.push(
              `docs/harness/git-policy.json approved_url_rewrites[${index}].${field} must not embed credentials`,
            );
          }
        }
      }
    }
  }
}

const textExtensions = new Set([
  ".md",
  ".txt",
  ".csv",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".mjs",
  ".js",
  ".ts",
  ".tsx",
  ".css",
  ".html",
  ".rs",
]);
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
for (const file of walkFiles(repoRoot)) {
  if (
    !textExtensions.has(path.extname(file).toLowerCase()) &&
    !new Set([".editorconfig", ".gitattributes", ".gitignore"]).has(path.basename(file))
  ) {
    continue;
  }
  try {
    utf8Decoder.decode(fs.readFileSync(file));
  } catch {
    errors.push(`${relativeToRoot(file)} is not valid UTF-8`);
  }
}

const requirementStatuses = new Set([
  "proposed",
  "accepted",
  "in-progress",
  "validated",
  "released",
  "rejected",
  "superseded",
]);
const requirementTypes = new Set([
  "feature",
  "bug",
  "improvement",
  "enabler",
  "discovery",
  "maintenance",
]);
const priorities = new Set(["P0", "P1", "P2", "P3"]);
const workStatuses = new Set([
  "planned",
  "in-progress",
  "blocked",
  "review",
  "done",
  "abandoned",
]);

const requirementsDirectory = path.join(repoRoot, "docs", "requirements");
const activeDirectory = path.join(repoRoot, "docs", "work", "active");
const archiveDirectory = path.join(repoRoot, "docs", "work", "archive");
const requirementFilename = /^REQ-\d{4}-\d{3}-.+\.md$/;
const workFilename = /^WORK-\d{4}-\d{3}-.+\.md$/;
const requirementFiles = filesIn(requirementsDirectory, (name) =>
  requirementFilename.test(name),
);
const activeWorkFiles = filesIn(activeDirectory, (name) => workFilename.test(name));
const archivedWorkFiles = filesIn(archiveDirectory, (name) => workFilename.test(name));

for (const file of filesIn(requirementsDirectory, (name) => /\.md$/i.test(name))) {
  const name = path.basename(file);
  if (name !== "README.md" && !requirementFilename.test(name)) {
    errors.push(`Malformed requirement filename: ${relativeToRoot(file)}`);
  }
}
for (const directory of [activeDirectory, archiveDirectory]) {
  for (const file of filesIn(directory, (name) => /\.md$/i.test(name))) {
    const name = path.basename(file);
    if (name !== "README.md" && !workFilename.test(name)) {
      errors.push(`Malformed work item filename: ${relativeToRoot(file)}`);
    }
  }
}

const requirementRecords = new Map();
const workRecords = new Map();

function requireFields(file, fields, required) {
  for (const field of required) {
    if (fields[field] === undefined || fields[field] === "") {
      errors.push(`${relativeToRoot(file)} is missing frontmatter field: ${field}`);
    }
  }
}

function validateDate(file, fieldName, value) {
  if (value === undefined) {
    return;
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    : null;
  const valid =
    date !== null &&
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3]);
  if (!valid) {
    errors.push(`${relativeToRoot(file)} has invalid ${fieldName}: ${value}`);
  }
}

function safeReadFrontmatter(file) {
  try {
    return readFrontmatter(file);
  } catch (error) {
    errors.push(`${relativeToRoot(file)}: ${error.message}`);
    return null;
  }
}

for (const file of requirementFiles) {
  const filenameId = path.basename(file).match(/^(REQ-\d{4}-\d{3})-/)?.[1];
  const fields = safeReadFrontmatter(file);
  if (!fields) {
    errors.push(`${relativeToRoot(file)} has no YAML frontmatter`);
    continue;
  }

  requireFields(file, fields, [
    "id",
    "title",
    "type",
    "status",
    "priority",
    "owner",
    "created",
    "updated",
  ]);

  if (fields.id !== filenameId) {
    errors.push(`${relativeToRoot(file)} filename ID does not match frontmatter ID ${fields.id}`);
  }
  if (requirementRecords.has(fields.id)) {
    errors.push(`Duplicate requirement ID ${fields.id}`);
  } else {
    requirementRecords.set(fields.id, { file, fields });
  }
  if (!requirementStatuses.has(fields.status)) {
    errors.push(`${relativeToRoot(file)} has invalid requirement status: ${fields.status}`);
  }
  if (!requirementTypes.has(fields.type)) {
    errors.push(`${relativeToRoot(file)} has invalid requirement type: ${fields.type}`);
  }
  if (!priorities.has(fields.priority)) {
    errors.push(`${relativeToRoot(file)} has invalid priority: ${fields.priority}`);
  }
  validateDate(file, "created", fields.created);
  validateDate(file, "updated", fields.updated);
}

for (const [location, files] of [
  ["active", activeWorkFiles],
  ["archive", archivedWorkFiles],
]) {
  for (const file of files) {
    const filenameId = path.basename(file).match(/^(WORK-\d{4}-\d{3})-/)?.[1];
    const fields = safeReadFrontmatter(file);
    if (!fields) {
      errors.push(`${relativeToRoot(file)} has no YAML frontmatter`);
      continue;
    }

    requireFields(file, fields, [
      "id",
      "title",
      "status",
      "requirement",
      "owner",
      "created",
      "updated",
    ]);

    if (fields.id !== filenameId) {
      errors.push(`${relativeToRoot(file)} filename ID does not match frontmatter ID ${fields.id}`);
    }
    if (workRecords.has(fields.id)) {
      errors.push(`Duplicate work item ID ${fields.id}`);
    } else {
      workRecords.set(fields.id, { file, fields, location });
    }
    if (!workStatuses.has(fields.status)) {
      errors.push(`${relativeToRoot(file)} has invalid work status: ${fields.status}`);
    }
    if (location === "active" && new Set(["done", "abandoned"]).has(fields.status)) {
      errors.push(`${relativeToRoot(file)} is complete but still in active/`);
    }
    if (location === "archive" && !new Set(["done", "abandoned"]).has(fields.status)) {
      errors.push(`${relativeToRoot(file)} is archived with non-terminal status ${fields.status}`);
    }
    validateDate(file, "created", fields.created);
    validateDate(file, "updated", fields.updated);
  }
}

for (const { file, fields, location } of workRecords.values()) {
  if (fields.requirement === "none") {
    continue;
  }
  const requirement = requirementRecords.get(fields.requirement);
  if (!requirement) {
    errors.push(`${relativeToRoot(file)} references missing requirement ${fields.requirement}`);
    continue;
  }
  if (
    location === "active" &&
    !new Set(["accepted", "in-progress"]).has(requirement.fields.status)
  ) {
    errors.push(
      `${relativeToRoot(file)} is active but requirement ${fields.requirement} has status ${requirement.fields.status}`,
    );
  }
}

for (const { file, fields } of requirementRecords.values()) {
  if (fields.status !== "in-progress") {
    continue;
  }
  const hasActiveWork = [...workRecords.values()].some(
    (work) => work.location === "active" && work.fields.requirement === fields.id,
  );
  if (!hasActiveWork) {
    errors.push(`${relativeToRoot(file)} is in-progress but has no active WORK`);
  }
}

function markdownWithoutCode(markdown) {
  const lines = markdown.split(/\r?\n/);
  let fence = null;
  return lines
    .map((line) => {
      const match = line.match(/^\s{0,3}(`{3,}|~{3,})/);
      if (fence) {
        if (
          match &&
          match[1][0] === fence.character &&
          match[1].length >= fence.length
        ) {
          fence = null;
        }
        return "";
      }
      if (match) {
        fence = { character: match[1][0], length: match[1].length };
        return "";
      }
      return line.replace(/(`+)[^`\r\n]*?\1/g, "");
    })
    .join("\n");
}

function isEscaped(text, index) {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function extractInlineTargets(markdown) {
  const targets = [];
  for (let index = 0; index < markdown.length - 1; index += 1) {
    if (
      markdown[index] !== "]" ||
      markdown[index + 1] !== "(" ||
      isEscaped(markdown, index)
    ) {
      continue;
    }

    const start = index + 2;
    let depth = 1;
    for (let cursor = start; cursor < markdown.length; cursor += 1) {
      if (isEscaped(markdown, cursor)) {
        continue;
      }
      if (markdown[cursor] === "(") {
        depth += 1;
      } else if (markdown[cursor] === ")") {
        depth -= 1;
        if (depth === 0) {
          targets.push(markdown.slice(start, cursor).trim());
          index = cursor;
          break;
        }
      }
    }
  }
  return targets;
}

function normalizeReferenceLabel(label) {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

function extractReferenceDefinitions(markdown, repositoryRelative) {
  const definitions = new Map();
  const pattern = /^\s{0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))(?:\s+.*)?$/gm;
  let match;
  while ((match = pattern.exec(markdown)) !== null) {
    const label = normalizeReferenceLabel(match[1]);
    if (definitions.has(label)) {
      errors.push(`${repositoryRelative} has duplicate reference definition: ${match[1]}`);
    } else {
      definitions.set(label, match[2] ?? match[3]);
    }
  }
  return definitions;
}

function validateReferenceUsages(markdown, definitions, repositoryRelative) {
  const pattern = /!?\[([^\]\r\n]+)]\[([^\]\r\n]*)]/g;
  let match;
  while ((match = pattern.exec(markdown)) !== null) {
    const label = normalizeReferenceLabel(match[2] || match[1]);
    if (!definitions.has(label)) {
      errors.push(`${repositoryRelative} has unresolved reference link: ${label}`);
    }
  }
}

function cleanLinkTarget(rawTarget) {
  if (rawTarget.startsWith("<")) {
    const closing = rawTarget.indexOf(">");
    return closing >= 0 ? rawTarget.slice(1, closing) : rawTarget;
  }
  return rawTarget.replace(/\s+["'][^"']*["']\s*$/, "");
}

function hasExactPathCase(resolved) {
  const relative = path.relative(repoRoot, resolved);
  if (relative === "") {
    return true;
  }
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return false;
  }

  let current = repoRoot;
  for (const segment of relative.split(path.sep)) {
    if (!fs.existsSync(current)) {
      return false;
    }
    const exact = fs.readdirSync(current).includes(segment);
    if (!exact) {
      return false;
    }
    current = path.join(current, segment);
  }
  return true;
}

function headingSlug(value) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/!\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\p{Mark}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

const anchorCache = new Map();
function markdownAnchors(file) {
  if (anchorCache.has(file)) {
    return anchorCache.get(file);
  }

  const source = fs
    .readFileSync(file, "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
  const text = markdownWithoutCode(source);
  const headings = [];
  const atx = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm;
  let match;
  while ((match = atx.exec(text)) !== null) {
    headings.push(match[1]);
  }

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (lines[index].trim() !== "" && /^\s{0,3}(?:=+|-+)\s*$/.test(lines[index + 1])) {
      headings.push(lines[index].trim());
    }
  }

  const counts = new Map();
  const anchors = new Set();
  for (const heading of headings) {
    const base = headingSlug(heading);
    if (base === "") {
      continue;
    }
    const duplicate = counts.get(base) ?? 0;
    anchors.add(duplicate === 0 ? base : `${base}-${duplicate}`);
    counts.set(base, duplicate + 1);
  }

  anchorCache.set(file, anchors);
  return anchors;
}

function validateLinkTarget(file, repositoryRelative, rawTarget) {
  const target = cleanLinkTarget(rawTarget);
  if (target === "") {
    errors.push(`${repositoryRelative} contains an empty link target`);
    return;
  }
  if (/^[A-Za-z]:[\\/]/.test(target) || target.startsWith("\\\\")) {
    errors.push(`${repositoryRelative} contains an absolute local link: ${target}`);
    return;
  }
  if (target.startsWith("/")) {
    errors.push(`${repositoryRelative} contains a repository-root link instead of a relative link: ${target}`);
    return;
  }
  if (/^file:/i.test(target)) {
    errors.push(`${repositoryRelative} contains a forbidden file URI: ${target}`);
    return;
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)) {
    return;
  }

  const hashIndex = target.indexOf("#");
  let fileTarget = hashIndex >= 0 ? target.slice(0, hashIndex) : target;
  let anchor = hashIndex >= 0 ? target.slice(hashIndex + 1) : "";
  fileTarget = fileTarget.split("?", 1)[0];

  try {
    fileTarget = decodeURIComponent(fileTarget);
    anchor = decodeURIComponent(anchor);
  } catch {
    errors.push(`${repositoryRelative} contains an invalid encoded link: ${rawTarget}`);
    return;
  }

  const resolved =
    fileTarget === "" ? file : path.resolve(path.dirname(file), fileTarget);
  const relativeResolved = path.relative(repoRoot, resolved);
  if (relativeResolved.startsWith("..") || path.isAbsolute(relativeResolved)) {
    errors.push(`${repositoryRelative} links outside the repository: ${rawTarget}`);
    return;
  }
  if (!fs.existsSync(resolved)) {
    errors.push(`${repositoryRelative} has broken local link: ${rawTarget}`);
    return;
  }
  if (!hasExactPathCase(resolved)) {
    errors.push(`${repositoryRelative} has a case-mismatched local link: ${rawTarget}`);
    return;
  }
  if (anchor !== "" && path.extname(resolved).toLowerCase() === ".md") {
    if (!markdownAnchors(resolved).has(anchor)) {
      errors.push(`${repositoryRelative} has a broken Markdown anchor: ${rawTarget}`);
    }
  }
}

const markdownFiles = walkFiles(repoRoot).filter(
  (file) => path.extname(file).toLowerCase() === ".md",
);
for (const file of markdownFiles) {
  const content = fs.readFileSync(file, "utf8");
  const repositoryRelative = relativeToRoot(file);

  if (!repositoryRelative.startsWith("docs/templates/")) {
    const unresolved = content.match(/\{\{[A-Z][A-Z0-9_]*\}\}/g);
    if (unresolved) {
      errors.push(
        `${repositoryRelative} contains unresolved placeholders: ${[
          ...new Set(unresolved),
        ].join(", ")}`,
      );
    }
  }

  const parseable = markdownWithoutCode(content);
  const definitions = extractReferenceDefinitions(parseable, repositoryRelative);
  validateReferenceUsages(parseable, definitions, repositoryRelative);

  const targets = new Set([
    ...extractInlineTargets(parseable),
    ...definitions.values(),
  ]);
  for (const rawTarget of targets) {
    validateLinkTarget(file, repositoryRelative, rawTarget);
  }
}

const adrDirectory = path.join(repoRoot, "docs", "technical", "adr");
const adrFiles = filesIn(adrDirectory, (name) => /^\d{4}-.+\.md$/.test(name));
for (const file of filesIn(adrDirectory, (name) => /\.md$/i.test(name))) {
  const name = path.basename(file);
  if (name !== "README.md" && !/^\d{4}-.+\.md$/.test(name)) {
    errors.push(`Malformed ADR filename: ${relativeToRoot(file)}`);
  }
}
const adrNumbers = new Set();
const adrStatuses = new Set([
  "Proposed",
  "Accepted for Spike",
  "Accepted",
  "Superseded",
  "Rejected",
]);
for (const file of adrFiles) {
  const number = path.basename(file).slice(0, 4);
  if (adrNumbers.has(number)) {
    errors.push(`Duplicate ADR number ${number}`);
  }
  adrNumbers.add(number);

  const content = fs.readFileSync(file, "utf8");
  const titleNumber = content.match(/^#\s+ADR-(\d{4})[：:]/)?.[1];
  if (titleNumber !== number) {
    errors.push(`${relativeToRoot(file)} title number does not match filename number ${number}`);
  }
  const status = content.match(/^\|\s*状态\s*\|\s*([^|]+?)\s*\|$/m)?.[1]?.trim();
  if (!status) {
    errors.push(`${relativeToRoot(file)} has no ADR status row`);
  } else if (!adrStatuses.has(status)) {
    errors.push(`${relativeToRoot(file)} has invalid ADR status: ${status}`);
  }
}

const adrIndexPath = path.join(adrDirectory, "README.md");
if (fs.existsSync(adrIndexPath)) {
  const index = fs.readFileSync(adrIndexPath, "utf8");
  const markerStart = index.indexOf("<!-- ADR_INDEX_START -->");
  const markerEnd = index.indexOf("<!-- ADR_INDEX_END -->");
  if (markerStart < 0 || markerEnd < 0 || markerEnd < markerStart) {
    errors.push("ADR index has missing or out-of-order managed index markers");
  }
  const indexedFiles = new Set(
    [...index.matchAll(/\]\((\d{4}-[^)#]+\.md)(?:#[^)]*)?\)/g)].map((match) => match[1]),
  );
  for (const file of adrFiles) {
    const filename = path.basename(file);
    if (!indexedFiles.has(filename)) {
      errors.push(`ADR index is missing ${filename}`);
    }
  }
  for (const indexedFile of indexedFiles) {
    if (!fs.existsSync(path.join(adrDirectory, indexedFile))) {
      errors.push(`ADR index references missing file ${indexedFile}`);
    }
  }
} else {
  errors.push("Missing ADR index: docs/technical/adr/README.md");
}

if (requirementFiles.length === 0) {
  warnings.push("No requirement records found");
}

for (const warning of warnings) {
  console.warn(`Warning: ${warning}`);
}

if (errors.length > 0) {
  console.error(`Harness check failed with ${errors.length} error(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Harness check passed: ${requirementFiles.length} REQ, ${activeWorkFiles.length} active WORK, ${archivedWorkFiles.length} archived WORK, ${adrFiles.length} ADR, ${markdownFiles.length} Markdown files.`,
  );
}
