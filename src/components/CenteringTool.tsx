// v4.14 - Centering Tool Refinements
import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';

interface CenteringToolProps {
  image: string;
  originalImage: string;
  onRatiosChange: (lr: number, tb: number) => void;
  filters?: { brightness: number; contrast: number; saturation: number; curvature: number };
}

export const CenteringTool: React.FC<CenteringToolProps> = ({ image, originalImage, onRatiosChange, filters }) => {
  const MARGIN = 0.02;
  const CARD_SIZE = 0.96; // 1 - 2 * MARGIN
  const DEFAULT_OFFSET = 0.03;

  const [lines, setLines] = useState(() => {
    const mx = 0.02;
    const my = (63 * 0.02) / 88;
    const cardW = 1 - 2 * mx;
    const cardH = 1 - 2 * my;
    return {
      left: mx + (cardW * DEFAULT_OFFSET),
      right: (1 - mx) - (cardW * DEFAULT_OFFSET),
      top: my + (cardH * DEFAULT_OFFSET),
      bottom: (1 - my) - (cardH * DEFAULT_OFFSET)
    };
  });
  const [linesInitialized, setLinesInitialized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState<string | null>(null);

  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });

  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (containerSize.width && containerSize.height && !linesInitialized) {
      const mx = 0.02;
      const my = (containerSize.width * 0.02) / containerSize.height;
      const cardW = 1 - 2 * mx;
      const cardH = 1 - 2 * my;
      
      const initialLines = {
        left: mx + (cardW * DEFAULT_OFFSET),
        right: (1 - mx) - (cardW * DEFAULT_OFFSET),
        top: my + (cardH * DEFAULT_OFFSET),
        bottom: (1 - my) - (cardH * DEFAULT_OFFSET)
      };
      
      setLines(initialLines);
      setLinesInitialized(true);

      // Report initial ratios
      const leftWidth = initialLines.left;
      const rightWidth = 1 - initialLines.right;
      const topHeight = initialLines.top;
      const bottomHeight = 1 - initialLines.bottom;
      const lrTotal = leftWidth + rightWidth;
      const tbTotal = topHeight + bottomHeight;
      const lrRatio = (leftWidth / lrTotal) * 100;
      const tbRatio = (topHeight / tbTotal) * 100;
      onRatiosChange(lrRatio, tbRatio);
    }
  }, [containerSize, linesInitialized]);

  const handleMouseDown = (side: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      let zX = x;
      let zY = y;
      if (side === 'left') zX = 0;
      if (side === 'right') zX = 100;
      if (side === 'top') zY = 0;
      if (side === 'bottom') zY = 100;
      
      setZoomOrigin({ x: zX, y: zY });
    }
    setDragging(side);
  };

  const handleTouchStart = (side: string) => (e: React.TouchEvent) => {
    if (e.touches.length > 0 && containerRef.current) {
      e.preventDefault(); // Prevent scroll start
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
      const y = ((e.touches[0].clientY - rect.top) / rect.height) * 100;
      
      let zX = x;
      let zY = y;
      if (side === 'left') zX = 0;
      if (side === 'right') zX = 100;
      if (side === 'top') zY = 0;
      if (side === 'bottom') zY = 100;
      
      setZoomOrigin({ x: zX, y: zY });
      setDragging(side);
    }
  };

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const onMove = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    setMousePos({ x: clientX, y: clientY });

    if (!dragging) return;

    // Update zoomOrigin dynamically while dragging to keep the edge flush
    let zX = x * 100;
    let zY = y * 100;
    if (dragging === 'left') zX = 0;
    if (dragging === 'right') zX = 100;
    if (dragging === 'top') zY = 0;
    if (dragging === 'bottom') zY = 100;
    setZoomOrigin({ x: zX, y: zY });

    const newLines = { ...lines };
    if (dragging === 'left') newLines.left = Math.max(0, Math.min(lines.right - 0.01, x));
    if (dragging === 'right') newLines.right = Math.max(lines.left + 0.01, Math.min(1, x));
    if (dragging === 'top') newLines.top = Math.max(0, Math.min(lines.bottom - 0.01, y));
    if (dragging === 'bottom') newLines.bottom = Math.max(lines.top + 0.01, Math.min(1, y));

    setLines(newLines);
    
    // Calculate ratios
    const leftWidth = newLines.left;
    const rightWidth = 1 - newLines.right;
    const topHeight = newLines.top;
    const bottomHeight = 1 - newLines.bottom;

    const lrTotal = leftWidth + rightWidth;
    const tbTotal = topHeight + bottomHeight;

    const lrRatio = (leftWidth / lrTotal) * 100;
    const tbRatio = (topHeight / tbTotal) * 100;

    onRatiosChange(lrRatio, tbRatio);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    onMove(e.clientX, e.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      if (dragging) {
        e.preventDefault(); // Prevent scroll while dragging
      }
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleMouseUp = () => setDragging(null);
  const handleTouchEnd = () => setDragging(null);

  const isNear = (val: number, current: number, isX: boolean) => {
    if (!containerRef.current) return false;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = isX ? (mousePos.x - rect.left) / rect.width : (mousePos.y - rect.top) / rect.height;
    const mouseCoord = isX ? mousePos.y - rect.top : mousePos.x - rect.left;
    const lineCoord = isX ? mousePos.x - rect.left : mousePos.y - rect.top;
    
    // We want to check if the mouse is near the line AND if we should thicken the segment
    // But the user wants "only thicken the portion the cursor is around"
    // So we'll render a small "handle" or a thicker segment that follows the mouse.
    return Math.abs(val - pos) < 0.05; 
  };

    // Proportional margins to ensure equal pixel thickness on all sides
    const mx = 0.02;
    const my = containerSize.width && containerSize.height 
      ? (containerSize.width * 0.02) / containerSize.height 
      : 0.02;

    const cardWidthPx = containerSize.width * (1 - 2 * mx);
    const cardRadiusPx = cardWidthPx * 0.05;
    const outerRadiusPx = cardRadiusPx + (containerSize.width * 0.02);

    const leftWidth = lines.left;
    const rightWidth = 1 - lines.right;
    const topHeight = lines.top;
    const bottomHeight = 1 - lines.bottom;
    const lrTotal = leftWidth + rightWidth;
    const tbTotal = topHeight + bottomHeight;
    const lrRatio = (leftWidth / lrTotal) * 100;
    const tbRatio = (topHeight / tbTotal) * 100;

  return (
    <div 
      className="relative h-full w-full flex items-center justify-center overflow-hidden bg-black/60"
      style={{ borderRadius: `${outerRadiusPx}px` }}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleTouchEnd}
      onMouseLeave={handleMouseUp}
    >
      {/* Blurred Background Fill */}
      <img 
        src={originalImage} 
        className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-40 scale-110 pointer-events-none" 
        alt="" 
        referrerPolicy="no-referrer"
      />

      {/* Card Container (Zoomed Out with buffer) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          ref={containerRef}
          className="relative max-w-full max-h-full aspect-[63/88] overflow-visible select-none cursor-default transition-transform duration-200 flex items-center justify-center touch-none pointer-events-auto shadow-2xl"
          style={{
            transform: dragging ? 'scale(2)' : 'scale(1)',
            transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
            width: '100%',
            height: '100%',
            borderRadius: `${outerRadiusPx}px`
          }}
        >
          <img 
            key={image} // Force re-render when image changes
            src={image} 
            className="w-full h-full block pointer-events-none shadow-2xl object-fill" 
            alt="Flattened card" 
            style={{
              filter: filters ? `brightness(${100 + filters.brightness}%) contrast(${100 + filters.contrast}%) saturate(${100 + filters.saturation}%)` : 'none',
              borderRadius: `${outerRadiusPx}px`
            }}
          />

          {/* Fixed Card Outline (at proportional margin) - Using SVG for sub-pixel precision */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            <defs>
              <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <rect width="2" height="6" fill="#f97316" opacity="0.8" />
              </pattern>
              <mask id="cardMask">
                <rect x="-10%" y="-10%" width="120%" height="120%" fill="white" />
                <rect 
                  x={`${mx * 100}%`} 
                  y={`${my * 100}%`} 
                  width={`${(1 - 2 * mx) * 100}%`} 
                  height={`${(1 - 2 * my) * 100}%`} 
                  rx={cardRadiusPx} 
                  ry={cardRadiusPx} 
                  fill="black" 
                />
              </mask>
            </defs>
            
            {/* Diagonal Pattern for Outside Area */}
            <rect 
              x="-5%" 
              y="-5%" 
              width="110%" 
              height="110%" 
              fill="black" 
              opacity="0.5"
              mask="url(#cardMask)"
            />
            <rect 
              x="-5%" 
              y="-5%" 
              width="110%" 
              height="110%" 
              fill="url(#diagonalHatch)" 
              mask="url(#cardMask)"
            />

            <rect 
              x={`${mx * 100}%`} 
              y={`${my * 100}%`} 
              width={`${(1 - 2 * mx) * 100}%`} 
              height={`${(1 - 2 * my) * 100}%`} 
              rx={cardRadiusPx} 
              ry={cardRadiusPx}
              fill="none"
              stroke="#dc2626" // red-600
              strokeWidth="1"
              className="transition-all duration-200"
            />
          </svg>
          
          {/* Overlay for borders */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-red-600/5" style={{ left: `${lines.left * 100}%`, right: `${(1 - lines.right) * 100}%`, top: `${lines.top * 100}%`, bottom: `${(1 - lines.bottom) * 100}%` }} />
          </div>

          {/* Draggable Lines */}
          {['left', 'right', 'top', 'bottom'].map((side) => {
            const isVertical = side === 'left' || side === 'right';
            const value = lines[side as keyof typeof lines];
            const isDragging = dragging === side;
            
            return (
              <div 
                key={side}
                onMouseDown={handleMouseDown(side)}
                onTouchStart={handleTouchStart(side)}
                className={cn(
                  "absolute cursor-pointer group",
                  isVertical ? "top-0 bottom-0 w-4 -ml-2" : "left-0 right-0 h-4 -mt-2"
                )}
                style={{ 
                  [isVertical ? 'left' : 'top']: `${value * 100}%`,
                  zIndex: isDragging ? 50 : 10
                }}
              >
                {/* The actual thin line */}
                <div 
                  className={cn(
                    "absolute bg-red-600 transition-all shadow-[0_0_8px_rgba(220,38,38,0.3)]",
                    isVertical ? "left-1/2 h-full -translate-x-1/2" : "top-1/2 w-full -translate-y-1/2"
                  )} 
                  style={{
                    width: isVertical ? (dragging ? '1px' : '2px') : '100%',
                    height: isVertical ? '100%' : (dragging ? '1px' : '2px'),
                    transform: isVertical 
                      ? `translateX(-50%) ${dragging ? 'scaleX(0.5)' : 'scaleX(1)'}` 
                      : `translateY(-50%) ${dragging ? 'scaleY(0.5)' : 'scaleY(1)'}`
                  }}
                />
                
                {/* The thickened segment that follows the mouse */}
                <div 
                  className={cn(
                    "absolute bg-red-600 rounded-full transition-opacity opacity-0 group-hover:opacity-100",
                    isVertical ? "left-1/2 w-1 h-12 -translate-x-1/2" : "top-1/2 h-1 w-12 -translate-y-1/2",
                    isDragging && "opacity-100 shadow-[0_0_10px_rgba(220,38,38,0.6)]"
                  )}
                  style={{
                    [isVertical ? 'top' : 'left']: isVertical 
                      ? `${((mousePos.y - (containerRef.current?.getBoundingClientRect().top || 0)) / (containerSize.height || 1)) * 100}%`
                      : `${((mousePos.x - (containerRef.current?.getBoundingClientRect().left || 0)) / (containerSize.width || 1)) * 100}%`,
                    transform: isVertical ? 'translate(-50%, -50%)' : 'translate(-50%, -50%)'
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Ratios Overlay (Conditional) - Moved outside scaled container to stay centered in viewport */}
      {dragging && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10 flex gap-3 pointer-events-none z-50">
          {(dragging === 'left' || dragging === 'right') && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">L/R</span>
              <span className="text-xs font-mono font-bold text-[#e6bbd4]">{lrRatio.toFixed(1)}:{ (100 - lrRatio).toFixed(1) }</span>
            </div>
          )}
          {(dragging === 'top' || dragging === 'bottom') && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">T/B</span>
              <span className="text-xs font-mono font-bold text-[#e6bbd4]">{tbRatio.toFixed(1)}:{ (100 - tbRatio).toFixed(1) }</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
