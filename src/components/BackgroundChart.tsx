"use client";

import { useEffect, useRef } from "react";
import { useDerivTicker } from "@/hooks/useDerivTicker";
import { DERIV_SYMBOL_VOL_100 } from "@/lib/types/deriv";

/* ─── constants ────────────────────────────────────────────── */
const TICKS_PER_CANDLE = 5;
const CW       = 10;   // candle body width (px)
const GAP      = 5;    // gap between candles
const STEP     = CW + GAP;
const LEFT_PAD = 20;   // px from left edge where chart begins
const RIGHT_PAD = 30;  // px from right edge where live candle sits

interface Candle { open: number; high: number; low: number; close: number; }

/* ─── component ────────────────────────────────────────────── */
export default function BackgroundChart() {
  const { currentTick } = useDerivTicker({ symbol: DERIV_SYMBOL_VOL_100 });

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const closedRef  = useRef<Candle[]>([]);
  const liveRef    = useRef<Candle | null>(null);
  const ticksRef   = useRef(0);
  const slideRef   = useRef(0);  // px: slides from STEP → 0 when a new candle opens

  // Smoothed Y range — lerp prevents axis jumps
  const dMaxRef = useRef<number | null>(null);
  const dMinRef = useRef<number | null>(null);

  /* ── ingest ticks ─────────────────────────────────────────── */
  useEffect(() => {
    if (!currentTick) return;
    const price = currentTick.quote;

    if (!liveRef.current) {
      // Very first tick: open the first candle at the left edge
      liveRef.current = { open: price, high: price, low: price, close: price };
      ticksRef.current = 1;
      return;
    }

    // Update the forming candle
    const live = liveRef.current;
    liveRef.current = {
      open:  live.open,
      high:  Math.max(live.high, price),
      low:   Math.min(live.low,  price),
      close: price,
    };
    ticksRef.current++;

    // Close the candle when enough ticks have arrived
    if (ticksRef.current >= TICKS_PER_CANDLE) {
      closedRef.current.push({ ...liveRef.current });
      liveRef.current  = { open: price, high: price, low: price, close: price };
      ticksRef.current = 0;
      slideRef.current = STEP; // kick off slide animation
    }
  }, [currentTick]);

  /* ── draw loop ────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W   = canvas.offsetWidth;
      const H   = canvas.offsetHeight;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // Build full candle list
      const live = liveRef.current;
      const all: Candle[] = live
        ? [...closedRef.current, live]
        : [...closedRef.current];

      if (all.length === 0) { raf = requestAnimationFrame(draw); return; }

      // ── X positioning ──────────────────────────────────────
      // Phase 1 (growing): first candle at LEFT_PAD, grow right
      // Phase 2 (scrolling): last candle anchored at right edge, history scrolls left
      // Transition is seamless — the formula switches only when screen is full.
      const availW     = W - LEFT_PAD - RIGHT_PAD;
      const screenFull = all.length * STEP > availW;

      let getX: (i: number) => number;

      if (!screenFull) {
        // Growing phase — no slide, candles just appear at next position
        slideRef.current = 0;
        getX = (i) => LEFT_PAD + i * STEP;
      } else {
        // Scrolling phase — smooth slide as each new candle enters from right
        if (slideRef.current > 0) {
          slideRef.current = Math.max(0, slideRef.current - 1.4);
        }
        const anchorX = W - RIGHT_PAD + slideRef.current;
        getX = (i) => anchorX - (all.length - 1 - i) * STEP;
      }

      // ── Smoothed Y range ───────────────────────────────────
      const rawMax = Math.max(...all.map(c => c.high));
      const rawMin = Math.min(...all.map(c => c.low));
      const pad    = (rawMax - rawMin) * 0.18 || rawMax * 0.004;

      if (dMaxRef.current === null) {
        dMaxRef.current = rawMax + pad;
        dMinRef.current = rawMin - pad;
      } else {
        dMaxRef.current += ((rawMax + pad) - dMaxRef.current) * 0.03;
        dMinRef.current! += ((rawMin - pad) - dMinRef.current!) * 0.03;
      }

      const dMax  = dMaxRef.current;
      const dMin  = dMinRef.current!;
      const range = dMax - dMin || 1;

      const padTop = H * 0.08;
      const padBot = H * 0.16;
      const chartH = H - padTop - padBot;
      const toY    = (p: number) => padTop + ((dMax - p) / range) * chartH;

      // ── Grid lines ─────────────────────────────────────────
      ctx.strokeStyle = "rgba(0, 229, 255, 0.05)";
      ctx.lineWidth   = 1;
      for (let row = 0; row <= 4; row++) {
        const y = padTop + (row / 4) * chartH;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // ── Candles ────────────────────────────────────────────
      all.forEach((c, i) => {
        const x = getX(i);
        if (x < -STEP || x > W + STEP) return;

        const isUp   = c.close >= c.open;
        const isLive = live !== null && i === all.length - 1;
        const alpha  = isLive ? 0.9 : 0.72;
        const color  = isUp
          ? `rgba(0, 255, 163, ${alpha})`
          : `rgba(255, 51, 102, ${alpha})`;

        // Wick
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(x + CW / 2, toY(c.high));
        ctx.lineTo(x + CW / 2, toY(c.low));
        ctx.stroke();

        // Body
        const bodyTop = toY(Math.max(c.open, c.close));
        const bodyH   = Math.max(Math.abs(toY(c.open) - toY(c.close)), 1.5);
        ctx.fillStyle = color;
        ctx.fillRect(x, bodyTop, CW, bodyH);
      });

      // ── Smooth close-price line ────────────────────────────
      const pts = all
        .map((c, i) => ({ x: getX(i) + CW / 2, y: toY(c.close) }))
        .filter(p => p.x >= 0 && p.x <= W);

      if (pts.length > 2) {
        const last = pts[pts.length - 1];

        // Area fill under line
        const areaGrad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
        areaGrad.addColorStop(0, "rgba(0, 229, 255, 0.09)");
        areaGrad.addColorStop(1, "rgba(0, 229, 255, 0)");

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(last.x, last.y);
        ctx.lineTo(last.x, padTop + chartH);
        ctx.lineTo(pts[0].x, padTop + chartH);
        ctx.closePath();
        ctx.fillStyle = areaGrad;
        ctx.fill();

        // Line stroke
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(last.x, last.y);
        ctx.strokeStyle = "rgba(0, 229, 255, 0.55)";
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        // Live price dot
        ctx.beginPath();
        ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#00E5FF";
        ctx.fill();

        // Dot halo
        const halo = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 10);
        halo.addColorStop(0, "rgba(0, 229, 255, 0.4)");
        halo.addColorStop(1, "rgba(0, 229, 255, 0)");
        ctx.beginPath();
        ctx.arc(last.x, last.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();
      }

      // ── Edge fades ─────────────────────────────────────────
      const bg = "9, 9, 11";

      const topFade = ctx.createLinearGradient(0, 0, 0, H * 0.2);
      topFade.addColorStop(0, `rgba(${bg}, 1)`);
      topFade.addColorStop(1, `rgba(${bg}, 0)`);
      ctx.fillStyle = topFade;
      ctx.fillRect(0, 0, W, H * 0.2);

      const botFade = ctx.createLinearGradient(0, H * 0.8, 0, H);
      botFade.addColorStop(0, `rgba(${bg}, 0)`);
      botFade.addColorStop(1, `rgba(${bg}, 1)`);
      ctx.fillStyle = botFade;
      ctx.fillRect(0, H * 0.8, W, H * 0.2);

      const leftFade = ctx.createLinearGradient(0, 0, W * 0.06, 0);
      leftFade.addColorStop(0, `rgba(${bg}, 1)`);
      leftFade.addColorStop(1, `rgba(${bg}, 0)`);
      ctx.fillStyle = leftFade;
      ctx.fillRect(0, 0, W * 0.06, H);

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.2 }}
    />
  );
}
