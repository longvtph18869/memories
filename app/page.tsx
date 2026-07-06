"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import InfiniteGallery from "@/components/gallery/InfiniteGallery"
import { BottomNav } from "@/components/ui/bottom-nav"
import { InfoPanel } from "@/components/ui/info-panel"
import { ImageItem } from "@/types"

// Import thư viện Lightbox chuyên nghiệp
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"
import Captions from "yet-another-react-lightbox/plugins/captions"
import "yet-another-react-lightbox/plugins/captions.css"

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

  // Lightbox của thư viện tự động xử lý bàn phím và vuốt cảm ứng

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

  // Định dạng lại danh sách ảnh truyền vào Lightbox
  const slides = images.map(img => {
    const hasRealCaption = img.alt && !img.alt.startsWith('memory-');
    return {
      src: img.src,
      title: hasRealCaption ? img.alt : undefined,
    }
  });

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

      {/* Lightbox Modal của thư viện */}
      <Lightbox
        open={selectedImageIndex !== null}
        index={selectedImageIndex ?? 0}
        close={() => setSelectedImageIndex(null)}
        slides={slides}
        plugins={[Captions]}
        captions={{ descriptionTextAlign: "center" }}
        styles={{
          container: { backgroundColor: "rgba(0, 0, 0, 0.96)", backdropFilter: "blur(4px)" }
        }}
      />

      {/* Info panel */}
      <InfoPanel open={infoOpen} onClose={() => setInfoOpen(false)} imageCount={images.length} />
    </main>
  )
}
