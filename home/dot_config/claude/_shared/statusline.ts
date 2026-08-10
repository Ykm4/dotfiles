import { readFileSync, writeFileSync, statSync } from "fs";
import { createHash } from "crypto";

const data = await Bun.stdin.json();

const model = data.model?.display_name ?? "?";
const ctxPct = Math.floor(data.context_window?.used_percentage ?? 0);
const fiveHPct = data.rate_limits?.five_hour?.used_percentage != null
  ? Math.floor(data.rate_limits.five_hour.used_percentage)
  : null;
const fiveHReset = data.rate_limits?.five_hour?.resets_at ?? null;
const agentName = data.agent?.name ?? null;
const cwd = data.workspace?.current_dir ?? data.cwd ?? "";

const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";
const SEP = ` ${DIM}|${RST} `;

const colorFor = (pct: number): string => {
  if (pct >= 90) return RED;
  if (pct >= 70) return YELLOW;
  return GREEN;
};

const bar = (pct: number, width = 10): string => {
  const filled = Math.min(Math.floor((pct * width) / 100), width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
};

// colorFor + bar + percentage label
const gauge = (label: string, pct: number): string =>
  `${label} ${colorFor(pct)}${bar(pct)} ${pct}%${RST}`;

// Manual UTC+9 formatting (avoid slow toLocale* ICU calls)
const formatJST = (epochMs: number, includeDate = false): string => {
  const d = new Date(epochMs + 9 * 3600_000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  if (!includeDate) return `${hh}:${mm}`;
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}/${mo}/${dd} ${hh}:${mm}`;
};

// Git branch cached per-workspace for 5 seconds
const cwdHash = createHash("md5").update(cwd).digest("hex").slice(0, 8);
const GIT_CACHE_FILE = `/tmp/statusline-git-${cwdHash}`;
const GIT_CACHE_MAX_AGE = 5_000;

const gitBranch = (() => {
  try {
    const stat = statSync(GIT_CACHE_FILE);
    if (Date.now() - stat.mtimeMs < GIT_CACHE_MAX_AGE) {
      return readFileSync(GIT_CACHE_FILE, "utf-8").trim();
    }
  } catch {}

  try {
    const proc = Bun.spawnSync(["git", "branch", "--show-current"], {
      cwd,
      stderr: "ignore",
    });
    const branch = proc.stdout.toString().trim();
    Bun.write(GIT_CACHE_FILE, branch);
    return branch;
  } catch {
    return "";
  }
})();

const dir = cwd.split("/").pop() ?? "";

// --- Line 1: ⏰ datetime | 📁 directory | 🌿 branch | 🤖 agent | [model] ---
const branchPart = gitBranch ? `${SEP}🌿 ${gitBranch}` : "";
const agentPart = agentName ? `${SEP}🤖 ${agentName}` : "";
const line1 = `⏰ ${formatJST(Date.now(), true)}${SEP}📁 ${dir}${branchPart}${agentPart}${SEP}${CYAN}[${model}]${RST}`;

// --- Line 2: context window usage | 5-hour rate limit usage (reset time) ---
const resetPart = fiveHReset ? ` ${DIM}(reset ${formatJST(fiveHReset * 1000)})${RST}` : "";
const fiveHPart = fiveHPct != null ? `${SEP}${gauge("5h", fiveHPct)}${resetPart}` : "";
const line2 = `${gauge("ctx", ctxPct)}${fiveHPart}`;

console.log(line1);
console.log(line2);
