
import React, { useState, useRef, useEffect } from 'react';
import { 
    FilePlus, FolderOpen, Save, X, 
    Database, Share2, FileCode, CheckCircle2,
    FileText, Download, Briefcase, Clock, File, Globe,
    Search, Edit2
} from 'lucide-react';

import VoxIcon from './VoxIcon';
import { LayoutDefinition, Shape } from '../types';
import { storageService } from '../services/storageService';

interface FileManagerProps {
    currentName: string;
    recentFiles?: {name: string, date: number}[];
    onAction: (action: string, payload?: any) => void;
    onClose: () => void;
    layouts?: LayoutDefinition[];
}

const ProjectActionBtn = ({ icon: Icon, label, sublabel, onClick, danger, active }: { icon: any, label: string, sublabel: string, onClick: () => void, danger?: boolean, active?: boolean }) => {
    const isVox = Icon === VoxIcon;
    return (
        <button 
            onClick={onClick}
            className={`flex flex-col items-start p-5 bg-[#121214] border rounded-[2rem] hover:bg-neutral-800/50 transition-all active:scale-[0.98] text-left group no-tap ${active ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-white/5'}`}
        >
            <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center mb-4 transition-all ${
                danger 
                    ? 'bg-red-500/10 text-red-500' 
                    : isVox 
                        ? 'bg-cyan-500/10 text-cyan-400' 
                        : 'bg-neutral-800 text-neutral-400 group-hover:text-white'
            }`}>
                <Icon size={isVox ? 24 : 20} />
            </div>
            <div className={`text-[12px] font-black uppercase tracking-tight ${active ? 'text-cyan-400' : 'text-white'}`}>{label}</div>
            <div className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest mt-1">{sublabel}</div>
        </button>
    );
};

const ExportActionBtn = ({ icon: Icon, label, sublabel, onClick, badge }: { icon: any, label: string, sublabel: string, onClick: () => void, badge?: string }) => (
    <button 
        onClick={onClick}
        className="flex items-center gap-4 p-5 bg-[#121214] border border-white/5 rounded-[1.5rem] hover:bg-neutral-800/50 transition-all active:scale-[0.98] text-left relative group no-tap"
    >
        <div className="w-10 h-10 rounded-[0.8rem] bg-neutral-800 flex items-center justify-center text-neutral-400 group-hover:text-white transition-all">
            <Icon size={18} />
        </div>
        <div>
            <div className="text-[11px] font-black text-white uppercase tracking-tight">{label}</div>
            <div className="text-[8px] text-neutral-600 font-bold uppercase tracking-widest mt-0.5">{sublabel}</div>
        </div>
        {badge && (
            <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-neutral-800 rounded text-[6px] font-black text-neutral-500 uppercase border border-white/5">
                {badge}
            </div>
        )}
    </button>
);

interface RecentFileItemProps {
    name: string;
    date: number;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
    onDownload: (e: React.MouseEvent) => void;
    onRename: (e: React.MouseEvent) => void;
    current?: boolean;
    selected?: boolean;
    onToggleSelect?: (e: React.MouseEvent) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

const RecentFileItem: React.FC<RecentFileItemProps> = ({ 
    name, date, onClick, onDelete, onDownload, onRename, current, selected, onToggleSelect,
    onMouseEnter, onMouseLeave
}) => (
    <div 
        className="relative group/item flex items-center gap-1.5"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
    >
        {onToggleSelect && (
            <div className="pl-1 py-1 shrink-0">
                <input 
                    type="checkbox"
                    checked={!!selected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onToggleSelect(e as any)}
                    className="w-4 h-4 rounded border-white/10 bg-black text-cyan-400 accent-[#00bcd4] cursor-pointer focus:ring-0 focus:ring-offset-0"
                />
            </div>
        )}
        <div className="relative flex-1">
            <button 
                onClick={onClick}
                className={`w-full flex items-center gap-4 p-4 pr-32 rounded-[1.2rem] transition-all group no-tap border ${current ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-[#121214] border-white/5 hover:bg-neutral-800/50'} ${selected ? 'border-cyan-500/40 bg-cyan-500/5' : ''}`}
            >
                <div className={`w-10 h-10 rounded-[0.8rem] flex items-center justify-center transition-all ${current ? 'bg-cyan-400 text-black' : 'bg-neutral-800 text-neutral-500 group-hover:text-white'}`}>
                    <File size={18} />
                </div>
                <div className="flex-1 text-left overflow-hidden">
                    <div className={`text-[11px] font-black uppercase tracking-tight truncate ${current ? 'text-cyan-400' : 'text-white'}`}>{name}</div>
                    <div className="text-[8px] text-neutral-600 font-bold uppercase tracking-widest mt-0.5">
                        {new Date(date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </button>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {current && (
                    <div className="px-2 py-1 bg-cyan-400 rounded text-[7px] font-black text-black uppercase tracking-tight shadow-[0_0_10px_rgba(6,182,212,0.3)] mr-1">Active</div>
                )}
                <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover/item:opacity-100 transition-opacity">
                    <button 
                        onClick={onRename}
                        title="Rename"
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-800 text-neutral-400 hover:bg-amber-500 hover:text-black transition-all"
                    >
                        <Edit2 size={13} />
                    </button>
                    <button 
                        onClick={onDownload}
                        title="Download"
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-800 text-neutral-400 hover:bg-cyan-500 hover:text-black transition-all"
                    >
                        <Download size={14} />
                    </button>
                    {!current && (
                        <button 
                            onClick={onDelete}
                            title="Delete"
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-800 text-neutral-400 hover:bg-red-500 hover:text-white transition-all"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    </div>
);

const getEntitiesFromProject = (data: any): any[] => {
  if (!data) return [];
  if (data.layers && typeof data.layers === 'object') {
    if (Array.isArray(data.layers)) {
      return data.layers;
    }
    return Object.values(data.layers).flat();
  }
  if (data.entities && Array.isArray(data.entities)) {
    return data.entities;
  }
  return [];
};

const getShapesBounds = (shapes: any[]) => {
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  shapes.forEach(s => {
    if (s.type === 'line') {
      xMin = Math.min(xMin, s.x1, s.x2);
      xMax = Math.max(xMax, s.x1, s.x2);
      yMin = Math.min(yMin, s.y1, s.y2);
      yMax = Math.max(yMax, s.y1, s.y2);
    } else if (s.type === 'circle' && typeof s.radius === 'number') {
      const r = s.radius;
      xMin = Math.min(xMin, s.x - r);
      xMax = Math.max(xMax, s.x + r);
      yMin = Math.min(yMin, s.y - r);
      yMax = Math.max(yMax, s.y + r);
    } else if (s.type === 'rect' && s.width && s.height) {
      xMin = Math.min(xMin, s.x);
      xMax = Math.max(xMax, s.x + s.width);
      yMin = Math.min(yMin, s.y);
      yMax = Math.max(yMax, s.y + s.height);
    } else if (s.type === 'arc' && typeof s.radius === 'number') {
      const r = s.radius;
      xMin = Math.min(xMin, s.x - r);
      xMax = Math.max(xMax, s.x + r);
      yMin = Math.min(yMin, s.y - r);
      yMax = Math.max(yMax, s.y + r);
    } else if (s.type === 'point') {
      xMin = Math.min(xMin, s.x);
      xMax = Math.max(xMax, s.x);
      yMin = Math.min(yMin, s.y);
      yMax = Math.max(yMax, s.y);
    } else if (s.points && Array.isArray(s.points)) {
      s.points.forEach((p: any) => {
        if (p && typeof p.x === 'number' && typeof p.y === 'number') {
          xMin = Math.min(xMin, p.x);
          xMax = Math.max(xMax, p.x);
          yMin = Math.min(yMin, p.y);
          yMax = Math.max(yMax, p.y);
        }
      });
    }
  });

  if (xMin === Infinity || yMin === Infinity) {
    return { xMin: 0, yMin: 0, xMax: 100, yMax: 100 };
  }
  const dx = xMax - xMin;
  const dy = yMax - yMin;
  const padX = dx === 0 ? 10 : dx * 0.1;
  const padY = dy === 0 ? 10 : dy * 0.1;
  return {
    xMin: xMin - padX,
    xMax: xMax + padX,
    yMin: yMin - padY,
    yMax: yMax + padY
  };
};

const mapCoords = (x: number, y: number, bounds: any, width: number, height: number) => {
  const dx = bounds.xMax - bounds.xMin;
  const dy = bounds.yMax - bounds.yMin;
  const scale = Math.min(width / (dx || 1), height / (dy || 1));
  const cx = bounds.xMin + dx / 2;
  const cy = bounds.yMin + dy / 2;
  const px = width / 2 + (x - cx) * scale;
  const py = height / 2 - (y - cy) * scale;
  return { x: px, y: py, scale };
};

const VectorPreviewPane: React.FC<{ fileName: string }> = ({ fileName }) => {
    const [loading, setLoading] = useState(true);
    const [shapes, setShapes] = useState<any[]>([]);
    const [bounds, setBounds] = useState<any>(null);

    useEffect(() => {
        let isCurrent = true;
        setLoading(true);
        storageService.loadLarge('voxcadd_project_' + fileName).then((data: any) => {
            if (!isCurrent) return;
            if (data) {
                const extracted = getEntitiesFromProject(data);
                setShapes(extracted);
                setBounds(getShapesBounds(extracted));
            } else {
                setShapes([]);
                setBounds(null);
            }
            setLoading(false);
        }).catch(err => {
            console.error(err);
            if (isCurrent) setLoading(false);
        });
        return () => { isCurrent = false; };
    }, [fileName]);

    if (loading) {
        return (
            <div className="w-52 h-52 bg-[#050507]/95 border border-[#00bcd4]/30 rounded-2xl flex items-center justify-center shadow-2xl backdrop-blur-md animate-pulse">
                <span className="text-[7.5px] font-mono font-bold text-cyan-400 uppercase tracking-widest text-center">LOADING MODEL DATA...</span>
            </div>
        );
    }

    if (shapes.length === 0) {
        return (
            <div className="w-52 h-52 bg-[#050507]/95 border border-white/10 rounded-2xl flex flex-col items-center justify-center p-4 text-center shadow-2xl backdrop-blur-md">
                <div className="w-8 h-8 rounded-full border border-dashed border-white/10 flex items-center justify-center text-neutral-600 mb-2">?</div>
                <span className="text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-widest text-center">EMPTY MODEL SPACE</span>
            </div>
        );
    }

    const width = 208;
    const height = 208;

    return (
        <div className="w-52 h-52 bg-[#030304] border border-[#00bcd4]/30 rounded-2xl overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900/35 via-[#030304] to-black" />
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
            
            <svg width={width} height={height} className="relative z-10 p-2">
                {shapes.map((s, idx) => {
                    let color = s.color || '#FFFFFF';
                    if (color.toLowerCase() === 'bylayer' || color.toLowerCase() === 'byblock') {
                        color = '#FFFFFF';
                    }
                    
                    if (s.type === 'line') {
                        const p1 = mapCoords(s.x1, s.y1, bounds, width, height);
                        const p2 = mapCoords(s.x2, s.y2, bounds, width, height);
                        return <line key={idx} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={1} opacity={0.8} />;
                    }
                    
                    if (s.type === 'circle') {
                        const c = mapCoords(s.x, s.y, bounds, width, height);
                        const r = s.radius * c.scale;
                        return <circle key={idx} cx={c.x} cy={c.y} r={Math.max(1, r)} stroke={color} fill="none" strokeWidth={1} opacity={0.8} />;
                    }
                    
                    if (s.type === 'rect') {
                        const c = mapCoords(s.x, s.y, bounds, width, height);
                        const w = s.width * c.scale;
                        const h = s.height * c.scale;
                        return <rect key={idx} x={c.x} y={c.y - h} width={Math.max(1, w)} height={Math.max(1, h)} stroke={color} fill="none" strokeWidth={1} opacity={0.8} />;
                    }
                    
                    if (s.type === 'point') {
                        const p = mapCoords(s.x, s.y, bounds, width, height);
                        return <circle key={idx} cx={p.x} cy={p.y} r={1.5} fill={color} opacity={0.9} />;
                    }
                    
                    if (s.type === 'arc') {
                        const c = mapCoords(s.x, s.y, bounds, width, height);
                        const r = s.radius * c.scale;
                        return <circle key={idx} cx={c.x} cy={c.y} r={Math.max(1, r)} stroke={color} fill="none" strokeWidth={1} strokeDasharray="2,2" opacity={0.6} />;
                    }

                    if ((s.type === 'pline' || s.type === 'polygon' || s.type === 'dline') && s.points && s.points.length > 0) {
                        const pointsStr = s.points.map((p: any) => {
                            if (!p) return '';
                            const pt = mapCoords(p.x, p.y, bounds, width, height);
                            return `${pt.x},${pt.y}`;
                        }).filter(Boolean).join(' ');
                        
                        return <polyline key={idx} points={pointsStr} stroke={color} fill="none" strokeWidth={1} opacity={0.8} />;
                    }

                    return null;
                })}
            </svg>
            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center z-20 pointer-events-none select-none">
                <span className="text-[6.5px] font-mono text-cyan-400 font-extrabold tracking-widest bg-[#050507]/90 border border-white/5 py-0.5 px-1.5 rounded uppercase max-w-[80%] truncate">
                    {fileName.replace(/\.(vox|dxf)$/i, '')}
                </span>
                <span className="text-[6px] font-mono text-neutral-500 font-extrabold uppercase tracking-widest shrink-0">
                    {shapes.length} ENT
                </span>
            </div>
        </div>
    );
};

const FileManager: React.FC<FileManagerProps> = ({ currentName, recentFiles = [], onAction, onClose, layouts = [] }) => {
    const [hoveredFile, setHoveredFile] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
    const [batchPrefix, setBatchPrefix] = useState('PROJ_');
    const [batchStartNum, setBatchStartNum] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const [selectedLayoutIds, setSelectedLayoutIds] = useState<string[]>(
        layouts ? layouts.map(l => l.id) : []
    );

    const handleToggleLayout = (id: string) => {
        setSelectedLayoutIds(prev => 
            prev.includes(id) 
                ? prev.filter(v => v !== id) 
                : [...prev, id]
        );
    };

    useEffect(() => {
        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging.current) return;
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            setPos({ x: clientX - dragStart.current.x, y: clientY - dragStart.current.y });
        };
        const handleEnd = () => { isDragging.current = false; };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
        };
    }, []);

    const startDrag = (clientX: number, clientY: number) => {
        isDragging.current = true;
        dragStart.current = { x: clientX - pos.x, y: clientY - pos.y };
    };

    const filteredRecent = recentFiles.filter(f => 
        f.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div 
            className="relative bg-[#0a0a0c] w-full md:w-[420px] max-w-[95vw] h-full sm:h-auto sm:max-h-[90vh] rounded-[1.5rem] sm:rounded-[2.5rem] shadow-[0_60px_150px_rgba(0,0,0,0.9)] border border-white/10 flex flex-col overflow-hidden select-none font-sans" 
        >
            {/* Header Section */}
            <div 
                className="flex justify-between items-center p-6 sm:p-8 pb-4"
            >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-[0.8rem] sm:rounded-[1.2rem] bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <VoxIcon size={32} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">Project Center</h3>
                    <p className="text-[8px] sm:text-[9px] text-neutral-500 font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5">
                      <Briefcase size={10} /> CAD File Management
                    </p>
                  </div>
                </div>
                <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full text-neutral-500 hover:text-white transition-all"><X size={28} /></button>
            </div>

            <div className="p-4 sm:p-8 space-y-6 sm:space-y-10 overflow-y-auto max-h-[75vh] scrollbar-none">
                
                {/* Search Bar */}
                <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-neutral-600 group-focus-within:text-cyan-500 transition-colors">
                        <Search size={14} />
                    </div>
                    <input 
                        type="text" 
                        placeholder="SEARCH RECENT DRAWINGS..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#121214] border border-white/5 rounded-xl py-3.5 pl-11 pr-10 text-[10px] font-black uppercase tracking-widest text-white focus:border-cyan-500 focus:outline-none transition-all placeholder:text-neutral-700"
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="absolute inset-y-0 right-3 flex items-center text-neutral-600 hover:text-white"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Batch Rename Control Panel */}
                {selectedFileNames.length > 0 && (
                    <div className="bg-neutral-900/90 border border-[#00bcd4]/30 rounded-2xl p-4 space-y-3 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black text-[#00bcd4] uppercase tracking-widest">{selectedFileNames.length} CAD files selected</span>
                            <button 
                                onClick={() => setSelectedFileNames([])} 
                                className="text-[8px] font-black text-neutral-500 hover:text-neutral-300 uppercase tracking-wider"
                            >
                                Deselect All
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[7.5px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">New Prefix</label>
                                <input 
                                    type="text" 
                                    value={batchPrefix}
                                    onChange={(e) => setBatchPrefix(e.target.value)}
                                    placeholder="PROJ_"
                                    className="w-full bg-black/60 border border-white/5 rounded-lg p-2 text-[10px] uppercase font-mono text-neutral-200 outline-none focus:border-cyan-500/50"
                                />
                            </div>
                            <div>
                                <label className="text-[7.5px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">Start Number</label>
                                <input 
                                    type="number" 
                                    value={batchStartNum}
                                    onChange={(e) => setBatchStartNum(parseInt(e.target.value) || 1)}
                                    className="w-full bg-black/60 border border-white/5 rounded-lg p-2 text-[10px] font-mono text-neutral-200 outline-none focus:border-cyan-500/50"
                                    min="1"
                                />
                            </div>
                        </div>

                        {/* Live preview */}
                        <div className="bg-black/35 rounded-xl p-3 border border-white/5 max-h-[100px] overflow-y-auto scrollbar-thin">
                            <div className="text-[7px] font-bold text-neutral-600 uppercase tracking-widest mb-1.5 pb-1 border-b border-white/5">Rename Preview Flow:</div>
                            <div className="space-y-1 font-mono text-[8px] text-neutral-500">
                                {selectedFileNames.slice(0, 3).map((oldName, idx) => {
                                    const ext = oldName.split('.').pop() || 'vox';
                                    const previewName = `${batchPrefix}${batchStartNum + idx}.${ext}`;
                                    return (
                                        <div key={oldName} className="truncate flex items-center justify-between">
                                            <span className="text-neutral-500 truncate max-w-[45%]">{oldName}</span>
                                            <span className="text-cyan-400 shrink-0 font-bold">→</span>
                                            <span className="text-cyan-400 truncate max-w-[45%] font-bold">{previewName.toUpperCase()}</span>
                                        </div>
                                    );
                                })}
                                {selectedFileNames.length > 3 && (
                                    <div className="text-neutral-700 italic text-[7.5px] text-center pt-1 border-t border-white/5">...and {selectedFileNames.length - 3} more files in sequence</div>
                                )}
                            </div>
                        </div>

                        <button 
                            type="button"
                            onClick={() => {
                                onAction('batchRename', {
                                    files: selectedFileNames,
                                    prefix: batchPrefix,
                                    startFrom: batchStartNum
                                });
                                setSelectedFileNames([]);
                            }}
                            className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-black text-[9.5px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
                        >
                            Apply Sequenced Rename
                        </button>
                    </div>
                )}
                
                {/* Storage Actions Section */}
                <div>
                    <h4 className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.25em] mb-4 px-2 flex justify-between items-center">
                        <span>Get Started</span>
                        <span className="text-[8px] text-cyan-500/50 lowercase italic hidden sm:inline">Drafting with precision</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <ProjectActionBtn icon={FilePlus} label="New" sublabel="New Workspace" onClick={() => onAction('new')} />
                        <ProjectActionBtn icon={FolderOpen} label="Open" sublabel="Existing File" onClick={() => onAction('open')} />
                        <ProjectActionBtn icon={VoxIcon} label="Save" sublabel={currentName} onClick={() => onAction('save')} />
                        <ProjectActionBtn icon={Database} label="Save As" sublabel=".vox format" onClick={() => onAction('saveAs', 'vox')} />
                    </div>
                </div>

                {/* Recent Documents Section */}
                <div>
                    <h4 className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.25em] mb-4 px-2 flex justify-between items-center">
                        <span className="flex items-center gap-2"><Clock size={10} /> Recent Drawings</span>
                        {recentFiles.length > 0 && <span className="text-[7px] text-neutral-500">{filteredRecent.length} of {recentFiles.length}</span>}
                    </h4>
                    <div className="space-y-2">
                        {filteredRecent.length > 0 ? (
                            filteredRecent.map((file, i) => {
                                const fileName = typeof file === 'string' ? file : file.name;
                                const fileDate = typeof file === 'string' ? Date.now() : file.date;
                                const isSelected = selectedFileNames.includes(fileName);
                                return (
                                    <RecentFileItem 
                                        key={`${fileName}-${i}`} 
                                        name={fileName} 
                                        date={fileDate} 
                                        current={fileName === currentName}
                                        selected={isSelected}
                                        onToggleSelect={() => {
                                            setSelectedFileNames(prev => 
                                                prev.includes(fileName) 
                                                    ? prev.filter(name => name !== fileName) 
                                                    : [...prev, fileName]
                                            );
                                        }}
                                        onClick={() => onAction('openRecent', fileName)}
                                        onDelete={(e) => { e.stopPropagation(); onAction('deleteRecent', fileName); }}
                                        onRename={(e) => { e.stopPropagation(); onAction('rename', fileName); }}
                                        onDownload={(e) => { e.stopPropagation(); onAction('downloadRecent', fileName); }}
                                        onMouseEnter={() => setHoveredFile(fileName)}
                                        onMouseLeave={() => setHoveredFile(null)}
                                    />
                                );
                            })
                        ) : (
                            <div className="py-8 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center px-4">
                               <File size={24} className="text-neutral-800 mb-3" />
                               <p className="text-[8px] font-black text-neutral-600 uppercase tracking-widest leading-loose">
                                   {searchTerm ? `No matches for "${searchTerm}"` : 'No recent drawings in local storage'}
                               </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Batch Plot System */}
                {layouts && layouts.length > 0 && (
                    <div className="bg-[#121214] border border-white/5 rounded-[1.5rem] p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                                <FileText size={12} className="text-cyan-400" />
                                Batch Plot PDF
                            </h4>
                            <span className="text-[7.5px] font-black text-neutral-500 uppercase tracking-widest bg-neutral-800 border border-white/5 px-1.5 py-0.5 rounded">
                                Multi-Page PDF
                            </span>
                        </div>
                        
                        <div className="flex items-center justify-between gap-4">
                            <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider leading-relaxed max-w-[65%]">
                                Select the layout sheets you wish to combine into a single multi-page PDF document:
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    const allChecked = selectedLayoutIds.length === layouts.length;
                                    if (allChecked) {
                                        setSelectedLayoutIds([]);
                                    } else {
                                        setSelectedLayoutIds(layouts.map(l => l.id));
                                    }
                                }}
                                className="text-[7.5px] font-black text-cyan-400 hover:text-cyan-300 uppercase tracking-widest bg-cyan-400/5 border border-cyan-400/20 px-2.5 py-1 rounded-lg transition-all active:scale-95 shrink-0"
                            >
                                {selectedLayoutIds.length === layouts.length ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>

                        <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                            {layouts.map((layout) => {
                                const isSelected = selectedLayoutIds.includes(layout.id);
                                return (
                                    <label 
                                        key={layout.id} 
                                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                                            isSelected 
                                                ? 'bg-[#00bcd4]/5 border-[#00bcd4]/20 text-cyan-400' 
                                                : 'bg-black/30 border-white/5 text-neutral-400 hover:text-white hover:border-white/10'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <input 
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleLayout(layout.id)}
                                                className="w-3.5 h-3.5 rounded border-white/10 bg-black text-cyan-400 accent-[#00bcd4] cursor-pointer focus:ring-0 focus:ring-offset-0"
                                            />
                                            <span className="text-[9.5px] font-black uppercase tracking-tight truncate max-w-[180px]">
                                                {layout.name}
                                            </span>
                                        </div>
                                        <span className="text-[7px] font-mono text-neutral-400 font-bold uppercase tracking-widest shrink-0">
                                            {layout.paperSize ? `${layout.paperSize.width}x${layout.paperSize.height} mm` : 'ModelSpace'}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            disabled={selectedLayoutIds.length === 0}
                            onClick={() => {
                                onAction('batchPlotLayouts', selectedLayoutIds);
                                onClose();
                            }}
                            className={`w-full py-3 text-black text-[9.5px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                                selectedLayoutIds.length > 0 
                                    ? 'bg-gradient-to-r from-cyan-400 to-[#00bcd4] hover:from-cyan-300 hover:to-cyan-400 cursor-pointer shadow-[0_4px_12px_rgba(6,182,212,0.15)]' 
                                    : 'bg-neutral-800 text-neutral-600 cursor-not-allowed border border-white/5'
                                }`}
                        >
                            <Download size={14} />
                            Plot Selected ({selectedLayoutIds.length}) to PDF
                        </button>
                    </div>
                )}

                {/* CAD Export Section */}
                <div>
                    <div className="flex items-center justify-between px-2 mb-4">
                        <h4 className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.25em]">CAD Export</h4>
                        <div className="bg-neutral-800/50 border border-white/5 px-2 py-0.5 rounded text-[7px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1">
                            <CheckCircle2 size={8} className="text-cyan-500" />
                            VOXCADD SYNK
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        <ExportActionBtn 
                            icon={FileCode} 
                            label="Export to .dxf" 
                            sublabel="Universal Vector Format" 
                            onClick={() => onAction('saveAs', 'dxf')} 
                        />
                        <ExportActionBtn 
                            icon={Download} 
                            label="Render to .png" 
                            sublabel="High-Resolution Snapshot" 
                            onClick={() => onAction('saveImage')} 
                        />
                        <ExportActionBtn 
                            icon={Globe} 
                            label="Cloud Publish" 
                            sublabel="Generate Shareable Link" 
                            onClick={() => onAction('publish')} 
                        />
                    </div>
                </div>
            </div>

            {/* Floating Vector Preview Pane */}
            {hoveredFile && (
                <div className="absolute right-4 bottom-20 z-[1002] pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <VectorPreviewPane fileName={hoveredFile} />
                </div>
            )}

            {/* Bottom Status Bar */}
            <div className="px-8 py-5 bg-[#0a0a0c] border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black text-emerald-500/80 uppercase tracking-widest">System Secure & Synced</span>
              </div>
              <span className="text-[8px] font-bold text-neutral-800 uppercase tracking-[0.2em]">VoxCadd PRD 22.04</span>
            </div>
        </div>
    );
};

export default FileManager;
