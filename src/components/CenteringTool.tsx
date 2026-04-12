// v4.27 - Centering Tool Refinements
import React, { useState, useRef, useEffect } from 'react';
import { cn, MX, MY, EXPORT_WIDTH, EXPORT_HEIGHT, MARGIN_PX } from '../lib/utils';

interface CenteringToolProps {
  image: string;
  originalImage: string;
  ratios: { lr: number; tb: number };
  filters?: { brightness: number; contrast: number; saturation: number; curvature: number };
  lines: { left: number; right: number; top: number; bottom: number };
  onLinesChange: (lines: { left: number; right: number; top: number; bottom: number }) => void;
  onDragStart?: () => void;
}

export const CenteringTool: React.FC<CenteringToolProps> = ({ 
  image, 
  originalImage, 
  ratios, 
  filters,
  lines,
  onLinesChange,
  onDragStart
}) => {
  const DEFAULT_OFFSET = 0.03;

  const [linesInitialized, setLinesInitialized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState<string | null>(null);

  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });

  // v4.35 - Using pixel-perfect constants
  const mx = MX;
  const my = MY;

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
    if (containerSize.width && containerSize.height) {
      if (!linesInitialized) setLinesInitialized(true);
    }
  }, [containerSize, linesInitialized]);

  const handleMouseDown = (side: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    onDragStart?.();
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      let zX = x;
      let zY = y;
      // Adjust origin so the absolute edge of the image aligns with the container edge
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
      onDragStart?.();
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
      const y = ((e.touches[0].clientY - rect.top) / rect.height) * 100;
      
      let zX = x;
      let zY = y;
      // Adjust origin so the absolute edge of the image aligns with the container edge
      if (side === 'left') zX = 0;
      if (side === 'right') zX = 100;
      if (side === 'top') zY = 0;
      if (side === 'bottom') zY = 100;
      
      setZoomOrigin({ x: zX, y: zY });
      setDragging(side);
    }
  };

  const onMove = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // v4.40 - Snap dragging to the pixel grid of the export resolution
    const x = Math.round(((clientX - rect.left) / rect.width) * EXPORT_WIDTH) / EXPORT_WIDTH;
    const y = Math.round(((clientY - rect.top) / rect.height) * EXPORT_HEIGHT) / EXPORT_HEIGHT;
    
    // Update CSS variables for mouse tracking to avoid React re-renders
    containerRef.current.style.setProperty('--mouse-x', `${x * 100}%`);
    containerRef.current.style.setProperty('--mouse-y', `${y * 100}%`);

    if (!dragging) return;

    let zX = x * 100;
    let zY = y * 100;
    // Adjust origin so the absolute edge of the image aligns with the container edge
    if (dragging === 'left') zX = 0;
    if (dragging === 'right') zX = 100;
    if (dragging === 'top') zY = 0;
    if (dragging === 'bottom') zY = 100;
    setZoomOrigin({ x: zX, y: zY });

    const newLines = { ...lines };

    if (dragging === 'left') {
      newLines.left = Math.max(mx, Math.min(lines.right - 0.01, x));
    }
    if (dragging === 'right') {
      newLines.right = Math.max(lines.left + 0.01, Math.min(1 - mx, x));
    }
    if (dragging === 'top') {
      newLines.top = Math.max(my, Math.min(lines.bottom - 0.01, y));
    }
    if (dragging === 'bottom') {
      newLines.bottom = Math.max(lines.top + 0.01, Math.min(1 - my, y));
    }

    onLinesChange(newLines);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!dragging) return;
      // v4.39 - Keyboard nudging is now exactly 1 pixel of the export resolution
      const stepX = e.shiftKey ? 10 / EXPORT_WIDTH : 1 / EXPORT_WIDTH;
      const stepY = e.shiftKey ? 10 / EXPORT_HEIGHT : 1 / EXPORT_HEIGHT;
      const newLines = { ...lines };
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        if (dragging === 'left') newLines.left = Math.max(mx, Math.min(lines.right - 0.01, lines.left + dir * stepX));
        if (dragging === 'right') newLines.right = Math.max(lines.left + 0.01, Math.min(1 - mx, lines.right + dir * stepX));
        onLinesChange(newLines);
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const dir = e.key === 'ArrowUp' ? -1 : 1;
        if (dragging === 'top') newLines.top = Math.max(my, Math.min(lines.bottom - 0.01, lines.top + dir * stepY));
        if (dragging === 'bottom') newLines.bottom = Math.max(lines.top + 0.01, Math.min(1 - my, lines.bottom + dir * stepY));
        onLinesChange(newLines);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dragging, lines, mx, my, onLinesChange]);

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

    const cardWidthPx = containerSize.width * (1 - 2 * mx);
    const cardRadiusPx = cardWidthPx * 0.05; 
    const outerRadiusPx = cardRadiusPx + (containerSize.width * mx);

    const lrRatio = ratios.lr;
    const tbRatio = ratios.tb;

  return (
    <div 
      className="absolute inset-0 bg-black/60 overflow-hidden"
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
      <div className="absolute inset-0 pointer-events-none">
            <div 
              ref={containerRef}
              className={cn(
                "absolute inset-0 overflow-visible select-none cursor-default touch-none pointer-events-auto",
                !dragging && "transition-transform duration-200"
              )}
              style={{
                transform: dragging ? 'scale(4)' : 'scale(1)',
                transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                borderRadius: `${outerRadiusPx}px`
              }}
            >
              <img 
                key={image} // Force re-render when image changes
                src={image} 
                className="absolute inset-0 w-full h-full block pointer-events-none shadow-2xl" 
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
                <rect 
                  x="0" 
                  y="0" 
                  width="100%" 
                  height="100%" 
                  rx={outerRadiusPx} 
                  ry={outerRadiusPx} 
                  fill="white" 
                />
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
              className={cn(!dragging && "transition-all duration-200")}
            />
          </svg>
          
          {/* Overlay for borders - Removed semi-transparent fill to ensure guides are clear */}
          <div className="absolute inset-0 pointer-events-none" />

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
                  "absolute cursor-pointer group z-20",
                  isVertical ? "top-0 bottom-0 w-8 -ml-4" : "left-0 right-0 h-8 -mt-4"
                )}
                style={{ 
                  [isVertical ? 'left' : 'top']: `${value * 100}%`,
                  zIndex: isDragging ? 50 : 10
                }}
              >
                {/* Visual Line - 1px thick visually even when zoomed, centered on the coordinate */}
                <div 
                  className={cn(
                    "absolute",
                    isVertical ? "left-1/2 top-0 bottom-0 w-[1px]" : "top-1/2 left-0 right-0 h-[1px]",
                    isDragging ? "bg-[#ff0000]" : "bg-[#dc2626] group-hover:bg-[#ff0000]"
                  )}
                  style={{
                    transform: isVertical 
                      ? `translateX(-50%) scaleX(${dragging ? 0.25 : 1})` 
                      : `translateY(-50%) scaleY(${dragging ? 0.25 : 1})`,
                    transformOrigin: 'center'
                  }}
                />
                
                {/* Streamlined Handle - Follows cursor and looks like a thicker line segment */}
                <div 
                  className={cn(
                    "absolute bg-[#ff0000] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-[0_0_10px_rgba(255,0,0,0.4)] rounded-full",
                    isVertical ? "left-1/2 w-[4px] h-12" : "top-1/2 h-[4px] w-12"
                  )}
                  style={{
                    [isVertical ? 'top' : 'left']: isVertical ? 'var(--mouse-y)' : 'var(--mouse-x)',
                    transform: isVertical 
                      ? `translate(-50%, -50%) scaleX(${dragging ? 0.25 : 1})` 
                      : `translate(-50%, -50%) scaleY(${dragging ? 0.25 : 1})`,
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
              <span className={cn(
                "text-xs font-mono font-bold transition-colors",
                Math.abs(lrRatio - 50) < 0.01 ? "text-green-400" : "text-[#ef4444]"
              )}>
                {lrRatio.toFixed(1)}:{ (100 - lrRatio).toFixed(1) }
              </span>
            </div>
          )}
          {(dragging === 'top' || dragging === 'bottom') && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">T/B</span>
              <span className={cn(
                "text-xs font-mono font-bold transition-colors",
                Math.abs(tbRatio - 50) < 0.01 ? "text-green-400" : "text-[#ef4444]"
              )}>
                {tbRatio.toFixed(1)}:{ (100 - tbRatio).toFixed(1) }
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
