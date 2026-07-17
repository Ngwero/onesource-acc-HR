"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
};

type LoginParticlesProps = {
  className?: string;
  /** denser field on the branded hero panel */
  density?: "soft" | "rich";
};

export function LoginParticles({ className, density = "soft" }: LoginParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let running = true;

    const countForArea = (w: number, h: number) => {
      const base = density === "rich" ? 0.00007 : 0.000045;
      return Math.max(18, Math.min(90, Math.floor(w * h * base)));
    };

    const spawn = (w: number, h: number): Particle => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * (reduceMotion ? 0 : 0.28),
      vy: (Math.random() - 0.5) * (reduceMotion ? 0 : 0.28) - 0.05,
      r: 0.8 + Math.random() * 2.2,
      a: 0.18 + Math.random() * 0.45,
    });

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = countForArea(width, height);
      if (particles.length === 0) {
        particles = Array.from({ length: target }, () => spawn(width, height));
      } else if (particles.length < target) {
        while (particles.length < target) particles.push(spawn(width, height));
      } else {
        particles.length = target;
      }
    };

    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        if (!reduceMotion) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;
          if (p.y < -10) p.y = height + 10;
          if (p.y > height + 10) p.y = -10;
        }

        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${p.a})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      frame = requestAnimationFrame(draw);
    };

    resize();
    draw();

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
    />
  );
}
