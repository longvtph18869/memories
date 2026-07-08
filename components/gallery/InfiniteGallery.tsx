'use client';

import type React from 'react';
import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import Image from 'next/image';
import { ImageItem } from '@/types';

interface FadeSettings {
    fadeIn: { start: number; end: number };
    fadeOut: { start: number; end: number };
}

interface BlurSettings {
    blurIn: { start: number; end: number };
    blurOut: { start: number; end: number };
    maxBlur: number;
}

interface InfiniteGalleryProps {
    images: ImageItem[];
    speed?: number;
    zSpacing?: number;
    visibleCount?: number;
    falloff?: { near: number; far: number };
    fadeSettings?: FadeSettings;
    blurSettings?: BlurSettings;
    globalOpacity?: number;
    className?: string;
    style?: React.CSSProperties;
}

interface PlaneData {
    index: number;
    z: number;
    imageIndex: number;
    x: number;
    y: number;
}

const DEFAULT_DEPTH_RANGE = 50;
const GOLDEN_ANGLE = 2.399963229728653;
// Tỉ lệ vùng màn hình được phủ ảnh (0.9 = tâm ảnh lên được tới 90% nửa màn hình,
// nên mép ảnh chạm sát cạnh trên/dưới — tăng lên 1.0 nếu muốn tràn hẳn ra ngoài)
const SPREAD = 0.9;

// Chiếu offset chuẩn hóa (-1..1) ra tọa độ thế giới, theo kích thước
// khung nhìn (frustum) tại độ sâu của plane — tự khớp mọi tỉ lệ màn hình
const projectOffset = (
    nx: number,
    ny: number,
    z: number,
    fovDeg: number,
    aspect: number
) => {
    const dist = Math.max(DEFAULT_DEPTH_RANGE / 2 - z, 1);
    const halfH = Math.tan(THREE.MathUtils.degToRad(fovDeg / 2)) * dist;
    return {
        x: nx * halfH * aspect * SPREAD,
        y: ny * halfH * SPREAD,
    };
};

const createClothMaterial = () => {
    return new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
            map: { value: null },
            opacity: { value: 1.0 },
            blurAmount: { value: 0.0 },
            scrollForce: { value: 0.0 },
            time: { value: 0.0 },
        },
        vertexShader: `
      uniform float scrollForce;
      uniform float time;
      varying vec2 vUv;
      varying vec3 vNormal;

      void main() {
        vUv = uv;
        vNormal = normal;

        vec3 pos = position;

        // Create smooth curving based on scroll force
        float curveIntensity = scrollForce * 0.3;

        // Base curve across the plane based on distance from center
        float distanceFromCenter = length(pos.xy);
        float curve = distanceFromCenter * distanceFromCenter * curveIntensity;
        
        // Add gentle cloth-like ripples
        float ripple1 = sin(pos.x * 2.0 + scrollForce * 3.0) * 0.02;
        float ripple2 = sin(pos.y * 2.5 + scrollForce * 2.0) * 0.015;
        float clothEffect = (ripple1 + ripple2) * abs(curveIntensity) * 2.0;
        
        // Apply Z displacement for curving effect (inverted) with cloth ripples
        pos.z -= (curve + clothEffect);
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
        fragmentShader: `
      uniform sampler2D map;
      uniform float opacity;
      uniform float blurAmount;
      uniform float scrollForce;
      varying vec2 vUv;
      varying vec3 vNormal;
      
      void main() {
        vec2 uv = vUv;
        
        // Khai báo kích thước viền và độ mượt khi chuyển cạnh (Antialiasing)
        float borderSize = 0.025;
        float transition = 0.003; // Bán kính làm mịn viền (tránh răng cưa/rung viền)
        
        // Thuật toán làm mịn viền trong (giữa ảnh và khung trắng)
        float borderX = smoothstep(borderSize - transition, borderSize + transition, uv.x) * 
                        (1.0 - smoothstep(1.0 - borderSize - transition, 1.0 - borderSize + transition, uv.x));
        float borderY = smoothstep(borderSize - transition, borderSize + transition, uv.y) * 
                        (1.0 - smoothstep(1.0 - borderSize - transition, 1.0 - borderSize + transition, uv.y));
        float inImage = borderX * borderY; // = 1.0 khi ở trong ảnh, = 0.0 khi ở trên viền, có chuyển tiếp mượt ở biên
        
        // Thuật toán làm mịn viền ngoài (đường chỉ đen ngoài cùng)
        float outlineSize = 0.004;
        float outlineX = smoothstep(outlineSize - 0.001, outlineSize + 0.001, uv.x) * 
                          (1.0 - smoothstep(1.0 - outlineSize - 0.001, 1.0 - outlineSize + 0.001, uv.x));
        float outlineY = smoothstep(outlineSize - 0.001, outlineSize + 0.001, uv.y) * 
                          (1.0 - smoothstep(1.0 - outlineSize - 0.001, 1.0 - outlineSize + 0.001, uv.y));
        float inBorder = outlineX * outlineY; // = 1.0 khi ở trong khung viền trắng, = 0.0 khi ở ngoài rìa đen

        // Giới hạn UV ảnh trong khoảng [0, 1] để tránh lỗi lấy mẫu ngoài biên của GPU
        vec2 innerUv = clamp((uv - vec2(borderSize)) / (1.0 - 2.0 * borderSize), 0.0, 1.0);
        vec4 imgColor = texture2D(map, innerUv);
        
        // Xử lý làm mờ nếu có
        if (blurAmount > 0.0) {
          vec2 texelSize = 1.0 / vec2(textureSize(map, 0));
          vec4 blurred = vec4(0.0);
          float total = 0.0;
          
          for (float x = -2.0; x <= 2.0; x += 1.0) {
            for (float y = -2.0; y <= 2.0; y += 1.0) {
              vec2 offset = vec2(x, y) * texelSize * blurAmount;
              float weight = 1.0 / (1.0 + length(vec2(x, y)));
              blurred += texture2D(map, clamp(innerUv + offset, 0.0, 1.0)) * weight;
              total += weight;
            }
          }
          imgColor = blurred / total;
        }
        
        // Hậu kỳ màu sắc điện ảnh cho ảnh
        imgColor.rgb = (imgColor.rgb - 0.5) * 1.06 + 0.5;
        imgColor.r *= 1.04;
        imgColor.g *= 1.01;
        imgColor.b *= 0.95;
        
        // Thiết lập các màu sắc thành phần
        vec4 borderColor = vec4(0.97, 0.96, 0.94, 1.0); // Màu viền trắng ấm
        vec4 outlineColor = vec4(0.12, 0.12, 0.12, 0.5); // Đường chỉ đen mỏng rìa ngoài
        
        // Trộn (blend) mượt mà các thành phần màu dựa trên mặt nạ smoothstep
        vec4 finalColor = mix(borderColor, imgColor, inImage);
        finalColor = mix(outlineColor, finalColor, inBorder);
        
        // Hiệu ứng ánh sáng phản chiếu khi uốn cong
        float curveHighlight = abs(scrollForce) * 0.05;
        finalColor.rgb += vec3(curveHighlight * 0.12);
        
        gl_FragColor = vec4(finalColor.rgb, finalColor.a * opacity);
      }
    `,
    });
};

const PARTICLE_COUNT = 140;

// Lớp bụi sáng/đom đóm lơ lửng giữa các tấm ảnh trong đường hầm 3D.
// Trôi chậm theo scroll (parallax) + bập bềnh và nhấp nháy nhẹ theo thời gian.
function FloatingParticles({
    scrollVelocity,
    globalOpacity,
}: {
    scrollVelocity: number;
    globalOpacity: number;
}) {
    const scrollOffset = useRef(0);

    const geometry = useMemo(() => {
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const sizes = new Float32Array(PARTICLE_COUNT);
        const phases = new Float32Array(PARTICLE_COUNT);
        const tints = new Float32Array(PARTICLE_COUNT);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            positions[i * 3] = (Math.random() * 2 - 1) * 14;
            positions[i * 3 + 1] = (Math.random() * 2 - 1) * 10;
            positions[i * 3 + 2] = Math.random() * DEFAULT_DEPTH_RANGE;
            sizes[i] = 6 + Math.random() * 18;
            phases[i] = Math.random() * Math.PI * 2;
            tints[i] = Math.random();
        }

        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
        g.setAttribute('aTint', new THREE.BufferAttribute(tints, 1));
        return g;
    }, []);

    const material = useMemo(
        () =>
            new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                uniforms: {
                    time: { value: 0 },
                    scrollOffset: { value: 0 },
                    globalOpacity: { value: 1 },
                },
                vertexShader: `
                    uniform float time;
                    uniform float scrollOffset;
                    attribute float aSize;
                    attribute float aPhase;
                    attribute float aTint;
                    varying float vAlpha;
                    varying float vTint;

                    void main() {
                        vTint = aTint;
                        vec3 pos = position;

                        // Bập bềnh nhẹ + bay lên chậm (wrap trong khoảng -10..10)
                        pos.x += sin(time * 0.12 + aPhase) * 1.2;
                        pos.y = mod(pos.y + sin(time * 0.09 + aPhase * 1.7) * 0.9
                                    + time * 0.15 + 10.0, 20.0) - 10.0;

                        // Trôi theo scroll với tốc độ chậm hơn ảnh -> hiệu ứng parallax
                        float z = mod(pos.z + scrollOffset, ${DEFAULT_DEPTH_RANGE.toFixed(1)});
                        pos.z = z - ${(DEFAULT_DEPTH_RANGE / 2).toFixed(1)};

                        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                        float dist = max(-mvPosition.z, 0.001);

                        // Mờ dần khi quá gần camera hoặc quá xa
                        float fade = smoothstep(1.5, 6.0, dist) * (1.0 - smoothstep(30.0, 48.0, dist));
                        // Nhấp nháy nhẹ như đom đóm
                        float twinkle = 0.4 + 0.6 * (0.5 + 0.5 * sin(time * 0.8 + aPhase * 3.0));
                        vAlpha = fade * twinkle;

                        gl_PointSize = min(aSize * (10.0 / dist), 42.0);
                        gl_Position = projectionMatrix * mvPosition;
                    }
                `,
                fragmentShader: `
                    uniform float globalOpacity;
                    varying float vAlpha;
                    varying float vTint;

                    void main() {
                        float d = distance(gl_PointCoord, vec2(0.5));
                        float disc = 1.0 - smoothstep(0.15, 0.5, d);

                        // Màu bụi nắng: từ cam đất trầm tới vàng sáng
                        vec3 warmDark = vec3(0.72, 0.50, 0.28);
                        vec3 warmLight = vec3(1.0, 0.92, 0.75);
                        vec3 color = mix(warmDark, warmLight, vTint);

                        gl_FragColor = vec4(color, disc * vAlpha * 0.45 * globalOpacity);
                    }
                `,
            }),
        []
    );

    useFrame((state, delta) => {
        // Ảnh trôi với hệ số *10, bụi trôi *4 -> chậm hơn tạo chiều sâu
        scrollOffset.current += scrollVelocity * delta * 4;
        material.uniforms.time.value = state.clock.getElapsedTime();
        material.uniforms.scrollOffset.value = scrollOffset.current;
        material.uniforms.globalOpacity.value = globalOpacity;
    });

    return <points geometry={geometry} material={material} />;
}

function ImagePlane({
    texture,
    position,
    scale,
    material,
}: {
    texture: THREE.Texture;
    position: [number, number, number];
    scale: [number, number, number];
    material: THREE.ShaderMaterial;
}) {
    const meshRef = useRef<THREE.Mesh>(null);

    useEffect(() => {
        if (material && texture) {
            material.uniforms.map.value = texture;
        }
    }, [material, texture]);

    return (
        <mesh
            ref={meshRef}
            position={position}
            scale={scale}
            material={material}
        >
            <planeGeometry args={[1, 1, 32, 32]} />
        </mesh>
    );
}

function GalleryScene({
    images,
    speed = 1,
    visibleCount = 13,
    fadeSettings = {
        fadeIn: { start: 0.05, end: 0.15 },
        fadeOut: { start: 0.65, end: 0.75 },
    },
    blurSettings = {
        blurIn: { start: 0.0, end: 0.1 },
        blurOut: { start: 0.9, end: 1.0 },
        maxBlur: 3.0,
    },
    globalOpacity = 1,
}: Omit<InfiniteGalleryProps, 'className' | 'style'>) {
    const [scrollVelocity, setScrollVelocity] = useState(0);
    const [autoPlay, setAutoPlay] = useState(true);
    const lastInteraction = useRef(0);

    useEffect(() => {
        lastInteraction.current = Date.now();
    }, []);

    // Normalize images to objects
    const normalizedImages = useMemo(
        () =>
            images.map((img) =>
                typeof img === 'string' ? { src: img, alt: '' } : img
            ),
        [images]
    );

    // Load textures
    const textures = useTexture(normalizedImages.map((img) => img.src));

    // Cấu hình anisotropic filtering để tăng tối đa độ sắc nét của ảnh
    useEffect(() => {
        textures.forEach((texture) => {
            if (texture) {
                texture.generateMipmaps = true;
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.anisotropy = 16;
                texture.needsUpdate = true;
            }
        });
    }, [textures]);

    // Create materials pool
    const materials = useMemo(
        () => Array.from({ length: visibleCount }, () => createClothMaterial()),
        [visibleCount]
    );

    const { camera, size } = useThree();

    // Rải đều trên đĩa đơn vị bằng xoắn ốc góc vàng (Vogel spiral):
    // tọa độ chuẩn hóa -1..1, lúc render mới nhân với kích thước khung nhìn
    const spatialPositions = useMemo(() => {
        const positions: { nx: number; ny: number }[] = [];

        for (let i = 0; i < visibleCount; i++) {
            const angle = i * GOLDEN_ANGLE;
            const radius = Math.sqrt((i + 0.5) / visibleCount);
            const cx = Math.cos(angle);
            const cy = Math.sin(angle);

            // Kéo phân bố từ đĩa tròn ra full hình chữ nhật (-1..1)²:
            // nếu để nguyên đĩa tròn, vùng sát mép trên/dưới và 4 góc
            // của màn hình dọc sẽ không bao giờ có ảnh
            const stretch = 1 / Math.max(Math.abs(cx), Math.abs(cy));

            positions.push({
                nx: cx * stretch * radius,
                ny: cy * stretch * radius,
            });
        }

        return positions;
    }, [visibleCount]);

    const totalImages = normalizedImages.length;
    const depthRange = DEFAULT_DEPTH_RANGE;

    // Thứ tự ảnh ban đầu được xáo trộn ngẫu nhiên (Fisher–Yates)
    // để ảnh không hiện lần lượt theo đúng thứ tự trong mảng đầu vào
    const shuffledOrder = useMemo(() => {
        const order = Array.from({ length: totalImages }, (_, i) => i);
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }
        return order;
    }, [totalImages]);

    const cameraFov =
        (camera as THREE.PerspectiveCamera).fov ?? 55;
    const cameraAspect = size.height > 0 ? size.width / size.height : 1;

    // Initialize plane data - use state for rendering, ref for fast mutations
    const [initialPlanes] = useState<PlaneData[]>(() =>
        Array.from({ length: visibleCount }, (_, i) => {
            const z =
                visibleCount > 0 ? ((depthRange / visibleCount) * i) % depthRange : 0;
            const offset = projectOffset(
                spatialPositions[i]?.nx ?? 0,
                spatialPositions[i]?.ny ?? 0,
                z,
                cameraFov,
                cameraAspect
            );
            return {
                index: i,
                z,
                imageIndex: totalImages > 0 ? shuffledOrder[i % totalImages] : 0,
                x: offset.x,
                y: offset.y,
            };
        })
    );

    const planesData = useRef<PlaneData[]>(initialPlanes);

    useEffect(() => {
        planesData.current = Array.from({ length: visibleCount }, (_, i) => {
            const z =
                visibleCount > 0
                    ? ((depthRange / Math.max(visibleCount, 1)) * i) % depthRange
                    : 0;
            // x/y được useFrame tính lại ngay frame kế tiếp theo khung nhìn
            return {
                index: i,
                z,
                imageIndex: totalImages > 0 ? shuffledOrder[i % totalImages] : 0,
                x: 0,
                y: 0,
            };
        });
    }, [depthRange, spatialPositions, totalImages, visibleCount, shuffledOrder]);

    // Handle scroll input
    const handleWheel = useCallback(
        (event: WheelEvent) => {
            event.preventDefault();
            setScrollVelocity((prev) => prev + event.deltaY * 0.01 * speed);
            setAutoPlay(false);
            lastInteraction.current = Date.now();
        },
        [speed]
    );

    // Handle keyboard input
    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                setScrollVelocity((prev) => prev - 2 * speed);
                setAutoPlay(false);
                lastInteraction.current = Date.now();
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                setScrollVelocity((prev) => prev + 2 * speed);
                setAutoPlay(false);
                lastInteraction.current = Date.now();
            }
        },
        [speed]
    );

    useEffect(() => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.addEventListener('wheel', handleWheel, { passive: false });
            document.addEventListener('keydown', handleKeyDown);

            return () => {
                canvas.removeEventListener('wheel', handleWheel);
                document.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, [handleWheel, handleKeyDown]);

    // Auto-play logic
    useEffect(() => {
        const interval = setInterval(() => {
            if (Date.now() - lastInteraction.current > 3000) {
                setAutoPlay(true);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useFrame((state, delta) => {
        // Apply auto-play
        if (autoPlay) {
            setScrollVelocity((prev) => prev + 0.48 * delta);
        }

        // Damping
        setScrollVelocity((prev) => prev * 0.95);

        // Update time uniform for all materials
        const time = state.clock.getElapsedTime();
        materials.forEach((material) => {
            if (material && material.uniforms) {
                material.uniforms.time.value = time;
                material.uniforms.scrollForce.value = scrollVelocity;
            }
        });

        // Update plane positions
        const totalRange = depthRange;

        // Bốc ngẫu nhiên một ảnh chưa hiển thị trên màn hình (tránh trùng);
        // nếu ảnh ít hơn số plane thì chỉ cần khác ảnh hiện tại
        const pickRandomImage = (current: number) => {
            if (totalImages <= 1) return current;
            const inUse = new Set(
                planesData.current.map((p) => p.imageIndex)
            );
            const candidates: number[] = [];
            for (let idx = 0; idx < totalImages; idx++) {
                if (!inUse.has(idx)) candidates.push(idx);
            }
            if (candidates.length === 0) {
                const idx = Math.floor(Math.random() * totalImages);
                return idx === current ? (idx + 1) % totalImages : idx;
            }
            return candidates[Math.floor(Math.random() * candidates.length)];
        };

        planesData.current.forEach((plane, i) => {
            let newZ = plane.z + scrollVelocity * delta * 10;
            let wrapped = false;

            if (newZ >= totalRange) {
                newZ -= totalRange * Math.floor(newZ / totalRange);
                wrapped = true;
            } else if (newZ < 0) {
                newZ += totalRange * Math.ceil(-newZ / totalRange);
                wrapped = true;
            }

            if (wrapped && totalImages > 0) {
                plane.imageIndex = pickRandomImage(plane.imageIndex);
            }

            plane.z = ((newZ % totalRange) + totalRange) % totalRange;

            // Chiếu offset chuẩn hóa ra tọa độ thế giới theo khung nhìn hiện tại:
            // offset tỉ lệ với khoảng cách nên vị trí trên màn hình ổn định
            // và phủ đều toàn màn hình ở mọi tỉ lệ (mobile lẫn desktop)
            const cam = state.camera as THREE.PerspectiveCamera;
            const offset = projectOffset(
                spatialPositions[i]?.nx ?? 0,
                spatialPositions[i]?.ny ?? 0,
                plane.z,
                cam.fov ?? 55,
                cam.aspect ?? 1
            );
            plane.x = offset.x;
            plane.y = offset.y;

            // Calculate opacity based on fade settings
            const normalizedPosition = plane.z / totalRange; // 0 to 1
            let opacity = 1;

            if (
                normalizedPosition >= fadeSettings.fadeIn.start &&
                normalizedPosition <= fadeSettings.fadeIn.end
            ) {
                // Fade in
                opacity =
                    (normalizedPosition - fadeSettings.fadeIn.start) /
                    (fadeSettings.fadeIn.end - fadeSettings.fadeIn.start);
            } else if (normalizedPosition < fadeSettings.fadeIn.start) {
                // Before fade in
                opacity = 0;
            } else if (
                normalizedPosition >= fadeSettings.fadeOut.start &&
                normalizedPosition <= fadeSettings.fadeOut.end
            ) {
                // Fade out
                const fadeOutProgress =
                    (normalizedPosition - fadeSettings.fadeOut.start) /
                    (fadeSettings.fadeOut.end - fadeSettings.fadeOut.start);
                opacity = 1 - fadeOutProgress;
            } else if (normalizedPosition > fadeSettings.fadeOut.end) {
                // After fade out
                opacity = 0;
            }

            opacity = Math.max(0, Math.min(1, opacity));

            // Calculate blur
            let blur = 0;

            if (
                normalizedPosition >= blurSettings.blurIn.start &&
                normalizedPosition <= blurSettings.blurIn.end
            ) {
                // Blur in
                const blurInProgress =
                    (normalizedPosition - blurSettings.blurIn.start) /
                    (blurSettings.blurIn.end - blurSettings.blurIn.start);
                blur = blurSettings.maxBlur * (1 - blurInProgress);
            } else if (normalizedPosition < blurSettings.blurIn.start) {
                // Before blur in
                blur = blurSettings.maxBlur;
            } else if (
                normalizedPosition >= blurSettings.blurOut.start &&
                normalizedPosition <= blurSettings.blurOut.end
            ) {
                // Blur out
                const blurOutProgress =
                    (normalizedPosition - blurSettings.blurOut.start) /
                    (blurSettings.blurOut.end - blurSettings.blurOut.start);
                blur = blurSettings.maxBlur * blurOutProgress;
            } else if (normalizedPosition > blurSettings.blurOut.end) {
                // After blur out
                blur = blurSettings.maxBlur;
            }

            blur = Math.max(0, Math.min(blurSettings.maxBlur, blur));

            // Update material uniforms
            const material = materials[i];
            if (material && material.uniforms) {
                material.uniforms.opacity.value = opacity * globalOpacity;
                material.uniforms.blurAmount.value = blur;
            }
        });
    });

    if (normalizedImages.length === 0) return null;

    return (
        <>
            <FloatingParticles
                scrollVelocity={scrollVelocity}
                globalOpacity={globalOpacity}
            />
            {initialPlanes.map((_, i) => {
                const plane = planesData.current[i];
                if (!plane) return null;

                const texture = textures[plane.imageIndex];
                const material = materials[i];

                if (!texture || !material) return null;

                const worldZ = plane.z - depthRange / 2;

                // Calculate scale to maintain aspect ratio
                const image = texture.image as HTMLImageElement | undefined;
                const aspect = image?.width && image?.height
                    ? image.width / image.height
                    : 1;
                const scale: [number, number, number] =
                    aspect > 1 ? [2 * aspect, 2, 1] : [2, 2 / aspect, 1];

                return (
                    <ImagePlane
                        key={plane.index}
                        texture={texture}
                        position={[plane.x, plane.y, worldZ]}
                        scale={scale}
                        material={material}
                    />
                );
            })}
        </>
    );
}

function FallbackGallery({ images }: { images: ImageItem[] }) {
    const normalizedImages = useMemo(
        () =>
            images.map((img) =>
                typeof img === 'string' ? { src: img, alt: '' } : img
            ),
        [images]
    );

    return (
        <div className="flex flex-col items-center justify-center h-full bg-gray-100 p-4">
            <p className="text-gray-600 mb-4">
                WebGL not supported. Showing image list:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                {normalizedImages.map((img, i) => (
                    <div key={i} className="relative w-full h-32">
                        <Image
                            src={img.src || '/placeholder.svg'}
                            alt={img.alt || ''}
                            fill
                            className="object-cover rounded"
                            sizes="(max-width: 768px) 50vw, 33vw"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function InfiniteGallery({
    images,
    className = 'h-96 w-full',
    style,
    fadeSettings = {
        fadeIn: { start: 0.05, end: 0.25 },
        fadeOut: { start: 0.4, end: 0.43 },
    },
    blurSettings = {
        blurIn: { start: 0.0, end: 0.1 },
        blurOut: { start: 0.4, end: 0.43 },
        maxBlur: 8.0,
    },
    globalOpacity = 1,
}: InfiniteGalleryProps) {
    const [webglSupported] = useState(() => {
        try {
            const canvas = document.createElement('canvas');
            const gl =
                canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return !!gl;
        } catch {
            return false;
        }
    });

    if (!webglSupported) {
        return (
            <div className={className} style={style}>
                <FallbackGallery images={images} />
            </div>
        );
    }

    return (
        <div className={className} style={style}>
            <Canvas
                camera={{ position: [0, 0, 0], fov: 55 }}
                gl={{ antialias: true, alpha: true }}
            >
                <GalleryScene
                    images={images}
                    fadeSettings={fadeSettings}
                    blurSettings={blurSettings}
                    globalOpacity={globalOpacity}
                />
            </Canvas>
        </div>
    );
}
