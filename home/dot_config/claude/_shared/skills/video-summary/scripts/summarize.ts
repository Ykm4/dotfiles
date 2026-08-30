#!/usr/bin/env bun
// YouTube 動画やローカル動画を Gemini に映像込みで解析させる。
// 字幕では拾えない情報（スライドの図表・コード・デモの操作手順）を読ませるための入口である。
// YouTube URL は Gemini が YouTube 側から直接取得するので、ローカルへのダウンロードは不要である。
// 送信するのは公開 URL とプロンプトだけなので、プロンプトに社内固有の文脈を書かないこと。

import {
  ApiError,
  GoogleGenAI,
  MediaResolution,
  createPartFromUri,
  createUserContent,
  type File as GenAiFile,
  type ModalityTokenCount,
  type Part,
} from "@google/genai";
import { constants as fsConstants } from "node:fs";
import { access, stat } from "node:fs/promises";

const DEFAULT_MODEL = "gemini-3.7-flash";

// アップロードした動画が処理を終えるまで待つ間隔と回数。API の応答時間は含まない。
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 60;
const CLEANUP_TIMEOUT_MS = 10_000;
const GENERATE_TIMEOUT_MINUTES = 15;
const GENERATE_TIMEOUT_MS = GENERATE_TIMEOUT_MINUTES * 60_000;

const GENERATE_TIMEOUT_MESSAGE =
  `動画の解析結果が${GENERATE_TIMEOUT_MINUTES}分以内に返らなかった。` +
  "動画が長いか、モデルが混雑している可能性がある。" +
  "--fps を下げるか、時間をおいて再実行する。";

const RESOLUTIONS: Record<string, MediaResolution> = {
  low: MediaResolution.MEDIA_RESOLUTION_LOW,
  high: MediaResolution.MEDIA_RESOLUTION_HIGH,
};

const ERROR_HINTS: Record<number, string> = {
  408: `\n${GENERATE_TIMEOUT_MESSAGE}`,
  429: "\n利用上限に達した。無料枠では1日20回を使い切ったか、長い動画で TPM 25万を超えた可能性がある。",
  503: "\nモデルが混雑している。時間をおくか --model で別の Flash を指定する。",
  504: `\n${GENERATE_TIMEOUT_MESSAGE}`,
};

const DEFAULT_PROMPT = `この動画の内容を日本語で要約してください。次の4点を必ず含めること。
- 全体の要旨を3〜5文で述べる。
- 主要な論点を時系列の箇条書きにし、各項目の先頭に MM:SS（1時間以上は HH:MM:SS）のタイムスタンプを付ける。
- スライドや画面に図表・コード・数値が映る場合は、そこに書かれている内容を文章で説明する。
- 音声では語られない視覚情報（デモの操作手順、グラフの傾向、画面遷移）も拾う。
視覚情報が乏しい動画では、その旨を一言添えたうえで音声の内容だけを要約すること。`;

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
  --fps <n>            映像のサンプリング頻度（既定は毎秒1コマ、範囲は 0 より大きく 24 以下）
                       スライド中心の動画は 0.2 程度で足りる
  --resolution <v>     low（既定）または high
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
  let model = process.env["GEMINI_VIDEO_MODEL"] || DEFAULT_MODEL;
  let vertex = process.env["GOOGLE_GENAI_USE_VERTEXAI"] === "true";
  let json = false;

  const next = (i: number, flag: string): string => {
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("-")) {
      throw new UsageError(`${flag} には値が必要である`);
    }
    return value;
  };

  const addPositional = (value: string): void => {
    if (target === "") target = value;
    else promptParts.push(value);
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
      case "--":
        for (const value of argv.slice(i + 1)) addPositional(value);
        i = argv.length;
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
      default:
        if (arg.startsWith("-")) throw new UsageError(`不明なオプション: ${arg}`);
        addPositional(arg);
    }
  }

  if (target === "") throw new UsageError(USAGE);
  if (model.trim() === "") throw new UsageError("--model には空でないモデル ID を指定する");

  const resolution = RESOLUTIONS[resolutionInput];
  if (resolution === undefined) {
    throw new UsageError(`--resolution は low か high を指定する: ${resolutionInput}`);
  }

  return {
    target,
    prompt: promptParts.join(" ").trim() || DEFAULT_PROMPT,
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
    if (!project) throw new UsageError("--vertex には GOOGLE_CLOUD_PROJECT が必要である");
    return new GoogleGenAI({
      vertexai: true,
      project,
      location: process.env["GOOGLE_CLOUD_LOCATION"] ?? "global",
    });
  }

  // mise がプロファイル単位で GEMINI_API_KEY を供給する。
  // SDK が環境から拾うときは GOOGLE_API_KEY を優先するため、取り違えを避けてここで明示的に渡す。
  const apiKey = process.env["GEMINI_API_KEY"];
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
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    if (file.state === "ACTIVE") return file;
    if (file.state === "FAILED") {
      throw new Error(`動画の処理に失敗した: ${file.error?.message ?? "理由不明"}`);
    }
    await Bun.sleep(POLL_INTERVAL_MS);
    file = await ai.files.get({ name });
  }
  if (file.state === "ACTIVE") return file;
  if (file.state === "FAILED") {
    throw new Error(`動画の処理に失敗した: ${file.error?.message ?? "理由不明"}`);
  }
  const limitMinutes = (POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS) / 60_000;
  throw new Error(`動画の処理が約${limitMinutes}分待っても終わらなかった`);
}

interface VideoInput {
  part: Part;
  uploadedFileName?: string;
}

type VideoSource = { kind: "youtube" } | { kind: "local"; mimeType: string };

function isYouTubeUrl(target: string): boolean {
  if (!/^https?:/i.test(target)) return false;

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    throw new UsageError(`URL の形式が正しくない: ${target}`);
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname !== "youtu.be" && hostname !== "youtube.com" && !hostname.endsWith(".youtube.com")) {
    throw new UsageError(`YouTube 以外の URL は扱えない: ${target}`);
  }
  return true;
}

async function inspectLocalVideo(path: string): Promise<string> {
  try {
    const fileInfo = await stat(path);
    if (!fileInfo.isFile()) throw new UsageError(`通常のファイルではない: ${path}`);
    if (fileInfo.size === 0) throw new UsageError(`ファイルが空である: ${path}`);
    await access(path, fsConstants.R_OK);
  } catch (error) {
    if (error instanceof UsageError) throw error;
    throw new UsageError(`ファイルを読み取れない: ${path}（${formatError(error)}）`);
  }

  // MIME タイプの判定は Bun のテーブル（mime-db 準拠）に任せる。SDK 内蔵の推定より網羅的である。
  const mimeType = Bun.file(path).type.split(";")[0] ?? "";
  if (!mimeType.startsWith("video/")) {
    throw new UsageError(`動画として扱えない形式である（${mimeType || "判定不能"}）: ${path}`);
  }
  return mimeType;
}

async function inspectVideoSource(options: Options): Promise<VideoSource> {
  if (isYouTubeUrl(options.target)) return { kind: "youtube" };
  if (options.vertex) {
    throw new UsageError("Vertex AI ではローカルファイルを直接アップロードできない。YouTube URL を指定する");
  }
  return { kind: "local", mimeType: await inspectLocalVideo(options.target) };
}

async function deleteUploadedFile(ai: GoogleGenAI, name: string): Promise<void> {
  try {
    await ai.files.delete({
      name,
      config: {
        httpOptions: {
          timeout: CLEANUP_TIMEOUT_MS,
          retryOptions: { attempts: 1 },
        },
      },
    });
  } catch (error) {
    console.error(`警告: アップロード済みファイルを削除できなかった: ${formatError(error)}`);
  }
}

async function uploadLocalVideo(
  ai: GoogleGenAI,
  path: string,
  mimeType: string,
): Promise<VideoInput> {
  console.error(`アップロード中: ${path}`);
  const uploaded = await ai.files.upload({ file: path, config: { mimeType } });
  const uploadedFileName = uploaded.name;
  if (!uploadedFileName) throw new Error("アップロード結果にファイル名が無い");

  try {
    const active = await waitUntilActive(ai, uploaded);
    if (!active.uri || !active.mimeType) throw new Error("アップロード結果に URI が無い");
    return { part: createPartFromUri(active.uri, active.mimeType), uploadedFileName };
  } catch (error) {
    await deleteUploadedFile(ai, uploadedFileName);
    throw error;
  }
}

async function buildVideoPart(
  ai: GoogleGenAI,
  options: Options,
  source: VideoSource,
): Promise<VideoInput> {
  const input: VideoInput =
    source.kind === "youtube"
      ? // YouTube URL はアップロード不要で、Gemini が YouTube 側から直接取得する。
        { part: createPartFromUri(options.target, "video/mp4") }
      : await uploadLocalVideo(ai, options.target, source.mimeType);

  if (options.fps !== undefined) input.part.videoMetadata = { fps: options.fps };
  return input;
}

function summarizeTokenDetails(details: ModalityTokenCount[] | undefined) {
  return (details ?? []).map((detail) => ({
    modality: detail.modality ?? null,
    tokenCount: detail.tokenCount ?? null,
  }));
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const source = await inspectVideoSource(options);
  const ai = createClient(options);
  const { part: videoPart, uploadedFileName } = await buildVideoPart(ai, options, source);

  let response;
  try {
    // 長い動画は解析に5分を超えることがあるため、生成要求の待ち時間を15分へ延ばす。
    // 503は失敗してもRPDを消費し得るため、自動再試行せず利用者に判断を委ねる。
    response = await ai.models.generateContent({
      model: options.model,
      contents: createUserContent([videoPart, options.prompt]),
      config: {
        mediaResolution: options.resolution,
        httpOptions: { timeout: GENERATE_TIMEOUT_MS },
      },
    });
  } finally {
    if (uploadedFileName) await deleteUploadedFile(ai, uploadedFileName);
  }

  const text = response.text;
  if (!text) {
    const candidate = response.candidates?.[0];
    const reason =
      candidate?.finishMessage ??
      candidate?.finishReason ??
      response.promptFeedback?.blockReasonMessage ??
      response.promptFeedback?.blockReason ??
      "理由不明";
    throw new Error(`本文が空だった。安全フィルタなどで止まった可能性がある（理由: ${reason}）`);
  }

  const usage = response.usageMetadata;
  const tokens = {
    input: usage?.promptTokenCount ?? 0,
    output: usage?.candidatesTokenCount ?? 0,
    thoughtsTokenCount: usage?.thoughtsTokenCount ?? 0,
    total: usage?.totalTokenCount ?? 0,
    promptTokensDetails: summarizeTokenDetails(usage?.promptTokensDetails),
    candidatesTokensDetails: summarizeTokenDetails(usage?.candidatesTokensDetails),
  };

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          text,
          model: options.model,
          modelVersion: response.modelVersion ?? null,
          usage: tokens,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(text);
  console.error(
    `\n--- 消費トークン: 入力 ${tokens.input} / 出力 ${tokens.output} / 思考 ${tokens.thoughtsTokenCount} / 合計 ${tokens.total} ---`,
  );
}

// SDK は API のエラー応答を JSON 文字列のまま ApiError.message に入れる。
// 本文の取り出しはその形に依存するが、分岐に使う HTTP ステータスは型付きの status から読む。
function extractApiMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    return parsed.error?.message ?? raw;
  } catch {
    return raw;
  }
}

function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    return `API エラー (${error.status}): ${extractApiMessage(error.message)}${ERROR_HINTS[error.status] ?? ""}`;
  }
  if (isTimeoutError(error)) return GENERATE_TIMEOUT_MESSAGE;
  return error instanceof Error ? error.message : String(error);
}

function isTimeoutError(error: unknown): boolean {
  let current = error;
  while (current instanceof Error) {
    const code = (current as Error & { code?: unknown }).code;
    if (
      current.name === "TimeoutError" ||
      current.name === "AbortError" ||
      code === "ETIMEDOUT" ||
      code === "UND_ERR_HEADERS_TIMEOUT" ||
      code === "UND_ERR_BODY_TIMEOUT" ||
      /timed out|timeout/i.test(current.message)
    ) {
      return true;
    }
    current = current.cause;
  }
  return false;
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
