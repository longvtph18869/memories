"use client"

import { X } from "lucide-react"
import SdcardphotosLogo from "@/components/ui/sdcardphotosLogo"

interface InfoPanelProps {
    open: boolean
    onClose: () => void
    imageCount?: number
}

export function InfoPanel({ open, onClose, imageCount = 0 }: InfoPanelProps) {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-[100] flex">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />

            {/* Panel - slides from left */}
            <div className="relative bg-background border-r border-border w-full max-w-sm h-full overflow-auto flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-foreground">Thông tin</span>
                    <button onClick={onClose} className="text-foreground-muted hover:text-foreground-bright transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-8 flex-1">
                    {/* Title */}
                    <div>
                        <h2 className="text-[11px] uppercase tracking-[0.3em] text-foreground-muted mb-2">Kỷ Niệm Thanh Xuân</h2>
                        <h3 className="font-serif text-3xl italic text-foreground-bright">Niên Khóa 2026</h3>
                    </div>

                    {/* Description */}
                    <p className="text-[12px] leading-relaxed text-foreground">
                        Một kho ảnh chung lưu giữ hành trình của chúng ta. Nơi lưu lại những kỷ niệm đẹp nhất thời học sinh và cùng nhau hồi tưởng lại những khoảnh khắc đáng nhớ.
                    </p>

                    {/* Stats */}
                    <div className="space-y-3">
                        <div className="flex justify-between text-[11px] uppercase tracking-wider">
                            <span className="text-foreground-muted">Kỷ niệm</span>
                            <span className="text-foreground-bright">{imageCount}</span>
                        </div>
                        <div className="flex justify-between text-[11px] uppercase tracking-wider">
                            <span className="text-foreground-muted">Từ</span>
                            <span className="text-foreground-bright">tháng 12, 2025</span>
                        </div>
                    </div>

                    <div className="border-t border-border" />

                    {/* Instructions */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] uppercase tracking-[0.2em] text-foreground-muted">Điều hướng (Chỉ cho máy tính)</h4>
                        <div className="space-y-2 text-[11px]">
                            <p className="text-foreground">
                                <span className="text-foreground-muted">Cuộn chuột</span> — Duyệt qua các kỷ niệm
                            </p>
                            <p className="text-foreground">
                                <span className="text-foreground-muted">Phím mũi tên</span> — Điều hướng thủ công
                            </p>
                            <p className="text-foreground">
                                <span className="text-foreground-muted">Di chuột</span> — Xem chi tiết ảnh
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer with Logo */}
                <div className="mt-auto border-t border-border p-6">
                    <a
                        href="https://sdcard.photos"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-fit hover:opacity-70 transition-opacity cursor-pointer"
                    >
                        <SdcardphotosLogo className="w-32 h-12" />
                    </a>
                </div>
            </div>
        </div>
    )
}
