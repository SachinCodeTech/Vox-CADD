
import React from 'react';
import { X, Grid, Hash, MoreHorizontal } from 'lucide-react';

interface HatchPatternSelectorProps {
  onSelect: (pattern: string) => void;
  onCancel: () => void;
  currentPattern?: string;
}

const patterns = [
  { id: 'ansi31', name: 'ANSI31 (Iron)', icon: <Hash size={18} /> },
  { id: 'ansi32', name: 'ANSI32 (Steel)', icon: <Hash size={18} className="rotate-90" /> },
  { id: 'ansi33', name: 'ANSI33 (Bronze)', icon: <Hash size={18} className="opacity-50" /> },
  { id: 'ansi37', name: 'ANSI37 (Glass)', icon: <Grid size={18} /> },
  { id: 'cross', name: 'CROSS (Net)', icon: <MoreHorizontal size={18} className="rotate-45" /> },
  { id: 'net', name: 'NET', icon: <Grid size={18} /> },
  { id: 'dots', name: 'DOTS', icon: <div className="grid grid-cols-2 gap-0.5"><div className="w-0.5 h-0.5 bg-current rounded-full" /><div className="w-0.5 h-0.5 bg-current rounded-full" /></div> },
  { id: 'brick', name: 'BRICK', icon: <div className="grid grid-cols-2 gap-0.5"><div className="w-1.5 h-0.5 bg-current" /><div className="w-1.5 h-0.5 bg-current translate-x-0.5" /></div> },
  { id: 'honey', name: 'HONEY (Hex)', icon: <div className="grid grid-cols-3 gap-0.5"><div className="w-1 h-1 bg-current transform rotate-45" /></div> },
  { id: 'gravel', name: 'GRAVEL', icon: <div className="flex gap-0.5 items-end"><div className="w-1 h-1 border border-current rotate-12" /></div> },
  { id: 'triang', name: 'TRIANG', icon: <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-current" /> },
  { id: 'ansi38', name: 'ANSI38 (Check)', icon: <div className="grid grid-cols-2 w-4 h-4 border border-current"><div className="bg-current" /><div className="bg-current translate-x-4 translate-y-4" /></div> },
  { id: 'hound', name: 'HOUND', icon: <div className="grid grid-cols-2 gap-0.5 rotate-45 font-bold">L</div> },
  { id: 'grid', name: 'GRID', icon: <Grid size={18} /> },
  { id: 'stars', name: 'STARS', icon: <div className="text-sm">★</div> },
  { id: 'grass', name: 'GRASS', icon: <div className="flex gap-0.1 items-end"><div className="w-0.5 h-2.5 bg-current rotate-12" /><div className="w-0.5 h-3 bg-current" /></div> },
  { id: 'clay', name: 'CLAY', icon: <div className="flex flex-col gap-0.25"><div className="w-3 h-1.5 rounded-t-full border border-current" /></div> },
  { id: 'cork', name: 'CORK', icon: <div className="text-[10px]">C</div> },
  { id: 'earth', name: 'EARTH', icon: <div className="grid grid-cols-2 gap-0.5 font-bold text-[6px] opacity-60">///</div> },
  { id: 'sand', name: 'SAND', icon: <div className="flex flex-wrap gap-0.25"><div className="w-0.25 h-0.25 bg-current rounded-full" /></div> },
  { id: 'conc', name: 'CONC', icon: <div className="flex gap-0.5 items-center"><div className="w-1.5 h-1.5 border border-current rounded-sm" /></div> },
  { id: 'wood', name: 'WOOD', icon: <div className="flex flex-col gap-0.25 w-full"><div className="h-0.25 bg-current rounded-full w-full" /></div> },
  { id: 'zigzag', name: 'ZIGZAG', icon: <div className="w-4 h-2 border-b-2 border-r-2 border-current transform -rotate-45" /> },
  { id: 'solid', name: 'SOLID', icon: <div className="w-4 h-4 bg-current rounded-sm shadow-inner" /> },
];

const HatchPatternSelector: React.FC<HatchPatternSelectorProps> = ({ onSelect, onCancel, currentPattern }) => {
  const [hoveredPattern, setHoveredPattern] = React.useState<string | null>(null);
  const activePatternId = hoveredPattern || currentPattern || 'ansi31';

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-[#121214] sm:rounded-3xl overflow-hidden shadow-[0_48px_144px_rgba(0,0,0,0.9)] border border-white/5 flex flex-col md:flex-row h-full sm:h-[420px]">
        {/* Left Side: Pattern Grid */}
        <div className="flex-1 flex flex-col min-w-0 h-[50%] md:h-auto border-b md:border-b-0 md:border-r border-white/5">
          <div className="px-5 py-3 border-b border-white/5 flex justify-between items-center bg-[#0d0d0f] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <Grid size={12} />
              </div>
              <h2 className="text-[9px] font-black text-neutral-300 uppercase tracking-[0.25em]">Hatch Gallery</h2>
            </div>
            <button onClick={onCancel} className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-full text-neutral-600 transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="p-4 grid grid-cols-4 xs:grid-cols-5 md:grid-cols-4 lg:grid-cols-5 gap-2 overflow-y-auto flex-1 scrollbar-none bg-[#0a0a0c]">
            {patterns.map((p) => (
              <button
                key={p.id}
                onClick={() => { if(navigator.vibrate) navigator.vibrate(5); onSelect(p.id); }}
                onMouseEnter={() => setHoveredPattern(p.id)}
                onMouseLeave={() => setHoveredPattern(null)}
                className={`group flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all active:scale-95 
                  ${(hoveredPattern === p.id || currentPattern === p.id) 
                    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 ring-4 ring-cyan-500/5' 
                    : 'bg-white/5 border-white/5 text-neutral-500 hover:text-neutral-200 hover:bg-white/10 hover:border-white/10'
                  }`}
              >
                <div className="w-5 h-5 flex items-center justify-center transition-transform group-hover:scale-110">
                  {p.icon}
                </div>
                <span className="text-[7px] font-black uppercase text-center w-full truncate px-0.5 tracking-tight opacity-80">{p.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Preview Panel */}
        <div className="w-full md:w-56 bg-[#0d0d0f] flex flex-col p-4 shrink-0 relative">
            <div className="w-full aspect-[2/1] md:aspect-square rounded-2xl bg-black border border-white/5 relative overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,1)] group mb-4">
                <HatchPreview pattern={activePatternId} />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3 right-3 text-left">
                    <div className="flex items-center gap-1.5 opacity-30 mb-0.5 shrink-0">
                        <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
                        <span className="text-[6.5px] font-black text-white uppercase tracking-[0.2em]">Real-time Context</span>
                    </div>
                    <h3 className="text-[10px] font-black text-[#00bcd4] uppercase truncate tracking-wide leading-tight">{patterns.find(p => p.id === activePatternId)?.name}</h3>
                </div>
            </div>
            
            <div className="flex-1 flex flex-col gap-4">
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                      <span className="text-[7px] font-black text-neutral-600 uppercase tracking-widest pl-1">Geometry Data</span>
                      <div className="bg-black/30 border border-white/5 rounded-xl px-3 py-2.5 space-y-2">
                        <div className="flex justify-between items-center text-[7.5px] font-black">
                            <span className="text-neutral-500 uppercase tracking-tighter">DEFINITION</span>
                            <span className="text-neutral-400 uppercase">Predefined</span>
                        </div>
                        <div className="flex justify-between items-center text-[7.5px] font-black">
                            <span className="text-neutral-500 uppercase tracking-tighter">SCALING</span>
                            <span className="text-cyan-400">DYNAMIC</span>
                        </div>
                      </div>
                  </div>
                </div>
                
                <div className="mt-auto flex flex-col gap-2">
                   <button 
                      onClick={() => onSelect(activePatternId)}
                      className="w-full h-10 bg-cyan-500 text-black text-[9px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 hover:bg-cyan-400 active:scale-95 transition-all shadow-lg shadow-cyan-500/20"
                    >
                      Apply Hatch
                    </button>
                    <button 
                      onClick={onCancel}
                      className="w-full h-10 border border-white/5 text-neutral-600 text-[9px] font-black uppercase tracking-[0.15em] rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 hover:text-white active:scale-95 transition-all"
                    >
                      Dismiss
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const HatchPreview: React.FC<{ pattern: string }> = ({ pattern }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const step = 20;
    for(let i=0; i<canvas.width; i+=step) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    if (pattern === 'solid') {
      ctx.fillStyle = '#00bcd4';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    ctx.strokeStyle = '#00bcd4';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const size = 400; // Assuming canvas is 400x400
    const s = 15; // density

    if (pattern === 'ansi31' || pattern === 'ansi32' || pattern === 'ansi33') {
        const spacing = pattern === 'ansi31' ? 12 : (pattern === 'ansi32' ? 8 : 6);
        for (let i = -size; i < size * 2; i += spacing) {
            ctx.moveTo(i, 0); ctx.lineTo(i + size, size);
            if (pattern === 'ansi32' || pattern === 'ansi33') {
                ctx.moveTo(i + (pattern === 'ansi32' ? 3 : 2), 0); 
                ctx.lineTo(i + (pattern === 'ansi32' ? 3 : 2) + size, size);
            }
            if (pattern === 'ansi33') {
                ctx.moveTo(i + 4, 0); ctx.lineTo(i + 4 + size, size);
            }
        }
    } else if (pattern === 'ansi37') {
        for (let i = -size; i < size * 2; i += 20) {
            ctx.moveTo(i, 0); ctx.lineTo(i + size, size);
            ctx.moveTo(i + 5, 0); ctx.lineTo(i + 5 + size/2, size/2);
        }
    } else if (pattern === 'net' || pattern === 'grid' || pattern === 'cross') {
        const spacing = pattern === 'net' ? 15 : (pattern === 'grid' ? 10 : 20);
        const angle = pattern === 'net' ? Math.PI/4 : 0;
        ctx.save();
        ctx.translate(size/2, size/2);
        ctx.rotate(angle);
        ctx.translate(-size/2, -size/2);
        for (let i = -size; i < size*2; i += spacing) {
            ctx.moveTo(i, -size); ctx.lineTo(i, size*2);
            ctx.moveTo(-size, i); ctx.lineTo(size*2, i);
        }
        ctx.restore();
    } else if (pattern === 'dots' || pattern === 'sand') {
        ctx.fillStyle = '#00bcd4';
        const density = pattern === 'dots' ? 15 : 8;
        for (let i = 0; i < size; i += density) {
            for (let j = 0; j < size; j += density) {
                if (Math.random() > 0.4) {
                    ctx.beginPath();
                    ctx.arc(i + Math.random()*density, j + Math.random()*density, pattern === 'dots' ? 1.5 : 0.8, 0, Math.PI*2);
                    ctx.fill();
                }
            }
        }
    } else if (pattern === 'brick') {
        for (let i = 0; i < size; i += 20) {
            ctx.moveTo(0, i); ctx.lineTo(size, i);
            let offset = ( (i/20)%2 === 0 ) ? 0 : 20;
            for(let k = 0; k <= size; k += 40) {
                ctx.moveTo(k + offset, i); ctx.lineTo(k + offset, i + 20);
            }
        }
    } else if (pattern === 'honey') {
        const r = 12;
        const h = r * Math.sin(Math.PI / 3);
        const w = r * 1.5;
        for (let j = 0; j < size / h + 2; j++) {
            for (let i = 0; i < size / w + 2; i++) {
                const x = i * w;
                const y = j * h + (i % 2) * h / 2;
                ctx.moveTo(x + r, y);
                for (let k = 1; k < 6; k++) {
                    ctx.lineTo(x + r * Math.cos(k * Math.PI / 3), y + r * Math.sin(k * Math.PI / 3));
                }
                ctx.closePath();
            }
        }
    } else if (pattern === 'triang') {
        const ts = 20;
        for (let i = 0; i < size; i += ts) {
            for (let j = 0; j < size; j += ts) {
                ctx.moveTo(i, j); ctx.lineTo(i + ts/2, j - ts/2); ctx.lineTo(i + ts, j); ctx.closePath();
            }
        }
    } else if (pattern === 'zigzag') {
        const zs = 15;
        for (let i = -size; i < size; i += zs) {
            ctx.moveTo(0, i);
            for (let x = 0; x < size; x += zs) {
                ctx.lineTo(x + zs/2, i + zs/2);
                ctx.lineTo(x + zs, i);
            }
        }
    } else if (pattern === 'stars') {
        for (let i = 0; i < size; i += 40) {
            for (let j = 0; j < size; j += 40) {
                const cx = i + 20, cy = j + 20, r = 8;
                ctx.moveTo(cx, cy - r);
                for (let k = 1; k < 10; k++) {
                    const radius = k % 2 === 0 ? r : r/2;
                    ctx.lineTo(cx + radius * Math.sin(k * Math.PI / 5), cy - radius * Math.cos(k * Math.PI / 5));
                }
                ctx.closePath();
            }
        }
    } else {
        // Fallback: simple diagonal lines
        for (let i = -size; i < size * 2; i += 15) {
            ctx.moveTo(i, 0); ctx.lineTo(i + size, size);
        }
    }
    
    ctx.stroke();
  }, [pattern]);

  return <canvas ref={canvasRef} width={400} height={400} className="w-full h-full opacity-40 group-hover:opacity-60 transition-opacity" />;
};

export default HatchPatternSelector;
