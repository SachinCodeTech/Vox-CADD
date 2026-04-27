
import React, { useState } from 'react';
import { X, Check, Type, AlignLeft, AlignCenter, AlignRight, RotateCcw, Maximize } from 'lucide-react';

interface MTextEditorProps {
  initialValue: string;
  initialSettings?: {
    size?: number;
    rotation?: number;
    justification?: 'left' | 'center' | 'right';
  };
  onSave: (text: string, settings: { size: number; rotation: number; justification: 'left' | 'center' | 'right' }) => void;
  onCancel: () => void;
}

const MTextEditor: React.FC<MTextEditorProps> = ({ initialValue, initialSettings, onSave, onCancel }) => {
  const [text, setText] = useState(initialValue);
  const [size, setSize] = useState(initialSettings?.size || 250);
  const [rotation, setRotation] = useState(initialSettings?.rotation || 0);
  const [justification, setJustification] = useState<'left' | 'center' | 'right'>(initialSettings?.justification || 'left');

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-[#0d0d0f] rounded-[2rem] overflow-hidden shadow-[0_60px_150px_rgba(0,0,0,1)] border border-white/10 animate-in zoom-in-95 duration-400 flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#121214]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Type size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Annotation Properties</h2>
              <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-[0.2em] mt-0.5">Multi-line Text Processor</p>
            </div>
          </div>
          <button onClick={onCancel} className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full text-neutral-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 bg-[#0a0a0c] border-b border-white/5 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                <button 
                  onClick={() => setJustification('left')}
                  className={`p-2 rounded-lg transition-all ${justification === 'left' ? 'bg-cyan-500 text-black' : 'text-neutral-500 hover:bg-white/5'}`}
                >
                  <AlignLeft size={16} />
                </button>
                <button 
                  onClick={() => setJustification('center')}
                  className={`p-2 rounded-lg transition-all ${justification === 'center' ? 'bg-cyan-500 text-black' : 'text-neutral-500 hover:bg-white/5'}`}
                >
                  <AlignCenter size={16} />
                </button>
                <button 
                  onClick={() => setJustification('right')}
                  className={`p-2 rounded-lg transition-all ${justification === 'right' ? 'bg-cyan-500 text-black' : 'text-neutral-500 hover:bg-white/5'}`}
                >
                  <AlignRight size={16} />
                </button>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                    <Maximize size={12} className="text-neutral-500" />
                    <span className="text-[8px] font-black uppercase text-neutral-600">Height</span>
                    <input 
                      type="number" 
                      value={size} 
                      onChange={(e) => setSize(Number(e.target.value))}
                      className="w-16 bg-transparent text-white font-mono text-[10px] outline-none"
                    />
                </div>
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                    <RotateCcw size={12} className="text-neutral-500" />
                    <span className="text-[8px] font-black uppercase text-neutral-600">Rotate</span>
                    <input 
                      type="number" 
                      value={rotation} 
                      onChange={(e) => setRotation(Number(e.target.value))}
                      className="w-16 bg-transparent text-white font-mono text-[10px] outline-none"
                    />
                    <span className="text-[8px] font-black text-neutral-600">°</span>
                </div>
            </div>
        </div>
        
        {/* Editor Area */}
        <div className="flex-1 p-6 overflow-hidden">
          <textarea 
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-full bg-transparent text-white font-sans text-base outline-none resize-none placeholder:text-neutral-800 leading-relaxed"
            placeholder="Enter architectural notes or text content..."
            style={{ 
                textAlign: justification,
                fontSize: `${Math.min(24, Math.max(12, size / 10))}px`
            }}
          />
        </div>

        {/* Footer */}
        <div className="p-6 bg-[#0a0a0c] border-t border-white/5 flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-white transition-all"
          >
            Discard
          </button>
          <button 
            onClick={() => onSave(text, { size, rotation, justification })}
            className="px-8 py-3 bg-cyan-600 text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-cyan-950/20 active:scale-95 transition-all flex items-center gap-2"
          >
            <Check size={16} strokeWidth={3} /> Place Content
          </button>
        </div>
      </div>
    </div>
  );
};

export default MTextEditor;
