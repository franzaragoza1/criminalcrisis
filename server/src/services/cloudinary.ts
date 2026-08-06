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
 */
export function signedAudioStreamUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    resource_type: 'video',
    type: 'authenticated',
    sign_url: true,
    secure: true,
  });
}

/**
 * Time-limited download link. `private_download_url` routes through Cloudinary's
 * authenticated API rather than the CDN, so the link genuinely stops working
 * after `ttlSeconds` — worth the slower first byte for a file people keep.
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

export async function deleteAudioFromCloudinary(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, {
    resource_type: 'video',
    type: 'authenticated',
  });
}

export default cloudinary;
