import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const distRoot = path.join(root, "dist");
const sourceForbidden = [
  /\bfetch\s*\(/,
  /\baxios\b/,
  /\/api\//,
  /\bopenai\b/i,
  /api[_-]?key/i,
  /https?:\/\//i,
];
const distForbidden = [
  /\/api\//,
  /\bopenai\b/i,
  /api[_-]?key/i,
  /https?:\/\/(?:api\.|.*openai|.*anthropic|.*googleapis)/i,
];

async function filesUnder(directory, predicate) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesUnder(fullPath, predicate)));
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

const sourceFiles = await filesUnder(
  sourceRoot,
  (file) =>
    /\.(ts|tsx)$/.test(file) &&
    !file.endsWith(".test.ts") &&
    !file.endsWith(".test.tsx") &&
    !file.includes(`${path.sep}test${path.sep}`),
);
let distFiles = [];
try {
  distFiles = await filesUnder(
    distRoot,
    (file) => /\.(html|js|css)$/.test(file),
  );
} catch {
  // dist is optional when checking source before a build.
}

const violations = [];
for (const file of sourceFiles) {
  const relative = path.relative(root, file);
  const content = await readFile(file, "utf8");
  for (const pattern of sourceForbidden) {
    if (pattern.test(content)) {
      violations.push(`${relative} matches ${pattern}`);
    }
  }
}
for (const file of distFiles) {
  const relative = path.relative(root, file);
  const content = await readFile(file, "utf8");
  for (const pattern of distForbidden) {
    if (pattern.test(content)) {
      violations.push(`${relative} matches ${pattern}`);
    }
  }
}

if (distFiles.length > 0) {
  const indexHtml = await readFile(path.join(distRoot, "index.html"), "utf8");
  if (/(?:src|href)="\/assets\//.test(indexHtml)) {
    violations.push("dist/index.html uses root-absolute /assets paths");
  }
  if (!/(?:src|href)="\.\/assets\//.test(indexHtml)) {
    violations.push("dist/index.html does not reference relative ./assets paths");
  }
}

if (violations.length > 0) {
  console.error("Static runtime check failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `Static runtime check passed (${sourceFiles.length} source files, ${distFiles.length} dist files).`,
);
