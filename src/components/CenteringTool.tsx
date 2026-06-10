// v5.5 - Lock perpendicular zoom axis while dragging; remove transitions for direct, smooth drag motion
import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import { computeRatio, MARGIN, MY } from '../lib/centeringLogic';

// Zoom level while dragging a guide line (was 2x). Higher = more visual zoom.
const DRAG_SCALE = 4;
// Multiplier applied to cursor movement when updating a guide's position while
// dragging. Lower = finer control (cursor moves further per unit of guide movement).
const DRAG_SENSITIVITY = 0.3;

interface CenteringToolProps {
  image: string;
  originalImage: string;
  filters?: { brightness: number; contrast: number; saturation: number; curvature: number };
  lines: { left: number; right: number; top: number; bottom: number };
  onLinesChange: (lines: { left: number; right: number; top: number; bottom: number }) => void;
  onDragStart?: () => void;
}

export const CenteringTool: React.FC<CenteringToolProps> = ({
  image,
  originalImage,
  filters,
  lines,
  onLinesChange,
  onDragStart
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState<string | null>(null);

  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchstart', block, { passive: false });
    el.addEventListener('touchmove', block, { passive: false });
    return () => {
      el.removeEventListener('touchstart', block);
      el.removeEventListener('touchmove', block);
    };
  }, []);

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


  const handleMouseDown = (side: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    onDragStart?.();
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      let zX = x * 100;
      let zY = y * 100;
      // Adjust origin so the absolute edge of the image aligns with the container edge
      if (side === 'left') zX = 0;
      if (side === 'right') zX = 100;
      if (side === 'top') zY = 0;
      if (side === 'bottom') zY = 100;

      setZoomOrigin({ x: zX, y: zY });
      // Deltas are computed from raw client coordinates (transform-independent),
      // so the baseline can be seeded right here at mousedown.
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    }
    setDragging(side);
  };

  const handleTouchStart = (side: string) => (e: React.TouchEvent) => {
    if (e.touches.length > 0 && containerRef.current) {
      e.preventDefault(); // Prevent scroll start
      onDragStart?.();
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.touches[0].clientX - rect.left) / rect.width;
      const y = (e.touches[0].clientY - rect.top) / rect.height;

      let zX = x * 100;
      let zY = y * 100;
      // Adjust origin so the absolute edge of the image aligns with the container edge
      if (side === 'left') zX = 0;
      if (side === 'right') zX = 100;
      if (side === 'top') zY = 0;
      if (side === 'bottom') zY = 100;

      setZoomOrigin({ x: zX, y: zY });
      // See handleMouseDown — client-coordinate baseline, safe to seed here.
      lastPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setDragging(side);
    }
  };

  const onMove = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    
    // Update CSS variables for mouse tracking to avoid React re-renders
    containerRef.current.style.setProperty('--mouse-x', `${x * 100}%`);
    containerRef.current.style.setProperty('--mouse-y', `${y * 100}%`);

    if (!dragging) return;

    // zoomOrigin is intentionally NOT updated here — it stays at the value
    // set on mousedown, which locks the zoomed viewport along the
    // perpendicular axis so it doesn't pan based on cursor movement on
    // that axis while dragging (e.g. dragging left/right won't pan up/down).

    // Move the guide by a fraction of the cursor's movement (reduced sensitivity)
    // rather than snapping it directly to the cursor — gives finer control.
    // Deltas use raw client px (normalized by the scaled container size) so
    // transform/transform-origin shifts can't inject spurious movement.
    const last = lastPosRef.current;
    lastPosRef.current = { x: clientX, y: clientY };
    if (!last) return;

    const dx = ((clientX - last.x) / rect.width) * DRAG_SENSITIVITY;
    const dy = ((clientY - last.y) / rect.height) * DRAG_SENSITIVITY;

    const newLines = { ...lines };
    if (dragging === 'left') newLines.left = Math.max(MARGIN, Math.min(lines.right - 0.01, lines.left + dx));
    if (dragging === 'right') newLines.right = Math.max(lines.left + 0.01, Math.min(1 - MARGIN, lines.right + dx));
    if (dragging === 'top') newLines.top = Math.max(MY, Math.min(lines.bottom - 0.01, lines.top + dy));
    if (dragging === 'bottom') newLines.bottom = Math.max(lines.top + 0.01, Math.min(1 - MY, lines.bottom + dy));

    onLinesChange(newLines);
  };

  // Keep a ref to the latest onMove so the window-level drag listeners below
  // always see fresh state without re-attaching on every lines change.
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  // While dragging, track the pointer on window so the drag continues even
  // when the cursor leaves the image — it only releases on mouseup/touchend.
  useEffect(() => {
    if (!dragging) return;

    const endDrag = () => { setDragging(null); lastPosRef.current = null; };
    const onWinMouseMove = (e: MouseEvent) => onMoveRef.current(e.clientX, e.clientY);
    const onWinTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault(); // Prevent scroll while dragging
        onMoveRef.current(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    window.addEventListener('mousemove', onWinMouseMove);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchmove', onWinTouchMove, { passive: false });
    window.addEventListener('touchend', endDrag);
    window.addEventListener('touchcancel', endDrag);
    return () => {
      window.removeEventListener('mousemove', onWinMouseMove);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('touchmove', onWinTouchMove);
      window.removeEventListener('touchend', endDrag);
      window.removeEventListener('touchcancel', endDrag);
    };
  }, [dragging]);

  // Hide the OS cursor while dragging (zoomed in) — the red indicator that
  // tracks --mouse-x/--mouse-y serves as the visual pointer instead.
  // A body class with `* { cursor: none !important }` is required because
  // per-element cursor classes (cursor-pointer/cursor-default) would override
  // a plain body style.
  useEffect(() => {
    if (!dragging) return;
    document.documentElement.classList.add('drag-hide-cursor');
    return () => document.documentElement.classList.remove('drag-hide-cursor');
  }, [dragging]);

  // Hover tracking only — drag movement is handled by the window listeners above.
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) onMove(e.clientX, e.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging && e.touches.length > 0) {
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

    const cardWidthPx = containerSize.width * (1 - 2 * MARGIN);
    const cardRadiusPx = cardWidthPx * 0.05;
    const outerRadiusPx = cardRadiusPx + (containerSize.width * MARGIN);

    const { lrRatio, tbRatio } = computeRatio(lines);

  return (
    <div
      ref={outerRef}
      className="absolute inset-0 flex items-center justify-center bg-black/60 overflow-hidden select-none"
      style={{ borderRadius: `${outerRadiusPx}px`, WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
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
              className={cn(
                "absolute inset-0 overflow-visible select-none cursor-default flex items-center justify-center touch-none pointer-events-auto",
                !dragging && "transition-transform duration-200"
              )}
              style={{
                transform: dragging ? `scale(${DRAG_SCALE})` : 'scale(1)',
                transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                borderRadius: `${outerRadiusPx}px`
              }}
            >
              <img 
                key={image} // Force re-render when image changes
                src={image} 
                className="w-full h-full block pointer-events-none shadow-2xl object-cover" 
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
                  x={containerSize.width > 0 ? containerSize.width * MARGIN : `${MARGIN * 100}%`}
                  y={containerSize.width > 0 ? containerSize.height * MY : `${MY * 100}%`}
                  width={containerSize.width > 0 ? containerSize.width * (1 - 2 * MARGIN) : `${(1 - 2 * MARGIN) * 100}%`}
                  height={containerSize.width > 0 ? containerSize.height * (1 - 2 * MY) : `${(1 - 2 * MY) * 100}%`}
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

          </svg>

          {/* CSS Card Outline — uses CSS left/right/top/bottom so it resolves percentages
              via the same layout engine as the draggable lines, guaranteeing symmetry */}
          <div
            className={cn("absolute pointer-events-none", !dragging && "transition-all duration-200")}
            style={{
              left:   containerSize.width  > 0 ? `${Math.round(containerSize.width  * MARGIN)}px` : `${MARGIN * 100}%`,
              right:  containerSize.width  > 0 ? `${Math.round(containerSize.width  * MARGIN)}px` : `${MARGIN * 100}%`,
              top:    containerSize.height > 0 ? `${Math.round(containerSize.height * MY)}px`     : `${MY * 100}%`,
              bottom: containerSize.height > 0 ? `${Math.round(containerSize.height * MY)}px`     : `${MY * 100}%`,
              borderRadius: `${cardRadiusPx}px`,
              border: '1px solid #dc2626',
            }}
          />

          {/* Overlay for borders */}
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute inset-0 bg-red-600/5"
              style={{
                left: `${lines.left * 100}%`,
                right: `${(1 - lines.right) * 100}%`,
                top: `${lines.top * 100}%`,
                bottom: `${(1 - lines.bottom) * 100}%`,
                borderRadius: `${cardRadiusPx}px`, // Add radius to border overlay
              }}
            />
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
                  side === 'left'   && "top-0 bottom-0 w-4 -ml-2",
                  side === 'right'  && "top-0 bottom-0 w-4 -mr-2",
                  side === 'top'    && "left-0 right-0 h-4 -mt-2",
                  side === 'bottom' && "left-0 right-0 h-4 -mb-2",
                )}
                style={(() => {
                  const W = containerSize.width, H = containerSize.height;
                  // No transition while dragging — direct per-event updates
                  // (like CornerSelector) track the cursor without lag.
                  const base = {
                    zIndex: isDragging ? 50 : 10
                  };
                  if (W > 0 && H > 0) {
                    // While actively dragging this line, use the precise sub-pixel
                    // position so movement is smooth (no grid-like snapping when
                    // zoomed in). Snap to whole pixels once released, for symmetry.
                    if (side === 'left')   return { ...base, left:   `${isDragging ? W * value : Math.round(W * value)}px` };
                    if (side === 'right')  return { ...base, right:  `${isDragging ? W * (1 - value) : Math.round(W * (1 - value))}px` };
                    if (side === 'top')    return { ...base, top:    `${isDragging ? H * value : Math.round(H * value)}px` };
                    return                       { ...base, bottom: `${isDragging ? H * (1 - value) : Math.round(H * (1 - value))}px` };
                  }
                  if (side === 'left')   return { ...base, left:   `${value * 100}%` };
                  if (side === 'right')  return { ...base, right:  `${(1 - value) * 100}%` };
                  if (side === 'top')    return { ...base, top:    `${value * 100}%` };
                  return                       { ...base, bottom: `${(1 - value) * 100}%` };
                })()}
              >
                {/* The actual thin line */}
                <div 
                  className={cn(
                    "absolute bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.3)]",
                    !dragging && "transition-all",
                    isVertical ? "left-1/2 h-full -translate-x-1/2" : "top-1/2 w-full -translate-y-1/2"
                  )} 
                  style={{
                    width: isVertical ? '1px' : '100%',
                    height: isVertical ? '100%' : '1px',
                    transform: isVertical
                      ? `translateX(-50%)${dragging ? ` scaleX(${1 / DRAG_SCALE})` : ''}`
                      : `translateY(-50%)${dragging ? ` scaleY(${1 / DRAG_SCALE})` : ''}`
                  }}
                />
                
                {/* The thickened segment that follows the mouse — extends inward toward card center */}
                <div
                  className={cn(
                    "absolute bg-red-600 rounded-full transition-opacity opacity-0 group-hover:opacity-100",
                    isVertical ? "left-1/2 w-1 h-12" : "top-1/2 h-1 w-12",
                    isDragging && "opacity-100 shadow-[0_0_10px_rgba(220,38,38,0.6)]"
                  )}
                  style={{
                    [isVertical ? 'top' : 'left']: isVertical ? 'var(--mouse-y)' : 'var(--mouse-x)',
                    transform: side === 'left'   ? 'translate(0, -50%)'
                             : side === 'right'  ? 'translate(-100%, -50%)'
                             : side === 'top'    ? 'translate(-50%, 0)'
                             :                     'translate(-50%, -100%)'
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
              <span className="text-xs font-mono font-bold text-[#ef4444]">{lrRatio.toFixed(1)}:{ (100 - lrRatio).toFixed(1) }</span>
            </div>
          )}
          {(dragging === 'top' || dragging === 'bottom') && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">T/B</span>
              <span className="text-xs font-mono font-bold text-[#ef4444]">{tbRatio.toFixed(1)}:{ (100 - tbRatio).toFixed(1) }</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
