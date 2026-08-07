import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadToCloudinary(buffer: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `criminalcrisis/${folder}` },
      (error, result) => {
        if (error || !result) reject(error);
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

export async function uploadVideoToCloudinary(buffer: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `criminalcrisis/${folder}`, resource_type: 'video' },
      (error, result) => {
        if (error || !result) reject(error);
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

// ---------------------------------------------------------------------------
// Promo audio
//
// Promos are unreleased, so they are uploaded as `type: 'authenticated'` — that
// protects both the original and any derived version, unlike `private` which
// leaves derivatives publicly reachable. Nothing is accessible without a URL
// signed with our API secret, and we only mint those after validating a
// recipient's access token.
// ---------------------------------------------------------------------------

export type UploadedAudio = {
  publicId: string;
  format: string;
  durationSeconds: number | null;
  bytes: number;
};

/**
 * Uploads an audio file as an authenticated asset.
 * Cloudinary handles audio under `resource_type: 'video'`.
 */
export async function uploadAudioToCloudinary(
  buffer: Buffer,
  folder: string,
  options: { transcodeTo128?: boolean } = {}
): Promise<UploadedAudio> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `criminalcrisis/${folder}`,
        resource_type: 'video',
        type: 'authenticated',
        // Streaming copies are transcoded to 128kbps mp3. A 4-track EP then costs
        // ~16MB per listener instead of ~40MB, which keeps us inside the free
        // Cloudinary bandwidth tier. Masters keep their original quality.
        ...(options.transcodeTo128
          ? { eager: [{ format: 'mp3', audio_codec: 'mp3', bit_rate: '128k' }], eager_async: false }
          : {}),
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Upload failed'));
        resolve({
          publicId: result.public_id,
          format: result.format || 'mp3',
          durationSeconds: result.duration ? Math.round(result.duration) : null,
          bytes: result.bytes || 0,
        });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Signed delivery URL for in-browser streaming. CDN-cacheable, and unguessable
 * without our API secret.
 *
 * The transformation here must stay identical to the `eager` block in
 * uploadAudioToCloudinary: matching it means the derivative already exists, so
 * the first listener gets a cache hit instead of an on-the-fly transcode.
 * Omitting it delivers the *original* upload — a 50MB WAV per listener, which
 * defeats the whole point of transcoding.
 */
export function signedAudioStreamUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    resource_type: 'video',
    type: 'authenticated',
    sign_url: true,
    secure: true,
    format: 'mp3',
    audio_codec: 'mp3',
    bit_rate: '128k',
  });
}

/**
 * Cloudinary puts this straight into the URL and into Content-Disposition, so
 * strip anything that would break either. Keeps "Artist - Title" readable.
 */
export function attachmentFilename(raw: string): string {
  return (
    raw
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // fold accents rather than drop the letter
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 80) || 'promo'
  );
}

/**
 * Signed download URL.
 *
 * Uses `fl_attachment:<filename>` rather than `private_download_url`, which was
 * the original approach: that endpoint's path ends in `/download`, so browsers
 * saved every file as "download.mp3" regardless of the track. The attachment
 * flag names the file properly and works for originals and derivatives alike.
 *
 * The trade-off is that these URLs don't expire on their own — Cloudinary's
 * expiring links can't carry a filename or a transformation on this plan. They
 * still can't be forged without our API secret, and we only mint one after the
 * recipient's access token checks out.
 *
 * Passing `bitRate` transcodes (the 320 derived from a master); omitting it
 * delivers the original untouched, which is what a lossless download must do.
 */
export function signedAudioAttachmentUrl(
  publicId: string,
  options: { format: string; bitRate?: string; filename: string }
): string {
  const { format, bitRate, filename } = options;
  return cloudinary.url(publicId, {
    resource_type: 'video',
    type: 'authenticated',
    sign_url: true,
    secure: true,
    format,
    ...(bitRate ? { audio_codec: 'mp3', bit_rate: bitRate } : {}),
    flags: `attachment:${attachmentFilename(filename)}`,
  });
}

/** Formats we treat as lossless masters worth offering as a separate download. */
export const LOSSLESS_FORMATS = new Set(['wav', 'aiff', 'aif', 'flac', 'alac']);

export async function deleteAudioFromCloudinary(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, {
    resource_type: 'video',
    type: 'authenticated',
  });
}

export default cloudinary;
