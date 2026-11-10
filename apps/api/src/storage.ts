import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Env } from './env';

export interface Storage {
  put(folder: string, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<{ url: string; kind: 'image' | 'video' }>;
}

const ALLOWED: Record<string, { ext: string; kind: 'image' | 'video'; maxMb: number }> = {
  'image/jpeg': { ext: 'jpg', kind: 'image', maxMb: 15 },
  'image/png': { ext: 'png', kind: 'image', maxMb: 15 },
  'image/webp': { ext: 'webp', kind: 'image', maxMb: 15 },
  'image/avif': { ext: 'avif', kind: 'image', maxMb: 15 },
  'video/mp4': { ext: 'mp4', kind: 'video', maxMb: 50 },
  'video/webm': { ext: 'webm', kind: 'video', maxMb: 50 },
};
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Checks the file's first bytes, so a renamed script can't pass as an image. */
export function sniffMime(buf: Buffer): string | null {
  const hex = buf.subarray(0, 12).toString('hex');
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('89504e470d0a1a0a')) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (hex.startsWith('1a45dfa3')) return 'video/webm';
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii');
    return brand.startsWith('avi') ? 'image/avif' : 'video/mp4';
  }
  return null;
}

export function validateUpload(file: { buffer: Buffer; mimetype: string; size: number }): { ok: true; mime: string } | { ok: false; error: string } {
  const sniffed = sniffMime(file.buffer);
  const rule = sniffed ? ALLOWED[sniffed] : undefined;
  if (!sniffed || !rule) return { ok: false, error: 'Upload a JPG, PNG, WebP or AVIF image, or an MP4 or WebM video' };
  if (file.size > rule.maxMb * 1024 * 1024) return { ok: false, error: `${rule.kind === 'image' ? 'Images' : 'Videos'} can be up to ${rule.maxMb} MB` };
  return { ok: true, mime: sniffed };
}

const safeFolder = (f: string) => (/^[a-z0-9-]{1,40}$/.test(f) ? f : 'misc');
const keyFor = (folder: string, mime: string) => `${safeFolder(folder)}/${new Date().getUTCFullYear()}/${randomUUID()}.${ALLOWED[mime].ext}`;

export function createStorage(env: Env): Storage {
  if (env.STORAGE_DRIVER === 'supabase') {
    const base = env.SUPABASE_URL!.replace(/\/$/, '');
    return {
      async put(folder, file) {
        const key = keyFor(folder, file.mimetype);
        const res = await fetch(`${base}/storage/v1/object/${env.SUPABASE_BUCKET}/${key}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
            'Content-Type': file.mimetype,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
          body: file.buffer,
        });
        if (!res.ok) throw new Error(`Supabase upload failed (${res.status})`);
        return { url: `${base}/storage/v1/object/public/${env.SUPABASE_BUCKET}/${key}`, kind: ALLOWED[file.mimetype].kind };
      },
    };
  }
  if (env.STORAGE_DRIVER === 'cloudinary') {
    return {
      async put(folder, file) {
        const kind = ALLOWED[file.mimetype].kind;
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const params: Record<string, string> = { folder: `joinziptrip/${safeFolder(folder)}`, timestamp };
        const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
        const signature = createHash('sha1').update(toSign + env.CLOUDINARY_API_SECRET).digest('hex');
        const form = new FormData();
        form.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
        Object.entries(params).forEach(([k, v]) => form.append(k, v));
        form.append('api_key', env.CLOUDINARY_API_KEY!);
        form.append('signature', signature);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${kind}/upload`, { method: 'POST', body: form });
        if (!res.ok) throw new Error(`Cloudinary upload failed (${res.status})`);
        const json = (await res.json()) as { secure_url: string };
        // f_auto,q_auto lets Cloudinary serve WebP/AVIF at a sensible quality to each browser.
        return { url: kind === 'image' ? json.secure_url.replace('/upload/', '/upload/f_auto,q_auto/') : json.secure_url, kind };
      },
    };
  }
  // Local disk: development only.
  return {
    async put(folder, file) {
      const key = keyFor(folder, file.mimetype);
      const full = path.resolve(env.LOCAL_UPLOAD_DIR, key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, file.buffer);
      return { url: `${env.PUBLIC_API_URL.replace(/\/$/, '')}/uploads/${key}`, kind: ALLOWED[file.mimetype].kind };
    },
  };
}
