import React, { useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { 
  X, FileText, Info, User, Briefcase, Activity, Calendar, 
  ShieldCheck, PenLine, Ruler, Layers2, Trash2, HardDrive, AlertTriangle 
} from 'lucide-react';
import { AppSettings, LayerConfig } from '../types';

interface DrawingPropertiesProps {
  settings: AppSettings;
  onConfirm: (metadata: any, newTitle: string) => void;
  onClose: () => void;
  entityCount: number;
  currentFileName: string;
  projectStats?: {
    total: number;
    unsupported: number;
    counts: Record<string, number>;
    layerUsage: Record<string, number>;
    unusedLayers: string[];
    invisibleCount: number;
    totalLength: number;
    estimatedSizeKB: string;
  };
  layersConfigList: Record<string, LayerConfig>;
  onPurgeLayers?: () => void;
}

const PropertySection = ({ title, icon: Icon, children, accent = "cyan" }: { title: string, icon: any, children?: React.ReactNode, accent?: string }) => (
  <div className="mb-4 last:mb-0 animate-in fade-in duration-300">
    <div className="flex items-center gap-2 mb-2 px-1">
      <Icon size={12} className={accent === "cyan" ? "text-[#00bcd4]" : accent === "amber" ? "text-amber-500" : "text-indigo-400"} />
      <span className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">{title}</span>
    </div>
    <div className="space-y-2 bg-neutral-950/40 rounded-xl p-3 border border-white/5">
      {children}
    </div>
  </div>
);

const InputField = ({ label, value, onChange, placeholder, icon: Icon, isTextArea }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string, icon?: any, isTextArea?: boolean }) => {
  const id = React.useId();
  const InputComponent = isTextArea ? 'textarea' : 'input';
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-[8px] font-bold text-neutral-700 uppercase pl-1 cursor-pointer hover:text-neutral-500 transition-colors tracking-widest">{label}</label>
      <div className="relative group">
        {Icon && <Icon size={10} className={`absolute left-2.5 ${isTextArea ? 'top-3.5' : 'top-1/2 -translate-y-1/2'} text-neutral-600 group-focus-within:text-amber-500 transition-colors pointer-events-none`} />}
        <InputComponent 
          id={id}
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          placeholder={placeholder}
          className={`w-full bg-black/40 border border-neutral-900 rounded-lg py-2 ${Icon ? 'pl-8' : 'px-3'} pr-3 text-[10px] text-neutral-300 outline-none focus:border-amber-600/50 focus:bg-black/60 hover:border-neutral-800 transition-all font-bold placeholder:text-neutral-900 select-text cursor-text ${isTextArea ? 'min-h-[50px] resize-none py-1.5' : ''}`}
        />
      </div>
    </div>
  );
};

const EntityDistributionChart: React.FC<{ counts: Record<string, number> }> = ({ counts }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<{ type: string; count: number; percent: string } | null>(null);

  useEffect(() => {
    if (!svgRef.current || !counts || Object.keys(counts).length === 0) return;

    // Clear previous elements
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const data: Array<{ type: string; count: number; label: string }> = Object.entries(counts).map(([type, count]) => ({
      type,
      count: Number(count),
      label: formattedTypeLabel(type)
    })).sort((a: any, b: any) => b.count - a.count);

    const total: number = data.reduce((acc: number, d) => acc + d.count, 0);

    const width = 280;
    const height = 150;

    // Custom CAD Theme Colors
    const colors = [
      '#00bcd4', // Cyan
      '#f59e0b', // Amber
      '#c084fc', // Purple
      '#10b981', // Emerald
      '#f43f5e', // Rose
      '#6366f1', // Indigo
      '#14b8a6', // Teal
      '#a855f7'  // Purple-dark
    ];

    const colorScale = d3.scaleOrdinal<string>()
      .domain(data.map(d => d.type))
      .range(colors);

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    const pie = d3.pie<any>()
      .value((d: any) => d.count)
      .sort(null);

    const arc = d3.arc<any>()
      .innerRadius(35)
      .outerRadius(55)
      .cornerRadius(4);

    const arcHover = d3.arc<any>()
      .innerRadius(35)
      .outerRadius(62)
      .cornerRadius(6);

    // Set initial display
    setTooltip({
      type: data[0].label,
      count: data[0].count,
      percent: ((data[0].count / total) * 100).toFixed(1) + '%'
    });

    const path = g.selectAll('path')
      .data(pie(data))
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', (d: any) => colorScale(d.data.type)!)
      .attr('stroke', '#0d0d0f')
      .attr('stroke-width', '2px')
      .style('cursor', 'pointer')
      .style('transition', 'all 0.2s ease');

    path.on('mouseover', function (event, d: any) {
      d3.select(this)
        .transition()
        .duration(150)
        .attr('d', arcHover)
        .style('opacity', '1');

      setTooltip({
        type: d.data.label,
        count: d.data.count,
        percent: ((d.data.count / total) * 100).toFixed(1) + '%'
      });
    });

    path.on('mouseout', function (event, d: any) {
      d3.select(this)
        .transition()
        .duration(150)
        .attr('d', arc);
    });

  }, [counts]);

  const formattedTypeLabel = (typeKey: string): string => {
    switch (typeKey) {
      case 'line': return 'LINES';
      case 'circle': return 'CIRCLES';
      case 'rect': return 'RECTANGLES';
      case 'pline': return 'POLYLINES';
      case 'polygon': return 'POLYGONS';
      case 'arc': return 'ARCS';
      case 'ellipse': return 'ELLIPSES';
      case 'point': return 'POINTS';
      case 'dimension': return 'DIMENSIONS';
      case 'dline': return 'DOUBLE LINES';
      case 'ray': return 'RAYS';
      case 'xline': return 'X-LINES';
      case 'text': return 'TEXT';
      case 'mtext': return 'MTEXT';
      case 'hatch': return 'HATCHES';
      case 'leader': return 'LEADERS';
      case 'block': return 'BLOCKS';
      case 'insert': return 'INSERTS';
      default: return typeKey.toUpperCase();
    }
  };

  if (!counts || Object.keys(counts).length === 0) return null;

  return (
    <div className="flex flex-col items-center justify-center p-2 bg-black/40 border border-white/5 rounded-xl">
      <div className="relative">
        <svg ref={svgRef} width="280" height="150" className="overflow-visible animate-in zoom-in-95 duration-300" />
        {tooltip && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none select-none text-center leading-none">
            <span className="text-[7.5px] font-mono text-neutral-500 font-bold uppercase tracking-widest truncate max-w-[80px]">
              {tooltip.type}
            </span>
            <span className="text-sm font-black text-white font-mono mt-1">
              {tooltip.count}
            </span>
            <span className="text-[8px] font-mono font-bold text-[#00bcd4] mt-0.5 font-black">
              {tooltip.percent}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const DrawingProperties: React.FC<DrawingPropertiesProps> = ({ 
  settings, 
  onConfirm, 
  onClose, 
  entityCount, 
  currentFileName,
  projectStats,
  layersConfigList,
  onPurgeLayers
}) => {
  // Internal state for metadata
  const [localMetadata, setLocalMetadata] = useState({
    author: '',
    createdAt: new Date().toISOString().split('T')[0],
    revision: 'REV-01',
    projectRevision: 'V-1.0',
    description: '',
    ...(settings.metadata || {})
  });
  const [localTitle, setLocalTitle] = useState(currentFileName.replace(/\.(vox|dxf)$/i, ''));
  const [activeTab, setActiveTab] = useState<'meta' | 'stats'>('meta');

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

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

  const handleConfirm = () => {
    const ext = currentFileName.toLowerCase().endsWith('.dxf') ? '.dxf' : '.vox';
    const finalName = localTitle.endsWith('.vox') || localTitle.endsWith('.dxf') ? localTitle : localTitle + ext;
    
    // Auto increment revision when properties are saved/confirmed
    const prevRevision = localMetadata.revision || 'REV-00';
    const match = prevRevision.match(/REV-(\d+)/i) || prevRevision.match(/REV\s*(\d+)/i) || prevRevision.match(/(\d+)/);
    let revNum = 0;
    if (match) {
      revNum = parseInt(match[1] || match[0], 10);
    }
    const nextRev = revNum + 1;
    const pad = nextRev < 10 ? '0' + nextRev : String(nextRev);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const timestampStr = `${yyyy}-${mm}-${dd} ${hh}:${min}`;

    const updated = {
      ...localMetadata,
      revision: `REV-${pad}`,
      revisionTimestamp: timestampStr,
      lastModified: now.toISOString(),
      modifiedAt: now.toISOString(),
      savedAt: now.toISOString(),
      lastSavedTimestamp: timestampStr
    };
    
    onConfirm(updated, finalName);
  };

  const formattedTypeLabel = (typeKey: string): string => {
    switch (typeKey) {
      case 'line': return 'LINES';
      case 'circle': return 'CIRCLES';
      case 'rect': return 'RECTANGLES';
      case 'pline': return 'POLYLINES';
      case 'polygon': return 'POLYGONS';
      case 'arc': return 'ARCS';
      case 'ellipse': return 'ELLIPSES';
      case 'point': return 'POINTS';
      case 'dimension': return 'DIMENSIONS';
      case 'dline': return 'DOUBLE LINES';
      case 'ray': return 'RAYS';
      case 'xline': return 'X-LINES';
      default: return typeKey.toUpperCase();
    }
  };

  return (
    <div 
      className="relative bg-[#0a0a0c]/98 backdrop-blur-3xl w-[340px] max-w-[95vw] border border-white/10 rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden font-sans text-neutral-300 select-none z-[1001]"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
    >
      {/* Header */}
      <div 
        className="flex justify-between items-center px-4 py-3 border-b border-white/5 bg-white/[0.01] cursor-grab active:cursor-grabbing touch-none shrink-0"
        onMouseDown={e => startDrag(e.clientX, e.clientY)}
        onTouchStart={e => e.touches.length > 0 && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
      >
        <div className="flex items-center gap-2.5 pointer-events-none">
          <Briefcase size={16} className="text-amber-500" />
          <div>
            <h3 className="text-[10px] font-black text-neutral-100 uppercase tracking-[0.2em]">Project Properties</h3>
            <p className="text-[7px] text-neutral-600 font-bold uppercase tracking-widest">Profile: {currentFileName}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center hover:bg-white/5 rounded-lg text-neutral-500 transition-colors active:scale-90">
          <X size={15} />
        </button>
      </div>

      {/* Modern Tabs */}
      <div className="flex bg-neutral-900/50 border-b border-white/5 p-1 text-[9px] font-black uppercase tracking-wider">
        <button 
          onClick={() => setActiveTab('meta')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${activeTab === 'meta' ? 'bg-amber-600/15 text-amber-500 font-black' : 'text-neutral-500 hover:text-white'}`}
        >
          General Metadata
        </button>
        <button 
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'stats' ? 'bg-[#00bcd4]/10 text-[#00bcd4] font-black' : 'text-neutral-500 hover:text-white'}`}
        >
          <Activity size={11} />
          VOX Model Analytics
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto px-4 py-3.5 scrollbar-none max-h-[420px] sm:max-h-[480px]">
        
        {activeTab === 'meta' ? (
          <div className="space-y-3">
            <PropertySection title="Profile Identity" icon={FileText} accent="amber">
              <InputField 
                label="Drawing / Project Title" 
                value={localTitle} 
                onChange={(v) => setLocalTitle(v)} 
                placeholder="Drawing 1" 
                icon={PenLine} 
              />
              <InputField 
                label="Design Engineer" 
                value={localMetadata.author || ''} 
                onChange={(v) => setLocalMetadata(prev => ({ ...prev, author: v }))} 
                placeholder="DESIGN LEAD" 
                icon={User} 
              />
              <div className="grid grid-cols-2 gap-2">
                 <InputField 
                    label="Release Date" 
                    value={localMetadata.createdAt || ''} 
                    onChange={(v) => setLocalMetadata(prev => ({ ...prev, createdAt: v }))} 
                    icon={Calendar} 
                  />
                 <InputField 
                    label="Review Code" 
                    value={localMetadata.revision || ''} 
                    onChange={(v) => setLocalMetadata(prev => ({ ...prev, revision: v }))} 
                    icon={ShieldCheck} 
                  />
              </div>
              <InputField 
                label="Drawing Specification Version" 
                value={localMetadata.projectRevision || ''} 
                onChange={(v) => setLocalMetadata(prev => ({ ...prev, projectRevision: v }))} 
                placeholder="e.g. V-2.1" 
                icon={ShieldCheck} 
              />
              <InputField 
                label="Architectural Summary & Brief" 
                value={localMetadata.description || ''} 
                onChange={(v) => setLocalMetadata(prev => ({ ...prev, description: v }))} 
                placeholder="Add specification descriptors..." 
                icon={PenLine} 
                isTextArea
              />

              <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl space-y-1.5 mt-2">
                <div className="flex justify-between items-center text-[8.5px] font-mono">
                  <span className="text-neutral-500 uppercase font-black">Last Save Revision</span>
                  <span className="text-amber-500 font-black px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">{localMetadata.revision || 'REV-01'}</span>
                </div>
                {localMetadata.revisionTimestamp && (
                  <div className="flex justify-between items-center text-[8.5px] font-mono">
                    <span className="text-neutral-500 uppercase font-black">Revision Timestamp</span>
                    <span className="text-neutral-300 font-bold">{localMetadata.revisionTimestamp}</span>
                  </div>
                )}
                <div className="text-[7.5px] text-neutral-600 font-semibold uppercase leading-normal pt-1 border-t border-white/5">
                  The revision counter auto-increments and stamps when clicking the main "Save Details" or "Export VOX" controllers.
                </div>
              </div>
            </PropertySection>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Primary Metrics Grid */}
            <PropertySection title="Drafting Quantities" icon={Activity} accent="cyan">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-black/45 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                  <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Total Entities</span>
                  <div className="text-lg font-black text-[#00bcd4] font-mono leading-none mt-1">{entityCount}</div>
                </div>
                
                <div className="bg-black/45 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                  <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Estimated File Size</span>
                  <div className="text-[11px] font-black text-purple-400 font-mono leading-none mt-1.5 flex items-center gap-1.5">
                    <HardDrive size={10} className="text-purple-400" />
                    {projectStats?.estimatedSizeKB || "0.00 KB"}
                  </div>
                </div>

                <div className="bg-black/45 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                  <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Active Layer context</span>
                  <div className="text-[9px] font-black text-rose-400 truncate uppercase mt-1.5 font-mono">{settings.currentLayer}</div>
                </div>

                <div className="bg-black/45 p-2.5 rounded-lg border border-white/5 flex flex-col justify-between">
                  <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Total linear perimeter</span>
                  <div className="text-[10px] font-black text-emerald-400 font-mono leading-none mt-1.5 flex items-center gap-1">
                    <Ruler size={10} className="text-emerald-500" />
                    {projectStats?.totalLength ? `${projectStats.totalLength} ${settings.units}` : `0 ${settings.units}`}
                  </div>
                </div>
              </div>

              {/* Ghost Alerts */}
              {projectStats && projectStats.invisibleCount > 0 && (
                <div className="mt-1.5 flex items-center gap-2 bg-amber-500/10 border border-amber-500/15 p-2 rounded-lg text-[9px] text-amber-400 font-medium">
                  <AlertTriangle size={12} className="shrink-0 text-amber-500" />
                  <span>Found <b>{projectStats.invisibleCount}</b> empty/zero-boundary shapes. These are sanitized on export.</span>
                </div>
              )}
            </PropertySection>

            {/* Entity Types breakdown list */}
            {projectStats?.counts && Object.keys(projectStats.counts).length > 0 && (
              <PropertySection title="Entity Inventory Breakdown" icon={Ruler} accent="cyan">
                {/* Interactive Donut visualization */}
                <div className="mb-3">
                  <EntityDistributionChart counts={projectStats.counts} />
                </div>
                
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(projectStats.counts).map(([typeKey, count]) => (
                    <div 
                      key={typeKey}
                      className="bg-black/55 border border-white/5 rounded-full px-2.5 py-1 text-[8px] font-mono font-bold text-neutral-400 flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00bcd4]" />
                      <span>{formattedTypeLabel(typeKey)}:</span>
                      <span className="text-[#00bcd4] font-black">{count}</span>
                    </div>
                  ))}
                </div>
              </PropertySection>
            )}

            {/* Layer Distribution and Management */}
            <PropertySection title="Layer Spatial Profiles" icon={Layers2} accent="cyan">
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto scrollbar-thin rounded-lg border border-white/5 bg-black/40 p-1.5">
                {Object.entries(layersConfigList).map(([layerId, config]: [string, any]) => {
                  const count = projectStats?.layerUsage?.[layerId] || 0;
                  const isUnused = count === 0 && layerId !== '0' && layerId !== 'defpoints' && layerId !== settings.currentLayer;
                  return (
                    <div 
                      key={layerId}
                      className={`flex justify-between items-center py-1 px-1.5 rounded text-[9px] font-mono ${isUnused ? 'bg-amber-950/10 text-neutral-500' : 'hover:bg-white/5 text-neutral-300'}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 pr-2">
                        <div 
                          className="w-2 h-2 rounded-full border border-white/10 shrink-0" 
                          style={{ backgroundColor: config.color || '#FFFFFF' }}
                        />
                        <span className="font-bold truncate uppercase">{config.name}</span>
                        {isUnused && <span className="text-[7px] text-amber-500/70 font-semibold">(Empty)</span>}
                      </div>
                      <span className={count > 0 ? 'text-[#00bcd4] font-bold' : 'text-neutral-600'}>{count} shapes</span>
                    </div>
                  );
                })}
              </div>

              {/* Sweep/Purge tools */}
              {onPurgeLayers && projectStats?.unusedLayers && projectStats.unusedLayers.length > 0 && (
                <button
                  type="button"
                  onClick={onPurgeLayers}
                  className="w-full mt-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:text-red-300 rounded-lg text-[8px] font-bold tracking-widest uppercase flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Trash2 size={11} />
                  Purge {projectStats.unusedLayers.length} Unused Layers
                </button>
              )}
            </PropertySection>

          </div>
        )}

        <div className="mt-2.5 p-3 bg-neutral-900/35 rounded-lg border border-white/5 flex items-start gap-2">
          <Info size={11} className="text-neutral-500 shrink-0 mt-0.5" />
          <p className="text-[8px] leading-relaxed text-neutral-600 font-medium">
             VoxCADD formats and precision-rounds coordinate structures on active files to provide efficient browser persistence and lightweight design sharing exports.
          </p>
        </div>
      </div>

      <div className="px-4 py-3 bg-[#0a0a0c]/80 border-t border-white/5 shrink-0 flex gap-2">
        <button 
          onClick={handleConfirm}
          className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-black text-[10px] font-black uppercase rounded-xl shadow-lg active:scale-95 transition-all"
        >
          Save Details
        </button>
      </div>
    </div>
  );
};

export default DrawingProperties;
