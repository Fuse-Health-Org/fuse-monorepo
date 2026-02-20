import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_PUBLIC_BUCKET!;
const AWS_REGION = process.env.AWS_REGION!;

// Validate required environment variables
if (!BUCKET_NAME) {
  throw new Error('AWS_PUBLIC_BUCKET environment variable is required');
}
if (!AWS_REGION) {
  throw new Error('AWS_REGION environment variable is required');
}
if (!process.env.AWS_ACCESS_KEY_ID) {
  throw new Error('AWS_ACCESS_KEY_ID environment variable is required');
}
if (!process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error('AWS_SECRET_ACCESS_KEY environment variable is required');
}

// HIPAA: Do not log configuration details in production
if (process.env.NODE_ENV === 'development') {
  console.log('✅ S3 configuration loaded');
}

const sanitizeFileName = (fileName: string) =>
  fileName
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/[^a-zA-Z0-9_.-]/g, '-');

// Upload file to S3 and return the public URL
export async function uploadToS3(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  folder = 'product-images',
  prefix?: string
): Promise<string> {
  try {
    const timestamp = Date.now();
    const safeName = sanitizeFileName(fileName || `upload-${timestamp}`);
    const safePrefix = prefix ? `${sanitizeFileName(prefix)}-` : '';
    const key = `${folder}/${timestamp}-${safePrefix}${safeName}`;

    // SECURITY: Enforce encryption and verify bucket configuration
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256', // HIPAA: Ensure AES-256 encryption at rest
      // SECURITY: Never use public-read ACL for PHI
      // Access should be granted via pre-signed URLs or bucket policies
    });

    // SECURITY: Upload with encryption and verify
    await s3Client.send(command);

    // Verify object encryption was applied
    const headCommand = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    const headResponse = await s3Client.send(headCommand);

    if (headResponse.ServerSideEncryption !== 'AES256') {
      // HIPAA: Do not log key details
      // Cleanup - delete unencrypted object
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        }));
      } catch (cleanupError) {
        // HIPAA: Do not log key details
      }
      throw new Error('Object encryption verification failed');
    }

    // Return public URL
    const url = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;
    // HIPAA: Do not log URLs that may contain identifiable paths
    return url;

  } catch (error) {
    // HIPAA: Do not log detailed error information
    throw new Error('Failed to upload file to S3');
  }
}

// Delete file from S3 using URL
export async function deleteFromS3(fileUrl: string): Promise<void> {
  try {
    // Extract key from S3 URL
    const key = extractKeyFromS3Url(fileUrl);
    if (!key) {
      throw new Error('Invalid S3 URL format');
    }

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    // HIPAA: Do not log key details

  } catch (error) {
    // HIPAA: Do not log detailed error information
    throw new Error('Failed to delete file from S3');
  }
}

// Extract S3 key from URL
function extractKeyFromS3Url(url: string): string | null {
  try {
    const bucketPattern = new RegExp(`https://${BUCKET_NAME}\\.s3\\.${AWS_REGION}\\.amazonaws\\.com/(.+)`);
    const match = url.match(bucketPattern);
    return match?.[1] ?? null;
  } catch (error) {
    // HIPAA: Do not log URL details
    return null;
  }
}

// Fetch a file from S3 and return its stream + content type (for proxying)
export async function getFileFromS3(fileUrl: string): Promise<{ body: NodeJS.ReadableStream; contentType: string }> {
  const key = extractKeyFromS3Url(fileUrl)
  if (!key) throw new Error('Invalid S3 URL format')

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  const response = await s3Client.send(command)
  if (!response.Body) throw new Error('Empty response from S3')

  return {
    body: response.Body as NodeJS.ReadableStream,
    contentType: response.ContentType || 'image/png',
  }
}

// Validate file type for uploads (logos allow PDFs as well)
export function isValidImageFile(contentType: string): boolean {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
  return allowedTypes.includes(contentType);
}

// Validate file size (max 5MB for logos)
export function isValidFileSize(fileSize: number): boolean {
  const maxSize = 5 * 1024 * 1024; // 5MB
  return fileSize <= maxSize;
}