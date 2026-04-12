import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Point {
  x: number;
  y: number;
}

export const CARD_RATIO = 63 / 88; // Standard trading card ratio (63x88mm)

// v4.35 - Pixel-perfect export constants
export const EXPORT_WIDTH = 1260;
export const EXPORT_HEIGHT = 1760;
export const MARGIN_PX = 25; // Exact pixel margin for deadzone
export const MX = MARGIN_PX / EXPORT_WIDTH;
export const MY = MARGIN_PX / EXPORT_HEIGHT;

export function getPixelPerfectRatios(lines: { left: number; right: number; top: number; bottom: number }) {
  const leftPx = Math.round(lines.left * EXPORT_WIDTH);
  const rightPx = Math.round(lines.right * EXPORT_WIDTH);
  const topPx = Math.round(lines.top * EXPORT_HEIGHT);
  const bottomPx = Math.round(lines.bottom * EXPORT_HEIGHT);

  const innerLeft = Math.max(0, leftPx - MARGIN_PX);
  const innerRight = Math.max(0, (EXPORT_WIDTH - MARGIN_PX) - rightPx);
  const innerTop = Math.max(0, topPx - MARGIN_PX);
  const innerBottom = Math.max(0, (EXPORT_HEIGHT - MARGIN_PX) - bottomPx);
  
  const lrTotal = innerLeft + innerRight;
  const tbTotal = innerTop + innerBottom;
  
  return {
    lr: lrTotal > 0 ? (innerLeft / lrTotal) * 100 : 50,
    tb: tbTotal > 0 ? (innerTop / tbTotal) * 100 : 50
  };
}

export function getPerspectiveInterpolation(corners: Point[]) {
  const x0 = corners[0].x, y0 = corners[0].y;
  const x1 = corners[1].x, y1 = corners[1].y;
  const x2 = corners[2].x, y2 = corners[2].y;
  const x3 = corners[3].x, y3 = corners[3].y;

  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const sx = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const sy = y0 - y1 + y2 - y3;

  let h0, h1, h2, h3, h4, h5, h6, h7;

  if (sx === 0 && sy === 0) {
    h0 = x1 - x0;
    h1 = x2 - x1;
    h2 = x0;
    h3 = y1 - y0;
    h4 = y2 - y1;
    h5 = y0;
    h6 = 0;
    h7 = 0;
  } else {
    const det = dx1 * dy2 - dx2 * dy1;
    h6 = (sx * dy2 - dx2 * sy) / det;
    h7 = (dx1 * sy - sx * dy1) / det;
    h0 = x1 - x0 + h6 * x1;
    h1 = x3 - x0 + h7 * x3;
    h2 = x0;
    h3 = y1 - y0 + h6 * y1;
    h4 = y3 - y0 + h7 * y3;
    h5 = y0;
  }

  return (u: number, v: number): Point => {
    const den = h6 * u + h7 * v + 1;
    return {
      x: (h0 * u + h1 * v + h2) / den,
      y: (h3 * u + h4 * v + h5) / den
    };
  };
}
