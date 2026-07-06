import { S3Client } from '@aws-sdk/client-s3';

if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY || !process.env.S3_ENDPOINT) {
    console.warn('Missing S3 environment variables');
}

export const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
});

export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
export const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL;
