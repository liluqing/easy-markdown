import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(scriptDirectory, "..", "..");

export function parseOptions(argv, schema) {
  const options = {};
  const valueOptions = new Set(schema.values ?? []);
  const flagOptions = new Set(schema.flags ?? []);
  const allowedOptions = new Set([...valueOptions, ...flagOptions]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${argument}`);
    }

    const equalsIndex = argument.indexOf("=");
    if (equalsIndex > 2) {
      const key = argument.slice(2, equalsIndex);
      const value = argument.slice(equalsIndex + 1);
      if (!allowedOptions.has(key)) {
        throw new Error(`Unknown option --${key}`);
      }
      if (Object.hasOwn(options, key)) {
        throw new Error(`Duplicate option --${key}`);
      }
      if (flagOptions.has(key)) {
        throw new Error(`Flag --${key} does not accept a value`);
      }
      if (value === "") {
        throw new Error(`Option --${key} requires a value`);
      }
      options[key] = value;
      continue;
    }

    const key = argument.slice(2);
    if (!allowedOptions.has(key)) {
      throw new Error(`Unknown option --${key}`);
    }
    if (Object.hasOwn(options, key)) {
      throw new Error(`Duplicate option --${key}`);
    }

    if (flagOptions.has(key)) {
      options[key] = true;
      continue;
    }

    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`Option --${key} requires a value`);
    }
    options[key] = next;
    index += 1;
  }

  return options;
}

export function requireText(options, key) {
  const value = options[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required option --${key}`);
  }
  return assertSingleLine(value.trim(), key);
}

export function assertSingleLine(value, label) {
  if (/[\r\n\u0000]/.test(value)) {
    throw new Error(`${label} must be a single line`);
  }
  return value;
}

export function yamlQuoted(value) {
  return JSON.stringify(value);
}

export function today() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseYear(value) {
  const year = value === undefined ? new Date().getFullYear() : Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error(`Invalid year: ${value}`);
  }
  return year;
}

export function slugify(value) {
  const slug = Array.from(
    value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-+|-+$/g, ""),
  )
    .slice(0, 48)
    .join("")
    .replace(/-+$/g, "");

  return slug || "item";
}

export function filesIn(directory, predicate = () => true) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => path.join(directory, entry.name));
}

export function walkFiles(directory, options = {}) {
  const skipDirectories = new Set(
    options.skipDirectories ?? [
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
    ],
  );
  const results = [];

  if (!fs.existsSync(directory)) {
    return results;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirectories.has(entry.name)) {
        results.push(...walkFiles(fullPath, options));
      }
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }

  return results;
}

export function nextId(prefix, year, directories) {
  const pattern = new RegExp(`^${prefix}-${year}-(\\d{3})(?:-|\\.)`);
  let maximum = 0;

  for (const directory of directories) {
    for (const file of filesIn(directory)) {
      const match = path.basename(file).match(pattern);
      if (match) {
        maximum = Math.max(maximum, Number(match[1]));
      }
    }
  }

  if (maximum >= 999) {
    throw new Error(`${prefix}-${year} has exhausted its three-digit ID range`);
  }
  return `${prefix}-${year}-${String(maximum + 1).padStart(3, "0")}`;
}

export function nextAdrNumber(directory) {
  let maximum = 0;
  for (const file of filesIn(directory)) {
    const match = path.basename(file).match(/^(\d{4})-/);
    if (match) {
      maximum = Math.max(maximum, Number(match[1]));
    }
  }
  if (maximum >= 9999) {
    throw new Error("ADR has exhausted its four-digit ID range");
  }
  return String(maximum + 1).padStart(4, "0");
}

export function readFrontmatter(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return null;
  }

  const fields = {};
  const lines = match[1].split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s/.test(line) || line.trim() === "" || line.trimStart().startsWith("#")) {
      continue;
    }
    const field = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*?)\s*$/);
    if (!field) {
      throw new Error(
        `${path.basename(file)} has invalid frontmatter on line ${index + 2}: ${line}`,
      );
    }
    if (Object.hasOwn(fields, field[1])) {
      throw new Error(`${path.basename(file)} has duplicate frontmatter field: ${field[1]}`);
    }

    let value = field[2];
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    fields[field[1]] = value;
  }

  return fields;
}

export function renderTemplate(templatePath, replacements) {
  let content = fs.readFileSync(templatePath, "utf8");
  for (const [key, value] of Object.entries(replacements)) {
    content = content.split(`{{${key}}}`).join(String(value));
  }

  const unresolved = content.match(/\{\{[A-Z][A-Z0-9_]*\}\}/g);
  if (unresolved) {
    throw new Error(`Unresolved template fields: ${[...new Set(unresolved)].join(", ")}`);
  }
  return content;
}

export function writeNewFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { encoding: "utf8", flag: "wx" });
}

export function atomicReplaceFile(file, content) {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, content, { encoding: "utf8", flag: "wx" });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) {
      fs.rmSync(temporary);
    }
  }
}

export function relativeToRoot(file) {
  return path.relative(repoRoot, file).split(path.sep).join("/");
}

export function findRecord(directory, id) {
  const matches = filesIn(directory, (name) => name.startsWith(`${id}-`) && name.endsWith(".md"));
  if (matches.length > 1) {
    throw new Error(`Multiple files found for ${id}`);
  }
  return matches[0] ?? null;
}

export function runCli(main) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}
