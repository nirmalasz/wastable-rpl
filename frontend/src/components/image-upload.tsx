'use client';

import { useId, useRef, useState } from 'react';
import { useAuth } from '@/features/auth';
import { uploadImage } from '@/lib/api-client';
import { prepareImage } from '@/lib/image';
import { Button } from './ui';

interface Props {
  /** Current photo URL, or null. */
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  /** "round" is for profile pictures, "wide" for listing photos. */
  shape?: 'round' | 'wide';
}

/**
 * Photo picker with two entry points: choose from the gallery / files, or take a photo with
 * the device camera (phones open the camera; desktops fall back to a file dialog).
 */
export function ImageUpload({ value, onChange, label = 'Photo', shape = 'wide' }: Props) {
  const { token } = useAuth();
  const galleryId = useId();
  const cameraId = useId();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function handle(file: File | undefined) {
    if (!file || !token) return;
    setBusy(true);
    setError(undefined);
    try {
      const ready = await prepareImage(file);
      onChange(await uploadImage(ready, token));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (galleryRef.current) galleryRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  }

  const frame =
    shape === 'round' ? 'h-24 w-24 rounded-full' : 'aspect-video w-full max-w-sm rounded-lg';

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium">{label}</span>
      <div
        className={`${frame} flex items-center justify-center overflow-hidden border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="px-2 text-center">{busy ? 'Uploading…' : 'No photo yet'}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={galleryRef}
          id={galleryId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => handle(e.target.files?.[0])}
        />
        <input
          ref={cameraRef}
          id={cameraId}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => handle(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
        >
          Choose from gallery
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          Take a photo
        </Button>
        {value && (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => onChange(null)}>
            Remove
          </Button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        JPG, PNG or WebP. Large photos are shrunk automatically.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
