// v4.14 - Card Flattener Curvature Support + Drag Optimization
import React, { useRef, useEffect } from 'react';
import { Point, CARD_RATIO, getPerspectiveInterpolation } from '../lib/utils';

interface CardFlattenerProps {
  image: string;
  corners: Point[];
  onFlattened: (dataUrl: string) => void;
  filters?: { brightness: number; contrast: number; saturation: number; curvature: number; barrelCurvature: number };
  isDragging?: boolean;
}

export const CardFlattener: React.FC<CardFlattenerProps> = ({ image, corners, onFlattened, filters, isDragging }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const img = new Image();
    if (image.startsWith('http')) {
      img.crossOrigin = "anonymous";
    }

    const processImage = () => {
      if (!active || isDragging) return;
      
      // Debounce the actual processing to keep dragging smooth
      if (timeoutId) clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        if (!active) return;
        
        // Use a high-resolution size that exactly matches 63:88 ratio
        // 1260x1760 is 20x the base 63x88 units
        const width = 1260; 
        const height = 1760;
        canvas.width = width;
        canvas.height = height;

        // Draw blurred background first for dead space
        ctx.save();
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
        ctx.filter = 'blur(60px)';
        ctx.globalAlpha = 0.6;
        // Draw image slightly larger to cover edges
        ctx.drawImage(img, -width * 0.15, -height * 0.15, width * 1.3, height * 1.3);
        ctx.restore();
        
        try {
          // Use 48x48 subdivision (4608 triangles) for maximum precision with perspective
          // Note: We don't clear the canvas in drawPerspective anymore to keep the blurred background
          drawPerspective(ctx, img, corners, width, height, 48, filters?.curvature || 0, filters?.barrelCurvature || 0);
          
          // Small delay before export to ensure GPU finish
          setTimeout(() => {
            if (!active) return;
            try {
              // Use PNG for lossless precision as every pixel matters
              const dataUrl = canvas.toDataURL('image/png');
              onFlattened(dataUrl);
            } catch (e) {
              console.error('Flattening export error:', e);
            }
          }, 100);
        } catch (e) {
          console.error('Flattening transform error:', e);
        }
      }, 200); // 200ms debounce for high-res processing
    };

    img.onload = processImage;
    img.onerror = (e) => console.error('Flattening image load error:', e);
    img.src = image;

    // Handle already loaded images (like data URLs)
    if (img.complete) {
      processImage();
    }

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [image, corners, onFlattened, filters, isDragging]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        position: 'absolute', 
        left: '-5000px', 
        top: '-5000px',
        width: '800px',
        height: '1120px',
        visibility: 'hidden',
        pointerEvents: 'none'
      }} 
    />
  );
};

function drawPerspective(ctx: CanvasRenderingContext2D, img: HTMLImageElement, corners: Point[], targetWidth: number, targetHeight: number, subdivide: number = 16, curvature: number = 0, barrelCurvature: number = 0) {
  // Removed clearRect to preserve blurred background
  
  // Get the perspective-correct interpolation function
  const interpolate = getPerspectiveInterpolation(corners);

  // Add a margin around the card to show context.
  // We want equal pixel thickness on all sides.
  // We use 2% of width as the base margin.
  const mx = 0.02;
  const my = (targetWidth * 0.02) / targetHeight;

  // We need to map target [0, 1] to source [-mx', 1+mx']
  // such that target [mx, 1-mx] maps to source [0, 1]
  const mx_prime = mx / (1 - 2 * mx);
  const my_prime = my / (1 - 2 * my);

  // Curvature factors
  // v3.5 - Reversed both signs to match user preference for centering result
  const c = curvature * 0.001;
  const c2 = barrelCurvature * 0.001;

  for (let y = 0; y < subdivide; y++) {
    for (let x = 0; x < subdivide; x++) {
      const u1 = x / subdivide;
      const v1 = y / subdivide;
      const u2 = (x + 1) / subdivide;
      const v2 = (y + 1) / subdivide;

      const mu1 = u1 * (1 + 2 * mx_prime) - mx_prime;
      const mu2 = u2 * (1 + 2 * mx_prime) - mx_prime;

      // Apply curvature offsets to the vertical mapping
      // c shifts both edges in same direction, c2 shifts them in opposite directions
      const getCurv = (u: number, v: number) => {
        const mu = u * (1 + 2 * mx_prime) - mx_prime;
        return (c + c2 * (1 - 2 * v)) * 4 * mu * (1 - mu);
      };

      const mv1_1 = (v1 * (1 + 2 * my_prime) - my_prime) + getCurv(u1, v1);
      const mv1_2 = (v1 * (1 + 2 * my_prime) - my_prime) + getCurv(u2, v1);
      const mv2_1 = (v2 * (1 + 2 * my_prime) - my_prime) + getCurv(u1, v2);
      const mv2_2 = (v2 * (1 + 2 * my_prime) - my_prime) + getCurv(u2, v2);

      const p1 = interpolate(mu1, mv1_1);
      const p2 = interpolate(mu2, mv1_2);
      const p3 = interpolate(mu2, mv2_2);
      const p4 = interpolate(mu1, mv2_1);

      drawTriangle(ctx, img, p1, p2, p4, 
        {x: u1 * targetWidth, y: v1 * targetHeight}, 
        {x: u2 * targetWidth, y: v1 * targetHeight}, 
        {x: u1 * targetWidth, y: v2 * targetHeight}
      );
      
      drawTriangle(ctx, img, p2, p3, p4, 
        {x: u2 * targetWidth, y: v1 * targetHeight}, 
        {x: u2 * targetWidth, y: v2 * targetHeight}, 
        {x: u1 * targetWidth, y: v2 * targetHeight}
      );
    }
  }
}

function drawTriangle(
  ctx: CanvasRenderingContext2D, 
  img: HTMLImageElement, 
  s1: Point, s2: Point, s3: Point, // Source points (normalized)
  d1: Point, d2: Point, d3: Point // Destination points (pixels)
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
  if (Math.abs(det) < 0.1) {
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
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
