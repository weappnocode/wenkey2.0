import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { motion, animate } from 'framer-motion';

type HoverType = 'none' | 'pause' | 'speedUp' | 'speedDown';

interface HoverAnimation {
    type?: HoverType;
    speedMultiplier?: number;
    /** Usado apenas quando type === 'pause' */
    scale?: number;
    /** Usado apenas quando type === 'pause' */
    opacity?: number;
}

interface StepTransition {
    type?: 'tween' | 'spring';
    duration?: number;
    ease?: string;
    stiffness?: number;
    damping?: number;
    mass?: number;
}

interface ProximityOrbitProps {
    /** URLs das imagens que orbitam */
    images: string[];
    /** 1 → 24px … 20 → 480px de raio */
    orbitRadius?: number;
    /** 1 → 20px … 20 → 400px de tamanho */
    imageScale?: number;
    imageFit?: 'cover' | 'contain';
    /** 0 = quadrado … 20 = círculo */
    rounded?: number;
    opacity?: number;
    movementType?: 'continuous' | 'step';
    direction?: 'clockwise' | 'counterclockwise';
    /** 1 = 20s/volta, 5 = 4s/volta, 10 = 2s/volta */
    speed?: number;
    stepTransition?: StepTransition;
    stackDirection?: 'firstToLast' | 'lastToFirst';
    hoverAnimation?: HoverAnimation;
    style?: CSSProperties;
}

/**
 * Imagens orbitando um ponto central, com efeitos ao passar o mouse
 * (acelerar, desacelerar ou pausar/destacar).
 */
export function ProximityOrbit({
    images,
    orbitRadius = 12,
    imageScale = 10,
    imageFit = 'cover',
    rounded = 0,
    opacity = 100,
    movementType = 'continuous',
    direction = 'counterclockwise',
    speed = 3,
    stepTransition = { duration: 0.5, ease: 'easeInOut' },
    stackDirection = 'lastToFirst',
    hoverAnimation = { type: 'speedUp', speedMultiplier: 5 },
    style,
}: ProximityOrbitProps) {
    const hoverType = hoverAnimation?.type ?? 'none';
    const hoverSpeedMult = hoverAnimation?.speedMultiplier ?? 5;
    const hoverScaleVal = hoverAnimation?.scale ?? 6;
    const hoverOpacityVal = hoverAnimation?.opacity ?? 100;

    const [rotation, setRotation] = useState(0);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [liveSpeedMult, setLiveSpeedMult] = useState(1);
    const [isPaused, setIsPaused] = useState(false);

    const rotRef = useRef(0);
    const rafRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number | null>(null);
    const stepAngleRef = useRef(0);

    // Espelha os props em refs para os loops de animação lerem o valor atual
    // sem precisar reiniciar a cada mudança.
    const hoverTypeRef = useRef(hoverType);
    const hoverSpeedRef = useRef(hoverSpeedMult);
    const liveSpeedRef = useRef(liveSpeedMult);
    const dirMultRef = useRef(direction === 'counterclockwise' ? -1 : 1);
    hoverTypeRef.current = hoverType;
    hoverSpeedRef.current = hoverSpeedMult;
    liveSpeedRef.current = liveSpeedMult;
    dirMultRef.current = direction === 'counterclockwise' ? -1 : 1;

    const radiusPx = orbitRadius * 24;
    const imageSizePx = imageScale * 20;
    const borderRadiusPct = (Math.max(0, Math.min(20, rounded)) / 20) * 50;

    const n = images.length;
    const hasImages = n > 0;

    const revDurationMs = (20 / speed) * 1000;
    const stepDurationMs = n > 0 ? revDurationMs / n : revDurationMs;

    // Rotação contínua via requestAnimationFrame
    useEffect(() => {
        if (movementType !== 'continuous' || !hasImages) return;
        if (isPaused) {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            lastTimeRef.current = null;
            return;
        }

        const tick = (ts: number) => {
            if (lastTimeRef.current === null) lastTimeRef.current = ts;
            const dt = Math.min(ts - lastTimeRef.current, 100);
            lastTimeRef.current = ts;
            const degsPerMs = (360 / revDurationMs) * liveSpeedRef.current * dirMultRef.current;
            rotRef.current = rotRef.current + dt * degsPerMs;
            setRotation(rotRef.current);
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            lastTimeRef.current = null;
        };
    }, [movementType, hasImages, revDurationMs, isPaused]);

    // Rotação em passos: anima o ângulo para as imagens percorrerem o arco real.
    useEffect(() => {
        if (movementType !== 'step' || n === 0 || isPaused) return;

        let active = true;
        let currentAnim: { stop: () => void } | null = null;

        const dirMult = direction === 'counterclockwise' ? -1 : 1;
        const stepSize = (360 / n) * dirMult;

        const effectiveDurationMs = stepDurationMs / liveSpeedMult;
        const animMs = Math.max(effectiveDurationMs * 0.65, 150);
        const pauseMs = Math.max(effectiveDurationMs * 0.35, 100);

        const makeAnimOpts = (onUpdate: (v: number) => void, onComplete: () => void) => {
            const base = { onUpdate, onComplete };
            if (stepTransition?.type === 'spring') {
                return {
                    ...base,
                    type: 'spring' as const,
                    stiffness: stepTransition.stiffness ?? 100,
                    damping: stepTransition.damping ?? 15,
                    mass: stepTransition.mass ?? 1,
                };
            }
            return {
                ...base,
                duration: animMs / 1000,
                ease: stepTransition?.ease ?? 'easeInOut',
            };
        };

        const doStep = () => {
            if (!active) return;
            const from = stepAngleRef.current;
            const to = from + stepSize;
            stepAngleRef.current = to;

            currentAnim = animate(
                from,
                to,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                makeAnimOpts(
                    (v) => {
                        if (active) setRotation(v);
                    },
                    () => {
                        if (active) setTimeout(doStep, pauseMs);
                    }
                ) as any
            );
        };

        const timer = setTimeout(doStep, pauseMs);
        return () => {
            active = false;
            clearTimeout(timer);
            if (currentAnim) currentAnim.stop();
        };
    }, [movementType, n, stepDurationMs, liveSpeedMult, isPaused, direction, stepTransition]);

    const handleContainerLeave = useCallback(() => {
        setIsPaused(false);
        setLiveSpeedMult(1);
        setHoveredIndex(null);
    }, []);

    // Os efeitos de hover só disparam sobre uma imagem, nunca no centro vazio.
    const handleImageEnter = useCallback((index: number) => {
        const t = hoverTypeRef.current;
        if (t === 'pause') {
            setIsPaused(true);
        } else if (t === 'speedUp') {
            setLiveSpeedMult(Math.max(hoverSpeedRef.current, 1));
        } else if (t === 'speedDown') {
            setLiveSpeedMult(1 / Math.max(hoverSpeedRef.current, 1));
        }
        setHoveredIndex(index);
    }, []);

    const handleImageLeave = useCallback(() => {
        setIsPaused(false);
        setLiveSpeedMult(1);
        setHoveredIndex(null);
    }, []);

    return (
        <div
            onMouseLeave={handleContainerLeave}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                ...style,
            }}
        >
            {hasImages &&
                images.map((src, i) => {
                    const baseAngle = (i / n) * 360;
                    const totalAngleRad = (baseAngle + rotation) * (Math.PI / 180);
                    const x = Math.cos(totalAngleRad) * radiusPx;
                    const y = Math.sin(totalAngleRad) * radiusPx;

                    const isHovered = hoveredIndex === i;
                    const applyHover = isHovered && hoverType === 'pause';

                    const targetScale = applyHover ? hoverScaleVal / 5 : 1;
                    const targetOpacity = applyHover ? hoverOpacityVal / 100 : opacity / 100;

                    const baseZIndex = stackDirection === 'firstToLast' ? i + 1 : n - i;
                    const zIndex = applyHover ? n + 10 : baseZIndex;

                    return (
                        <div
                            key={i}
                            onMouseEnter={() => handleImageEnter(i)}
                            onMouseLeave={handleImageLeave}
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                zIndex,
                                willChange: 'transform',
                                transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
                            }}
                        >
                            <motion.div
                                animate={{ opacity: targetOpacity, scale: targetScale }}
                                transition={{ opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}
                                style={{
                                    cursor: hoverType !== 'none' ? 'pointer' : 'default',
                                    lineHeight: 0,
                                }}
                            >
                                <img
                                    src={src}
                                    alt=""
                                    draggable={false}
                                    style={{
                                        width: imageSizePx,
                                        height: imageFit === 'cover' ? imageSizePx : 'auto',
                                        objectFit: imageFit,
                                        display: 'block',
                                        borderRadius: `${borderRadiusPct}%`,
                                        pointerEvents: 'none',
                                        userSelect: 'none',
                                    }}
                                />
                            </motion.div>
                        </div>
                    );
                })}
        </div>
    );
}
