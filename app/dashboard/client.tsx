"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { X, Upload, Check, Loader2, Lock, Trash2 } from "lucide-react"
import Image from "next/image"
import imageCompression from "browser-image-compression"
import { uploadImage, deleteImage } from "@/app/actions/upload"
import { ImageItem } from "@/types"

export default function DashboardClient({ isAuthenticated }: { isAuthenticated: boolean }) {
    const router = useRouter()
    
    // Auth State
    const [password, setPassword] = useState("")
    const [isLoggingIn, setIsLoggingIn] = useState(false)
    const [loginError, setLoginError] = useState("")

    // Upload State
    const [dragActive, setDragActive] = useState(false)
    const [preview, setPreview] = useState<string | null>(null)
    const [compressedFile, setCompressedFile] = useState<File | null>(null)
    const [caption, setCaption] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")
    const [errorMessage, setErrorMessage] = useState("")
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Images List State
    const [imagesList, setImagesList] = useState<ImageItem[]>([])
    const [isLoadingImages, setIsLoadingImages] = useState(false)
    const [deletingKey, setDeletingKey] = useState<string | null>(null)

    // Load images on mount if authenticated
    useEffect(() => {
        if (isAuthenticated) {
            fetchImages()
        }
    }, [isAuthenticated])

    const fetchImages = async () => {
        setIsLoadingImages(true)
        try {
            const response = await fetch("/api/images")
            const data = await response.json()
            if (data.images) {
                setImagesList(data.images)
            }
        } catch (error) {
            console.error("Failed to fetch images:", error)
        } finally {
            setIsLoadingImages(false)
        }
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoggingIn(true)
        setLoginError("")

        try {
            const res = await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            })
            
            const data = await res.json()
            if (res.ok && data.success) {
                router.refresh()
            } else {
                setLoginError(data.error || "Đăng nhập thất bại")
            }
        } catch (error) {
            setLoginError("Đã xảy ra lỗi")
        } finally {
            setIsLoggingIn(false)
        }
    }

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true)
        } else if (e.type === "dragleave") {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0])
        }
    }

    const handleFile = async (file: File) => {
        try {
            const options = {
                maxSizeMB: 3.5,
                maxWidthOrHeight: 2048,
                useWebWorker: true,
                fileType: "image/webp",
                initialQuality: 0.9,
            }

            const compressed = await imageCompression(file, options)
            setCompressedFile(compressed)
            const previewUrl = URL.createObjectURL(compressed)
            setPreview(previewUrl)
        } catch (error) {
            console.error("Compression error:", error)
            setCompressedFile(file)
            const previewUrl = URL.createObjectURL(file)
            setPreview(previewUrl)
        }
    }

    const handleSubmit = async () => {
        if (!compressedFile) return

        setIsSubmitting(true)
        setSubmitStatus("idle")
        setErrorMessage("")

        const formData = new FormData()
        formData.append("caption", caption)
        formData.append("image", compressedFile)

        const result = await uploadImage(formData)

        setIsSubmitting(false)

        if (result.success) {
            setSubmitStatus("success")
            fetchImages() // Reload danh sách ảnh sau khi up thành công
            setTimeout(() => {
                handleReset()
            }, 2000)
        } else {
            setSubmitStatus("error")
            setErrorMessage(result.error || "Tải lên thất bại")
        }
    }

    const handleReset = () => {
        if (preview) {
            URL.revokeObjectURL(preview)
        }
        setPreview(null)
        setCompressedFile(null)
        setCaption("")
        setSubmitStatus("idle")
        setErrorMessage("")
    }

    const handleDelete = async (key: string) => {
        if (!confirm("Bạn có chắc chắn muốn xóa ảnh này không?")) return

        setDeletingKey(key)
        const result = await deleteImage(key)
        setDeletingKey(null)

        if (result.success) {
            setImagesList(prev => prev.filter(img => img.key !== key))
        } else {
            alert(result.error || "Không thể xóa ảnh")
        }
    }

    if (!isAuthenticated) {
        return (
            <main className="min-h-screen bg-background flex items-center justify-center p-4">
                <form onSubmit={handleLogin} className="w-full max-w-sm border border-border p-8 bg-background/80 backdrop-blur-sm">
                    <div className="flex justify-center mb-6">
                        <Lock className="w-8 h-8 text-foreground-muted" />
                    </div>
                    <h1 className="text-[12px] uppercase tracking-[0.2em] text-foreground text-center mb-6">Quyền Quản Trị</h1>
                    
                    <div className="space-y-4">
                        <div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-transparent border border-border px-4 py-3 text-[12px] text-foreground-bright placeholder:text-foreground-muted focus:outline-none focus:border-foreground-muted text-center"
                                placeholder="Nhập mật khẩu"
                                required
                            />
                        </div>
                        
                        {loginError && (
                            <p className="text-[10px] text-red-400 uppercase tracking-wider text-center">{loginError}</p>
                        )}

                        <button
                            type="submit"
                            disabled={isLoggingIn || !password}
                            className="w-full py-3 text-[11px] uppercase tracking-wider bg-foreground-bright text-background hover:bg-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : "Đăng nhập"}
                        </button>
                    </div>
                </form>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-background flex flex-col items-center py-12 px-4">
            <div className="w-full max-w-2xl border border-border bg-background/80 backdrop-blur-sm">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <span className="text-[12px] uppercase tracking-[0.2em] text-foreground">Bảng Quản Trị - Tải Ảnh Lên</span>
                </div>

                {submitStatus === "success" ? (
                    <div className="p-16 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 border border-foreground-bright flex items-center justify-center mb-6">
                            <Check className="w-8 h-8 text-foreground-bright" />
                        </div>
                        <p className="text-[12px] uppercase tracking-wider text-foreground-bright mb-2">Gửi Thành Công</p>
                        <p className="text-[11px] text-foreground-muted">Ảnh đã được tải lên thành công</p>
                    </div>
                ) : (
                    <div className="p-8 space-y-8">
                        {/* Drop zone */}
                        {!preview ? (
                            <div
                                className={`
                                    border-2 border-dashed border-border p-12 text-center cursor-pointer
                                    transition-colors hover:border-foreground-muted
                                    ${dragActive ? "border-foreground-bright bg-border/20" : ""}
                                `}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="w-8 h-8 mx-auto mb-4 text-foreground-muted" />
                                <p className="text-[12px] uppercase tracking-wider text-foreground-muted mb-2">
                                    Thả ảnh vào đây hoặc click để chọn
                                </p>
                                <p className="text-[10px] text-foreground-muted/60">
                                    Hỗ trợ PNG, JPG, WEBP tối đa 10MB
                                </p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                />
                            </div>
                        ) : (
                            <div className="relative w-full aspect-video border border-border">
                                <Image
                                    src={preview}
                                    alt="Preview"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                />
                                <button
                                    onClick={handleReset}
                                    className="absolute top-4 right-4 p-2 bg-background/80 backdrop-blur-sm border border-border hover:bg-border/50 transition-colors"
                                >
                                    <X className="w-5 h-5 text-foreground" />
                                </button>
                            </div>
                        )}

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[11px] uppercase tracking-wider text-foreground-muted mb-3">
                                    Chú thích
                                </label>
                                <input
                                    type="text"
                                    value={caption}
                                    onChange={(e) => setCaption(e.target.value)}
                                    className="w-full bg-transparent border border-border px-4 py-3 text-[13px] text-foreground-bright placeholder:text-foreground-muted focus:outline-none focus:border-foreground-muted"
                                    placeholder="Thêm chú thích hoặc kỷ niệm (tùy chọn)"
                                />
                            </div>
                        </div>

                        {submitStatus === "error" && (
                            <p className="text-[11px] text-red-400 uppercase tracking-wider text-center">{errorMessage}</p>
                        )}

                        <div className="pt-6 border-t border-border flex justify-end gap-4">
                            <button
                                onClick={handleSubmit}
                                disabled={!preview || isSubmitting}
                                className="px-8 py-3 text-[12px] uppercase tracking-wider bg-foreground-bright text-background hover:bg-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Đang tải lên...
                                    </>
                                ) : (
                                    "Tải ảnh lên"
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Giao diện quản lý ảnh ở dưới */}
            {isAuthenticated && (
                <div className="w-full max-w-2xl mt-8 border border-border bg-background/80 backdrop-blur-sm p-6 space-y-6">
                    <h2 className="text-[12px] uppercase tracking-[0.2em] text-foreground border-b border-border pb-3">
                        Quản lý ảnh ({imagesList.length})
                    </h2>
                    
                    {isLoadingImages ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
                        </div>
                    ) : imagesList.length === 0 ? (
                        <p className="text-[11px] text-foreground-muted text-center py-8">Chưa có ảnh nào trong thư viện</p>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                            {imagesList.map((img, index) => {
                                const isDeleting = deletingKey === img.key;
                                return (
                                    <div key={index} className="relative aspect-square border border-border group overflow-hidden">
                                        <Image
                                            src={img.src}
                                            alt={img.alt || `Memory ${index + 1}`}
                                            fill
                                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                                            sizes="150px"
                                            unoptimized
                                        />
                                        {/* Nút xóa hiện ra khi hover */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <button
                                                onClick={() => handleDelete(img.key)}
                                                disabled={isDeleting}
                                                className="p-2 bg-red-600/90 text-white rounded-none hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
                                                title="Xóa ảnh"
                                            >
                                                {isDeleting ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
            
            <button 
                onClick={() => router.push('/')}
                className="mt-8 text-[11px] uppercase tracking-wider text-foreground-muted hover:text-foreground-bright transition-colors"
            >
                Quay lại Thư Viện Ảnh
            </button>
        </main>
    )
}
