"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import InfiniteGallery from "@/components/gallery/InfiniteGallery"
import { BottomNav } from "@/components/ui/bottom-nav"
import { InfoPanel } from "@/components/ui/info-panel"
import { ImageItem } from "@/types"

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    img.onload = () => resolve()
    img.onerror = reject
    img.src = src
  })
}

export default function Home() {
  const [images, setImages] = useState<ImageItem[]>([])
  const [loadedCount, setLoadedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showGallery, setShowGallery] = useState(false)
  const [galleryOpacity, setGalleryOpacity] = useState(0)

  const [infoOpen, setInfoOpen] = useState(false)
  const [isGridView, setIsGridView] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)

  useEffect(() => {
    async function fetchAndPreloadImages() {
      try {
        // Fetch image list from API
        const response = await fetch('/api/images');
        const data = await response.json();

        if (data.images && data.images.length > 0) {
          const imageList: ImageItem[] = data.images;
          setTotalCount(imageList.length);

          // Preload all images
          let loaded = 0;
          await Promise.all(
            imageList.map(async (img) => {
              try {
                await preloadImage(img.src);
              } catch {
                // Image failed to load, continue anyway
              }
              loaded++;
              setLoadedCount(loaded);
            })
          );

          setImages(imageList);
        }
      } catch (error) {
        console.error('Failed to fetch images:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAndPreloadImages();
  }, []);

  useEffect(() => {
    if (!isLoading && images.length > 0) {
      setShowGallery(true)
      setGalleryOpacity(1)
    }
  }, [isLoading, images.length])

  // Lắng nghe phím bấm để điều hướng Lightbox bằng bàn phím
  useEffect(() => {
    if (selectedImageIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedImageIndex(null);
      } else if (e.key === "ArrowLeft") {
        setSelectedImageIndex(prev => prev !== null ? (prev - 1 + images.length) % images.length : null);
      } else if (e.key === "ArrowRight") {
        setSelectedImageIndex(prev => prev !== null ? (prev + 1) % images.length : null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImageIndex, images.length]);

  if (!showGallery) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-foreground-muted mb-2">Đang tải kỷ niệm...</p>
          {totalCount > 0 && (
            <p className="text-[10px] font-mono text-foreground-muted/60">
              {loadedCount} / {totalCount}
            </p>
          )}
        </div>
      </main>
    )
  }

  if (images.length === 0) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-foreground-muted">Chưa có kỷ niệm nào</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-background text-foreground transition-opacity duration-[4000ms] ${galleryOpacity === 1 ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
      >
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-foreground-muted mb-2">Đang tải kỷ niệm...</p>
          {totalCount > 0 && (
            <p className="text-[10px] font-mono text-foreground-muted/60">
              {loadedCount} / {totalCount}
            </p>
          )}
        </div>
      </div>

      {!isGridView ? (
        <>
          <InfiniteGallery
            images={images}
            speed={1.2}
            zSpacing={3}
            visibleCount={12}
            falloff={{ near: 0.8, far: 14 }}
            globalOpacity={galleryOpacity}
            className="h-screen w-full overflow-hidden"
          />
        </>
      ) : (
        <div className="h-screen w-full overflow-y-auto p-3 md:p-6 lg:p-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-4 pb-32">
            {images.map((img, index) => {
              const imgSrc = img.src;
              const imgAlt = img.alt || `Memory ${index + 1}`;
              return (
                <div 
                  key={index} 
                  onClick={() => setSelectedImageIndex(index)}
                  className="relative aspect-square overflow-hidden border border-border hover:border-foreground-muted transition-colors cursor-pointer group"
                >
                  <Image
                    src={imgSrc}
                    alt={imgAlt}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    unoptimized
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom navigation */}
      <BottomNav
        onInfoClick={() => setInfoOpen(true)}
        onGridClick={() => setIsGridView(!isGridView)}
        isGridView={isGridView}
      />

      {/* Lightbox Modal (Xem phóng to ảnh) */}
      {selectedImageIndex !== null && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col justify-between p-4 md:p-6 backdrop-blur-sm">
          {/* Header */}
          <div className="flex justify-end">
            <button 
              onClick={() => setSelectedImageIndex(null)}
              className="text-foreground-muted hover:text-foreground-bright p-2 transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Main content (Ảnh phóng to + Điều hướng) */}
          <div className="flex-1 flex items-center justify-between gap-4 max-w-5xl mx-auto w-full relative">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex(prev => prev !== null ? (prev - 1 + images.length) % images.length : null);
              }}
              className="p-3 bg-background/20 hover:bg-background/60 border border-border text-foreground-muted hover:text-foreground-bright transition-all cursor-pointer hidden sm:block"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div 
              onClick={() => setSelectedImageIndex(null)}
              className="relative flex-1 h-[70vh] w-full flex items-center justify-center cursor-zoom-out"
            >
              <Image
                src={images[selectedImageIndex].src}
                alt="Memory"
                fill
                className="object-contain"
                unoptimized
              />
            </div>

            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex(prev => prev !== null ? (prev + 1) % images.length : null);
              }}
              className="p-3 bg-background/20 hover:bg-background/60 border border-border text-foreground-muted hover:text-foreground-bright transition-all cursor-pointer hidden sm:block"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Footer (Chỉ số thứ tự) */}
          <div className="text-center space-y-2 pb-6">
            {/* Lọc bỏ tên file key nếu không có chú thích thật */}
            {images[selectedImageIndex].alt && 
             !images[selectedImageIndex].alt.startsWith('memory-') && (
              <p className="text-[12px] text-foreground-bright max-w-md mx-auto">
                {images[selectedImageIndex].alt}
              </p>
            )}
            <p className="text-[10px] font-mono text-foreground-muted/60">
              {selectedImageIndex + 1} / {images.length}
            </p>
            
            {/* Thanh điều hướng nhanh cho Điện thoại di động (Mobile Nav) */}
            <div className="flex justify-center gap-6 sm:hidden pt-2">
              <button 
                onClick={() => setSelectedImageIndex(prev => prev !== null ? (prev - 1 + images.length) % images.length : null)}
                className="px-5 py-2 bg-background/40 border border-border text-foreground-muted hover:text-foreground-bright text-[10px] uppercase tracking-wider cursor-pointer"
              >
                Trước
              </button>
              <button 
                onClick={() => setSelectedImageIndex(prev => prev !== null ? (prev + 1) % images.length : null)}
                className="px-5 py-2 bg-background/40 border border-border text-foreground-muted hover:text-foreground-bright text-[10px] uppercase tracking-wider cursor-pointer"
              >
                Sau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info panel */}
      <InfoPanel open={infoOpen} onClose={() => setInfoOpen(false)} imageCount={images.length} />
    </main>
  )
}
