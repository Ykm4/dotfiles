#!/usr/bin/env bun
// YouTube 動画やローカル動画を Gemini に映像込みで解析させる。
// 字幕では拾えない情報（スライドの図表・コード・デモの操作手順）を読ませるための入口である。
// YouTube URL は Gemini が YouTube 側から直接取得するので、ローカルへのダウンロードは要らない。
// 送信するのは公開 URL とプロンプトだけなので、プロンプトに社内固有の文脈を書かないこと。

import {
  GoogleGenAI,
  MediaResolution,
  createPartFromUri,
  type File as GenAiFile,
  type Part,
} from "@google/genai";
import { extname } from "node:path";

const DEFAULT_MODEL = "gemini-3.7-flash";

const DEFAULT_PROMPT = `この動画の内容を日本語で要約してください。次の4点を必ず含めること。
- 全体の要旨を3〜5文で述べる。
- 主要な論点を時系列の箇条書きにし、各項目の先頭に MM:SS のタイムスタンプを付ける。
- スライドや画面に図表・コード・数値が映る場合は、そこに書かれている内容を文章で説明する。
- 音声では語られない視覚情報（デモの操作手順、グラフの傾向、画面遷移）も拾う。
視覚情報が乏しい動画では、その旨を一言添えたうえで音声の内容だけを要約すること。`;

// 拡張子から MIME タイプを引く。Files API はアップロード時に MIME タイプを要求する。
const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/mov",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpg",
  ".avi": "video/avi",
  ".wmv": "video/wmv",
  ".flv": "video/x-flv",
  ".webm": "video/webm",
};

interface Options {
  target: string;
  prompt: string;
  fps: number | undefined;
  resolution: MediaResolution;
  model: string;
  vertex: boolean;
  json: boolean;
}

const USAGE = `使い方: video-summary <YouTube URL | 動画ファイル> [プロンプト] [オプション]

オプション:
  --fps <n>            映像のサンプリング間隔（既定は 1fps、範囲は 0 より大きく 24 以下）
                       スライド中心の動画は 0.2 程度で足りる
  --resolution <v>     low（既定・約100トークン/秒）または default（約300トークン/秒）
  --model <id>         既定は ${DEFAULT_MODEL}。無料枠は Flash 系のみ
  --vertex             Vertex AI（ADC 認証・GOOGLE_CLOUD_PROJECT 必須）へ切り替える
  --json               本文と消費トークンを JSON で出力する
  -h, --help           この使い方を表示する

例:
  video-summary 'https://www.youtube.com/watch?v=XXXX'
  video-summary 'https://youtu.be/XXXX' '登場する図表だけを列挙して' --fps 0.2`;

class UsageError extends Error {}

function parseArgs(argv: string[]): Options {
  let target = "";
  const promptParts: string[] = [];
  let fps: number | undefined;
  let resolutionInput = "low";
  let model = process.env["GEMINI_VIDEO_MODEL"] ?? DEFAULT_MODEL;
  let vertex = process.env["GOOGLE_GENAI_USE_VERTEXAI"] === "true";
  let json = false;

  const next = (i: number, flag: string): string => {
    const value = argv[i + 1];
    if (value === undefined) throw new UsageError(`${flag} に値が要る`);
    return value;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "--fps": {
        const raw = next(i, arg);
        fps = Number(raw);
        if (!Number.isFinite(fps) || fps <= 0 || fps > 24) {
          throw new UsageError(`--fps は 0 より大きく 24 以下の数値を指定する: ${raw}`);
        }
        i++;
        break;
      }
      case "--resolution":
        resolutionInput = next(i, arg);
        i++;
        break;
      case "--model":
        model = next(i, arg);
        i++;
        break;
      case "--vertex":
        vertex = true;
        break;
      case "--json":
        json = true;
        break;
      case "-h":
      case "--help":
        console.log(USAGE);
        process.exit(0);
      // eslint-disable-next-line no-fallthrough
      default:
        if (arg.startsWith("--")) throw new UsageError(`不明なオプション: ${arg}`);
        if (target === "") target = arg;
        else promptParts.push(arg);
    }
  }

  if (target === "") throw new UsageError(USAGE);

  const resolution =
    resolutionInput === "low"
      ? MediaResolution.MEDIA_RESOLUTION_LOW
      : resolutionInput === "default" || resolutionInput === "medium"
        ? MediaResolution.MEDIA_RESOLUTION_MEDIUM
        : undefined;
  if (resolution === undefined) {
    throw new UsageError(`--resolution は low か default を指定する: ${resolutionInput}`);
  }

  return {
    target,
    prompt: promptParts.length > 0 ? promptParts.join(" ") : DEFAULT_PROMPT,
    fps,
    resolution,
    model,
    vertex,
    json,
  };
}

function createClient(options: Options): GoogleGenAI {
  if (options.vertex) {
    const project = process.env["GOOGLE_CLOUD_PROJECT"];
    if (!project) throw new UsageError("--vertex には GOOGLE_CLOUD_PROJECT が要る");
    return new GoogleGenAI({
      vertexai: true,
      project,
      location: process.env["GOOGLE_CLOUD_LOCATION"] ?? "global",
    });
  }

  const apiKey = process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_API_KEY"];
  if (!apiKey) {
    throw new UsageError(
      [
        "GEMINI_API_KEY が設定されていない。",
        "",
        "無料枠のキーは https://aistudio.google.com/apikey で発行する。",
        "発行したキーは 1Password の hucomsystem Vault へ入れ、dotfiles の",
        "private_secrets.toml.tmpl から GEMINI_API_KEY_HUCOM_SYSTEM として供給する。",
        "Vertex AI を使う場合は --vertex を付けて GOOGLE_CLOUD_PROJECT を設定すること。",
      ].join("\n"),
    );
  }
  return new GoogleGenAI({ apiKey });
}

// アップロードした動画は処理が終わるまで PROCESSING のままで、そのままでは推論に使えない。
async function waitUntilActive(ai: GoogleGenAI, uploaded: GenAiFile): Promise<GenAiFile> {
  const name = uploaded.name;
  if (!name) throw new Error("アップロード結果にファイル名が無い");

  let file = uploaded;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (file.state === "ACTIVE") return file;
    if (file.state === "FAILED") throw new Error(`動画の処理に失敗した: ${file.error?.message ?? "理由不明"}`);
    await Bun.sleep(5000);
    file = await ai.files.get({ name });
  }
  throw new Error("動画の処理が5分以内に終わらなかった");
}

async function buildVideoPart(ai: GoogleGenAI, options: Options): Promise<Part> {
  let part: Part;

  if (/^https?:\/\//.test(options.target)) {
    // YouTube URL はアップロード不要で、Gemini が YouTube 側から直接取得する。
    part = { fileData: { fileUri: options.target, mimeType: "video/mp4" } };
  } else {
    const source = Bun.file(options.target);
    if (!(await source.exists())) throw new UsageError(`ファイルが見つからない: ${options.target}`);

    const mimeType = MIME_BY_EXT[extname(options.target).toLowerCase()];
    if (!mimeType) throw new UsageError(`対応していない動画形式である: ${options.target}`);

    console.error(`アップロード中: ${options.target}`);
    const uploaded = await ai.files.upload({ file: options.target, config: { mimeType } });
    const active = await waitUntilActive(ai, uploaded);
    if (!active.uri || !active.mimeType) throw new Error("アップロード結果に URI が無い");
    part = createPartFromUri(active.uri, active.mimeType);
  }

  if (options.fps !== undefined) part.videoMetadata = { fps: options.fps };
  return part;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const ai = createClient(options);
  const videoPart = await buildVideoPart(ai, options);

  const response = await ai.models.generateContent({
    model: options.model,
    contents: [{ role: "user", parts: [videoPart, { text: options.prompt }] }],
    config: { mediaResolution: options.resolution },
  });

  const text = response.text;
  if (!text) {
    const reason = response.candidates?.[0]?.finishReason ?? "理由不明";
    throw new Error(`本文が空だった。安全フィルタで止まった可能性がある（finishReason: ${reason}）`);
  }

  const usage = response.usageMetadata;
  if (options.json) {
    console.log(
      JSON.stringify(
        {
          text,
          model: options.model,
          usage: {
            input: usage?.promptTokenCount ?? 0,
            output: usage?.candidatesTokenCount ?? 0,
            total: usage?.totalTokenCount ?? 0,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(text);
  console.error(
    `\n--- 消費トークン: 入力 ${usage?.promptTokenCount ?? 0} / 出力 ${usage?.candidatesTokenCount ?? 0} / 合計 ${usage?.totalTokenCount ?? 0} ---`,
  );
}

// SDK は API のエラー応答を JSON 文字列のまま Error.message に入れる。そのままでは読みにくいので整形する。
function formatError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  try {
    const parsed = JSON.parse(error.message) as {
      error?: { code?: number; message?: string; status?: string };
    };
    const detail = parsed.error;
    if (detail?.message) {
      const label = detail.status ?? String(detail.code ?? "不明");
      const hint =
        detail.code === 503
          ? "\nモデルが混雑している。時間をおくか --model で別の Flash を指定する。"
          : detail.code === 429
            ? "\n無料枠の上限に達した。1日20本を使い切ったか、長い動画で TPM 25万を超えた可能性がある。"
            : "";
      return `API エラー (${label}): ${detail.message}${hint}`;
    }
  } catch {
    // JSON でなければ素のメッセージとして扱う。
  }
  return error.message;
}

try {
  await main();
} catch (error) {
  if (error instanceof UsageError) {
    console.error(error.message);
    process.exit(2);
  }
  console.error(formatError(error));
  process.exit(1);
}
