
import React, { useState } from 'react';
import { X, Check, Type, AlignLeft, AlignCenter, AlignRight, RotateCcw, Maximize, Bold, Italic, Underline, Highlighter, ArrowLeftRight, List, ListOrdered, IndentIncrease } from 'lucide-react';

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
    width?: number;
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
    width?: number;
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
  const [width, setWidth] = useState(initialSettings?.width || 0);

  const fonts = [
    { name: 'Regular', value: 'monospace' },
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Sans-Serif', value: 'Inter, system-ui, sans-serif' },
    { name: 'JetBrains', value: '"JetBrains Mono", monospace' },
    { name: 'Serif', value: 'serif' }
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-[#0d0d0f] rounded-[1.5rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/10 animate-in zoom-in-95 duration-200 flex flex-col h-[75vh] max-h-[90vh]">
        
        {/* Header - 1st line: annotation property */}
        <div className="px-4 py-2 border-b border-white/5 flex justify-between items-center bg-[#121214]">
          <div className="flex items-center gap-2">
            <Type size={14} className="text-cyan-400" />
            <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">ANNOTATION PROPERTY</h2>
          </div>
          <button onClick={onCancel} className="p-1 hover:bg-white/5 rounded-full text-neutral-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* 2nd line - Justification tool and text style */}
        <div className="px-4 py-1.5 bg-[#0a0a0c] border-b border-white/10 flex items-center gap-4 scrollbar-none overflow-x-auto">
            <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg border border-white/5 shrink-0">
                {[
                  { id: 'left', icon: <AlignLeft size={16} /> },
                  { id: 'center', icon: <AlignCenter size={16} /> },
                  { id: 'right', icon: <AlignRight size={16} /> }
                ].map((btn) => (
                  <button 
                    key={btn.id}
                    onClick={() => setJustification(btn.id as any)}
                    className={`p-1.5 rounded-md transition-all ${justification === btn.id ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    {btn.icon}
                  </button>
                ))}
            </div>

            <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg border border-white/5 shrink-0">
                {[
                  { active: bold, setter: setBold, icon: <Bold size={16} />, title: "Bold" },
                  { active: italic, setter: setItalic, icon: <Italic size={16} />, title: "Italic" },
                  { active: underline, setter: setUnderline, icon: <Underline size={16} />, title: "Underline" },
                ].map((btn) => (
                  <button 
                    key={`mtext-attr-${btn.title}`}
                    onClick={() => btn.setter(!btn.active)}
                    className={`p-1.5 rounded-md transition-all ${btn.active ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                    title={btn.title}
                  >
                    {btn.icon}
                  </button>
                ))}
                <button 
                  onClick={() => setHighlight(!highlight)}
                  className={`p-1.5 rounded-md transition-all ${highlight ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                  title="Highlight"
                >
                  <Highlighter size={16} />
                </button>
            </div>

            <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg border border-white/5 shrink-0 opacity-40 grayscale pointer-events-none">
                <button className="p-1.5 text-neutral-500"><List size={16} /></button>
                <button className="p-1.5 text-neutral-500"><ListOrdered size={16} /></button>
                <button className="p-1.5 text-neutral-500"><IndentIncrease size={16} /></button>
            </div>
        </div>

        {/* 3rd line - Text type , height angle, width */}
        <div className="px-4 py-2 bg-[#0a0a0c] border-b border-white/10 flex items-center gap-6 overflow-x-auto scrollbar-none">
            <div className="flex flex-col gap-0.5 shrink-0">
                <span className="text-[7.5px] font-black uppercase text-neutral-600 tracking-tighter">Text Type</span>
                <select 
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="bg-white/5 text-white font-bold text-[10px] outline-none border border-white/5 px-2 py-1 rounded-md cursor-pointer min-w-[100px] hover:bg-white/10 transition-colors"
                >
                  {fonts.map(f => (
                    <option key={f.value} value={f.value} className="bg-[#0d0d0f]">{f.name}</option>
                  ))}
                </select>
            </div>

            <div className="flex flex-col gap-0.5 shrink-0">
                <span className="text-[7.5px] font-black uppercase text-neutral-600 tracking-tighter">Height</span>
                <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-md border border-white/5 hover:bg-white/10 transition-colors">
                    <Maximize size={10} className="text-cyan-500" />
                    <input 
                      type="number" 
                      value={size} 
                      onChange={(e) => setSize(Number(e.target.value))}
                      className="w-14 bg-transparent text-neutral-100 font-mono text-[10px] outline-none"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-0.5 shrink-0">
                <span className="text-[7.5px] font-black uppercase text-neutral-600 tracking-tighter">Angle</span>
                <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-md border border-white/5 hover:bg-white/10 transition-colors">
                    <RotateCcw size={10} className="text-cyan-500" />
                    <input 
                      type="number" 
                      value={rotation} 
                      onChange={(e) => setRotation(Number(e.target.value))}
                      className="w-12 bg-transparent text-neutral-100 font-mono text-[10px] outline-none"
                    />
                    <span className="text-[8px] font-black text-neutral-600">°</span>
                </div>
            </div>

            <div className="flex flex-col gap-0.5 shrink-0">
                <span className="text-[7.5px] font-black uppercase text-neutral-600 tracking-tighter">Block Width</span>
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-md border border-white/5 hover:bg-white/10 transition-colors group">
                    <ArrowLeftRight size={10} className="text-cyan-500" />
                    <input 
                      type="number" 
                      value={width} 
                      onChange={(e) => setWidth(Number(e.target.value))}
                      placeholder="Infinite"
                      className="w-16 bg-transparent text-neutral-100 font-mono text-[10px] outline-none placeholder:text-neutral-700"
                    />
                    <span className="text-[8px] font-black text-neutral-700 group-focus-within:text-cyan-500">MM</span>
                </div>
            </div>
        </div>
        
        {/* 4th line - Text area */}
        <div className="flex-1 p-0 overflow-hidden bg-black/40">
          <textarea 
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-full min-h-[400px] bg-transparent text-neutral-200 p-8 outline-none resize-none placeholder:text-neutral-800 leading-[1.6] tracking-wide scrollbar-thin scrollbar-thumb-white/10"
            placeholder="TYPE CONTENT HERE..."
            style={{ 
                textAlign: justification,
                fontSize: `${Math.min(32, Math.max(14, size / 8))}px`,
                fontWeight: bold ? 'bold' : 'normal',
                fontStyle: italic ? 'italic' : 'normal',
                textDecoration: underline ? 'underline' : 'none',
                backgroundColor: highlight ? 'rgba(255, 230, 0, 0.05)' : 'transparent',
                fontFamily: fontFamily,
                maxWidth: width > 0 ? `${width / 10}px` : 'none',
                margin: '0 auto'
            }}
          />
        </div>

        {/* 5th line - Discard and place content */}
        <div className="px-6 py-3 bg-[#121214] border-t border-white/10 flex justify-between items-center shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
          <button 
            onClick={onCancel}
            className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 hover:text-red-500 hover:bg-red-500/5 transition-all active:scale-95"
          >
            DISCARD
          </button>
          <div className="flex items-center gap-3">
              <span className="text-[9px] font-bold text-neutral-600 uppercase hidden sm:block">CTRL+ENTER TO SAVE</span>
              <button 
                onClick={() => onSave(text, { size, rotation, justification, bold, italic, underline, highlight, fontFamily, width })}
                className="px-8 py-2.5 bg-cyan-500 text-black rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_10px_25px_rgba(6,182,212,0.3)] active:scale-95 transition-all flex items-center gap-2 hover:bg-cyan-400 hover:shadow-cyan-400/40"
              >
                <Check size={14} strokeWidth={4} /> PLACE CONTENT
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MTextEditor;

