/**
 * Client-side image downscaling for form uploads.
 *
 * Forms take photos straight from a phone camera (`capture="environment"`), and
 * those files are 3-8MB each. Several inputs are `multiple`. Posting them raw
 * through a Server Action blows the `serverActions.bodySizeLimit`, which Next
 * raises as an UNCAUGHT exception — that takes the whole Node process down, not
 * just the request. Shrinking before submit keeps a full form well inside the
 * limit (a 6MB camera JPEG lands around 200-400KB at 1600px/0.75 quality).
 *
 * Browser-only: uses canvas. Callers are all 'use client' form components.
 * Never throws — an image that cannot be decoded is passed through untouched so
 * a compression failure can never block a save.
 */

export type CompressOptions = {
  /** Longest edge, in px. Bigger is pointless for KYC photos on screen/print. */
  maxDimension?: number;
  /** JPEG quality, 0-1. */
  quality?: number;
  /** Files at or below this stay untouched. */
  skipBelowBytes?: number;
};

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1600,
  quality: 0.75,
  skipBelowBytes: 512 * 1024,
};

function isCompressibleImage(file: File): boolean {
  // PDFs and anything non-image must pass through byte-for-byte.
  if (!file.type.startsWith('image/')) return false;
  // Re-encoding these to JPEG would drop animation or transparency.
  return !/^image\/(gif|svg\+xml)$/.test(file.type);
}

/** Downscale one image file. Returns the original on any failure. */
export async function compressImageFile(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const { maxDimension, quality, skipBelowBytes } = { ...DEFAULTS, ...options };

  if (!isCompressibleImage(file) || file.size <= skipBelowBytes) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const renamed = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], renamed, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

/**
 * Compress every image File in a FormData, in place.
 *
 * Preserves field order and repeated keys (`documents` is a multiple input, and
 * guarantor photos are indexed), so the server sees exactly the same shape.
 */
export async function compressFormDataImages(
  formData: FormData,
  options: CompressOptions = {},
): Promise<FormData> {
  const entries = Array.from(formData.entries());
  const hasFiles = entries.some(([, v]) => v instanceof File && (v as File).size > 0);
  if (!hasFiles) return formData;

  const compressed = await Promise.all(
    entries.map(async ([key, value]) => {
      if (!(value instanceof File) || value.size === 0) return [key, value] as const;
      return [key, await compressImageFile(value, options)] as const;
    }),
  );

  // Rebuild rather than mutate: FormData has no in-place replace that keeps
  // ordering for repeated keys.
  for (const [key] of entries) formData.delete(key);
  for (const [key, value] of compressed) formData.append(key, value as any);
  return formData;
}
