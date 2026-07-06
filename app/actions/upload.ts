"use server"

import { UploadResult } from "@/types";
import { cookies } from "next/headers";
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET_NAME } from '@/lib/s3';

export async function uploadImage(formData: FormData): Promise<UploadResult> {
    const cookieStore = await cookies()
    const isAdmin = cookieStore.get("admin_session")?.value === "true"
    
    if (!isAdmin) {
        return { success: false, error: "Unauthorized access" }
    }

    if (!S3_BUCKET_NAME) {
        return { success: false, error: "Chưa cấu hình Storage Bucket" }
    }

    const caption = formData.get("caption") as string
    const imageFile = formData.get("image") as File

    if (!imageFile) {
        return { success: false, error: "Thiếu thông tin bắt buộc" }
    }

    try {
        const fileExtension = imageFile.type.split("/")[1] || "webp"
        const arrayBuffer = await imageFile.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const key = `memory-${Date.now()}.${fileExtension}`

        const command = new PutObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: imageFile.type,
            Metadata: {
                caption: encodeURIComponent(caption || "")
            }
        });

        await s3Client.send(command);

        return { success: true }
    } catch (error) {
        console.error("Upload error:", error)
        return { success: false, error: "Đã xảy ra lỗi khi tải ảnh lên" }
    }
}

export async function deleteImage(key: string): Promise<UploadResult> {
    const cookieStore = await cookies()
    const isAdmin = cookieStore.get("admin_session")?.value === "true"
    
    if (!isAdmin) {
        return { success: false, error: "Unauthorized access" }
    }

    if (!S3_BUCKET_NAME) {
        return { success: false, error: "Chưa cấu hình Storage Bucket" }
    }

    if (!key) {
        return { success: false, error: "Thiếu thông tin file" }
    }

    try {
        const command = new DeleteObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: key,
        });

        await s3Client.send(command);

        return { success: true }
    } catch (error) {
        console.error("Delete error:", error)
        return { success: false, error: "Đã xảy ra lỗi khi xóa ảnh" }
    }
}
