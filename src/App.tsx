import React, { useState, useCallback } from 'react';
import { Upload, Layers, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone } from 'react-dropzone';
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
            <h1 className="text-xl font-black tracking-tighter flex items-center gap-2 text-[#e6bbd4]">
              <Layers className="w-6 h-6" />
              CARD CENTERING PRO
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
                  <p className="text-lg font-bold">Drop card image</p>
                  <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">or click to browse / paste</p>
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
                      <div className="w-1.5 h-1.5 rounded-full bg-[#e6bbd4]" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Analysis Workspace</span>
                    </div>

                    {/* Minimal Stats Row */}
                    <div className="flex items-center gap-6 px-4">
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">L/R</span>
                        <span className="text-sm font-mono font-bold text-[#e6bbd4]">{ratios.lr.toFixed(1)}:{ (100 - ratios.lr).toFixed(1) }</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">T/B</span>
                        <span className="text-sm font-mono font-bold text-[#e6bbd4]">{ratios.tb.toFixed(1)}:{ (100 - ratios.tb).toFixed(1) }</span>
                      </div>
                      <div className="h-4 w-[1px] bg-white/10" />
                      <div className="flex items-center gap-4">
                        {(['PSA', 'BGS', 'CGC'] as const).map(company => {
                          const lrGrade = getGrade(ratios.lr, company);
                          const tbGrade = getGrade(ratios.tb, company);
                          const overall = Math.abs(50 - ratios.lr) > Math.abs(50 - ratios.tb) ? lrGrade : tbGrade;
                          return (
                            <div key={company} className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded border border-white/5">
                              <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{company}</span>
                              <span className={cn("text-sm font-black min-w-[1.2rem] text-center", overall.color)}>{overall.grade}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex flex-col md:flex-row gap-8 items-center md:items-stretch justify-center pb-8 h-[45vh] md:h-[65vh] min-h-[400px] max-h-[750px]">
                      {/* Corner Selector */}
                      <div className="flex-1 min-w-0 flex flex-col space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest">1. Corners</h3>
                        </div>
                        <div className="flex-1 min-h-0">
                          {image && (
                            <CornerSelector 
                              image={image} 
                              corners={corners} 
                              onCornersChange={setCorners} 
                            />
                          )}
                        </div>
                        <CardFlattener 
                          image={image!} 
                          corners={corners} 
                          onFlattened={setFlattenedImage} 
                        />
                      </div>

                      {/* Centering Tool */}
                      <div className="flex-1 min-w-0 flex flex-col space-y-2">
                        <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest">2. Centering</h3>
                        <div className="flex-1 min-h-0">
                          {flattenedImage ? (
                            <CenteringTool 
                              image={flattenedImage} 
                              onRatiosChange={(lr, tb) => setRatios({ lr, tb })} 
                            />
                          ) : (
                            <div className="relative h-full w-full flex items-center justify-center">
                              <div className="h-fit w-fit aspect-[2.5/3.5] max-w-full max-h-full bg-white/5 border border-dashed border-white/10 rounded-lg flex items-center justify-center text-white/20 text-[10px] uppercase tracking-widest text-center p-8">
                                Adjust corners to load
                              </div>
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
      </div>
    </div>
  );
}
