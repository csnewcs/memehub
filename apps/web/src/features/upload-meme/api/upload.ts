import axios, { type AxiosInstance } from 'axios';
import type { Meme } from '../../../entities/meme';

export type ImageInput = {
  file: File;
  title: string;
  source_url: string;
  source_name: string;
  source_author: string;
};
type Reservation = Meme & {
  upload: { url: string; method: 'PUT'; headers: Record<string, string>; expires_at: string };
};
export function validateImageFile(file: File) {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size === 0 ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error('Choose a JPEG, PNG, or WebP image up to 10 MB.');
}

export async function uploadImage(
  api: AxiosInstance,
  input: ImageInput,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
) {
  const { file, ...metadata } = input;
  validateImageFile(file);
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const sha256 = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const { data } = await api.post<Reservation>(
    'memes',
    {
      content_type: 'image',
      original_filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      sha256,
      ...metadata,
    },
    { signal },
  );
  const target = new URL(data.upload.url);
  if (!['https:', 'http:'].includes(target.protocol) || data.upload.method !== 'PUT')
    throw new Error('Invalid upload URL');
  // Use a separate client so service cookies and CSRF headers never reach storage.
  await axios.put(target.href, file, {
    headers: data.upload.headers,
    signal,
    withCredentials: false,
    onUploadProgress: (event) => {
      if (event.total) onProgress(Math.round((event.loaded * 100) / event.total));
    },
  });
  const completed = await api.post<Meme>(
    `memes/${encodeURIComponent(data.id)}/upload-completion`,
    undefined,
    { signal },
  );
  return completed.data;
}

export type TextInput = Omit<ImageInput, 'file'> & { body_text: string };
export async function createTextMeme(api: AxiosInstance, input: TextInput, signal?: AbortSignal) {
  if (!input.body_text.trim() || Array.from(input.body_text).length > 10_000) {
    throw new Error('Enter text up to 10,000 characters.');
  }
  const { data } = await api.post<Meme>('memes', { ...input, content_type: 'text' }, { signal });
  return data;
}
