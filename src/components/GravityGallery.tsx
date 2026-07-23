import { useEffect, useRef } from 'react';
import Matter from 'matter-js';

export interface GravityImage {
    src: string;
}

interface WallOptions {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
}

interface GravityGalleryProps {
    images: GravityImage[];
    count?: number;
    size?: number;
    shape?: 'square' | 'circle';
    color?: string;
    friction?: number;
    mouseEnable?: boolean;
    mouseStiffness?: number;
    mouseAngularStiffness?: number;
    gravX?: number;
    gravY?: number;
    wallOptions?: WallOptions;
    style?: React.CSSProperties;
}

// A tipagem do matter-js atrapalha mais do que ajuda aqui — usamos o namespace solto.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const M: any = Matter;

// Paredes estáticas em volta do container (grossas, logo fora das bordas).
function makeWalls(
    bounding: { width: number; height: number },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    world: any,
    opts: WallOptions
) {
    const { width: w, height: h } = bounding;
    const t = 200;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walls: any[] = [];
    if (opts.top) walls.push(M.Bodies.rectangle(w / 2, -t / 2, w + 2 * t, t, { isStatic: true }));
    if (opts.bottom) walls.push(M.Bodies.rectangle(w / 2, h + t / 2, w + 2 * t, t, { isStatic: true }));
    if (opts.left) walls.push(M.Bodies.rectangle(-t / 2, h / 2, t, h + 2 * t, { isStatic: true }));
    if (opts.right) walls.push(M.Bodies.rectangle(w + t / 2, h / 2, t, h + 2 * t, { isStatic: true }));
    M.Composite.add(world, walls);
    return walls;
}

/**
 * Solta corpos (círculos ou quadrados) preenchidos com imagens em um mundo
 * Matter.js: gravidade, paredes e arrastar com o mouse. As imagens são
 * cicladas entre os corpos.
 */
export function GravityGallery({
    images,
    count = 20,
    size = 126,
    shape = 'square',
    color = '#FFFFFF',
    friction = 1,
    mouseEnable = true,
    mouseStiffness = 0.991,
    mouseAngularStiffness = 0,
    gravX = 0,
    gravY = 1,
    wallOptions = { top: true, bottom: true, right: true, left: true },
    style,
}: GravityGalleryProps) {
    const n = Math.max(1, Math.min(20, Math.round(count)));
    const containerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef(0);

    const depKey = JSON.stringify({
        n,
        size,
        shape,
        gravX,
        gravY,
        wallOptions,
        friction,
        mouseEnable,
        mouseStiffness,
        mouseAngularStiffness,
    });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const engine = M.Engine.create({
            enableSleeping: false,
            gravity: { x: gravX, y: gravY },
        });

        const bounding = container.getBoundingClientRect();
        makeWalls(bounding, engine.world, wallOptions);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let mouseConstraint: any = null;
        const onLeave = () => mouseConstraint?.mouse?.mouseup(new Event('mouseup'));
        if (mouseEnable) {
            const mouse = M.Mouse.create(container);
            mouseConstraint = M.MouseConstraint.create(engine, {
                mouse,
                constraint: {
                    angularStiffness: mouseAngularStiffness,
                    stiffness: mouseStiffness,
                },
            });
            M.Composite.add(engine.world, mouseConstraint);
            const el = mouseConstraint.mouse.element;
            el.removeEventListener('mousewheel', mouseConstraint.mouse.mousewheel);
            el.removeEventListener('DOMMouseScroll', mouseConstraint.mouse.mousewheel);
            container.addEventListener('mouseleave', onLeave);
        }

        // Corpos distribuídos no topo, para caírem. Fricção 1–10 → 0.1–1.
        const bodyOpts = {
            friction: Math.max(1, Math.min(10, friction)) / 10,
            frictionAir: 0.02,
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const made: any[] = [];
        for (let i = 0; i < n; i++) {
            const x = ((i + 0.5) / n) * bounding.width;
            const y = size / 2 + i * (size * 0.15 + 10);
            const body =
                shape === 'square'
                    ? M.Bodies.rectangle(x, y, size, size, bodyOpts)
                    : M.Bodies.circle(x, y, size / 2, bodyOpts);
            made.push(body);
        }
        M.Composite.add(engine.world, made);

        const els = Array.from(container.querySelectorAll<HTMLElement>('[data-physics-body]'));

        const update = () => {
            rafRef.current = requestAnimationFrame(update);
            for (let i = 0; i < made.length; i++) {
                const el = els[i];
                if (!el) continue;
                const { position, angle } = made[i];
                el.style.visibility = 'visible';
                el.style.left = `${position.x}px`;
                el.style.top = `${position.y}px`;
                el.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
            }
            M.Engine.update(engine);
        };
        update();

        return () => {
            cancelAnimationFrame(rafRef.current);
            if (mouseEnable) container.removeEventListener('mouseleave', onLeave);
            M.World.clear(engine.world, false);
            M.Engine.clear(engine);
        };
    }, [depKey]);

    // Cicla as imagens entre os corpos.
    const imgFor = (i: number) => {
        if (!images.length) return undefined;
        return images[i % images.length]?.src;
    };

    return (
        <div
            ref={containerRef}
            style={{
                ...style,
                position: 'relative',
                height: '100%',
                width: '100%',
                overflow: 'hidden',
            }}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
        >
            {Array.from({ length: n }).map((_, i) => {
                const src = imgFor(i);
                return (
                    <div
                        key={i}
                        data-physics-body=""
                        style={{
                            position: 'absolute',
                            visibility: 'hidden',
                            width: size,
                            height: size,
                            borderRadius: shape === 'circle' ? '50%' : 0,
                            overflow: 'hidden',
                            background: src ? 'transparent' : color,
                            backgroundImage: src ? `url(${src})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            cursor: 'grab',
                        }}
                        draggable={false}
                    />
                );
            })}
        </div>
    );
}
