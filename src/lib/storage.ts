import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "./db";

export const UPLOAD_DIR = path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./uploads");
const MAX_BYTES = (Number(process.env.MAX_UPLOAD_MB) || 10) * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "application/pdf": ".pdf",
};

export class UploadError extends Error {}

/** Cheap content sniffing so a renamed file cannot masquerade as an image/PDF. */
function sniffOk(mime: string, buf: Buffer): boolean {
  const head = buf.subarray(0, 12);
  switch (mime) {
    case "application/pdf":
      return head.subarray(0, 4).toString("latin1") === "%PDF";
    case "image/jpeg":
      return head[0] === 0xff && head[1] === 0xd8;
    case "image/png":
      return head.subarray(1, 4).toString("latin1") === "PNG";
    case "image/webp":
      return head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP";
    case "image/heic":
      return head.subarray(4, 8).toString("latin1") === "ftyp";
    default:
      return false;
  }
}

/** Saves an uploaded File to disk and records it. Returns null if no file was provided. */
export async function saveUpload(file: File | null | undefined, uploadedBy: string) {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_BYTES) {
    throw new UploadError(`File is too large (max ${MAX_BYTES / 1024 / 1024} MB).`);
  }
  const mime = file.type;
  const ext = ALLOWED[mime];
  if (!ext) throw new UploadError("Only JPG, PNG, WebP, HEIC images and PDFs are allowed.");

  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffOk(mime, buf)) throw new UploadError("File content does not match its type.");

  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const rel = `${folder}/${randomUUID()}${ext}`;
  const abs = path.join(UPLOAD_DIR, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buf);

  return db.fileAsset.create({
    data: {
      path: rel,
      filename: file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || `upload${ext}`,
      mime,
      size: file.size,
      uploadedBy,
    },
  });
}

export async function readUpload(relPath: string) {
  const abs = path.resolve(UPLOAD_DIR, relPath);
  // Defense in depth against path traversal.
  if (!abs.startsWith(UPLOAD_DIR + path.sep)) throw new Error("Invalid path");
  return fs.readFile(/* turbopackIgnore: true */ abs);
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
