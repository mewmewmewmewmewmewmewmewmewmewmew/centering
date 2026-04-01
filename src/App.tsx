import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Layers, RotateCcw, Instagram, Download, Sun, Contrast, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone } from 'react-dropzone';
import ReactGA from 'react-ga4';
import { CornerSelector } from './components/CornerSelector';
import { CardFlattener } from './components/CardFlattener';
import { CenteringTool } from './components/CenteringTool';
import { Point, cn } from './lib/utils';

type Step = 'upload' | 'analysis' | 'results';

export default function App() {
  const [step, setStep] = useState<Step>('upload');
  const [image, setImage] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [corners, setCorners] = useState<Point[]>([
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.9, y: 0.9 },
    { x: 0.1, y: 0.9 },
  ]);

  // Initialize Google Analytics
  useEffect(() => {
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-SP0LL2R217';
    if (measurementId) {
      ReactGA.initialize(measurementId);
      ReactGA.send({ hitType: "pageview", page: window.location.pathname });
    }
  }, []);

  // Pre-load logo as base64 to avoid CORS issues during export
  React.useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await fetch('https://mew.cards/img/centerlogo.png');
        if (!response.ok) throw new Error('Logo fetch failed');
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result as string);
        reader.readAsDataURL(blob);
      } catch (err) {
        console.warn('Could not pre-load logo for export, will use direct URL');
        setLogoBase64(null);
      }
    };
    loadLogo();
  }, []);

  const [flattenedImage, setFlattenedImage] = useState<string | null>(null);
  const [ratios, setRatios] = useState({ lr: 50, tb: 50 });
  const [filters, setFilters] = useState({ brightness: 0, contrast: 0, saturation: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const handleSaveImage = async () => {
    if (!exportRef.current || isSaving) return;
    setIsSaving(true);
    
    const node = exportRef.current;
    const glossBoxes = node.querySelectorAll('.gloss-box');
    const originalFilters = new Map<Element, string>();
    
    try {
      const { toBlob } = await import('html-to-image');
      
      // Temporarily disable backdrop-filter as it often breaks html-to-image
      originalFilters.set(node, node.style.backdropFilter);
      node.style.backdropFilter = 'none';
      
      glossBoxes.forEach(box => {
        if (box instanceof HTMLElement) {
          originalFilters.set(box, box.style.backdropFilter);
          box.style.backdropFilter = 'none';
        }
      });
      
      // Wait for any transitions to settle and for the style change to apply
      await new Promise(resolve => setTimeout(resolve, 600));

      // Try to generate the image
      const blob = await toBlob(node, {
        backgroundColor: '#1a1a1a',
        pixelRatio: 2,
        cacheBust: true,
        style: {
          borderRadius: '0',
          transform: 'none',
          margin: '0',
          backdropFilter: 'none'
        }
      });

      if (!blob || blob.size < 100) {
        throw new Error('Generated image is empty or too small');
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `mew-centering-${Date.now()}.png`;
      link.href = url;
      link.click();
      
      // Clean up the URL
      setTimeout(() => URL.revokeObjectURL(url), 100);

      // Track save event
      ReactGA.event({
        category: 'Image',
        action: 'Save',
        label: 'Centering Result'
      });
    } catch (err) {
      console.error('Save failed:', err);
      // If it fails, try one more time without pixelRatio
      try {
        const { toBlob } = await import('html-to-image');
        const blob = await toBlob(node, {
          backgroundColor: '#1a1a1a',
          cacheBust: true,
          style: {
            borderRadius: '0',
            transform: 'none',
            margin: '0',
            backdropFilter: 'none'
          }
        });
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `mew-centering-${Date.now()}.png`;
          link.href = url;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 100);
          return;
        }
      } catch (innerErr) {
        console.error('Fallback save also failed:', innerErr);
      }
      alert('Failed to save image. Please try taking a screenshot of the results.');
    } finally {
      // Restore original styles
      originalFilters.forEach((filter, element) => {
        if (element instanceof HTMLElement) {
          element.style.backdropFilter = filter;
        }
      });
      setIsSaving(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      setStep('analysis');
      
      // Track upload event
      ReactGA.event({
        category: 'Image',
        action: 'Upload',
        label: 'Card Image'
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'image/*': [] },
    multiple: false 
  } as any);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = () => {
            setImage(reader.result as string);
            setStep('analysis');
            
            // Track paste event
            ReactGA.event({
              category: 'Image',
              action: 'Paste',
              label: 'Card Image'
            });
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  }, []);

  const getGrade = (ratio: number, company: 'PSA' | 'BGS' | 'CGC') => {
    const diff = Math.abs(50 - ratio);
    const max = 50 + diff;

    if (company === 'PSA') {
      if (max <= 55) return { grade: '10', color: 'text-green-400' };
      if (max <= 60) return { grade: '9', color: 'text-lime-400' };
      if (max <= 65) return { grade: '8', color: 'text-yellow-300' };
      if (max <= 70) return { grade: '7', color: 'text-orange-300' };
      return { grade: '6', color: 'text-orange-500' };
    }
    if (company === 'BGS') {
      if (max <= 50.5) return { grade: 'BL', color: 'text-green-400 font-black' };
      if (max <= 55) return { grade: '9.5', color: 'text-lime-400' };
      if (max <= 60) return { grade: '8', color: 'text-yellow-300' };
      if (max <= 65) return { grade: '7', color: 'text-orange-300' };
      return { grade: '6', color: 'text-orange-500' };
    }
    if (company === 'CGC') {
      if (max <= 55) return { grade: '10', color: 'text-green-400' };
      if (max <= 60) return { grade: '9', color: 'text-lime-400' };
      if (max <= 65) return { grade: '8', color: 'text-yellow-300' };
      if (max <= 70) return { grade: '7', color: 'text-orange-300' };
      return { grade: '6', color: 'text-orange-500' };
    }
    return { grade: '-', color: '' };
  };

  return (
    <div className="min-h-screen bg-[#101010] text-white font-sans p-4 md:p-6 flex flex-col" onPaste={handlePaste}>
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between mb-6 gloss-box px-4 py-3 rounded-xl">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-3 text-white lowercase">
              <img 
                src="https://mew.cards/img/centerlogo.png" 
                alt="mew logo" 
                className="w-8 h-8 object-contain"
                referrerPolicy="no-referrer"
              />
              mew centering
            </h1>
          </div>
          <button 
            onClick={() => { 
              setStep('upload'); 
              setImage(null); 
              setFlattenedImage(null); 
              ReactGA.event({
                category: 'Action',
                action: 'Reset',
                label: 'Centering Tool'
              });
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-colors text-[10px] font-bold uppercase tracking-widest"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </header>

        <main className="space-y-6">
          <AnimatePresence mode="wait">
            {step === 'upload' ? (
              <motion.div 
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                {...getRootProps()} 
                className={cn(
                  "rounded-xl p-20 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer gloss-box",
                  isDragActive ? "border-[#e6bbd4] bg-[#e6bbd4]/5" : "hover:bg-white/5"
                )}
              >
                <input {...getInputProps()} />
                <div className="w-16 h-16 bg-[#e6bbd4]/10 rounded-full flex items-center justify-center text-[#e6bbd4] mb-2">
                  <Upload className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">Drop or paste card image</p>
                  <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">or click to browse</p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="analysis"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                {/* Tools Row */}
                <div className="flex flex-col md:flex-row gap-8 items-center md:items-stretch justify-center md:h-[75vh] md:min-h-[500px] md:max-h-[900px]">
                  {/* Corner Selector */}
                  <div className="w-full md:flex-1 min-w-0 flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-[#e6bbd4]">1.</span> <span className="text-white/60">Corners</span>
                      </h3>
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col items-center">
                      <div className="w-fit mx-auto flex flex-col">
                        <div className="h-fit">
                          {image && (
                            <CornerSelector 
                              image={image} 
                              corners={corners} 
                              onCornersChange={setCorners} 
                              filters={filters}
                            />
                          )}
                        </div>
                        
                        {/* Image Controls */}
                        <div className="p-3 rounded-lg space-y-3 mt-[10px] w-full gloss-box">
                          {[
                            { icon: Sun, value: filters.brightness, key: 'brightness' },
                            { icon: Contrast, value: filters.contrast, key: 'contrast' },
                            { icon: Palette, value: filters.saturation, key: 'saturation' }
                          ].map(({ icon: Icon, value, key }) => (
                            <div key={key} className="flex items-center gap-3">
                              <Icon className="w-3 h-3 text-white/60 shrink-0" />
                              <div className="flex-1 relative flex items-center h-4">
                                {/* Center Indicator Line - Taller */}
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-5 bg-white/30 pointer-events-none z-0" />
                                <input 
                                  type="range" 
                                  min="-100" 
                                  max="100" 
                                  value={value} 
                                  onChange={(e) => {
                                    let val = parseInt(e.target.value);
                                    // Snap to 0 if close
                                    if (Math.abs(val) < 8) val = 0;
                                    setFilters(f => ({ ...f, [key]: val }));
                                  }}
                                  className="relative z-10 w-full custom-slider"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="h-[18px] mt-2" /> {/* Spacer to align with save link on the right */}

                    <CardFlattener 
                      image={image!} 
                      corners={corners} 
                      onFlattened={setFlattenedImage} 
                    />
                  </div>

                    <div className="w-full md:flex-1 min-w-0 flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest">
                          <span className="text-[#e6bbd4]">2.</span> <span className="text-white/60">Centering</span>
                        </h3>
                      </div>
                      <div className="flex-1 min-h-0 flex flex-col">
                        <div className="flex-1 min-h-0 flex flex-col">
                          <div ref={exportRef} className="p-2 pb-2 rounded-[36px] flex flex-col gap-3 gloss-box">
                            <div className="aspect-[63/88] w-full">
                              {flattenedImage ? (
                                <CenteringTool 
                                  image={flattenedImage} 
                                  originalImage={image!}
                                  onRatiosChange={(lr, tb) => setRatios({ lr, tb })} 
                                  filters={filters}
                                />
                              ) : (
                                <div className="relative h-full w-full flex items-center justify-center">
                                  <div className="h-full w-full aspect-[63/88] bg-white/5 border border-dashed border-white/10 rounded-[24px] flex items-center justify-center text-white/40 text-[10px] uppercase tracking-widest text-center p-8">
                                    Adjust corners to load
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Centering Report Section */}
                            {flattenedImage && (
                              <div className="space-y-3">
                                {/* Row 1: Grades */}
                                <div className="grid grid-cols-3 gap-2">
                                  {(['PSA', 'BGS', 'CGC'] as const).map(company => {
                                    const lrGrade = getGrade(ratios.lr, company);
                                    const tbGrade = getGrade(ratios.tb, company);
                                    const overall = Math.abs(50 - ratios.lr) > Math.abs(50 - ratios.tb) ? lrGrade : tbGrade;
                                    return (
                                      <div key={company} className="flex flex-col items-center gap-1 p-2 rounded-[8px] gloss-box">
                                        <span className="text-[7px] font-bold text-white/50 uppercase tracking-widest">{company}</span>
                                        <span className={cn("text-lg font-black", overall.color)}>{overall.grade}</span>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Row 2: Centering Ratios */}
                                <div className="flex items-center justify-around p-2 rounded-[12px] gloss-box">
                                  <div className="flex flex-col items-center">
                                    <span className="text-[7px] font-bold text-white/50 uppercase tracking-widest mb-0.5">Left / Right</span>
                                    <span className="text-xs font-mono font-bold text-[#e6bbd4]">{ratios.lr.toFixed(1)} : {(100 - ratios.lr).toFixed(1)}</span>
                                  </div>
                                  <div className="w-[1px] h-6 bg-white/10" />
                                  <div className="flex flex-col items-center">
                                    <span className="text-[7px] font-bold text-white/50 uppercase tracking-widest mb-0.5">Top / Bottom</span>
                                    <span className="text-xs font-mono font-bold text-[#e6bbd4]">{ratios.tb.toFixed(1)} : {(100 - ratios.tb).toFixed(1)}</span>
                                  </div>
                                </div>

                                 {/* Branding */}
                                <div className="flex items-center justify-center gap-2 opacity-60 pb-1">
                                  {logoBase64 && (
                                    <img 
                                      src={logoBase64} 
                                      className="w-3 h-3 grayscale" 
                                      alt="" 
                                      referrerPolicy="no-referrer"
                                    />
                                  )}
                                  <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-white">centering.mew.cards</span>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {flattenedImage && (
                            <div className="hidden md:flex justify-center mt-2">
                              <button 
                                onClick={handleSaveImage}
                                disabled={isSaving}
                                className={cn(
                                  "text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5",
                                  isSaving ? "text-white/40 cursor-wait" : "text-[#e6bbd4] hover:text-[#e6bbd4]/80 active:scale-[0.98]"
                                )}
                              >
                                {isSaving ? (
                                  "Saving..."
                                ) : (
                                  <>
                                    <Download className="w-3 h-3" /> save image
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>

        <footer className="mt-auto pt-12 mb-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-6">
            <a 
              href="https://x.com/mewmewnami" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white/30 hover:text-white/60 transition-colors"
              aria-label="X (formerly Twitter)"
            >
              <svg 
                viewBox="0 0 24 24" 
                className="w-5 h-5 fill-current"
                aria-hidden="true"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a 
              href="https://instagram.com/myu" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <Instagram className="w-5 h-5" />
            </a>
          </div>
        </footer>
        <div className="fixed bottom-4 left-4 text-[8px] font-mono text-white/20 uppercase tracking-widest pointer-events-none">
          v2.6
        </div>
      </div>
    );
}
