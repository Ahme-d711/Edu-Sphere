import type { UploadApiResponse, DeleteApiResponse } from 'cloudinary';
import { cloudinary } from '../config/cloudinary.js';
import streamifier from 'streamifier';
import sharp from 'sharp';
import { AppError } from '../utils/AppError.js';
import type { MulterFile } from '../types/express-multer.ts';

/**
 * Upload & optimize image to Cloudinary
 * @param file - Multer file
 * @param options - Upload options
 * @returns Cloudinary response
 */
interface UploadOptions {
  folder?: string;
  publicId?: string;
  tags?: string[];
  context?: Record<string, string>;
  allowedFormats?: string[];
}

export const uploadToCloudinary = async (
  file: MulterFile,
  options: UploadOptions = {}
): Promise<UploadApiResponse> => {
  const {
    folder = 'edu-sphere',
    publicId,
    tags = [],
    context = {},
    allowedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  } = options;

  try {
    // 1. Validate file type
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (!ext || !allowedFormats.includes(ext)) {
      throw AppError.badRequest(`Invalid file type. Allowed: ${allowedFormats.join(', ')}`);
    }

    // 2. Optimize with Sharp (WebP + resize + quality)
    const optimizedBuffer = await sharp(file.buffer)
      .resize({
        width: 1200,
        height: 1200,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 }) // WebP = أفضل ضغط
      .toBuffer();

    // 3. Generate unique public_id
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const finalPublicId = publicId || `${folder}/${timestamp}-${random}`;

    // 4. Upload via stream
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: finalPublicId,
          overwrite: true,
          resource_type: 'image',
          format: 'webp',
          tags: ['edu-sphere', ...tags],
          context,
          // CDN auto-optimization
          eager: [
            { width: 800, height: 800, crop: 'fill', format: 'webp', quality: 'auto' },
            { width: 400, height: 400, crop: 'fill', format: 'webp', quality: 'auto' },
          ],
          eager_async: true,
        },
        (error, result) => {
          if (error) return reject(AppError.badRequest(`Upload failed: ${error.message}`));
          if (!result) return reject(AppError.badRequest('No upload result'));
          resolve(result);
        }
      );

      streamifier.createReadStream(optimizedBuffer).pipe(uploadStream);
    });
  } catch (err: unknown) {
    console.error('Cloudinary upload error:', err);
    throw err instanceof AppError ? err : AppError.badRequest('Image upload failed');
  }
};

/**
 * Delete image from Cloudinary
 * @param publicId - Full public_id (with folder)
 * @returns Deletion result
 */
export const deleteFromCloudinary = async (
  publicId: string
): Promise<DeleteApiResponse> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true, // Remove from CDN
      resource_type: 'image',
    });

    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error(result.result);
    }

    return result;
  } catch (error: unknown) {
    console.error('Cloudinary delete error:', error);
    throw AppError.badRequest(`Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Delete multiple images
 */
export const deleteManyFromCloudinary = async (
  publicIds: string[]
): Promise<void> => {
  if (publicIds.length === 0) return;

  try {
    await cloudinary.api.delete_resources(publicIds, {
      resource_type: 'image',
      invalidate: true,
    });
  } catch (error: unknown) {
    console.error('Bulk delete failed:', error);
    throw AppError.badRequest('Failed to delete images');
  }
};