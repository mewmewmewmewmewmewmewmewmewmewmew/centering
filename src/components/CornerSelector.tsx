import React, { useState, useRef, useEffect } from 'react';
import { Point, cn } from '../lib/utils';

interface CornerSelectorProps {
  image: string;
  corners: Point[];
  onCornersChange: (corners: Point[]) => void;
}

export const CornerSelector: React.FC<CornerSelectorProps> = ({ image, corners, onCornersChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [draggingLine, setDraggingLine] = useState<string | null>(null);
  const [hoverLine, setHoverLine] = useState<string | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = image;
    img.onload = () => {
      setImgSize({ width: img.width, height: img.height });
    };
  }, [image]);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
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

    const onWindowMouseMove = (e: MouseEvent) => {
      if (!rectRef.current) return;
      const rect = rectRef.current;
      
      if (draggingIdx !== null) {
        // Inward offsets (handles inside the box)
        const offsetX = draggingIdx === 0 || draggingIdx === 3 ? 16 : -16;
        const offsetY = draggingIdx === 0 || draggingIdx === 1 ? 16 : -16;

        // Calculate pixel position relative to container
        const targetPxX = e.clientX - rect.left - offsetX;
        const targetPxY = e.clientY - rect.top - offsetY;

        const x = Math.max(0, Math.min(1, targetPxX / rect.width));
        const y = Math.max(0, Math.min(1, targetPxY / rect.height));

        const newCorners = [...cornersRef.current];
        newCorners[draggingIdx] = { x, y };
        onCornersChange(newCorners);
      } else if (draggingLine !== null) {
        const isHorizontalDrag = draggingLine === 'left' || draggingLine === 'right';
        const isVerticalDrag = draggingLine === 'top' || draggingLine === 'bottom';
        
        const dx = isHorizontalDrag ? (e.clientX - startDragPos.current.x) / rect.width : 0;
        const dy = isVerticalDrag ? (e.clientY - startDragPos.current.y) / rect.height : 0;
        
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
      
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const onWindowMouseUp = () => {
      setDraggingIdx(null);
      setDraggingLine(null);
    };

    window.addEventListener('mousemove', onWindowMouseMove, { passive: true });
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [draggingIdx, draggingLine, onCornersChange]);

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

  const handleMouseDown = (idx: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingIdx(idx);
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleLineMouseDown = (side: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingLine(side);
    startDragPos.current = { x: e.clientX, y: e.clientY };
    startCorners.current = [...corners];
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingIdx === null && draggingLine === null) {
      setMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const getDynamicRadius = () => {
    const topWidth = Math.sqrt(Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2));
    const bottomWidth = Math.sqrt(Math.pow(corners[2].x - corners[3].x, 2) + Math.pow(corners[2].y - corners[3].y, 2));
    const avgWidth = (topWidth + bottomWidth) / 2;
    return avgWidth * containerSize.width * 0.05;
  };

  const r = getDynamicRadius();

  const paths = [
    `M 0,${r} A ${r},${r} 0 0 1 ${r},0`, // Top-Left
    `M 0,${r} A ${r},${r} 0 0 0 -${r},0`, // Top-Right
    `M 0,-${r} A ${r},${r} 0 0 1 -${r},0`, // Bottom-Right
    `M 0,-${r} A ${r},${r} 0 0 0 ${r},0`, // Bottom-Left
  ];

  return (
    <div className="relative h-full flex items-center justify-center">
      <div 
        ref={containerRef}
        className="relative w-fit h-fit max-w-full max-h-full bg-black/10 rounded-lg overflow-visible cursor-crosshair select-none"
        onMouseMove={handleMouseMove}
      >
        <img 
          src={image} 
          className="max-w-full max-h-full block rounded-lg pointer-events-none" 
          alt="Card to analyze" 
        />
        
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" 
          viewBox={`0 0 ${containerSize.width} ${containerSize.height}`} 
          preserveAspectRatio="none"
        >
          <polygon 
            points={corners.map(p => `${p.x * containerSize.width},${p.y * containerSize.height}`).join(' ')}
            className={cn(
              "fill-red-600/5 stroke-red-600 stroke-[2] transition-all",
              draggingLine ? "stroke-red-600 stroke-[3]" : ""
            )}
            strokeDasharray={draggingLine ? "0" : "6 6"}
          />
          {/* Crosshairs for each corner */}
          {corners.map((p, i) => {
            return (
              <g key={`cross-${i}`} transform={`translate(${p.x * containerSize.width}, ${p.y * containerSize.height})`}>
                {/* Outer crosshair lines with offset */}
                {i === 0 && ( // Top-Left
                  <>
                    <line x1="-30" y1="0" x2="-6" y2="0" className="stroke-white/50 stroke-[2]" />
                    <line x1="0" y1="-30" x2="0" y2="-6" className="stroke-white/50 stroke-[2]" />
                  </>
                )}
                {i === 1 && ( // Top-Right
                  <>
                    <line x1="6" y1="0" x2="30" y2="0" className="stroke-white/50 stroke-[2]" />
                    <line x1="0" y1="-30" x2="0" y2="-6" className="stroke-white/50 stroke-[2]" />
                  </>
                )}
                {i === 2 && ( // Bottom-Right
                  <>
                    <line x1="6" y1="0" x2="30" y2="0" className="stroke-white/50 stroke-[2]" />
                    <line x1="0" y1="6" x2="0" y2="30" className="stroke-white/50 stroke-[2]" />
                  </>
                )}
                {i === 3 && ( // Bottom-Left
                  <>
                    <line x1="-30" y1="0" x2="-6" y2="0" className="stroke-white/50 stroke-[2]" />
                    <line x1="0" y1="6" x2="0" y2="30" className="stroke-white/50 stroke-[2]" />
                  </>
                )}
                <circle cx="0" cy="0" r="2.5" className="fill-red-600" />
                <path 
                  d={paths[i]} 
                  fill="none" 
                  className="stroke-red-600 stroke-[4]" 
                />
                {/* Theoretical sharp corner lines */}
                <line 
                  x1={0} y1={0} 
                  x2={i === 0 || i === 3 ? 60 : -60} y2={0} 
                  className="stroke-red-600/30 stroke-[2]" 
                />
                <line 
                  x1={0} y1={0} 
                  x2={0} y2={i === 0 || i === 1 ? 60 : -60} 
                  className="stroke-red-600/30 stroke-[2]" 
                />
              </g>
            );
          })}
        </svg>

        {/* Draggable Lines (Invisible hit areas) */}
        {['top', 'right', 'bottom', 'left'].map((side) => {
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
            >
              <div className={cn(
                "absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-red-600/0 transition-all rounded-full",
                (hoverLine === side || draggingLine === side) && "bg-red-600/40 h-2"
              )} />
            </div>
          );
        })}

        {/* Drag Handles */}
        {corners.map((p, i) => {
          const offsetX = i === 0 || i === 3 ? 16 : -16;
          const offsetY = i === 0 || i === 1 ? 16 : -16;

          return (
            <div
              key={i}
              onMouseDown={handleMouseDown(i)}
              className={cn(
                "absolute w-6 h-6 rounded-full border-2 border-red-600 shadow-xl cursor-grab active:cursor-grabbing pointer-events-auto flex items-center justify-center z-20 transition-transform hover:scale-110",
                draggingIdx === i ? "bg-red-600 scale-125" : ""
              )}
              style={{ 
                left: `${p.x * containerSize.width}px`, 
                top: `${p.y * containerSize.height}px`,
                transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
                backgroundImage: draggingIdx === i ? 'none' : 'repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(220, 38, 38, 0.3) 2px, rgba(220, 38, 38, 0.3) 4px)'
              }}
            >
              <div className="w-2 h-2 rounded-full bg-white/20" />
            </div>
          );
        })}

        {/* Magnifier / Zoom */}
        {draggingIdx !== null && containerRef.current && (
          <div 
            className="absolute pointer-events-none z-50 border-4 border-red-600 rounded-full overflow-hidden shadow-2xl bg-black"
            style={{
              width: '180px',
              height: '180px',
              left: `${Math.max(90, Math.min(containerSize.width - 90, mousePos.x - containerRef.current.getBoundingClientRect().left))}px`,
              top: `${Math.max(90, Math.min(containerSize.height - 90, (mousePos.y - containerRef.current.getBoundingClientRect().top) - 120))}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {(() => {
              const zoom = 3.6;
              const r_zoom = 20;
              const offX = (draggingIdx === 0 || draggingIdx === 3 ? 1 : -1) * (r_zoom / 2);
              const offY = (draggingIdx === 0 || draggingIdx === 1 ? 1 : -1) * (r_zoom / 2);
              const focalX = corners[draggingIdx].x * containerSize.width + offX;
              const focalY = corners[draggingIdx].y * containerSize.height + offY;

              return (
                <>
                  <div 
                    className="absolute w-full h-full"
                    style={{
                      backgroundImage: `url(${image})`,
                      backgroundSize: `${containerSize.width * zoom}px ${containerSize.height * zoom}px`,
                      backgroundPosition: `${-(focalX * zoom) + 90}px ${-(focalY * zoom) + 90}px`,
                      backgroundRepeat: 'no-repeat'
                    }}
                  />
                  
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 180 180">
                    <g transform={`translate(${90 - offX * zoom}, ${90 - offY * zoom}) scale(${zoom})`}>
                      <line x1="-30" y1="0" x2="30" y2="0" className="stroke-white/50" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                      <line x1="0" y1="-30" x2="0" y2="30" className="stroke-white/50" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                      <circle cx="0" cy="0" r="2.5" className="fill-red-600" />
                      <path d={paths[draggingIdx]} fill="none" className="stroke-red-600" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                      <line x1={0} y1={0} x2={draggingIdx === 0 || draggingIdx === 3 ? 60 : -60} y2={0} className="stroke-red-600/30" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                      <line x1={0} y1={0} x2={0} y2={draggingIdx === 0 || draggingIdx === 1 ? 60 : -60} className="stroke-red-600/30" strokeWidth="1" vectorEffect="non-scaling-stroke" />
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
    </div>
  );
};
