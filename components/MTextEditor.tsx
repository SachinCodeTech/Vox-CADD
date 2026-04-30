
import React, { useState } from 'react';
import { X, Check, Type, AlignLeft, AlignCenter, AlignRight, RotateCcw, Maximize, Bold, Italic, Underline, Highlighter } from 'lucide-react';

interface MTextEditorProps {
  initialValue: string;
  initialSettings?: {
    size?: number;
    rotation?: number;
    justification?: 'left' | 'center' | 'right';
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    highlight?: boolean;
    fontFamily?: string;
  };
  onSave: (text: string, settings: { 
    size: number; 
    rotation: number; 
    justification: 'left' | 'center' | 'right';
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    highlight?: boolean;
    fontFamily?: string;
  }) => void;
  onCancel: () => void;
}

const MTextEditor: React.FC<MTextEditorProps> = ({ initialValue, initialSettings, onSave, onCancel }) => {
  const [text, setText] = useState(initialValue);
  const [size, setSize] = useState(initialSettings?.size || 250);
  const [rotation, setRotation] = useState(initialSettings?.rotation || 0);
  const [justification, setJustification] = useState<'left' | 'center' | 'right'>(initialSettings?.justification || 'left');
  const [bold, setBold] = useState(initialSettings?.bold || false);
  const [italic, setItalic] = useState(initialSettings?.italic || false);
  const [underline, setUnderline] = useState(initialSettings?.underline || false);
  const [highlight, setHighlight] = useState(initialSettings?.highlight || false);
  const [fontFamily, setFontFamily] = useState(initialSettings?.fontFamily || 'monospace');

  const fonts = [
    { name: 'Regular', value: 'monospace' },
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Sans-Serif', value: 'Inter, system-ui, sans-serif' },
    { name: 'JetBrains', value: '"JetBrains Mono", monospace' },
    { name: 'Serif', value: 'serif' }
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-[#0d0d0f] rounded-[1.5rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/10 animate-in zoom-in-95 duration-200 flex flex-col h-[70vh] max-h-[90vh]">
        
        {/* Header - 1st line: t annotation property */}
        <div className="px-4 py-2 border-b border-white/5 flex justify-between items-center bg-[#121214]">
          <div className="flex items-center gap-2">
            <Type size={14} className="text-cyan-400" />
            <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">T ANNOTATION PROPERTY</h2>
          </div>
          <button onClick={onCancel} className="p-1 hover:bg-white/5 rounded-full text-neutral-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* 2nd line - Justification tool and text style */}
        <div className="px-4 py-1.5 bg-[#0a0a0c] border-b border-white/10 flex items-center gap-4">
            <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg border border-white/5">
                {[
                  { id: 'left', icon: <AlignLeft size={16} /> },
                  { id: 'center', icon: <AlignCenter size={16} /> },
                  { id: 'right', icon: <AlignRight size={16} /> }
                ].map((btn) => (
                  <button 
                    key={btn.id}
                    onClick={() => setJustification(btn.id as any)}
                    className={`p-1.5 rounded-md transition-all ${justification === btn.id ? 'bg-cyan-500 text-black' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    {btn.icon}
                  </button>
                ))}
            </div>

            <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg border border-white/5">
                {[
                  { active: bold, setter: setBold, icon: <Bold size={16} />, title: "Bold" },
                  { active: italic, setter: setItalic, icon: <Italic size={16} />, title: "Italic" },
                  { active: underline, setter: setUnderline, icon: <Underline size={16} />, title: "Underline" },
                ].map((btn, idx) => (
                  <button 
                    key={idx}
                    onClick={() => btn.setter(!btn.active)}
                    className={`p-1.5 rounded-md transition-all ${btn.active ? 'bg-cyan-500 text-black' : 'text-neutral-500 hover:text-neutral-300'}`}
                    title={btn.title}
                  >
                    {btn.icon}
                  </button>
                ))}
                <button 
                  onClick={() => setHighlight(!highlight)}
                  className={`p-1.5 rounded-md transition-all ${highlight ? 'bg-yellow-500 text-black' : 'text-neutral-500 hover:text-neutral-300'}`}
                  title="Highlight"
                >
                  <Highlighter size={16} />
                </button>
            </div>
        </div>

        {/* 3rd line - Text type , height angle */}
        <div className="px-4 py-2 bg-[#0a0a0c] border-b border-white/10 flex items-center gap-3 overflow-x-auto scrollbar-none">
            <div className="flex flex-col gap-0.5 shrink-0">
                <span className="text-[7.5px] font-black uppercase text-neutral-600 tracking-tighter">Text Type</span>
                <select 
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="bg-white/5 text-white font-bold text-[10px] outline-none border border-white/5 px-2 py-1 rounded-md cursor-pointer min-w-[100px]"
                >
                  {fonts.map(f => (
                    <option key={f.value} value={f.value} className="bg-[#0d0d0f]">{f.name}</option>
                  ))}
                </select>
            </div>

            <div className="flex flex-col gap-0.5 shrink-0">
                <span className="text-[7.5px] font-black uppercase text-neutral-600 tracking-tighter">Height</span>
                <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                    <Maximize size={10} className="text-neutral-500" />
                    <input 
                      type="number" 
                      value={size} 
                      onChange={(e) => setSize(Number(e.target.value))}
                      className="w-14 bg-transparent text-white font-mono text-[10px] outline-none"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-0.5 shrink-0">
                <span className="text-[7.5px] font-black uppercase text-neutral-600 tracking-tighter">Angle</span>
                <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                    <RotateCcw size={10} className="text-neutral-500" />
                    <input 
                      type="number" 
                      value={rotation} 
                      onChange={(e) => setRotation(Number(e.target.value))}
                      className="w-12 bg-transparent text-white font-mono text-[10px] outline-none"
                    />
                    <span className="text-[8px] font-black text-neutral-600">°</span>
                </div>
            </div>
        </div>
        
        {/* 4th line - Text area */}
        <div className="flex-1 p-0 overflow-hidden bg-neutral-900/10">
          <textarea 
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-full min-h-[400px] bg-transparent text-white p-4 outline-none resize-none placeholder:text-neutral-800 leading-relaxed scrollbar-thin scrollbar-thumb-white/10"
            placeholder="TYPE CONTENT HERE..."
            style={{ 
                textAlign: justification,
                fontSize: `${Math.min(24, Math.max(12, size / 10))}px`,
                fontWeight: bold ? 'bold' : 'normal',
                fontStyle: italic ? 'italic' : 'normal',
                textDecoration: underline ? 'underline' : 'none',
                backgroundColor: highlight ? 'rgba(255, 230, 0, 0.1)' : 'transparent',
                fontFamily: fontFamily
            }}
          />
        </div>

        {/* 5th line - Discard and place content */}
        <div className="px-4 py-1.5 bg-[#121214] border-t border-white/10 flex justify-between items-center">
          <button 
            onClick={onCancel}
            className="px-4 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest text-neutral-600 hover:text-red-500 transition-all active:scale-95"
          >
            DISCARD
          </button>
          <button 
            onClick={() => onSave(text, { size, rotation, justification, bold, italic, underline, highlight, fontFamily })}
            className="px-6 py-1.5 bg-cyan-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-[0_10px_20px_rgba(6,182,212,0.3)] active:scale-95 transition-all flex items-center gap-2"
          >
            <Check size={14} strokeWidth={4} /> PLACE CONTENT
          </button>
        </div>
      </div>
    </div>

  );
};

export default MTextEditor;
