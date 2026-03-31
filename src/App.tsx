import React, { useState, useCallback, useRef } from 'react';
import { Upload, Layers, RotateCcw, Instagram, Download, Sun, Contrast, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone } from 'react-dropzone';
import { toPng } from 'html-to-image';
import { CornerSelector } from './components/CornerSelector';
import { CardFlattener } from './components/CardFlattener';
import { CenteringTool } from './components/CenteringTool';
import { Point, cn } from './lib/utils';

type Step = 'upload' | 'analysis' | 'results';

export default function App() {
  const [step, setStep] = useState<Step>('upload');
  const [image, setImage] = useState<string | null>(null);
  const [corners, setCorners] = useState<Point[]>([
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.9, y: 0.9 },
    { x: 0.1, y: 0.9 },
  ]);
  const [flattenedImage, setFlattenedImage] = useState<string | null>(null);
  const [ratios, setRatios] = useState({ lr: 50, tb: 50 });
  const [filters, setFilters] = useState({ brightness: 0, contrast: 0, saturation: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const handleSaveImage = async () => {
    if (!exportRef.current || isSaving) return;
    setIsSaving(true);
    try {
      // Small delay to ensure any pending renders are finished
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        backgroundColor: '#101010',
        pixelRatio: 3, // Higher quality
        skipAutoScale: true,
        style: {
          padding: '40px',
          borderRadius: '0', // Square corners for the final export
          margin: '0',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }
      });
      
      const link = document.createElement('a');
      link.download = `mew-centering-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to save image', err);
      alert('Failed to save image. Please try again or take a screenshot.');
    } finally {
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
      if (max <= 55) return { grade: '10', color: 'text-[#e6bbd4]' };
      if (max <= 60) return { grade: '9', color: 'text-[#e6bbd4]/80' };
      if (max <= 65) return { grade: '8', color: 'text-[#e6bbd4]/70' };
      if (max <= 70) return { grade: '7', color: 'text-[#e6bbd4]/60' };
      return { grade: '6', color: 'text-[#e6bbd4]/40' };
    }
    if (company === 'BGS') {
      if (max <= 50.5) return { grade: 'BL', color: 'text-[#e6bbd4] font-black' };
      if (max <= 55) return { grade: '9.5', color: 'text-[#e6bbd4]/80' };
      if (max <= 60) return { grade: '8', color: 'text-[#e6bbd4]/60' };
      if (max <= 65) return { grade: '7', color: 'text-[#e6bbd4]/50' };
      return { grade: '6', color: 'text-[#e6bbd4]/40' };
    }
    if (company === 'CGC') {
      if (max <= 55) return { grade: '10', color: 'text-[#e6bbd4]' };
      if (max <= 60) return { grade: '9', color: 'text-[#e6bbd4]/80' };
      if (max <= 65) return { grade: '8', color: 'text-[#e6bbd4]/70' };
      if (max <= 70) return { grade: '7', color: 'text-[#e6bbd4]/60' };
      return { grade: '6', color: 'text-[#e6bbd4]/40' };
    }
    return { grade: '-', color: '' };
  };

  return (
    <div className="min-h-screen bg-[#101010] text-white font-sans p-4 md:p-6" onPaste={handlePaste}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
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
            onClick={() => { setStep('upload'); setImage(null); setFlattenedImage(null); }}
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
                  "border border-white/10 rounded-xl p-20 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer bg-white/5",
                  isDragActive ? "border-[#e6bbd4] bg-[#e6bbd4]/5" : "hover:border-white/20 hover:bg-white/10"
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
                <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                  <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-2">
                      <div className="relative flex h-1.5 w-1.5">
                        <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e6bbd4] opacity-75"></div>
                        <div className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#e6bbd4]"></div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Analysis Workspace</span>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex flex-col md:flex-row gap-8 items-center md:items-stretch justify-center pb-8 h-[50vh] md:h-[75vh] min-h-[500px] max-h-[900px]">
                      {/* Corner Selector */}
                      <div className="flex-1 min-w-0 flex flex-col space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[10px] font-bold uppercase tracking-widest">
                            <span className="text-[#e6bbd4]">1.</span> <span className="text-white/40">Corners</span>
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
                            <div className="bg-white/5 p-3 rounded-lg border border-white/5 space-y-3 mt-[10px] w-full">
                              <div className="flex items-center gap-3">
                                <Sun className="w-3 h-3 text-white/40 shrink-0" />
                                <input 
                                  type="range" min="-100" max="100" value={filters.brightness} 
                                  onChange={(e) => setFilters(f => ({ ...f, brightness: parseInt(e.target.value) }))}
                                  className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#e6bbd4]"
                                />
                              </div>
                              <div className="flex items-center gap-3">
                                <Contrast className="w-3 h-3 text-white/40 shrink-0" />
                                <input 
                                  type="range" min="-100" max="100" value={filters.contrast} 
                                  onChange={(e) => setFilters(f => ({ ...f, contrast: parseInt(e.target.value) }))}
                                  className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#e6bbd4]"
                                />
                              </div>
                              <div className="flex items-center gap-3">
                                <Palette className="w-3 h-3 text-white/40 shrink-0" />
                                <input 
                                  type="range" min="-100" max="100" value={filters.saturation} 
                                  onChange={(e) => setFilters(f => ({ ...f, saturation: parseInt(e.target.value) }))}
                                  className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#e6bbd4]"
                                />
                              </div>
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

                        <div className="flex-1 min-w-0 flex flex-col space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest">
                              <span className="text-[#e6bbd4]">2.</span> <span className="text-white/40">Centering</span>
                            </h3>
                          </div>
                          <div className="flex-1 min-h-0 flex flex-col">
                            <div ref={exportRef} className="flex-1 min-h-0 flex flex-col gap-3 bg-[#101010] pt-4 px-4 pb-1.5 rounded-xl border border-white/5">
                            <div className="flex-1 min-h-0">
                              {flattenedImage ? (
                                <CenteringTool 
                                  image={flattenedImage} 
                                  onRatiosChange={(lr, tb) => setRatios({ lr, tb })} 
                                  filters={filters}
                                />
                              ) : (
                                <div className="relative h-full w-full flex items-center justify-center">
                                  <div className="h-fit w-fit aspect-[2.5/3.5] max-w-full max-h-full bg-white/5 border border-dashed border-white/10 rounded-lg flex items-center justify-center text-white/20 text-[10px] uppercase tracking-widest text-center p-8">
                                    Adjust corners to load
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Centering Report Section */}
                            {flattenedImage && (
                              <div className="space-y-3 pt-2 border-t border-white/5">
                                {/* Row 1: Grades */}
                                <div className="grid grid-cols-3 gap-2">
                                  {(['PSA', 'BGS', 'CGC'] as const).map(company => {
                                    const lrGrade = getGrade(ratios.lr, company);
                                    const tbGrade = getGrade(ratios.tb, company);
                                    const overall = Math.abs(50 - ratios.lr) > Math.abs(50 - ratios.tb) ? lrGrade : tbGrade;
                                    return (
                                      <div key={company} className="flex flex-col items-center gap-1 bg-white/5 p-1.5 rounded border border-white/5">
                                        <span className="text-[7px] font-bold text-white/20 uppercase tracking-widest">{company}</span>
                                        <span className={cn("text-lg font-black", overall.color)}>{overall.grade}</span>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Row 2: Centering Ratios */}
                                <div className="flex items-center justify-around bg-white/5 p-1.5 rounded border border-white/5">
                                  <div className="flex flex-col items-center">
                                    <span className="text-[7px] font-bold text-white/20 uppercase tracking-widest mb-0.5">Left / Right</span>
                                    <span className="text-xs font-mono font-bold text-[#e6bbd4]">{ratios.lr.toFixed(1)} : {(100 - ratios.lr).toFixed(1)}</span>
                                  </div>
                                  <div className="w-[1px] h-6 bg-white/10" />
                                  <div className="flex flex-col items-center">
                                    <span className="text-[7px] font-bold text-white/20 uppercase tracking-widest mb-0.5">Top / Bottom</span>
                                    <span className="text-xs font-mono font-bold text-[#e6bbd4]">{ratios.tb.toFixed(1)} : {(100 - ratios.tb).toFixed(1)}</span>
                                  </div>
                                </div>

                                {/* Branding */}
                                <div className="flex items-center justify-center gap-2 opacity-30">
                                  <img src="https://mew.cards/img/centerlogo.png" className="w-2.5 h-2.5 grayscale" alt="" />
                                  <span className="text-[7px] font-bold uppercase tracking-[0.2em] lowercase">center.mew.cards</span>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {flattenedImage && (
                            <div className="flex justify-end mt-2">
                              <button 
                                onClick={handleSaveImage}
                                disabled={isSaving}
                                className={cn(
                                  "text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5",
                                  isSaving ? "text-white/20 cursor-wait" : "text-[#e6bbd4] hover:text-[#e6bbd4]/80 active:scale-[0.98]"
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        <footer className="mt-12 pb-12 flex flex-col items-center gap-4">
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
      </div>
    </div>
  );
}
