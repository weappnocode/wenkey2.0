import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react';

export interface CarouselItem {
    /** Imagem grande exibida no card */
    image: string;
    /** Miniatura usada no botão (por padrão, a mesma imagem) */
    buttonImage?: string;
    label?: string;
}

interface FontValue {
    fontFamily?: string;
    fontWeight?: CSSProperties['fontWeight'];
    fontSize?: number | string;
    fontStyle?: string;
    letterSpacing?: number | string;
    lineHeight?: number | string;
}

interface ButtonCarouselProps {
    items: CarouselItem[];
    cardRadius?: number;
    imageWidth?: number;
    imageHeight?: number;
    buttonCount?: number;
    buttonSize?: number;
    buttonRadius?: number;
    curve?: number;
    gap?: number;
    labelShow?: boolean;
    labelX?: number;
    labelY?: number;
    labelColor?: string;
    labelFont?: FontValue;
    backgroundColor?: string;
}

function modIdx(i: number, n: number) {
    return ((i % n) + n) % n;
}

function easeCubicInOut(p: number) {
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

/**
 * Carrossel com card central animado e uma fileira curva de botões.
 * Clicar em um botão traz o item correspondente para o centro.
 */
export function ButtonCarousel({
    items,
    cardRadius = 0,
    imageWidth = 300,
    imageHeight = 300,
    buttonCount = 7,
    buttonSize = 40,
    buttonRadius = 20,
    curve = 5,
    gap = 26,
    labelShow = true,
    labelX = 0,
    labelY = 0,
    labelColor = '#ffffff',
    labelFont = {
        fontFamily: 'Inter',
        fontWeight: 400,
        fontSize: 26,
        lineHeight: '1.3em',
        letterSpacing: '0em',
    },
    backgroundColor = '#0a0a0a',
}: ButtonCarouselProps) {
    const M = items.length;

    const posRef = useRef(0);
    const [posDisplay, setPosDisplay] = useState(0);
    const rafRef = useRef<number | null>(null);
    const animRef = useRef({ startPos: 0, targetPos: 0, startTime: 0 });
    const [dir, setDir] = useState(1);

    const select = useCallback(
        (itemIdx: number) => {
            const currentActive = modIdx(Math.round(posRef.current), M);
            if (itemIdx === currentActive) return;

            let delta = itemIdx - Math.round(posRef.current);
            delta = ((delta % M) + M) % M;
            if (delta > M / 2) delta -= M;
            setDir(Math.sign(delta));

            if (rafRef.current) cancelAnimationFrame(rafRef.current);

            animRef.current = {
                startPos: posRef.current,
                targetPos: posRef.current + delta,
                startTime: performance.now(),
            };

            const DURATION = 320;
            const tick = (now: number) => {
                const { startPos, targetPos, startTime } = animRef.current;
                const progress = Math.min(1, (now - startTime) / DURATION);
                posRef.current = startPos + (targetPos - startPos) * easeCubicInOut(progress);
                setPosDisplay(posRef.current);
                if (progress < 1) {
                    rafRef.current = requestAnimationFrame(tick);
                } else {
                    posRef.current = targetPos;
                    setPosDisplay(targetPos);
                    rafRef.current = null;
                }
            };
            rafRef.current = requestAnimationFrame(tick);
        },
        [M]
    );

    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    if (M === 0) return null;

    const active = modIdx(Math.round(posDisplay), M);
    const half = Math.floor(Math.min(Math.max(1, buttonCount), M) / 2);
    const buffer = half + 1;

    const cardRadiusPx =
        (Math.max(0, Math.min(20, cardRadius)) / 20) * (Math.min(imageWidth, imageHeight) / 2);
    const buttonRadiusPx = (Math.max(0, Math.min(20, buttonRadius)) / 20) * (buttonSize / 2);
    const t = Math.max(0.0001, Math.min(10, curve) / 10);
    const step = buttonSize + gap;
    const dPsi = ((Math.PI * 2) / M) * t;
    const R = step / (2 * Math.sin(dPsi / 2));
    const baseTop = buttonSize * 0.9;
    const fadeInner = Math.max(0, half - 0.4);
    const fadeEnd = half + 0.6;
    const maxPsi = Math.min(Math.PI, fadeEnd * dPsi);
    const stripHeight = baseTop + R * (1 - Math.cos(maxPsi)) + buttonSize / 2 + 16;

    const center = Math.round(posDisplay);
    const renderItems: number[] = [];
    const seen = new Set<number>();
    for (let s = -buffer; s <= buffer; s++) {
        const idx = modIdx(center + s, M);
        if (!seen.has(idx)) {
            seen.add(idx);
            renderItems.push(idx);
        }
    }

    const getVisualSlot = (itemIdx: number): number => {
        let slot = itemIdx - posDisplay;
        slot = slot % M;
        if (slot > M / 2) slot -= M;
        if (slot < -M / 2) slot += M;
        return slot;
    };

    const slotStyle = (slot: number) => {
        const angle = slot * dPsi;
        const x = R * Math.sin(angle);
        const y = R * (1 - Math.cos(angle));
        const deg = (angle * 180) / Math.PI;
        const absSlot = Math.abs(slot);
        const depth = Math.max(0, 1 - (0.55 * absSlot) / Math.max(1, half));
        const scale = 0.55 + 0.45 * depth;
        const opacity =
            absSlot <= fadeInner
                ? 1
                : absSlot >= fadeEnd
                  ? 0
                  : 1 - (absSlot - fadeInner) / (fadeEnd - fadeInner);
        const zIndex = Math.round(depth * 100) + (absSlot < 0.5 ? 100 : 0);
        return { x, y, deg, scale, opacity, zIndex };
    };

    const imgSweep = 260;
    const imgDip = 150;
    const imageVariants = {
        enter: (d: number) => ({ x: d * imgSweep, y: imgDip, opacity: 0, scale: 0.82, rotate: d * 8 }),
        center: { x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 },
        exit: (d: number) => ({ x: -d * imgSweep, y: imgDip, opacity: 0, scale: 0.82, rotate: -d * 8 }),
    };

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 24,
                overflow: 'hidden',
                boxSizing: 'border-box',
                background: backgroundColor,
            }}
        >
            <div
                style={{
                    position: 'relative',
                    width: imageWidth,
                    height: imageHeight,
                    flex: '0 0 auto',
                    borderRadius: cardRadiusPx,
                    overflow: 'hidden',
                }}
            >
                <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                    <motion.div
                        key={active}
                        custom={dir}
                        variants={imageVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        style={{ position: 'absolute', inset: 0 }}
                    >
                        <img
                            src={items[active]?.image}
                            alt=""
                            draggable={false}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                    </motion.div>
                </AnimatePresence>
            </div>

            {labelShow && (
                <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                        key={`label-${active}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                            flex: '0 0 auto',
                            maxWidth: '100%',
                            textAlign: 'center',
                            color: labelColor,
                            transform: `translate(${labelX}px, ${labelY}px)`,
                            fontFamily: labelFont?.fontFamily,
                            fontWeight: labelFont?.fontWeight,
                            fontSize: labelFont?.fontSize,
                            fontStyle: labelFont?.fontStyle,
                            letterSpacing: labelFont?.letterSpacing,
                            lineHeight: labelFont?.lineHeight,
                        }}
                    >
                        {items[active]?.label ?? ''}
                    </motion.div>
                </AnimatePresence>
            )}

            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    height: stripHeight,
                    overflow: 'hidden',
                    flex: '0 0 auto',
                }}
            >
                {renderItems.map((itemIdx) => {
                    const slot = getVisualSlot(itemIdx);
                    const { x, y, deg, scale, opacity, zIndex } = slotStyle(slot);
                    const isActive = itemIdx === active;
                    const item = items[itemIdx];

                    return (
                        <div
                            key={itemIdx}
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: baseTop,
                                marginLeft: -buttonSize / 2,
                                marginTop: -buttonSize / 2,
                                width: buttonSize,
                                height: buttonSize,
                                transform: `translate(${x}px, ${y}px) rotate(${deg}deg) scale(${scale})`,
                                transformOrigin: 'center',
                                opacity,
                                zIndex,
                                willChange: 'transform, opacity',
                            }}
                        >
                            <div
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: buttonRadiusPx,
                                    overflow: 'hidden',
                                    position: 'relative',
                                    transform: `rotate(${-deg}deg)`,
                                    transformOrigin: 'center',
                                    background: isActive ? '#ffffff' : 'rgba(255,255,255,0.55)',
                                    backdropFilter: isActive ? undefined : 'blur(6px)',
                                    WebkitBackdropFilter: isActive ? undefined : 'blur(6px)',
                                    cursor: 'pointer',
                                    WebkitTapHighlightColor: 'transparent',
                                }}
                                onClick={() => select(itemIdx)}
                            >
                                <img
                                    src={item?.buttonImage ?? item?.image}
                                    alt=""
                                    draggable={false}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
