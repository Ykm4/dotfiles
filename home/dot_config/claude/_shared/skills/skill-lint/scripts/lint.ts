import { parse as parseYaml } from "yaml";
import { basename, join } from "node:path";
import { readdir, stat, access, readFile } from "node:fs/promises";

// --- Types ---

type Severity = "error" | "warning";

interface RuleResult {
  id: string;
  severity: Severity;
  passed: boolean;
  message?: string;
}

interface LintContext {
  dir: string;
  dirName: string;
  skillMdExists: boolean;
  rawContent: string;
  frontmatter: Record<string, unknown> | null;
  frontmatterError: string | null;
  body: string;
  bodyLines: number;
  entries: string[];
}

interface LintResult {
  skill: string;
  path: string;
  results: RuleResult[];
  summary: { passed: number; warnings: number; errors: number };
}

// --- Constants ---

const ALLOWED_FRONTMATTER_KEYS = new Set([
  "name",
  "description",
  "license",
  "argument-hint",
  "allowed-tools",
  "disable-model-invocation",
  "metadata",
]);

const JUNK_FILES = new Set([
  "readme.md",
  "changelog.md",
  "installation_guide.md",
  "quick_reference.md",
]);

const ALLOWED_DIRS = new Set(["scripts", "references", "assets"]);

const RESERVED_WORDS = ["anthropic", "claude"];

const WHEN_KEYWORDS = [
  "when",
  "use for",
  "use this",
  "trigger",
  "使用",
  "トリガー",
  "呼び出",
  "利用",
  "で使う",
];

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// --- Context Builder ---

async function buildContext(dir: string): Promise<LintContext> {
  const dirName = basename(dir);
  const skillMdPath = join(dir, "SKILL.md");

  let skillMdExists = false;
  let rawContent = "";
  let frontmatter: Record<string, unknown> | null = null;
  let frontmatterError: string | null = null;
  let body = "";

  try {
    await access(skillMdPath);
    skillMdExists = true;
    rawContent = await readFile(skillMdPath, "utf-8");

    const match = rawContent.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (match) {
      try {
        const parsed = parseYaml(match[1]);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          frontmatter = parsed as Record<string, unknown>;
        } else {
          frontmatterError = "frontmatter が辞書型ではありません";
        }
      } catch (e) {
        frontmatterError = `YAML パースエラー: ${(e as Error).message}`;
      }
      body = match[2] || "";
    } else {
      frontmatterError = "--- で囲まれた YAML frontmatter が見つかりません";
    }
  } catch {
    // SKILL.md doesn't exist
  }

  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    // can't read dir
  }

  return {
    dir,
    dirName,
    skillMdExists,
    rawContent,
    frontmatter,
    frontmatterError,
    body,
    bodyLines: body ? body.split("\n").length : 0,
    entries,
  };
}

// --- Rules ---

function checkFrontmatterExists(ctx: LintContext): RuleResult {
  if (!ctx.skillMdExists) {
    return { id: "frontmatter/exists", severity: "error", passed: false, message: "SKILL.md が見つかりません" };
  }
  if (ctx.frontmatterError && ctx.frontmatterError.includes("見つかりません")) {
    return { id: "frontmatter/exists", severity: "error", passed: false, message: ctx.frontmatterError };
  }
  return { id: "frontmatter/exists", severity: "error", passed: true };
}

function checkFrontmatterValidYaml(ctx: LintContext): RuleResult {
  if (!ctx.skillMdExists) return { id: "frontmatter/valid-yaml", severity: "error", passed: false, message: "SKILL.md なし" };
  if (ctx.frontmatterError) {
    return { id: "frontmatter/valid-yaml", severity: "error", passed: false, message: ctx.frontmatterError };
  }
  if (!ctx.frontmatter) {
    return { id: "frontmatter/valid-yaml", severity: "error", passed: false, message: "frontmatter が空です" };
  }
  return { id: "frontmatter/valid-yaml", severity: "error", passed: true };
}

function checkRequiredFields(ctx: LintContext): RuleResult {
  if (!ctx.frontmatter) return { id: "frontmatter/required-fields", severity: "error", passed: false, message: "frontmatter なし" };

  const missing: string[] = [];
  for (const field of ["name", "description"]) {
    const val = ctx.frontmatter[field];
    if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    return { id: "frontmatter/required-fields", severity: "error", passed: false, message: `必須フィールドが不足: ${missing.join(", ")}` };
  }
  return { id: "frontmatter/required-fields", severity: "error", passed: true };
}

function checkNameFormat(ctx: LintContext): RuleResult {
  if (!ctx.frontmatter?.name) return { id: "name/format", severity: "error", passed: false, message: "name なし" };

  const name = String(ctx.frontmatter.name);
  if (name.length > 64) {
    return { id: "name/format", severity: "error", passed: false, message: `name が ${name.length}文字 (上限: 64文字)` };
  }
  if (!NAME_PATTERN.test(name)) {
    return { id: "name/format", severity: "error", passed: false, message: `name "${name}" は hyphen-case (a-z0-9, ハイフン区切り) でなければなりません` };
  }
  return { id: "name/format", severity: "error", passed: true };
}

function checkNameNoReserved(ctx: LintContext): RuleResult {
  if (!ctx.frontmatter?.name) return { id: "name/no-reserved", severity: "error", passed: false, message: "name なし" };

  const name = String(ctx.frontmatter.name).toLowerCase();
  for (const word of RESERVED_WORDS) {
    if (name.includes(word)) {
      return { id: "name/no-reserved", severity: "error", passed: false, message: `name に予約語 "${word}" が含まれています` };
    }
  }
  return { id: "name/no-reserved", severity: "error", passed: true };
}

function checkDescriptionLength(ctx: LintContext): RuleResult {
  if (!ctx.frontmatter?.description) return { id: "description/length", severity: "error", passed: false, message: "description なし" };

  const desc = String(ctx.frontmatter.description);
  if (desc.length > 1024) {
    return { id: "description/length", severity: "error", passed: false, message: `description が ${desc.length}文字 (上限: 1024文字)` };
  }
  if (desc.trim().length === 0) {
    return { id: "description/length", severity: "error", passed: false, message: "description が空です" };
  }
  return { id: "description/length", severity: "error", passed: true };
}

function checkDescriptionNoHtml(ctx: LintContext): RuleResult {
  if (!ctx.frontmatter?.description) return { id: "description/no-html", severity: "error", passed: false, message: "description なし" };

  const desc = String(ctx.frontmatter.description);
  if (/<|>/.test(desc)) {
    return { id: "description/no-html", severity: "error", passed: false, message: "description に < > が含まれています" };
  }
  return { id: "description/no-html", severity: "error", passed: true };
}

function checkAllowedKeys(ctx: LintContext): RuleResult {
  if (!ctx.frontmatter) return { id: "frontmatter/allowed-keys", severity: "warning", passed: true };

  const unknown = Object.keys(ctx.frontmatter).filter((k) => !ALLOWED_FRONTMATTER_KEYS.has(k));
  if (unknown.length > 0) {
    return { id: "frontmatter/allowed-keys", severity: "warning", passed: false, message: `不明なキー: ${unknown.join(", ")}` };
  }
  return { id: "frontmatter/allowed-keys", severity: "warning", passed: true };
}

function checkNameDirMatch(ctx: LintContext): RuleResult {
  if (!ctx.frontmatter?.name) return { id: "name/dir-match", severity: "warning", passed: true };

  const name = String(ctx.frontmatter.name);
  if (name !== ctx.dirName) {
    return { id: "name/dir-match", severity: "warning", passed: false, message: `ディレクトリ名 "${ctx.dirName}" と name "${name}" が不一致` };
  }
  return { id: "name/dir-match", severity: "warning", passed: true };
}

function checkBodyLineCount(ctx: LintContext): RuleResult {
  if (ctx.bodyLines > 500) {
    return { id: "body/line-count", severity: "warning", passed: false, message: `本文 ${ctx.bodyLines}行 (上限: 500行)` };
  }
  if (ctx.bodyLines > 400) {
    return { id: "body/line-count", severity: "warning", passed: false, message: `本文 ${ctx.bodyLines}行 (推奨: 400行以下)` };
  }
  return { id: "body/line-count", severity: "warning", passed: true, message: `${ctx.bodyLines}行` };
}

function checkNoJunkFiles(ctx: LintContext): RuleResult {
  const junk = ctx.entries.filter((e) => JUNK_FILES.has(e.toLowerCase()));
  if (junk.length > 0) {
    return { id: "structure/no-junk", severity: "warning", passed: false, message: `不要ファイル: ${junk.join(", ")}` };
  }
  return { id: "structure/no-junk", severity: "warning", passed: true };
}

async function checkAllowedDirs(ctx: LintContext): Promise<RuleResult> {
  const badDirs: string[] = [];
  for (const entry of ctx.entries) {
    if (entry.startsWith(".") || entry === "node_modules") continue;
    const entryPath = join(ctx.dir, entry);
    try {
      const s = await stat(entryPath);
      if (s.isDirectory() && !ALLOWED_DIRS.has(entry)) {
        badDirs.push(entry);
      }
    } catch {
      // skip
    }
  }
  if (badDirs.length > 0) {
    return { id: "structure/allowed-dirs", severity: "warning", passed: false, message: `非標準ディレクトリ: ${badDirs.join(", ")} (許可: scripts/, references/, assets/)` };
  }
  return { id: "structure/allowed-dirs", severity: "warning", passed: true };
}

async function checkReferencesDepth(ctx: LintContext): Promise<RuleResult> {
  const refsDir = join(ctx.dir, "references");
  try {
    await access(refsDir);
  } catch {
    return { id: "references/depth", severity: "warning", passed: true };
  }

  const refs = await readdir(refsDir);
  const nestedDirs: string[] = [];
  for (const entry of refs) {
    const entryPath = join(refsDir, entry);
    try {
      const s = await stat(entryPath);
      if (s.isDirectory()) {
        nestedDirs.push(entry);
      }
    } catch {
      // skip
    }
  }
  if (nestedDirs.length > 0) {
    return { id: "references/depth", severity: "warning", passed: false, message: `references/ 内にサブディレクトリ: ${nestedDirs.join(", ")} (1階層まで推奨)` };
  }
  return { id: "references/depth", severity: "warning", passed: true };
}

function checkDescriptionHasWhen(ctx: LintContext): RuleResult {
  if (!ctx.frontmatter?.description) return { id: "description/has-when", severity: "warning", passed: true };

  const desc = String(ctx.frontmatter.description).toLowerCase();
  const found = WHEN_KEYWORDS.some((kw) => desc.includes(kw.toLowerCase()));
  if (!found) {
    return { id: "description/has-when", severity: "warning", passed: false, message: "description に WHEN（いつ使うか）情報が見つかりません" };
  }
  return { id: "description/has-when", severity: "warning", passed: true };
}

// --- Runner ---

type Rule = (ctx: LintContext) => RuleResult | Promise<RuleResult>;

const rules: Rule[] = [
  checkFrontmatterExists,
  checkFrontmatterValidYaml,
  checkRequiredFields,
  checkNameFormat,
  checkNameNoReserved,
  checkDescriptionLength,
  checkDescriptionNoHtml,
  checkAllowedKeys,
  checkNameDirMatch,
  checkBodyLineCount,
  checkNoJunkFiles,
  checkAllowedDirs,
  checkReferencesDepth,
  checkDescriptionHasWhen,
];

async function lintSkill(dir: string): Promise<LintResult> {
  const ctx = await buildContext(dir);
  const results: RuleResult[] = [];
  for (const rule of rules) {
    results.push(await rule(ctx));
  }
  const summary = {
    passed: results.filter((r) => r.passed).length,
    warnings: results.filter((r) => !r.passed && r.severity === "warning").length,
    errors: results.filter((r) => !r.passed && r.severity === "error").length,
  };
  return { skill: ctx.dirName, path: dir, results, summary };
}

// --- Output ---

function printResult(result: LintResult): void {
  console.log(`\n── ${result.skill} ${"─".repeat(Math.max(0, 40 - result.skill.length))}`);

  for (const r of result.results) {
    if (r.passed) {
      const detail = r.message ? ` (${r.message})` : "";
      console.log(`  \x1b[32m✓\x1b[0m ${r.id}${detail}`);
    } else if (r.severity === "error") {
      console.log(`  \x1b[31m✗\x1b[0m ${r.id}: ${r.message}`);
    } else {
      console.log(`  \x1b[33m⚠\x1b[0m ${r.id}: ${r.message}`);
    }
  }

  const parts: string[] = [];
  parts.push(`${result.summary.passed} passed`);
  if (result.summary.warnings > 0) parts.push(`${result.summary.warnings} warnings`);
  if (result.summary.errors > 0) parts.push(`${result.summary.errors} errors`);
  console.log(`\n  ${parts.join(", ")}`);
}

function printJson(results: LintResult[]): void {
  console.log(JSON.stringify(results, null, 2));
}

// --- Main ---

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const dirs = args.filter((a) => a !== "--json");

  if (dirs.length === 0) {
    console.error("Usage: bun run lint.ts [--json] <skill-dir> [skill-dir...]");
    process.exit(1);
  }

  const results: LintResult[] = [];
  for (const dir of dirs) {
    results.push(await lintSkill(dir));
  }

  if (jsonMode) {
    printJson(results);
  } else {
    for (const result of results) {
      printResult(result);
    }

    // Summary
    const totalErrors = results.reduce((sum, r) => sum + r.summary.errors, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.summary.warnings, 0);
    if (results.length > 1) {
      console.log(`\n${"═".repeat(50)}`);
      console.log(`合計: ${results.length} skills, ${totalErrors} errors, ${totalWarnings} warnings`);
    }

    process.exit(totalErrors > 0 ? 1 : 0);
  }
}

main();
