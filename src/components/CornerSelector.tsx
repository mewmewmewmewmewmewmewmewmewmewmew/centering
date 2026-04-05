// v4.28 - Corner Selector Curvature Support + Proxy Canvas Zoom + Mobile Optimizations + Rounded Corners + Sequential Selection
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Point, cn, getPerspectiveInterpolation } from '../lib/utils';

interface CornerSelectorProps {
  image: string;
  corners: Point[];
  onCornersChange: (corners: Point[]) => void;
  onDraggingChange?: (isDragging: boolean) => void;
  filters?: { brightness: number; contrast: number; saturation: number; curvature: number; barrelCurvature: number };
  selectionMode?: 'drag' | 'sequential';
  onSelectionModeChange?: (mode: 'drag' | 'sequential') => void;
  onDragStart?: () => void;
  seqPoints: Point[];
  onSeqPointsChange: (points: Point[]) => void;
  seqStep: number;
  onSeqStepChange: (step: number) => void;
  seqPhase: 'select_region' | 'select_points';
  onSeqPhaseChange: (phase: 'select_region' | 'select_points') => void;
  currentRegion: Point | null;
  onCurrentRegionChange: (region: Point | null) => void;
}

export const CornerSelector: React.FC<CornerSelectorProps> = ({ 
  image, 
  corners, 
  onCornersChange, 
  onDraggingChange, 
  filters, 
  selectionMode = 'drag',
  onSelectionModeChange,
  onDragStart,
  seqPoints,
  onSeqPointsChange,
  seqStep,
  onSeqStepChange,
  seqPhase,
  onSeqPhaseChange,
  currentRegion,
  onCurrentRegionChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [draggingLine, setDraggingLine] = useState<string | null>(null);
  const [hoverLine, setHoverLine] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const zoomCanvasRef = useRef<HTMLCanvasElement>(null);
  const fullZoomCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);

  // Sequential Mode State
  const [seqHoverPos, setSeqHoverPos] = useState<Point | null>(null);

  // Panning State
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  useEffect(() => {
    if (selectionMode === 'drag') {
      onSeqPointsChange([]);
      onSeqStepChange(0);
      onSeqPhaseChange('select_region');
      onCurrentRegionChange(null);
    }
    setPanOffset({ x: 0, y: 0 });
  }, [selectionMode, onSeqPhaseChange, onSeqPointsChange, onSeqStepChange, onCurrentRegionChange]);

  useEffect(() => {
    setIsMobile(window.matchMedia('(max-width: 768px)').matches);
  }, []);

  useEffect(() => {
    const img = new Image();
    if (image.startsWith('http')) {
      img.crossOrigin = "anonymous";
    }
    img.src = image;
    img.onload = () => {
      sourceImageRef.current = img;
      setImgSize({ width: img.width, height: img.height });
    };
  }, [image]);

  useEffect(() => {
    if (draggingIdx === null || !sourceImageRef.current || !zoomCanvasRef.current || !imgSize.width || !containerSize.width) return;
    
    const canvas = zoomCanvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const magSize = isMobile ? 140 : 180;
    
    // v4.6 - Fix zoom level to match v4.4 behavior
    // The previous zoom was 4x relative to the container size.
    // We calculate the source width in original image pixels that corresponds to this.
    const zoomFactor = 4;
    const sw = (magSize / (containerSize.width * zoomFactor)) * imgSize.width;
    const sh = (magSize / (containerSize.height * zoomFactor)) * imgSize.height;

    if (canvas.width !== magSize) {
      canvas.width = magSize;
      canvas.height = magSize;
    }

    const p = corners[draggingIdx];
    const focalX = p.x * imgSize.width;
    const focalY = p.y * imgSize.height;

    const targetX = draggingIdx === 0 || draggingIdx === 3 ? (magSize / 3) : (magSize * 2 / 3);
    const targetY = draggingIdx === 0 || draggingIdx === 1 ? (magSize / 3) : (magSize * 2 / 3);

    const sx = focalX - (targetX / magSize) * sw;
    const sy = focalY - (targetY / magSize) * sh;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, magSize, magSize);
    ctx.drawImage(sourceImageRef.current, sx, sy, sw, sh, 0, 0, magSize, magSize);
  }, [draggingIdx, corners, imgSize, isMobile, containerSize, selectionMode]);

  // Sequential Zoom Effect (High Res Canvas)
  useEffect(() => {
    if (selectionMode !== 'sequential' || seqPhase !== 'select_points' || !sourceImageRef.current || !fullZoomCanvasRef.current || !imgSize.width || !containerSize.width || !currentRegion) return;
    
    const canvas = fullZoomCanvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = containerSize.width;
    const h = containerSize.height;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    // Reset transform to identity then scale by DPR to avoid cumulative scaling
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Draw zoomed image
    const scale = 4;
    const sw = imgSize.width / scale;
    const sh = imgSize.height / scale;
    
    const focalX = currentRegion.x * imgSize.width - (panOffset.x / (w * scale)) * imgSize.width;
    const focalY = currentRegion.y * imgSize.height - (panOffset.y / (h * scale)) * imgSize.height;

    const sx = focalX - sw / 2;
    const sy = focalY - sh / 2;

    // Apply filters if any
    if (filters) {
      ctx.filter = `brightness(${100 + filters.brightness}%) contrast(${100 + filters.contrast}%) saturate(${100 + filters.saturation}%)`;
    }

    ctx.drawImage(sourceImageRef.current, sx, sy, sw, sh, 0, 0, w, h);
    ctx.filter = 'none';
  }, [selectionMode, seqPhase, currentRegion, panOffset, imgSize, containerSize, filters]);

  const cornersRef = useRef(corners);
  const rectRef = useRef<DOMRect | null>(null);
  const startDragPos = useRef({ x: 0, y: 0 });
  const startCorners = useRef<Point[]>([]);

  useEffect(() => {
    cornersRef.current = corners;
  }, [corners]);

  // Handle dragging with window listeners to allow dragging outside the container
  useEffect(() => {
    if (draggingIdx === null && draggingLine === null) {
      rectRef.current = null;
      return;
    }

    if (containerRef.current) {
      rectRef.current = containerRef.current.getBoundingClientRect();
    }

    const onMove = (clientX: number, clientY: number) => {
      if (!rectRef.current) return;
      const rect = rectRef.current;
      
      if (draggingIdx !== null) {
        // Inward offsets (handles inside the box)
        const offsetX = draggingIdx === 0 || draggingIdx === 3 ? 16 : -16;
        const offsetY = draggingIdx === 0 || draggingIdx === 1 ? 16 : -16;

        // Calculate pixel position relative to container
        const targetPxX = clientX - rect.left - offsetX;
        const targetPxY = clientY - rect.top - offsetY;

        const x = Math.max(0, Math.min(1, targetPxX / rect.width));
        const y = Math.max(0, Math.min(1, targetPxY / rect.height));

        const newCorners = [...cornersRef.current];
        newCorners[draggingIdx] = { x, y };
        onCornersChange(newCorners);
      } else if (draggingLine !== null) {
        const isHorizontalDrag = draggingLine === 'left' || draggingLine === 'right';
        const isVerticalDrag = draggingLine === 'top' || draggingLine === 'bottom';
        
        const dx = isHorizontalDrag ? (clientX - startDragPos.current.x) / rect.width : 0;
        const dy = isVerticalDrag ? (clientY - startDragPos.current.y) / rect.height : 0;
        
        const newCorners = [...startCorners.current];
        const indices = draggingLine === 'top' ? [0, 1] : 
                        draggingLine === 'right' ? [1, 2] : 
                        draggingLine === 'bottom' ? [2, 3] : [3, 0];
        
        indices.forEach(idx => {
          newCorners[idx] = {
            x: Math.max(0, Math.min(1, startCorners.current[idx].x + dx)),
            y: Math.max(0, Math.min(1, startCorners.current[idx].y + dy))
          };
        });
        onCornersChange(newCorners);
      }
      
      setMousePos({ x: clientX, y: clientY });
    };

    const onWindowMouseMove = (e: MouseEvent) => {
      onMove(e.clientX, e.clientY);
    };

    const onWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        // Prevent scrolling while dragging
        if (draggingIdx !== null || draggingLine !== null) {
          e.preventDefault();
        }
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onWindowEnd = () => {
      setDraggingIdx(null);
      setDraggingLine(null);
      setIsDragging(false);
      onDraggingChange?.(false);
    };

    window.addEventListener('mousemove', onWindowMouseMove, { passive: true });
    window.addEventListener('mouseup', onWindowEnd);
    window.addEventListener('touchmove', onWindowTouchMove, { passive: false });
    window.addEventListener('touchend', onWindowEnd);
    window.addEventListener('touchcancel', onWindowEnd);

    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowEnd);
      window.removeEventListener('touchmove', onWindowTouchMove);
      window.removeEventListener('touchend', onWindowEnd);
      window.removeEventListener('touchcancel', onWindowEnd);
    };
  }, [draggingIdx, draggingLine, onCornersChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    
    observer.observe(el);
    return () => observer.disconnect();
  }, [image]); // Re-run when image changes to ensure ref is captured

  const handleMouseDown = (idx: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    onDragStart?.();
    setDraggingIdx(idx);
    setIsDragging(true);
    onDraggingChange?.(true);
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleTouchStart = (idx: number) => (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      onDragStart?.();
      setDraggingIdx(idx);
      setIsDragging(true);
      onDraggingChange?.(true);
      setMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleLineMouseDown = (side: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    onDragStart?.();
    setDraggingLine(side);
    setIsDragging(true);
    onDraggingChange?.(true);
    startDragPos.current = { x: e.clientX, y: e.clientY };
    startCorners.current = [...corners];
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleLineTouchStart = (side: string) => (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      onDragStart?.();
      setDraggingLine(side);
      setIsDragging(true);
      onDraggingChange?.(true);
      startDragPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      startCorners.current = [...corners];
      setMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (selectionMode === 'sequential' && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setSeqHoverPos({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height
      });
    }
  };

  const handleSequentialClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (selectionMode !== 'sequential' || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    
    let x = (clientX - rect.left) / rect.width;
    let y = (clientY - rect.top) / rect.height;

    if (seqPhase === 'select_region') {
      onDragStart?.();
      onCurrentRegionChange({ x, y });
      onSeqPhaseChange('select_points');
      return;
    }
    
    // Map zoomed coordinates back to original space
    const scale = 4;
    x = currentRegion!.x + (x - 0.5) / scale - (panOffset.x / (containerSize.width * scale));
    y = currentRegion!.y + (y - 0.5) / scale - (panOffset.y / (containerSize.height * scale));

    onDragStart?.();
    const newPoints = [...seqPoints, { x, y }];
    onSeqPointsChange(newPoints);
    
    if (newPoints.length % 2 === 0) {
      // Finished a corner
      if (newPoints.length === 8) {
        // Calculate 4 corners from 8 points using line intersections
        // We sort each pair of points to ensure we know which edge they belong to,
        // making the tool robust to click order.
        
        const getIntersection = (p1: Point, p2: Point, p3: Point, p4: Point): Point => {
          const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
          const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
          const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
          if (Math.abs(denom) < 0.000001) return { x: (x1 + x3) / 2, y: (y1 + y3) / 2 };
          const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
          return { x: x1 + ua * (x2 - x1), y: y1 + ua * (y2 - y1) };
        };

        // TL: Top point is further right, Left point is further down
        const tlPts = [newPoints[0], newPoints[1]];
        const tlTop = tlPts[0].x > tlPts[1].x ? tlPts[0] : tlPts[1];
        const tlLeft = tlPts[0].y > tlPts[1].y ? tlPts[0] : tlPts[1];

        // TR: Top point is further left, Right point is further down
        const trPts = [newPoints[2], newPoints[3]];
        const trTop = trPts[0].x < trPts[1].x ? trPts[0] : trPts[1];
        const trRight = trPts[0].y > trPts[1].y ? trPts[0] : trPts[1];

        // BR: Bottom point is further left, Right point is further up
        const brPts = [newPoints[4], newPoints[5]];
        const brBottom = brPts[0].x < brPts[1].x ? brPts[0] : brPts[1];
        const brRight = brPts[0].y < brPts[1].y ? brPts[0] : brPts[1];

        // BL: Bottom point is further right, Left point is further up
        const blPts = [newPoints[6], newPoints[7]];
        const blBottom = blPts[0].x > blPts[1].x ? blPts[0] : blPts[1];
        const blLeft = blPts[0].y < blPts[1].y ? blPts[0] : blPts[1];

        const finalCorners: Point[] = [
          getIntersection(blLeft, tlLeft, tlTop, trTop), // TL
          getIntersection(tlTop, trTop, trRight, brRight), // TR
          getIntersection(trRight, brRight, brBottom, blBottom), // BR
          getIntersection(brBottom, blBottom, blLeft, tlLeft)  // BL
        ];

        onCornersChange(finalCorners as [Point, Point, Point, Point]);
        onSeqPointsChange([]);
        onSeqStepChange(0);
        onSeqPhaseChange('select_region');
        onCurrentRegionChange(null);
        setPanOffset({ x: 0, y: 0 });
        onSelectionModeChange?.('drag');
      } else {
        onSeqStepChange(newPoints.length);
        onSeqPhaseChange('select_region');
        onCurrentRegionChange(null);
        setPanOffset({ x: 0, y: 0 });
      }
    } else {
      onSeqStepChange(newPoints.length);
    }
  };

  const getDynamicRadius = () => {
    const topWidth = Math.sqrt(Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2));
    const bottomWidth = Math.sqrt(Math.pow(corners[2].x - corners[3].x, 2) + Math.pow(corners[2].y - corners[3].y, 2));
    const avgWidth = (topWidth + bottomWidth) / 2;
    return avgWidth * containerSize.width * 0.05;
  };

  const getCornerPath = (idx: number, radius: number) => {
    const neighbors = idx === 0 ? [1, 3] :
                      idx === 1 ? [0, 2] :
                      idx === 2 ? [1, 3] : [2, 0];
    
    const p0 = corners[idx];
    const p1 = corners[neighbors[0]];
    const p2 = corners[neighbors[1]];

    const v1 = {
      x: (p1.x - p0.x) * containerSize.width,
      y: (p1.y - p0.y) * containerSize.height
    };
    const v2 = {
      x: (p2.x - p0.x) * containerSize.width,
      y: (p2.y - p0.y) * containerSize.height
    };

    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (len1 === 0 || len2 === 0) return "";

    const u1 = { x: v1.x / len1, y: v1.y / len1 };
    const u2 = { x: v2.x / len2, y: v2.y / len2 };

    const start = { x: u1.x * radius, y: u1.y * radius };
    const end = { x: u2.x * radius, y: u2.y * radius };

    // Use a quadratic Bezier to approximate the rounded corner
    // The control point is the corner itself (0,0 in local space)
    return `M ${start.x},${start.y} Q 0,0 ${end.x},${end.y}`;
  };

  const r = getDynamicRadius();

  // Calculate zoom transform for sequential mode
  const handleSeqMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (selectionMode !== 'sequential') return;
    
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    
    if (seqPhase === 'select_points') {
      setIsPanning(true);
      dragStartPos.current = { x: clientX, y: clientY };
      hasMoved.current = false;
    }
  };

  const handleSeqMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (selectionMode !== 'sequential' || !containerRef.current) return;

    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;

    if (isPanning && seqPhase === 'select_points') {
      const dx = clientX - dragStartPos.current.x;
      const dy = clientY - dragStartPos.current.y;
      
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved.current = true;
      }
      
      setPanOffset(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      
      dragStartPos.current = { x: clientX, y: clientY };
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    setSeqHoverPos({ x, y });
  };

  const handleSeqMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (selectionMode !== 'sequential') return;
    
    if (isPanning) {
      setIsPanning(false);
      if (hasMoved.current) return;
    }

    handleSequentialClick(e);
  };

  const getSequentialTransform = () => {
    return 'none';
  };

  const mapImageToScreen = (p: Point) => {
    if (selectionMode !== 'sequential' || seqPhase !== 'select_points' || !currentRegion) return p;
    const scale = 4;
    return {
      x: (p.x - currentRegion.x) * scale + 0.5 + (panOffset.x / containerSize.width),
      y: (p.y - currentRegion.y) * scale + 0.5 + (panOffset.y / containerSize.height)
    };
  };

  return (
    <div className="relative flex flex-col items-center overflow-hidden p-0 rounded-lg border border-white/5 bg-black/20">
      <div 
        ref={containerRef}
        className={cn(
          "relative select-none w-full h-auto max-w-full",
          selectionMode === 'sequential' 
            ? (isPanning ? "cursor-grabbing" : (seqPhase === 'select_points' ? "cursor-crosshair" : "cursor-zoom-in")) 
            : "cursor-default"
        )}
        onMouseDown={handleSeqMouseDown}
        onMouseMove={(e) => {
          if (selectionMode === 'drag') handleMouseMove(e);
          else handleSeqMouseMove(e);
        }}
        onMouseUp={handleSeqMouseUp}
        onTouchStart={handleSeqMouseDown}
        onTouchMove={handleSeqMouseMove}
        onTouchEnd={handleSeqMouseUp}
        style={{
          aspectRatio: imgSize.width && imgSize.height ? `${imgSize.width} / ${imgSize.height}` : 'auto',
          willChange: 'auto'
        }}
      >
        {selectionMode === 'sequential' && seqPhase === 'select_points' ? (
          <canvas 
            ref={fullZoomCanvasRef}
            className="w-full h-full block rounded-lg"
            style={{ imageRendering: 'auto' }}
          />
        ) : (
          <img 
            src={image} 
            className="w-full h-full block pointer-events-none object-contain rounded-lg" 
            alt="Card to analyze" 
            style={{
              filter: filters ? `brightness(${100 + filters.brightness}%) contrast(${100 + filters.contrast}%) saturate(${100 + filters.saturation}%)` : 'none'
            }}
          />
        )}

        {selectionMode === 'drag' ? (
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" 
            viewBox={`0 0 ${containerSize.width} ${containerSize.height}`} 
            preserveAspectRatio="none"
          >
            {/* Perspective Box with Curvature */}
            {(() => {
              const p0 = corners[0], p1 = corners[1], p2 = corners[2], p3 = corners[3];
              const w = containerSize.width, h = containerSize.height;
              
              // v4.7 - Simplify SVG during drag on mobile to save CPU
              if (isMobile && isDragging) {
                return (
                  <path 
                    d={`M ${p0.x * w},${p0.y * h} L ${p1.x * w},${p1.y * h} L ${p2.x * w},${p2.y * h} L ${p3.x * w},${p3.y * h} Z`}
                    className="fill-red-600/5 stroke-red-600 stroke-[2] stroke-dasharray-[6,6]"
                  />
                );
              }

              const curv = (filters?.curvature || 0) * 0.001;
              const bCurv = (filters?.barrelCurvature || 0) * 0.001;
              
              // Perspective-correct midpoints
              const interpolate = getPerspectiveInterpolation(corners);
              
              // Top edge (v=0)
              const topOffset = curv + bCurv;
              const pTopMid = interpolate(0.5, topOffset);
              const cpTop = {
                x: (2 * pTopMid.x - 0.5 * p0.x - 0.5 * p1.x) * w,
                y: (2 * pTopMid.y - 0.5 * p0.y - 0.5 * p1.y) * h
              };

              // Bottom edge (v=1)
              const bottomOffset = curv - bCurv;
              const pBottomMid = interpolate(0.5, 1 + bottomOffset);
              const cpBottom = {
                x: (2 * pBottomMid.x - 0.5 * p2.x - 0.5 * p3.x) * w,
                y: (2 * pBottomMid.y - 0.5 * p2.y - 0.5 * p3.y) * h
              };

              const pathData = `
                M ${p0.x * w},${p0.y * h}
                Q ${cpTop.x},${cpTop.y} ${p1.x * w},${p1.y * h}
                L ${p2.x * w},${p2.y * h}
                Q ${cpBottom.x},${cpBottom.y} ${p3.x * w},${p3.y * h}
                Z
              `;

              return (
                <>
                  <path 
                    d={pathData}
                    className={cn(
                      "fill-red-600/5 stroke-red-600 stroke-[2] transition-all",
                      draggingLine ? "stroke-red-600 stroke-[3]" : ""
                    )}
                    strokeDasharray={draggingLine ? "0" : "6 6"}
                  />
                  
                  {/* Edge Highlights (Curved) */}
                  {(hoverLine || draggingLine) && (() => {
                    const activeSide = draggingLine || hoverLine;
                    let d = "";
                    if (activeSide === 'top') {
                      d = `M ${p0.x * w},${p0.y * h} Q ${cpTop.x},${cpTop.y} ${p1.x * w},${p1.y * h}`;
                    } else if (activeSide === 'bottom') {
                      d = `M ${p2.x * w},${p2.y * h} Q ${cpBottom.x},${cpBottom.y} ${p3.x * w},${p3.y * h}`;
                    } else if (activeSide === 'right') {
                      d = `M ${p1.x * w},${p1.y * h} L ${p2.x * w},${p2.y * h}`;
                    } else if (activeSide === 'left') {
                      d = `M ${p3.x * w},${p3.y * h} L ${p0.x * w},${p0.y * h}`;
                    }

                    return (
                      <path 
                        d={d}
                        fill="none"
                        className="stroke-red-600/40 stroke-[8] transition-all pointer-events-none"
                      />
                    );
                  })()}
                </>
              );
            })()}
            {/* Crosshairs for each corner */}
            {(!isMobile || !isDragging) && corners.map((p, i) => {
              const p0 = corners[0], p1 = corners[1], p2 = corners[2], p3 = corners[3];
              const w = containerSize.width, h = containerSize.height;
              const curv = (filters?.curvature || 0) * 0.001;
              const bCurv = (filters?.barrelCurvature || 0) * 0.001;
              
              const interpolate = getPerspectiveInterpolation(corners);
              const topOffset = curv + bCurv;
              const bottomOffset = curv - bCurv;

              let angle1 = 0; // Horizontal (curved)
              let angle2 = 0; // Vertical (straight)

              if (i === 0) {
                const pNext = interpolate(0.1, topOffset);
                angle1 = Math.atan2((pNext.y - p0.y) * h, (pNext.x - p0.x) * w);
                angle2 = Math.atan2((p3.y - p0.y) * h, (p3.x - p0.x) * w);
              } else if (i === 1) {
                const pPrev = interpolate(0.9, topOffset);
                angle1 = Math.atan2((pPrev.y - p1.y) * h, (pPrev.x - p1.x) * w);
                angle2 = Math.atan2((p2.y - p1.y) * h, (p2.x - p1.x) * w);
              } else if (i === 2) {
                const pPrev = interpolate(0.9, 1 + bottomOffset);
                angle1 = Math.atan2((pPrev.y - p2.y) * h, (pPrev.x - p2.x) * w);
                angle2 = Math.atan2((p1.y - p2.y) * h, (p1.x - p2.x) * w);
              } else if (i === 3) {
                const pNext = interpolate(0.1, 1 + bottomOffset);
                angle1 = Math.atan2((pNext.y - p3.y) * h, (pNext.x - p3.x) * w);
                angle2 = Math.atan2((p0.y - p3.y) * h, (p0.x - p3.x) * w);
              }

              return (
                <g key={`cross-${i}`} transform={`translate(${p.x * w}, ${p.y * h})`}>
                  {/* Outer crosshair lines (extensions) matching perspective */}
                  <line 
                    x1={Math.cos(angle1 + Math.PI) * 6} 
                    y1={Math.sin(angle1 + Math.PI) * 6} 
                    x2={Math.cos(angle1 + Math.PI) * 30} 
                    y2={Math.sin(angle1 + Math.PI) * 30} 
                    className="stroke-white/50 stroke-[2]" 
                  />
                  <line 
                    x1={Math.cos(angle2 + Math.PI) * 6} 
                    y1={Math.sin(angle2 + Math.PI) * 6} 
                    x2={Math.cos(angle2 + Math.PI) * 30} 
                    y2={Math.sin(angle2 + Math.PI) * 30} 
                    className="stroke-white/50 stroke-[2]" 
                  />
                  
                  <circle cx="0" cy="0" r="2.5" className="fill-red-600" />
                  <path 
                    d={getCornerPath(i, r)} 
                    fill="none" 
                    className="stroke-red-600 stroke-[4]" 
                  />
                  {/* Theoretical sharp corner lines following actual perspective */}
                  <line x1={0} y1={0} x2={Math.cos(angle1) * 60} y2={Math.sin(angle1) * 60} className="stroke-red-600/30 stroke-[2]" />
                  <line x1={0} y1={0} x2={Math.cos(angle2) * 60} y2={Math.sin(angle2) * 60} className="stroke-red-600/30 stroke-[2]" />
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="absolute inset-0 pointer-events-none">
            {/* Points already placed */}
            {seqPoints.map((p, i) => {
              const sp = mapImageToScreen(p);
              return (
                <div 
                  key={i}
                  className="absolute w-4 h-4 bg-[#ef4444] rounded-full shadow-[0_0_12px_rgba(239,68,68,0.8)] -translate-x-1/2 -translate-y-1/2 border-2 border-white/20"
                  style={{ left: `${sp.x * 100}%`, top: `${sp.y * 100}%` }}
                />
              );
            })}
            
            {/* Current Hover Point & Custom Crosshair */}
            {seqHoverPos && (
              <>
                {seqPhase === 'select_points' && !isPanning && (
                  <div 
                    className="absolute pointer-events-none z-50 flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${seqHoverPos.x * 100}%`, top: `${seqHoverPos.y * 100}%` }}
                  >
                    <div className="absolute w-10 h-[1px] bg-red-600" />
                    <div className="absolute h-10 w-[1px] bg-red-600" />
                  </div>
                )}
                <div 
                  className="absolute w-8 h-8 border-2 border-[#ef4444] rounded-full -translate-x-1/2 -translate-y-1/2 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                  style={{ left: `${seqHoverPos.x * 100}%`, top: `${seqHoverPos.y * 100}%` }}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Sequential Mode Instructions & Diagram (Outside transformed container) */}
      {selectionMode === 'sequential' && (
        <motion.div 
          drag
          dragMomentum={false}
          whileDrag={{ scale: 1.05, opacity: 0.9, cursor: 'grabbing' }}
          initial={{ x: "-50%", y: 0, opacity: 0 }}
          animate={{ x: "-50%", y: 0, opacity: 1 }}
          style={{ x: "-50%" }}
          className="absolute bottom-6 left-1/2 z-[100] bg-black/40 backdrop-blur-md border border-white/20 rounded-2xl p-2 shadow-2xl flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
        >
          <p className="text-[9px] font-bold text-[#e6bbd4] uppercase tracking-widest px-2 pointer-events-none select-none">
            {seqPhase === 'select_region' 
              ? `Select ${['first', 'second', 'third', 'fourth'][Math.floor(seqStep / 2)]} corner` 
              : 'Mark both ends of this corner'}
          </p>
          
          <div className="relative w-20 h-20 flex items-center justify-center overflow-hidden pointer-events-none">
            {seqPhase === 'select_region' ? (
              <svg width="60" height="60" viewBox="0 0 100 100">
                <rect x="25" y="15" width="50" height="70" rx="4" fill="none" stroke="white" strokeWidth="2" strokeDasharray="4 2" opacity="0.3" />
                {(() => {
                  const rIdx = Math.floor(seqStep / 2);
                  const pos = [
                    { cx: 25, cy: 15, d: "M 25,35 L 25,15 L 45,15" },
                    { cx: 75, cy: 15, d: "M 55,15 L 75,15 L 75,35" },
                    { cx: 75, cy: 85, d: "M 75,65 L 75,85 L 55,85" },
                    { cx: 25, cy: 85, d: "M 45,85 L 25,85 L 25,65" }
                  ][rIdx];
                  return (
                    <>
                      <circle cx={pos.cx} cy={pos.cy} r="6" fill="#ef4444" className="animate-pulse" />
                      <path d={pos.d} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                      
                      {[0, 1, 2, 3].filter(i => i !== rIdx).map(i => {
                        const p = [{cx:25,cy:15},{cx:75,cy:15},{cx:75,cy:85},{cx:25,cy:85}][i];
                        return <circle key={i} cx={p.cx} cy={p.cy} r="4" fill="white" opacity="0.2" />;
                      })}
                    </>
                  );
                })()}
              </svg>
            ) : (
              <svg width="60" height="60" viewBox="0 0 100 100">
                <g transform={`rotate(${Math.floor(seqStep / 2) * 90} 50 50)`}>
                  <path 
                    d="M 10,70 L 10,30 Q 10,10 30,10 L 70,10" 
                    fill="none" 
                    stroke="white" 
                    strokeWidth="2" 
                    strokeDasharray="4 2"
                    className="opacity-30"
                  />
                  <path 
                    d="M 10,30 Q 10,10 30,10" 
                    fill="none" 
                    stroke="#ef4444" 
                    strokeWidth="4" 
                    strokeLinecap="round"
                  />
                  <circle cx="10" cy="30" r="5" fill="#ef4444" className="animate-pulse" />
                  <circle cx="30" cy="10" r="5" fill="#ef4444" className="animate-pulse" />
                  
                  <text x="15" y="45" fill="white" fontSize="10" className="font-mono font-bold" transform={`rotate(${-Math.floor(seqStep / 2) * 90} 15 45)`}>1</text>
                  <text x="35" y="25" fill="white" fontSize="10" className="font-mono font-bold" transform={`rotate(${-Math.floor(seqStep / 2) * 90} 35 25)`}>2</text>
                </g>
              </svg>
            )}
          </div>

          <div className="flex gap-1.5 pb-1 pointer-events-none select-none">
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
              <div 
                key={i} 
                className={cn(
                  "w-1 h-1 rounded-full transition-all duration-300",
                  i < seqStep ? "bg-[#ef4444]" : i === seqStep ? "bg-white scale-125 shadow-[0_0_8px_white]" : "bg-white/10"
                )} 
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Draggable Lines (Invisible hit areas) */}
      {selectionMode === 'drag' && ['top', 'right', 'bottom', 'left'].map((side) => {
        const indices = side === 'top' ? [0, 1] : 
                        side === 'right' ? [1, 2] : 
                        side === 'bottom' ? [2, 3] : [3, 0];
        const p1 = corners[indices[0]];
        const p2 = corners[indices[1]];
        
        const cx = ((p1.x + p2.x) / 2) * containerSize.width;
        const cy = ((p1.y + p2.y) / 2) * containerSize.height;
        const angle = Math.atan2((p2.y - p1.y) * containerSize.height, (p2.x - p1.x) * containerSize.width);
        const length = Math.sqrt(Math.pow((p2.x - p1.x) * containerSize.width, 2) + Math.pow((p2.y - p1.y) * containerSize.height, 2));

        return (
          <div
            key={side}
            onMouseDown={handleLineMouseDown(side)}
            onTouchStart={handleLineTouchStart(side)}
            onMouseEnter={() => setHoverLine(side)}
            onMouseLeave={() => setHoverLine(null)}
            className="absolute cursor-move z-10 pointer-events-auto"
            style={{
              left: `${cx}px`,
              top: `${cy}px`,
              width: `${length - 40}px`,
              height: '24px',
              transform: `translate(-50%, -50%) rotate(${angle}rad)`,
            }}
          />
        );
      })}

      {/* Drag Handles */}
      {selectionMode === 'drag' && corners.map((p, i) => {
        const offsetX = i === 0 || i === 3 ? 16 : -16;
        const offsetY = i === 0 || i === 1 ? 16 : -16;

        return (
          <div
            key={i}
            onMouseDown={handleMouseDown(i)}
            onTouchStart={handleTouchStart(i)}
            className={cn(
              "absolute w-6 h-6 rounded-full border-2 border-red-600 shadow-xl cursor-grab active:cursor-grabbing pointer-events-auto flex items-center justify-center z-20 transition-transform hover:scale-110",
              draggingIdx === i ? "bg-red-600 scale-125" : ""
            )}
            style={{ 
              left: `${p.x * containerSize.width}px`, 
              top: `${p.y * containerSize.height}px`,
              transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
              backgroundImage: draggingIdx === i ? 'none' : 'repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(220, 38, 38, 0.3) 2px, rgba(220, 38, 38, 0.3) 4px)',
              willChange: 'transform'
            }}
          >
            <div className="w-2 h-2 rounded-full bg-white/20" />
          </div>
        );
      })}
      {/* Magnifier / Zoom (Drag Mode) */}
      {selectionMode === 'drag' && draggingIdx !== null && containerRef.current && (
    <div 
      className="absolute pointer-events-none z-50 border-4 border-red-600 rounded-full overflow-hidden shadow-2xl bg-black box-content"
      style={{
        width: isMobile ? '140px' : '180px',
        height: isMobile ? '140px' : '180px',
        left: `${Math.max(isMobile ? 70 : 90, Math.min(containerSize.width - (isMobile ? 70 : 90), corners[draggingIdx].x * containerSize.width))}px`,
        top: `${Math.max(isMobile ? 70 : 90, Math.min(containerSize.height - (isMobile ? 70 : 90), (corners[draggingIdx].y * containerSize.height) + (draggingIdx < 2 ? (isMobile ? 100 : 120) : -(isMobile ? 100 : 120))))}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {(() => {
        const zoom = 4;
        const magSize = isMobile ? 140 : 180;
        const focalX = corners[draggingIdx].x * containerSize.width;
        const focalY = corners[draggingIdx].y * containerSize.height;

        // Move the center of the zoom around the corner radius
        // We shift the sharp corner towards the edge of the magnifier to show more of the card's interior
        const targetX = draggingIdx === 0 || draggingIdx === 3 ? (magSize / 3) : (magSize * 2 / 3);
        const targetY = draggingIdx === 0 || draggingIdx === 1 ? (magSize / 3) : (magSize * 2 / 3);

        // Calculate angles for the two edges connected to this corner
        const neighbors = draggingIdx === 0 ? [1, 3] :
                          draggingIdx === 1 ? [0, 2] :
                          draggingIdx === 2 ? [1, 3] : [2, 0];
        
        const p0 = corners[draggingIdx];
        const p1 = corners[neighbors[0]];
        const p2 = corners[neighbors[1]];

        const angle1 = Math.atan2((p1.y - p0.y) * containerSize.height, (p1.x - p0.x) * containerSize.width);
        const angle2 = Math.atan2((p2.y - p0.y) * containerSize.height, (p2.x - p0.x) * containerSize.width);

        return (
          <>
            <canvas 
              ref={zoomCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{
                filter: filters ? `brightness(${100 + filters.brightness}%) contrast(${100 + filters.contrast}%) saturate(${100 + filters.saturation}%)` : 'none',
                imageRendering: 'pixelated'
              }}
            />
            
            <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${magSize} ${magSize}`}>
              <g transform={`translate(${targetX}, ${targetY}) scale(${zoom})`}>
                {/* Perspective-aligned crosshair guides */}
                <line 
                  x1={Math.cos(angle1 + Math.PI) * 30} 
                  y1={Math.sin(angle1 + Math.PI) * 30} 
                  x2={Math.cos(angle1) * 30} 
                  y2={Math.sin(angle1) * 30} 
                  className="stroke-white/50" 
                  strokeWidth="1" 
                  vectorEffect="non-scaling-stroke" 
                />
                <line 
                  x1={Math.cos(angle2 + Math.PI) * 30} 
                  y1={Math.sin(angle2 + Math.PI) * 30} 
                  x2={Math.cos(angle2) * 30} 
                  y2={Math.sin(angle2) * 30} 
                  className="stroke-white/50" 
                  strokeWidth="1" 
                  vectorEffect="non-scaling-stroke" 
                />
                <circle cx="0" cy="0" r="2" className="fill-red-600" />
                
                {/* Rounded corner guide */}
                <path d={getCornerPath(draggingIdx, r)} fill="none" className="stroke-red-600" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                
                {/* Dynamic edge lines reflecting actual perspective */}
                <line x1={0} y1={0} x2={Math.cos(angle1) * 60} y2={Math.sin(angle1) * 60} className="stroke-red-600" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <line x1={0} y1={0} x2={Math.cos(angle2) * 60} y2={Math.sin(angle2) * 60} className="stroke-red-600" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                
                {/* Faint extension lines */}
                <line x1={0} y1={0} x2={Math.cos(angle1) * 120} y2={Math.sin(angle1) * 120} className="stroke-red-600/20" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <line x1={0} y1={0} x2={Math.cos(angle2) * 120} y2={Math.sin(angle2) * 120} className="stroke-red-600/20" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              </g>
            </svg>
          </>
        );
      })()}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div className="w-full h-[1px] bg-white" />
        <div className="h-full w-[1px] bg-white" />
      </div>
    </div>
      )}
    </div>
  );
};
