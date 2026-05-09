
import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Save, FileText, Activity } from 'lucide-react';
import { LineTypeDefinition, LineType } from '../types';

interface LineTypeManagerProps {
  lineTypes: Record<string, LineTypeDefinition>;
  onUpdate: (name: string, def: LineTypeDefinition) => void;
  onRemove: (name: string) => void;
  onClose: () => void;
}

const LineTypeManager: React.FC<LineTypeManagerProps> = ({ lineTypes, onUpdate, onRemove, onClose }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPattern, setNewPattern] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    
    // Parse pattern: "10,-5,2,-5" -> [10, 5, 2, 5] (internally we use all positive, or maybe negative means space)
    // Standard CAD .lin: positive is dash, negative is space.
    // Our renderer uses Canvas setLineDash which expects [dash, space, dash, space].
    
    const pattern = newPattern.split(',').map(s => Math.abs(parseFloat(s.trim()))).filter(n => !isNaN(n));
    
    onUpdate(newName.toLowerCase(), {
      name: newName.toLowerCase(),
      description: newDesc || newName,
      pattern: pattern.length > 0 ? pattern : []
    });
    
    setNewName('');
    setNewDesc('');
    setNewPattern('');
  };

  const startEdit = (lt: LineTypeDefinition) => {
    setEditingId(lt.name);
    setNewName(lt.name);
    setNewDesc(lt.description);
    setNewPattern(lt.pattern.join(', '));
  };

  const isStandard = (name: string) => [
      'continuous', 'dashed', 'dotted', 'center', 'dashdot', 'border', 'divide', 
      'phantom', 'zigzag', 'hotwater', 'hidden', 'gasline', 'fenceline', 'tracks', 
      'batt', 'zigzag2', 'dots2', 'dash2', 'bylayer', 'byblock'
  ].includes(name.toLowerCase());

  return (
    <div className="w-[450px] max-w-full bg-[#0d0d0f] rounded-2xl border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#121214]">
        <div className="flex items-center gap-2">
            <Activity size={16} className="text-cyan-400" />
            <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Linetype Manager</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-full text-neutral-600 transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-h-[60vh] space-y-2 scrollbar-none">
        {(Object.values(lineTypes) as LineTypeDefinition[]).sort((a, b) => a.name.localeCompare(b.name)).map((lt: LineTypeDefinition) => {
          const standard = isStandard(lt.name);
          return (
            <div key={lt.name} className="group bg-black/40 border border-white/5 rounded-xl p-3 hover:border-cyan-500/30 transition-all">
              <div className="flex justify-between items-start mb-2">
                <div>
                    <div className="text-[10px] font-black text-white uppercase tracking-wider">{lt.name}</div>
                    <div className="text-[8px] text-neutral-500 uppercase font-bold">{lt.description}</div>
                </div>
                {!standard && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => startEdit(lt)} className="p-1.5 hover:bg-white/5 rounded-lg text-neutral-500 hover:text-cyan-400">
                        <Edit2 size={12} />
                    </button>
                    <button onClick={() => onRemove(lt.name)} className="p-1.5 hover:bg-white/5 rounded-lg text-neutral-500 hover:text-red-500">
                        <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="h-6 flex items-center bg-black rounded border border-white/5 relative overflow-hidden">
                <div className="absolute inset-x-2 h-[1px] bg-neutral-800" />
                <svg className="absolute inset-0 w-full h-full">
                    <line 
                        x1="10" y1="50%" x2="calc(100% - 10)" y2="50%" 
                        stroke="#00bcd4" strokeWidth="1.5" 
                        strokeDasharray={lt.pattern.join(',')} 
                    />
                </svg>
              </div>
              <div className="mt-2 text-[7px] font-mono text-neutral-600 uppercase tracking-widest">
                Pattern: {lt.pattern.length > 0 ? lt.pattern.map(p => p.toFixed(1)).join(', ') : 'Solid'}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleAdd} className="p-4 border-t border-white/5 bg-[#121214] space-y-3">
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
                <label className="text-[7px] font-black text-neutral-600 uppercase tracking-widest px-1">Name</label>
                <input 
                    type="text" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)}
                    placeholder="MY_LINETYE"
                    className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-[10px] text-white uppercase font-black outline-none focus:border-cyan-500/30"
                />
            </div>
            <div className="space-y-1">
                <label className="text-[7px] font-black text-neutral-600 uppercase tracking-widest px-1">Pattern (D, S, D, S...)</label>
                <input 
                    type="text" 
                    value={newPattern} 
                    onChange={e => setNewPattern(e.target.value)}
                    placeholder="10, 5, 2, 5"
                    className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-[10px] text-white font-mono outline-none focus:border-cyan-500/30"
                />
            </div>
        </div>
        <div className="space-y-1">
            <label className="text-[7px] font-black text-neutral-600 uppercase tracking-widest px-1">Description</label>
            <input 
                type="text" 
                value={newDesc} 
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Custom dashed pattern..."
                className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-[10px] text-neutral-400 outline-none focus:border-cyan-500/30"
            />
        </div>
        <button type="submit" className="w-full bg-cyan-500 text-black py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-cyan-400 transition-all active:scale-[0.98]">
            {editingId ? 'Update Linetype' : 'Create New Linetype'}
        </button>
        {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setNewName(''); setNewPattern(''); setNewDesc(''); }} className="w-full text-neutral-500 text-[8px] font-bold uppercase py-1">
                Cancel Editing
            </button>
        )}
      </form>
    </div>
  );
};

export default LineTypeManager;
