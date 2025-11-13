import type { UploadApiResponse, DeleteApiResponse, UploadApiOptions } from 'cloudinary';
import { cloudinary } from '../config/cloudinary.js';
import streamifier from 'streamifier';
import sharp from 'sharp';
import { AppError } from '../utils/AppError.js';
import type { MulterFile } from '../types/express-multer.js';

/**
 * Upload options
 */
interface UploadOptions {
  folder?: string;
  publicId?: string;
  tags?: string[];
  context?: Record<string, string>;
  allowedFormats?: string[];
  maxSizeMB?: number;
  resourceType?: 'image' | 'video';
  quality?: 'auto' | 'auto:eco' | 'auto:good' | 'auto:best' | number;
  format?: 'webp' | 'jpg' | 'png' | 'auto';
}

/**
 * Upload file to Cloudinary with optimization
 */
export const uploadToCloudinary = async (
  file: MulterFile,
  options: UploadOptions = {}
): Promise<UploadApiResponse> => {
  const {
    folder = 'edu-sphere',
    publicId,
    tags = [],
    context = {},
    allowedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'ogg', 'mov'],
    maxSizeMB = 10,
    resourceType = 'image',
    quality = 'auto:good',
    format = 'webp',
  } = options;

  // 1. Validate file size
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > maxSizeMB) {
    throw AppError.badRequest(`File too large. Max size: ${maxSizeMB}MB`);
  }

  // 2. Validate file type
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (!ext || !allowedFormats.includes(ext)) {
    throw AppError.badRequest(
      `Invalid file type. Allowed: ${allowedFormats.join(', ')}`
    );
  }

  // 3. Generate public_id
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  const finalPublicId = publicId || `${folder}/${timestamp}-${random}`;

  // 4. Upload stream options
  const uploadOptions: UploadApiOptions = {
    folder,
    public_id: finalPublicId,
    overwrite: true,
    resource_type: resourceType,  // 'image' أو 'video'
    tags: ['edu-sphere', ...tags],
    context,
    format: resourceType === 'image' ? format : undefined,
    quality,
    type: 'authenticated'
    // لا حاجة لـ upload_preset عند signed upload
  };

  return new Promise((resolve, reject) => {
    if (resourceType === 'image') {
      // معالجة الصور
      sharp(file.buffer)
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: quality === 'auto:good' ? 80 : undefined })
        .toBuffer()
        .then((optimizedBuffer) => {
          const uploadStream = streamifier.createReadStream(optimizedBuffer);
          uploadStream.pipe(
            cloudinary.uploader.upload_stream(uploadOptions, (err, result) => {
              if (err) return reject(AppError.badRequest(`Upload failed: ${err.message}`));
              if (!result) return reject(AppError.badRequest('Upload failed: no response'));
              resolve(result);
            })
          );
        })
        .catch((err) => reject(AppError.badRequest(`Image processing failed: ${err.message}`)));
    } else {
      // فيديو: رفع مباشر
      const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (err, result) => {
        if (err) return reject(AppError.badRequest(`Upload failed: ${err.message}`));
        if (!result) return reject(AppError.badRequest('Upload failed: no response'));
        resolve(result);
      });
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    }
  });
  
};

/**
 * Delete single asset from Cloudinary
 */
export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'image'
): Promise<DeleteApiResponse> => {
  if (!publicId) {
    throw AppError.badRequest('publicId is required');
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });

    if (result.result === 'not found') {
      console.warn(`Cloudinary asset not found: ${publicId}`);
      return result;
    }

    if (result.result !== 'ok') {
      throw new Error(result.result);
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw AppError.badRequest(`Failed to delete from Cloudinary: ${message}`);
  }
};

/**
 * Delete multiple assets
 */
export const deleteManyFromCloudinary = async (
  publicIds: string[],
  resourceType: 'image' | 'video' | 'raw' = 'image'
): Promise<void> => {
  if (!publicIds.length) return;

  try {
    const result = await cloudinary.api.delete_resources(publicIds, {
      resource_type: resourceType,
      invalidate: true,
    });

    const failed = Object.entries(result.deleted).filter(([, status]) => status !== 'deleted');
    if (failed.length > 0) {
      console.warn('Some assets failed to delete:', failed);
    }
  } catch (err) {
    console.error('Bulk delete failed:', err);
    throw AppError.badRequest('Failed to delete assets from Cloudinary');
  }
};

/**
 * Generate signed URL (for secure streaming)
 */
export const getSignedUrl = (
  publicId: string,
  options: Record<string, unknown> = {}
): string => {
  return cloudinary.url(publicId, {
    sign_url: true,
    secure: true,
    ...options,
  });
};