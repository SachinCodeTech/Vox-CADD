import React, { useState, useRef, useEffect } from 'react';
import { X, Search, PlusCircle, Box, AlertCircle, Copy, Trash2, ArrowDown, Wrench } from 'lucide-react';
import { BlockDefinition, Point, Shape } from '../types';

interface BlockLibraryPanelProps {
  blocks: Record<string, BlockDefinition>;
  onCreateBlockFromSelection: (name: string) => void;
  onInsertBlock: (blockId: string) => void;
  onDeleteBlock: (blockId: string) => void;
  onEditBlock: (blockId: string) => void;
  selectedCount: number;
  onClose: () => void;
}

// Helper to generate IDs for shape components
const makeId = () => Math.random().toString(36).substr(2, 9);

// Beautiful standard predefined blocks
export const PREDEFINED_BLOCKS: Record<string, BlockDefinition> = {
  'door_90': {
    id: 'pre_door_90',
    name: 'Door (Swing 90°)',
    basePoint: { x: 0, y: 0 },
    shapes: [
      { id: makeId(), type: 'line', layer: '0', color: '#00bcd4', x1: 0, y1: 0, x2: 0, y2: 100 } as any,
      { id: makeId(), type: 'line', layer: '0', color: '#6b7280', x1: 0, y1: 0, x2: 100, y2: 0 } as any,
      { id: makeId(), type: 'arc', layer: '0', color: '#f59e0b', x: 0, y: 0, radius: 100, startAngle: 0, endAngle: 1.5707963267948966, counterClockwise: true } as any
    ]
  },
  'window_slide': {
    id: 'pre_window_slide',
    name: 'Window (Sliding)',
    basePoint: { x: 0, y: 0 },
    shapes: [
      { id: makeId(), type: 'rect', layer: '0', color: '#00bcd4', x: -50, y: -15, width: 100, height: 30 } as any,
      { id: makeId(), type: 'line', layer: '0', color: '#6b7280', x1: -50, y1: 0, x2: 50, y2: 0 } as any,
      { id: makeId(), type: 'line', layer: '0', color: '#00bcd4', x1: -25, y1: -15, x2: -25, y2: 15 } as any,
      { id: makeId(), type: 'line', layer: '0', color: '#00bcd4', x1: 25, y1: -15, x2: 25, y2: 15 } as any
    ]
  },
  'dining_set_6': {
    id: 'pre_dining_set_6',
    name: 'Dining Set (6 Seats)',
    basePoint: { x: 0, y: 0 },
    shapes: [
      // Main table
      { id: makeId(), type: 'rect', layer: '0', color: '#f59e0b', x: -60, y: -30, width: 120, height: 60 } as any,
      // Seats Left/Right
      { id: makeId(), type: 'rect', layer: '0', color: '#6b7280', x: -80, y: -15, width: 15, height: 30 } as any,
      { id: makeId(), type: 'rect', layer: '0', color: '#6b7280', x: 65, y: -15, width: 15, height: 30 } as any,
      // Seats Top
      { id: makeId(), type: 'rect', layer: '0', color: '#6b7280', x: -40, y: -50, width: 30, height: 15 } as any,
      { id: makeId(), type: 'rect', layer: '0', color: '#6b7280', x: 10, y: -50, width: 30, height: 15 } as any,
      // Seats Bottom
      { id: makeId(), type: 'rect', layer: '0', color: '#6b7280', x: -40, y: 35, width: 30, height: 15 } as any,
      { id: makeId(), type: 'rect', layer: '0', color: '#6b7280', x: 10, y: 35, width: 30, height: 15 } as any
    ]
  },
  'office_chair': {
    id: 'pre_office_chair',
    name: 'Office Chair',
    basePoint: { x: 0, y: 0 },
    shapes: [
      { id: makeId(), type: 'circle', layer: '0', color: '#00bcd4', x: 0, y: 0, radius: 20 } as any,
      { id: makeId(), type: 'rect', layer: '0', color: '#6b7280', x: -18, y: -25, width: 36, height: 8 } as any,
      { id: makeId(), type: 'line', layer: '0', color: '#6b7280', x1: -22, y1: -10, x2: -22, y2: 10 } as any,
      { id: makeId(), type: 'line', layer: '0', color: '#6b7280', x1: 22, y1: -10, x2: 22, y2: 10 } as any
    ]
  },
  'sofa_3': {
    id: 'pre_sofa_3',
    name: 'Sofa (3-Seater)',
    basePoint: { x: 0, y: 0 },
    shapes: [
      { id: makeId(), type: 'rect', layer: '0', color: '#3b82f6', x: -80, y: -40, width: 160, height: 15 } as any, // Backrest
      { id: makeId(), type: 'rect', layer: '0', color: '#6b7280', x: -95, y: -40, width: 15, height: 75 } as any, // Armrest L
      { id: makeId(), type: 'rect', layer: '0', color: '#6b7280', x: 80, y: -40, width: 15, height: 75 } as any,  // Armrest R
      { id: makeId(), type: 'rect', layer: '0', color: '#3b82f6', x: -80, y: -25, width: 160, height: 60 } as any, // Cushion body
      { id: makeId(), type: 'line', layer: '0', color: '#6b7280', x1: -27, y1: -25, x2: -27, y2: 35 } as any,      // Seams
      { id: makeId(), type: 'line', layer: '0', color: '#6b7280', x1: 27, y1: -25, x2: 27, y2: 35 } as any
    ]
  },
  'bed_king': {
    id: 'pre_bed_king',
    name: 'King Bed & Nightstands',
    basePoint: { x: 0, y: -100 },
    shapes: [
      { id: makeId(), type: 'rect', layer: '0', color: '#3b82f6', x: -75, y: -100, width: 150, height: 190 } as any, // Bed frame
      { id: makeId(), type: 'rect', layer: '0', color: '#94a3b8', x: -60, y: -90, width: 50, height: 30 } as any,   // Pillow 1
      { id: makeId(), type: 'rect', layer: '0', color: '#94a3b8', x: 10, y: -90, width: 50, height: 30 } as any,    // Pillow 2
      { id: makeId(), type: 'rect', layer: '0', color: '#6b7280', x: -80, y: -110, width: 160, height: 10 } as any,  // Headboard
      { id: makeId(), type: 'rect', layer: '0', color: '#1e293b', x: -115, y: -110, width: 35, height: 35 } as any,  // Side L
      { id: makeId(), type: 'rect', layer: '0', color: '#1e293b', x: 80, y: -110, width: 35, height: 35 } as any     // Side R
    ]
  },
  'compact_car': {
    id: 'pre_compact_car',
    name: 'Compact Car (Top)',
    basePoint: { x: 0, y: 0 },
    shapes: [
      // Wheels
      { id: makeId(), type: 'rect', layer: '0', color: '#111827', x: -45, y: -65, width: 10, height: 25 } as any,
      { id: makeId(), type: 'rect', layer: '0', color: '#111827', x: 35, y: -65, width: 10, height: 25 } as any,
      { id: makeId(), type: 'rect', layer: '0', color: '#111827', x: -45, y: 40, width: 10, height: 25 } as any,
      { id: makeId(), type: 'rect', layer: '0', color: '#111827', x: 35, y: 40, width: 10, height: 25 } as any,
      // Main Chassis
      { id: makeId(), type: 'rect', layer: '0', color: '#ef4444', x: -40, y: -80, width: 80, height: 160 } as any,
      // Windshield & lights details
      { id: makeId(), type: 'line', layer: '0', color: '#ffffff', x1: -35, y1: -40, x2: 35, y2: -40 } as any,
      { id: makeId(), type: 'line', layer: '0', color: '#ffffff', x1: -35, y1: 25, x2: 35, y2: 25 } as any,
      { id: makeId(), type: 'rect', layer: '0', color: '#38bdf8', x: -30, y: -35, width: 60, height: 50 } as any // Cabin
    ]
  },
  'tree_top': {
    id: 'pre_tree_top',
    name: 'Tree (Top)',
    basePoint: { x: 0, y: 0 },
    shapes: [
      { id: makeId(), type: 'circle', layer: '0', color: '#10b981', x: 0, y: 0, radius: 45 } as any,
      { id: makeId(), type: 'circle', layer: '0', color: '#047857', x: 0, y: 0, radius: 25 } as any,
      { id: makeId(), type: 'circle', layer: '0', color: '#78350f', x: 0, y: 0, radius: 6 } as any,
      { id: makeId(), type: 'line', layer: '0', color: '#047857', x1: -45, y1: 0, x2: 45, y2: 0 } as any,
      { id: makeId(), type: 'line', layer: '0', color: '#047857', x1: 0, y1: -45, x2: 0, y2: 45 } as any
    ]
  },
  'north_arrow': {
    id: 'pre_north_arrow',
    name: 'North Arrow',
    basePoint: { x: 0, y: 0 },
    shapes: [
      { id: makeId(), type: 'circle', layer: '0', color: '#ffffff', x: 0, y: 0, radius: 35 } as any,
      { id: makeId(), type: 'line', layer: '0', color: '#ef4444', x1: 0, y1: -45, x2: 0, y2: 45 } as any,
      { id: makeId(), type: 'line', layer: '0', color: '#ffffff', x1: -35, y1: 0, x2: 35, y2: 0 } as any,
      // Arrow head
      { id: makeId(), type: 'line', layer: '0', color: '#ef4444', x1: 0, y1: -45, x2: -8, y2: -30 } as any,
      { id: makeId(), type: 'line', layer: '0', color: '#ef4444', x1: 0, y1: -45, x2: 8, y2: -30 } as any,
      // 'N' character representation
      { id: makeId(), type: 'line', layer: '0', color: '#ef4444', x1: -4, y1: -60, x2: -4, y2: -50 } as any,
      { id: makeId(), type: 'line', layer: '0', color: '#ef4444', x1: -4, y1: -60, x2: 4, y2: -50 } as any,
      { id: makeId(), type: 'line', layer: '0', color: '#ef4444', x1: 4, y1: -60, x2: 4, y2: -50 } as any
    ]
  }
};

export default function BlockLibraryPanel({
  blocks,
  onCreateBlockFromSelection,
  onInsertBlock,
  onDeleteBlock,
  onEditBlock,
  selectedCount,
  onClose
}: BlockLibraryPanelProps) {
  const [activeTab, setActiveTab] = useState<'standard' | 'custom'>('standard');
  const [searchQuery, setSearchQuery] = useState('');
  const [newBlockName, setNewBlockName] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'shapes_desc' | 'source' | 'creation'>('name');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'ARCH' | 'FURN' | 'SITE'>('ALL');

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

  const currentLibrary = activeTab === 'standard' ? PREDEFINED_BLOCKS : blocks;
  
  // Tag blocks classification helper
  const getBlockCategory = (key: string): 'ARCH' | 'FURN' | 'SITE' => {
    const k = key.toLowerCase();
    if (k.includes('door') || k.includes('window') || k.includes('wall')) return 'ARCH';
    if (k.includes('dining') || k.includes('chair') || k.includes('sofa') || k.includes('bed') || k.includes('desk') || k.includes('table')) return 'FURN';
    return 'SITE';
  };

  const getBlockDateString = (b: BlockDefinition, key: string): string => {
    if (key.startsWith('pre_') || PREDEFINED_BLOCKS[key]) return 'System Predefined';
    // Simulated/Real creation date based on block id structure
    return 'User Generated';
  };

  // Filter & Sort
  const filteredBlocksList = Object.entries(currentLibrary)
    .filter(([key, b]) => {
      const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) || key.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      
      if (filterCategory === 'ALL') return true;
      return getBlockCategory(key) === filterCategory;
    })
    .sort((a, b) => {
      const [keyA, valA] = a;
      const [keyB, valB] = b;
      
      if (sortBy === 'name') {
        return valA.name.localeCompare(valB.name);
      } else if (sortBy === 'shapes_desc') {
        return valB.shapes.length - valA.shapes.length;
      } else if (sortBy === 'source') {
        const isPreA = keyA.startsWith('pre_') || PREDEFINED_BLOCKS[keyA] ? 1 : 0;
        const isPreB = keyB.startsWith('pre_') || PREDEFINED_BLOCKS[keyB] ? 1 : 0;
        return isPreB - isPreA;
      } else {
        // Creation date: Predefined first, then Custom definitions ordered
        const isPreA = keyA.startsWith('pre_') || PREDEFINED_BLOCKS[keyA] ? 1 : 0;
        const isPreB = keyB.startsWith('pre_') || PREDEFINED_BLOCKS[keyB] ? 1 : 0;
        if (isPreA !== isPreB) return isPreB - isPreA;
        return valA.name.localeCompare(valB.name); // Sort by name within groups
      }
    });

  const handleDragStart = (e: React.DragEvent, key: string, b: BlockDefinition) => {
    e.dataTransfer.setData('application/x-cad-block', key);
    // Add full definition json in case we drop standard block and need to preload it
    e.dataTransfer.setData('application/x-cad-block-json', JSON.stringify(b));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleSaveSelection = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newBlockName.trim();
    if (cleanName) {
      onCreateBlockFromSelection(cleanName);
      setNewBlockName('');
    }
  };

  return (
    <div 
      className="relative w-[94vw] sm:w-[480px] sm:max-w-[95vw] h-[82vh] sm:h-[85vh] sm:max-h-[680px] glass-panel rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-white/5 bg-[#0b0b0d]/95 backdrop-blur-2xl"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, zIndex: 150 }}
    >
      {/* Panel Header */}
      <div 
        className="flex justify-between items-center px-5 py-4 border-b border-white/5 bg-[#121215] cursor-grab active:cursor-grabbing touch-none shrink-0"
        onMouseDown={e => startDrag(e.clientX, e.clientY)}
        onTouchStart={e => e.touches.length > 0 && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <Box size={16} className="stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 leading-none">Block Library</h3>
            <span className="text-[7px] text-neutral-500 uppercase tracking-widest font-bold mt-1 block">Drag & drop or Click to place</span>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-full text-neutral-500 hover:text-white transition-all outline-none"
        >
          <X size={18} />
        </button>
      </div>

      {/* Tabs bar */}
      <div className="grid grid-cols-2 bg-[#0d0d10] border-b border-white/5 shrink-0 select-none">
        <button
          onClick={() => setActiveTab('standard')}
          className={`py-3.5 text-[9px] font-black uppercase tracking-wider transition-all border-b-2 outline-none ${
            activeTab === 'standard' 
              ? 'border-cyan-500 text-cyan-400 bg-white/[0.01]' 
              : 'border-transparent text-neutral-500 hover:text-neutral-300'
          }`}
        >
          Standard Blocks
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`py-3.5 text-[9px] font-black uppercase tracking-wider transition-all border-b-2 outline-none ${
            activeTab === 'custom' 
              ? 'border-cyan-500 text-cyan-400 bg-white/[0.01]' 
              : 'border-transparent text-neutral-500 hover:text-neutral-300'
          }`}
        >
          Drawing Blocks ({Object.keys(blocks).length})
        </button>
      </div>

      {/* Search Filter and Sorting Controls */}
      <div className="px-4 py-3 bg-[#0d0d10] border-b border-white/5 space-y-2.5 shrink-0">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="SEARCH BLOCKS..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-black/55 border border-white/5 rounded-xl py-2 px-9 text-[10px] text-neutral-300 font-mono focus:border-cyan-500 focus:bg-black placeholder-neutral-600 outline-none transition-all uppercase"
            />
          </div>
          
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-black/55 border border-white/5 rounded-xl px-2.5 py-2 text-[10px] text-neutral-300 font-mono tracking-wider outline-none focus:border-cyan-500 transition-all cursor-pointer uppercase shrink-0 w-[110px]"
          >
            <option value="name">SORT: NAME</option>
            <option value="shapes_desc">SORT: COMPLEX</option>
            <option value="source">SORT: SOURCE</option>
            <option value="creation">SORT: DATE</option>
          </select>
        </div>

        {/* Classification Quick Filter Tags */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setFilterCategory('ALL')}
            className={`px-3 py-1 text-[8px] font-black uppercase rounded-lg transition-all shrink-0 ${
              filterCategory === 'ALL'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25'
                : 'bg-black/30 text-neutral-500 border border-transparent hover:text-neutral-300'
            }`}
          >
            ALL CATEGORIES
          </button>
          <button
            onClick={() => setFilterCategory('ARCH')}
            className={`px-3 py-1 text-[8px] font-black uppercase rounded-lg transition-all shrink-0 ${
              filterCategory === 'ARCH'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25'
                : 'bg-black/30 text-neutral-500 border border-transparent hover:text-neutral-300'
            }`}
          >
            Architectural
          </button>
          <button
            onClick={() => setFilterCategory('FURN')}
            className={`px-3 py-1 text-[8px] font-black uppercase rounded-lg transition-all shrink-0 ${
              filterCategory === 'FURN'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25'
                : 'bg-black/30 text-neutral-500 border border-transparent hover:text-neutral-300'
            }`}
          >
            Furniture
          </button>
          <button
            onClick={() => setFilterCategory('SITE')}
            className={`px-3 py-1 text-[8px] font-black uppercase rounded-lg transition-all shrink-0 ${
              filterCategory === 'SITE'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25'
                : 'bg-black/30 text-neutral-500 border border-transparent hover:text-neutral-300'
            }`}
          >
            Site & Utility
          </button>
        </div>
      </div>

      {/* Sidebar Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#070709] scrollbar-none content-start">
        {/* Helper Instructions Banner */}
        <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-xl p-3 flex gap-2.5 items-start">
          <ArrowDown size={14} className="text-cyan-400 shrink-0 mt-0.5" />
          <p className="text-[8px] text-neutral-400 font-medium leading-normal uppercase select-none">
            Drag any block from the list and drop directly on the canvas to place, or simply click/tap a block to use precise alignment snapping insertion.
          </p>
        </div>

        {/* Custom block creator tool */}
        {activeTab === 'custom' && (
          <div className="bg-neutral-900/40 border border-white/5 rounded-xl p-4 space-y-3.5">
            <h4 className="text-[8px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/5 pb-2">
              <PlusCircle size={12} className="text-cyan-400" />
              Create Custom Block Definition
            </h4>
            
            {selectedCount > 0 ? (
              <form onSubmit={handleSaveSelection} className="space-y-3">
                <div className="text-[8px] font-mono text-cyan-500 font-bold bg-cyan-500/5 px-2.5 py-1.5 rounded-lg border border-cyan-500/10 inline-block">
                  {selectedCount} SHAPES SELECTED FOR BLOCK
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="ENTER EXQUISITE BLOCK NAME..."
                    value={newBlockName}
                    onChange={e => setNewBlockName(e.target.value)}
                    className="flex-1 bg-black border border-white/10 rounded-xl py-3 px-3.5 text-[10px] text-cyan-400 font-mono placeholder-neutral-600 outline-none focus:border-cyan-500 transition-all uppercase"
                  />
                  <button
                    type="submit"
                    className="bg-cyan-500 hover:bg-cyan-400 text-black px-4.5 rounded-xl text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all outline-none shrink-0"
                  >
                    Save Definition
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-2.5 text-[8px] font-bold text-neutral-500 uppercase py-1">
                <AlertCircle size={14} className="text-neutral-600 shrink-0" />
                Select some drawing elements on the canvas to define as a new reusable block!
              </div>
            )}
          </div>
        )}

        {/* Grid of Blocks */}
        {filteredBlocksList.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 pb-4">
            {filteredBlocksList.map(([key, b]) => {
              const cat = getBlockCategory(key);
              const dateClass = getBlockDateString(b, key);
              return (
              <div
                key={b.id || key}
                draggable
                onDragStart={e => handleDragStart(e, key, b)}
                onClick={() => onInsertBlock(key)}
                className="group relative bg-[#0d0d11]/80 hover:bg-[#121217] border border-white/5 hover:border-cyan-500/30 rounded-2xl p-3 flex flex-col items-center justify-between gap-3 text-center transition-all duration-300 cursor-pointer active:scale-98 select-none hover:shadow-lg"
              >
                {/* Visual Block Representation Badge */}
                <div className="w-full aspect-[4/3] rounded-xl bg-black/60 border border-white/[0.03] flex items-center justify-center relative overflow-hidden group-hover:bg-black/90 transition-all duration-300">
                  <Box size={24} className="text-neutral-600 group-hover:text-cyan-400 stroke-[1.5] transition-all group-hover:scale-110 duration-500" />
                  
                  {/* Category mini tag indicator */}
                  <span className="absolute top-1.5 left-1.5 py-0.5 px-1.5 rounded-md bg-cyan-950/45 border border-cyan-500/10 text-[5.5px] font-mono text-cyan-400 group-hover:bg-cyan-900/60 transition-all">
                    {cat}
                  </span>

                  {/* Creation indicator */}
                  <span className="absolute top-1.5 right-1.5 py-0.5 px-1.5 rounded-md bg-black/55 border border-white/5 text-[5px] font-mono text-neutral-500 group-hover:text-neutral-400 transition-all">
                    {dateClass}
                  </span>

                  {/* Base Insertion Coordinates indicator */}
                  <span className="absolute bottom-1.5 left-1.5 py-0.5 px-1.5 rounded bg-neutral-900/80 border border-white/5 text-[6px] font-mono text-cyan-500/80 group-hover:text-cyan-400">
                    BASE: {b.basePoint ? `${b.basePoint.x}, ${b.basePoint.y}` : '0, 0'}
                  </span>
                  
                  {/* Inline metadata indicator */}
                  <span className="absolute bottom-1.5 right-1.5 py-0.5 px-1.5 rounded bg-neutral-900/80 border border-white/5 text-[6px] font-mono text-neutral-500 group-hover:text-neutral-400">
                    {b.shapes.length} SHP
                  </span>
                </div>

                {/* Details */}
                <div className="w-full flex flex-col items-start px-0.5">
                  <span className="text-[9px] font-bold text-neutral-300 group-hover:text-cyan-400 tracking-wide text-left uppercase line-clamp-1 w-full truncate transition-all">
                    {b.name}
                  </span>
                  <span className="text-[7px] text-neutral-500 font-mono mt-0.5 tracking-tighter truncate w-full text-left uppercase">
                    ID: {key}
                  </span>
                </div>

                {/* Hover Action Indicators overlay */}
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-all flex gap-1 animate-in slide-in-from-top-1 duration-200">
                  <button
                    title="Edit block definition"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditBlock(key);
                    }}
                    className="p-1.5 bg-emerald-950/20 border border-emerald-500/20 rounded-lg text-emerald-400 hover:bg-emerald-500 hover:text-black active:scale-95 transition-all outline-none cursor-pointer"
                  >
                    <Wrench size={10} />
                  </button>
                  {activeTab === 'custom' && (
                    <button
                      title="Delete block definition"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBlock(key);
                      }}
                      className="p-1.5 bg-red-950/20 border border-red-500/20 rounded-lg text-red-500 hover:text-red-400 active:scale-95 transition-all outline-none cursor-pointer"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                  <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400">
                    <Copy size={10} />
                  </div>
                </div>
              </div>
            );})}
          </div>
        ) : (
          <div className="text-center py-12 text-neutral-600 space-y-2">
            <Box size={32} className="mx-auto text-neutral-800 opacity-60" />
            <p className="text-[9px] font-bold uppercase tracking-wider">No matching blocks found</p>
          </div>
        )}
      </div>
    </div>
  );
}
