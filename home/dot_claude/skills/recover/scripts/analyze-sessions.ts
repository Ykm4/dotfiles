#!/usr/bin/env bun
/**
 * セッション JSONL からエラーを検出し、関連するスキル情報とともに出力する。
 *
 * Usage:
 *   bun run analyze-sessions.ts [--minutes N] [--session-id CURRENT_ID]
 *
 * Output (JSON):
 *   {
 *     "errors": [...],
 *     "affected_skills": ["keiba-prediction"],
 *     "session_count": 3
 *   }
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";
import { parseArgs } from "util";

interface SessionError {
  session_id: string;
  timestamp: string;
  error_type: "exit_code" | "command_not_found" | "runtime_error";
  message: string;
  context: string;
  related_skill: string | null;
  related_files: string[];
}

interface SessionLine {
  type?: string;
  timestamp?: string;
  message?: {
    role?: string;
    content?: string | ContentItem[];
  };
}

interface ContentItem {
  text?: string;
  content?: string;
  result?: unknown;
}

// --- CLI引数パース ---

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    minutes: { type: "string", default: "120" },
    "session-id": { type: "string" },
  },
});

const MINUTES = parseInt(values.minutes ?? "120", 10);
const EXCLUDE_ID = values["session-id"];

// --- ユーティリティ ---

function findProjectDirs(): string[] {
  const base = join(homedir(), ".claude", "projects");
  try {
    return readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(base, d.name));
  } catch {
    return [];
  }
}

function findRecentSessions(projectDir: string): string[] {
  const cutoff = Date.now() - MINUTES * 60 * 1000;
  try {
    return readdirSync(projectDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => join(projectDir, f))
      .filter((f) => {
        const sid = basename(f, ".jsonl");
        if (EXCLUDE_ID && sid === EXCLUDE_ID) return false;
        return statSync(f).mtimeMs > cutoff;
      })
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  } catch {
    return [];
  }
}

// --- 検出ロジック ---

function detectSkillFromText(text: string): string | null {
  const m = text.match(/\.claude\/skills\/([a-z0-9][\w-]*)\//);
  if (m) {
    const name = m[1];
    if (name.includes("{") || name.includes("}") || name.includes("*"))
      return null;
    return name;
  }
  return null;
}

function detectRelatedFiles(text: string, skillName: string | null): string[] {
  const files = new Set<string>();
  if (skillName) {
    const re = new RegExp(
      `\\.claude/skills/${skillName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/([^\\s:]+)`,
      "g"
    );
    for (const m of text.matchAll(re)) {
      files.add(m[1]);
    }
  }
  for (const m of text.matchAll(/scripts\/([^\s:]+\.(?:sh|py|ts))/g)) {
    files.add(`scripts/${m[1]}`);
  }
  return [...files];
}

function detectError(
  text: string,
  role: string
): { type: SessionError["error_type"]; message: string } | null {
  if (!text) return null;

  // Read ツール出力（行番号付き）は除外
  if (/^\s*\d+→/.test(text)) return null;

  // Exit code エラー
  const exitMatch = text.trim().match(/^Exit code (\d+)/);
  if (exitMatch && exitMatch[1] !== "0") {
    return { type: "exit_code", message: text.slice(0, 200).trim() };
  }

  // command not found
  const notFoundPatterns = [
    /command not found:\s*\S+/i,
    /exec:\s*\S+:\s*not found/i,
    /no such file or directory,?\s*\S+/i,
    /\S+ not found$/im,
  ];
  for (const pattern of notFoundPatterns) {
    if (pattern.test(text) && text.length <= 500) {
      if (["user", "tool_result", ""].includes(role)) {
        return { type: "command_not_found", message: text.slice(0, 200).trim() };
      }
    }
  }

  // Traceback
  if (text.includes("Traceback (most recent call last)")) {
    return { type: "runtime_error", message: text.slice(0, 300).trim() };
  }

  // 明示的 ERROR:
  if (/^ERROR:/m.test(text) && text.length < 500) {
    return { type: "runtime_error", message: text.slice(0, 200).trim() };
  }

  return null;
}

// --- セッション解析 ---

function analyzeSession(filepath: string): SessionError[] {
  const errors: SessionError[] = [];
  const sessionId = basename(filepath, ".jsonl");

  let lines: SessionLine[];
  try {
    lines = readFileSync(filepath, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((l): l is SessionLine => l !== null);
  } catch {
    return errors;
  }

  for (let i = 0; i < lines.length; i++) {
    const obj = lines[i];
    const msg = obj.message ?? {};
    const content = msg.content ?? "";
    const role = msg.role ?? "";
    const typ = obj.type ?? "";
    const timestamp = obj.timestamp ?? "";

    // content からテキストを抽出
    const texts: string[] = [];
    if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === "object" && item !== null) {
          const t =
            (item as ContentItem).text ??
            (item as ContentItem).content ??
            ((item as ContentItem).result != null
              ? String((item as ContentItem).result)
              : "");
          if (typeof t === "string") texts.push(t);
        }
      }
    } else if (typeof content === "string") {
      texts.push(content);
    }

    for (const text of texts) {
      if (typeof text !== "string") continue;

      const errorInfo = detectError(text, role || typ);
      if (!errorInfo) continue;

      let skill = detectSkillFromText(text);

      // 前後のコンテキストからスキルを探す
      if (!skill) {
        for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + 2); j++) {
          const ctxContent = lines[j]?.message?.content ?? "";
          if (typeof ctxContent === "string") {
            skill = detectSkillFromText(ctxContent);
            if (skill) break;
          } else if (Array.isArray(ctxContent)) {
            for (const item of ctxContent) {
              if (typeof item === "object" && item !== null) {
                const ctxText =
                  (item as ContentItem).text ??
                  (item as ContentItem).content ??
                  "";
                if (typeof ctxText === "string") {
                  skill = detectSkillFromText(ctxText);
                  if (skill) break;
                }
              }
            }
            if (skill) break;
          }
        }
      }

      errors.push({
        session_id: sessionId,
        timestamp,
        error_type: errorInfo.type,
        message: errorInfo.message.slice(0, 500),
        context: text.slice(0, 300),
        related_skill: skill,
        related_files: detectRelatedFiles(text, skill),
      });
    }
  }

  return errors;
}

// --- メイン ---

const allErrors: SessionError[] = [];
let sessionCount = 0;

for (const projectDir of findProjectDirs()) {
  const sessions = findRecentSessions(projectDir);
  sessionCount += sessions.length;
  for (const sessionFile of sessions) {
    allErrors.push(...analyzeSession(sessionFile));
  }
}

const affectedSkills = [
  ...new Set(allErrors.filter((e) => e.related_skill).map((e) => e.related_skill!)),
];

console.log(
  JSON.stringify(
    { errors: allErrors, affected_skills: affectedSkills, session_count: sessionCount },
    null,
    2
  )
);
