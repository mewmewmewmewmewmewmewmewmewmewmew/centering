import React, { useRef, useEffect, useState } from 'react';
import { Point, CARD_RATIO } from '../lib/utils';

interface CardFlattenerProps {
  image: string;
  corners: Point[];
  onFlattened: (dataUrl: string) => void;
}

export const CardFlattener: React.FC<CardFlattenerProps> = ({ image, corners, onFlattened }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let active = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = image;
    
    img.onload = () => {
      if (!active) return;
      
      const width = 800;
      const height = Math.round(width / CARD_RATIO);
      canvas.width = width;
      canvas.height = height;

      // Ensure clean state
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);
      
      try {
        drawPerspective(ctx, img, corners, width, height);
        
        // Use requestAnimationFrame to ensure the drawing is flushed
        requestAnimationFrame(() => {
          if (!active) return;
          try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            onFlattened(dataUrl);
          } catch (e) {
            console.error('Failed to export flattened image:', e);
          }
        });
      } catch (e) {
        console.error('Perspective transform failed:', e);
      }
    };

    return () => {
      active = false;
    };
  }, [image, corners, onFlattened]);

  return <canvas ref={canvasRef} className="hidden" />;
};

function drawPerspective(ctx: CanvasRenderingContext2D, img: HTMLImageElement, corners: Point[], targetWidth: number, targetHeight: number) {
  // Clear canvas
  ctx.clearRect(0, 0, targetWidth, targetHeight);

  // Use a high-subdivision grid to approximate perspective transformation accurately.
  const subdivide = 24;
  for (let y = 0; y < subdivide; y++) {
    for (let x = 0; x < subdivide; x++) {
      const u1 = x / subdivide;
      const v1 = y / subdivide;
      const u2 = (x + 1) / subdivide;
      const v2 = (y + 1) / subdivide;

      const p1 = interpolate(corners, u1, v1);
      const p2 = interpolate(corners, u2, v1);
      const p3 = interpolate(corners, u2, v2);
      const p4 = interpolate(corners, u1, v2);

      // Triangle 1: Top-Left, Top-Right, Bottom-Left
      drawTriangle(ctx, img, p1, p2, p4, 
        {x: u1 * targetWidth, y: v1 * targetHeight}, 
        {x: u2 * targetWidth, y: v1 * targetHeight}, 
        {x: u1 * targetWidth, y: v2 * targetHeight},
        u1, v1, u2, v2 // Source bounds
      );
      
      // Triangle 2: Top-Right, Bottom-Right, Bottom-Left
      drawTriangle(ctx, img, p2, p3, p4, 
        {x: u2 * targetWidth, y: v1 * targetHeight}, 
        {x: u2 * targetWidth, y: v2 * targetHeight}, 
        {x: u1 * targetWidth, y: v2 * targetHeight},
        u1, v1, u2, v2 // Source bounds
      );
    }
  }
}

function interpolate(corners: Point[], u: number, v: number): Point {
  const top = { x: corners[0].x + (corners[1].x - corners[0].x) * u, y: corners[0].y + (corners[1].y - corners[0].y) * u };
  const bottom = { x: corners[3].x + (corners[2].x - corners[3].x) * u, y: corners[3].y + (corners[2].y - corners[3].y) * u };
  return { x: top.x + (bottom.x - top.x) * v, y: top.y + (bottom.y - top.y) * v };
}

function drawTriangle(
  ctx: CanvasRenderingContext2D, 
  img: HTMLImageElement, 
  s1: Point, s2: Point, s3: Point, // Source points (normalized)
  d1: Point, d2: Point, d3: Point, // Destination points (pixels)
  uMin: number, vMin: number, uMax: number, vMax: number // Source bounds (normalized)
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.lineTo(d3.x, d3.y);
  ctx.closePath();
  ctx.clip();

  // Source pixel coordinates
  const sw = img.width;
  const sh = img.height;
  
  const m1 = s1.x * sw, m2 = s1.y * sh;
  const m3 = s2.x * sw, m4 = s2.y * sh;
  const m5 = s3.x * sw, m6 = s3.y * sh;

  const n1 = d1.x, n2 = d1.y;
  const n3 = d2.x, n4 = d2.y;
  const n5 = d3.x, n6 = d3.y;

  const det = m1 * (m4 - m6) - m2 * (m3 - m5) + (m3 * m6 - m4 * m5);
  if (Math.abs(det) < 0.0001) {
    ctx.restore();
    return;
  }

  const a = (n1 * (m4 - m6) - m2 * (n3 - n5) + (n3 * m6 - m4 * n5)) / det;
  const b = (m1 * (n3 - n5) - n1 * (m3 - m5) + (m3 * n5 - n3 * m5)) / det;
  const c = (m1 * (m4 * n5 - n3 * m6) - m2 * (m3 * n5 - n3 * m5) + n1 * (m3 * m6 - m4 * m5)) / det;
  const d = (n2 * (m4 - m6) - m2 * (n4 - n6) + (n4 * m6 - m4 * n6)) / det;
  const e = (m1 * (n4 - n6) - n2 * (m3 - m5) + (m3 * n6 - n4 * m5)) / det;
  const f = (m1 * (m4 * n6 - n4 * m6) - m2 * (m3 * n6 - n4 * m5) + n2 * (m3 * m6 - m4 * m5)) / det;

  ctx.setTransform(a, d, b, e, c, f);
  
  // Draw only the relevant part of the image to save GPU memory and avoid black image issues on mobile
  const sx = uMin * sw;
  const sy = vMin * sh;
  const sWidth = (uMax - uMin) * sw;
  const sHeight = (vMax - vMin) * sh;
  
  ctx.drawImage(img, sx, sy, sWidth, sHeight, sx, sy, sWidth, sHeight);
  ctx.restore();
}
