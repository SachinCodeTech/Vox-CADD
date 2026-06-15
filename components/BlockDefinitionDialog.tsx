import React, { useState, useEffect } from 'react';
import { X, Box, Crosshair, HelpCircle, Save, AlertCircle } from 'lucide-react';
import { Point } from '../types';

interface BlockDefinitionDialogProps {
  selectedShapesCount: number;
  pickedPoint: Point | null;
  onPickPointOnScreen: (tempName: string, tempAction: 'retain' | 'convert' | 'delete') => void;
  onConfirm: (name: string, basePoint: Point, action: 'retain' | 'convert' | 'delete') => void;
  onClose: () => void;
  initialTempValues?: { name: string; action: 'retain' | 'convert' | 'delete' };
}

export default function BlockDefinitionDialog({
  selectedShapesCount,
  pickedPoint,
  onPickPointOnScreen,
  onConfirm,
  onClose,
  initialTempValues
}: BlockDefinitionDialogProps) {
  const [name, setName] = useState(initialTempValues?.name || '');
  const [xVal, setXVal] = useState(pickedPoint ? pickedPoint.x.toFixed(2) : '0.00');
  const [yVal, setYVal] = useState(pickedPoint ? pickedPoint.y.toFixed(2) : '0.00');
  const [action, setAction] = useState<'retain' | 'convert' | 'delete'>(initialTempValues?.action || 'convert');
  const [error, setError] = useState('');

  useEffect(() => {
    if (pickedPoint) {
      setXVal(pickedPoint.x.toFixed(2));
      setYVal(pickedPoint.y.toFixed(2));
    }
  }, [pickedPoint]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please specify a unique block name.');
      return;
    }
    const x = parseFloat(xVal);
    const y = parseFloat(yVal);
    if (isNaN(x) || isNaN(y)) {
      setError('Base point coordinates must be valid numbers.');
      return;
    }

    onConfirm(cleanName, { x, y }, action);
  };

  const handlePickPoint = () => {
    onPickPointOnScreen(name, action);
  };

  return (
    <div 
      id="block-definition-dialog"
      className="relative w-[94vw] sm:w-[450px] max-w-[95vw] glass-panel rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.85)] border border-white/5 bg-[#0b0b0d]/98 backdrop-blur-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      style={{ zIndex: 1100 }}
    >
      {/* Header */}
      <div className="flex justify-between items-center px-5 py-4 border-b border-white/5 bg-[#121215]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <Box size={16} className="stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 leading-none">Block Definition</h3>
            <span className="text-[7px] text-neutral-500 uppercase tracking-widest font-bold mt-1 block">Define new reusable CAD component</span>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-full text-neutral-500 hover:text-white transition-all outline-none"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 flex-1 space-y-4 text-left">
        {/* Block Name Section */}
        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
          <label className="text-[8px] font-black uppercase tracking-wider text-neutral-400">Block Name</label>
          <input
            type="text"
            required
            autoFocus
            placeholder="E.G. COLUMN_300X300, DOOR_90..."
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            className="w-full bg-black/60 border border-white/10 rounded-xl py-3 px-3.5 text-[10px] text-cyan-400 font-mono placeholder-neutral-700 outline-none focus:border-cyan-500/50 focus:bg-black transition-all uppercase"
          />
        </div>

        {/* Base Point Coordinates / Pick Section */}
        <div className="bg-neutral-900/40 border border-white/5 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h4 className="text-[8px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
              <Crosshair size={12} className="text-cyan-400" />
              Base Point Definition
            </h4>
            <button
              type="button"
              onClick={handlePickPoint}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all outline-none border border-cyan-500/20"
            >
              <Crosshair size={10} />
              Pick Point on Screen
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-[7px] font-bold text-neutral-500 uppercase tracking-wider">X Coordinate (mm)</label>
              <input
                type="text"
                value={xVal}
                onChange={(e) => setXVal(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-lg py-2 px-2.5 text-[10px] text-neutral-300 font-mono focus:border-cyan-500/50 focus:bg-black outline-none transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[7px] font-bold text-neutral-500 uppercase tracking-wider">Y Coordinate (mm)</label>
              <input
                type="text"
                value={yVal}
                onChange={(e) => setYVal(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-lg py-2 px-2.5 text-[10px] text-neutral-300 font-mono focus:border-cyan-500/50 focus:bg-black outline-none transition-all"
              />
            </div>
          </div>
          {pickedPoint && (
            <p className="text-[6.5px] text-cyan-500 font-mono font-black uppercase mt-1">
              ● CAPTURED COORDINATES: ({pickedPoint.x.toFixed(1)}, {pickedPoint.y.toFixed(1)})
            </p>
          )}
        </div>

        {/* Selected Objects Settings Section */}
        <div className="bg-neutral-900/40 border border-white/5 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h4 className="text-[8px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
              <HelpCircle size={12} className="text-cyan-400" />
              Source Objects Behavior
            </h4>
            <div className="text-[7px] font-mono text-cyan-400 font-bold bg-cyan-500/5 px-2 py-0.5 rounded border border-cyan-500/10">
              {selectedShapesCount} COMPONENT{selectedShapesCount !== 1 ? 'S' : ''} SELECTED
            </div>
          </div>

          {selectedShapesCount === 0 ? (
            <div className="w-full flex items-center gap-2 text-amber-500/80 text-[7.5px] font-bold uppercase p-1">
              <AlertCircle size={14} className="shrink-0" />
              Warning: 0 shapes selected. Block will be empty! Please close, select objects on screen, and run BLOCK again.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAction('retain')}
                className={`py-2 px-1.5 rounded-xl text-center border text-[8px] font-black uppercase tracking-wider transition-all outline-none ${
                  action === 'retain'
                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                    : 'bg-black/20 text-neutral-500 border-transparent hover:text-neutral-400'
                }`}
              >
                Retain
              </button>
              <button
                type="button"
                onClick={() => setAction('convert')}
                className={`py-2 px-1.5 rounded-xl text-center border text-[8px] font-black uppercase tracking-wider transition-all outline-none ${
                  action === 'convert'
                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                    : 'bg-black/20 text-neutral-500 border-transparent hover:text-neutral-400'
                }`}
              >
                Convert to Block
              </button>
              <button
                type="button"
                onClick={() => setAction('delete')}
                className={`py-2 px-1.5 rounded-xl text-center border text-[8px] font-black uppercase tracking-wider transition-all outline-none ${
                  action === 'delete'
                    ? 'bg-rose-500/5 text-rose-500 border-rose-500/10'
                    : 'bg-black/20 text-neutral-500 border-transparent hover:text-neutral-400'
                }`}
              >
                Delete Source
              </button>
            </div>
          )}
          <p className="text-[6px] text-neutral-500 leading-normal uppercase">
            {action === 'retain' && 'Leaves the original geometry on your canvas intact while recording the definition.'}
            {action === 'convert' && 'Replaces the selected geometry with an active block reference instance relative to your base point.'}
            {action === 'delete' && 'Deletes selected canvas entities after defining. Access them from Block Library.'}
          </p>
        </div>

        {/* Error messaging */}
        {error && (
          <div className="text-rose-500 text-[8px] font-black uppercase flex items-center gap-1.5 bg-rose-950/20 px-3 py-2 rounded-xl border border-rose-500/20">
            <AlertCircle size={12} />
            {error}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-white/5 hover:border-white/15 bg-black/40 text-neutral-400 hover:text-white py-3 rounded-xl text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all outline-none"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black py-3 rounded-xl text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all outline-none flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] duration-300"
          >
            <Save size={12} />
            Create Block
          </button>
        </div>
      </form>
    </div>
  );
}
