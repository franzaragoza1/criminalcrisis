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
 * Time-limited download of the untouched original (the master a DJ actually
 * wants). `private_download_url` routes through Cloudinary's authenticated API
 * rather than the CDN, so the link genuinely stops working after `ttlSeconds` —
 * worth the slower first byte for a file people keep.
 *
 * Only works for originals: it cannot apply a transformation.
 */
export function expiringAudioDownloadUrl(
  publicId: string,
  format: string,
  ttlSeconds = 60 * 60 * 6
): string {
  return cloudinary.utils.private_download_url(publicId, format, {
    resource_type: 'video',
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
}

/**
 * Signed download of a *derived* file — used for the 320kbps MP3 when it's
 * transcoded from the master rather than uploaded separately.
 *
 * `private_download_url` can't carry a transformation, so this builds a signed
 * delivery URL with `fl_attachment` instead. No built-in expiry, but the
 * signature can't be forged without our API secret and we only mint it after
 * the recipient's token checks out.
 */
export function signedAudioAttachmentUrl(
  publicId: string,
  options: { format?: string; bitRate?: string; filename?: string } = {}
): string {
  const { format = 'mp3', bitRate = '320k', filename } = options;
  return cloudinary.url(publicId, {
    resource_type: 'video',
    type: 'authenticated',
    sign_url: true,
    secure: true,
    format,
    audio_codec: format === 'mp3' ? 'mp3' : undefined,
    bit_rate: bitRate,
    flags: filename ? `attachment:${filename}` : 'attachment',
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
