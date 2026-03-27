import { spawn } from "child_process";
import { createRequire } from "node:module";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

const require = createRequire(import.meta.url);

/** В production-образе (Docker) ставим системный ffmpeg; локально — fallback на ffmpeg-static */
const SYSTEM_FFMPEG = "/usr/bin/ffmpeg";
const SYSTEM_FFPROBE = "/usr/bin/ffprobe";

/** OpenAI / OpenRouter лимит на один запрос */
export const CLOUD_TRANSCRIPTION_MAX_BYTES = 25 * 1024 * 1024;

/** Длительность сегмента по умолчанию (~7.5 МБ при 128 kbps mono) */
const CHUNK_SECONDS_DEFAULT = 8 * 60;

function resolveFfmpegPath(): string {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  if (existsSync(SYSTEM_FFMPEG)) return SYSTEM_FFMPEG;
  try {
    const p = require("ffmpeg-static") as string | undefined;
    if (typeof p === "string" && p && existsSync(p)) return p;
  } catch {
    /* optional */
  }
  throw new Error(
    "Не найден ffmpeg. В Docker установите пакет ffmpeg (см. Dockerfile); локально: npm install ffmpeg-static или задайте FFMPEG_PATH.",
  );
}

function resolveFfprobePath(): string {
  const fromEnv = process.env.FFPROBE_PATH?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  if (existsSync(SYSTEM_FFPROBE)) return SYSTEM_FFPROBE;
  try {
    const mod = require("ffprobe-static") as { path?: string };
    const p = mod?.path;
    if (typeof p === "string" && p && existsSync(p)) return p;
  } catch {
    /* optional */
  }
  throw new Error(
    "Не найден ffprobe. В Docker: пакет ffmpeg; локально: ffprobe-static или задайте FFPROBE_PATH.",
  );
}

function getFfmpegBin(): string {
  return resolveFfmpegPath();
}

function getFfprobeBin(): string {
  return resolveFfprobePath();
}

function runProcessStdout(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout?.on("data", (d: Buffer) => {
      out += d.toString();
    });
    p.stderr?.on("data", (d: Buffer) => {
      err += d.toString();
    });
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`${cmd} exited ${code}: ${err || out}`));
    });
  });
}

export async function getMediaDurationSeconds(filePath: string): Promise<number> {
  const out = await runProcessStdout(getFfprobeBin(), [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const sec = parseFloat(out);
  if (!Number.isFinite(sec) || sec < 0) throw new Error("Не удалось определить длительность медиа");
  return sec;
}

async function runFfmpeg(args: string[]): Promise<void> {
  const bin = getFfmpegBin();
  await new Promise<void>((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr?.on("data", (d: Buffer) => {
      err += d.toString();
    });
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed: ${err.slice(-2000)}`));
    });
  });
}

/** Из видео — только аудио MP3 mono 128k 16 kHz */
export async function extractAudioFromVideoToMp3(inputPath: string, outputMp3Path: string): Promise<void> {
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-acodec",
    "libmp3lame",
    "-b:a",
    "128k",
    "-ar",
    "16000",
    "-ac",
    "1",
    outputMp3Path,
  ]);
}

/** Любой поддерживаемый звук → нормализованный MP3 */
export async function normalizeAudioToMp3(inputPath: string, outputMp3Path: string): Promise<void> {
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-acodec",
    "libmp3lame",
    "-b:a",
    "128k",
    "-ar",
    "16000",
    "-ac",
    "1",
    outputMp3Path,
  ]);
}

/**
 * Режет один MP3 на сегменты по chunkSeconds (копирование потока где возможно).
 */
export async function splitMp3IntoChunkFiles(
  inputMp3Path: string,
  workDir: string,
  durationSec: number,
  chunkSeconds: number,
): Promise<string[]> {
  const paths: string[] = [];
  let start = 0;
  let index = 0;
  while (start < durationSec - 0.05) {
    const len = Math.min(chunkSeconds, durationSec - start);
    const outPath = path.join(workDir, `chunk_${String(index).padStart(4, "0")}.mp3`);
    await runFfmpeg([
      "-y",
      "-ss",
      String(start),
      "-i",
      inputMp3Path,
      "-t",
      String(len),
      "-acodec",
      "copy",
      outPath,
    ]);
    paths.push(outPath);
    start += chunkSeconds;
    index += 1;
  }
  return paths;
}

export interface PreparedCloudAudio {
  chunks: Buffer[];
  /** Временная директория — удалить после транскрибации */
  workDir: string;
  durationSeconds: number;
  chunkCount: number;
}

function extForMime(mimeType: string, filename: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes("mp4") || m.includes("m4a")) return ".m4a";
  if (m.includes("mpeg") || m.includes("mp3")) return ".mp3";
  if (m.includes("wav")) return ".wav";
  if (m.includes("ogg")) return ".ogg";
  if (m.includes("flac")) return ".flac";
  const fromName = path.extname(filename);
  return fromName || ".bin";
}

/**
 * Видео → извлечение аудио; затем нормализация при необходимости; нарезка если > лимита размера.
 */
export async function prepareAudioBuffersForCloudTranscription(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  isVideo: boolean,
): Promise<PreparedCloudAudio> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `tx-${randomUUID()}-`));
  try {
    const ext = extForMime(mimeType, filename);
    const inputPath = path.join(workDir, `input${ext}`);
    await fs.writeFile(inputPath, buffer);

    let audioMp3Path: string;

    if (isVideo) {
      audioMp3Path = path.join(workDir, "extracted.mp3");
      await extractAudioFromVideoToMp3(inputPath, audioMp3Path);
    } else if (
      mimeType === "audio/mpeg" ||
      mimeType === "audio/mp3" ||
      filename.toLowerCase().endsWith(".mp3")
    ) {
      audioMp3Path = path.join(workDir, "normalized.mp3");
      await normalizeAudioToMp3(inputPath, audioMp3Path);
    } else {
      audioMp3Path = path.join(workDir, "normalized.mp3");
      await normalizeAudioToMp3(inputPath, audioMp3Path);
    }

    const durationSeconds = await getMediaDurationSeconds(audioMp3Path);
    const mp3Buf = await fs.readFile(audioMp3Path);

    if (mp3Buf.length <= CLOUD_TRANSCRIPTION_MAX_BYTES) {
      return {
        chunks: [mp3Buf],
        workDir,
        durationSeconds,
        chunkCount: 1,
      };
    }

    let chunkSeconds = CHUNK_SECONDS_DEFAULT;
    while (chunkSeconds >= 60) {
      const estChunks = Math.max(1, Math.ceil(durationSeconds / chunkSeconds));
      const approxBytesPerChunk = mp3Buf.length / estChunks;
      if (approxBytesPerChunk <= CLOUD_TRANSCRIPTION_MAX_BYTES * 0.95) {
        break;
      }
      chunkSeconds = Math.floor(chunkSeconds / 2);
    }

    const chunkFiles = await splitMp3IntoChunkFiles(
      audioMp3Path,
      workDir,
      durationSeconds,
      chunkSeconds,
    );
    const chunks: Buffer[] = [];
    for (const p of chunkFiles) {
      const b = await fs.readFile(p);
      if (b.length > CLOUD_TRANSCRIPTION_MAX_BYTES) {
        throw new Error(
          `Сегмент транскрибации всё ещё слишком большой (${(b.length / 1024 / 1024).toFixed(1)} МБ). Попробуйте более короткий файл.`,
        );
      }
      chunks.push(b);
    }

    return {
      chunks,
      workDir,
      durationSeconds,
      chunkCount: chunks.length,
    };
  } catch (e) {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
}

export async function cleanupTranscriptionWorkDir(workDir: string): Promise<void> {
  await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
}
