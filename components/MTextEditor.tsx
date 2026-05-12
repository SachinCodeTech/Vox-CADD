
import React, { useState } from 'react';
import { X, Check, Type, AlignLeft, AlignCenter, AlignRight, RotateCcw, Maximize, Bold, Italic, Underline, Highlighter, ArrowLeftRight, List, ListOrdered, IndentIncrease, Strikethrough as StrikethroughIcon } from 'lucide-react';

interface MTextEditorProps {
  initialValue: string;
  initialSettings?: {
    size?: number;
    rotation?: number;
    justification?: 'left' | 'center' | 'right';
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    highlight?: boolean;
    highlightColor?: string;
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
    strikethrough?: boolean;
    highlight?: boolean;
    highlightColor?: string;
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
  const [strikethrough, setStrikethrough] = useState(initialSettings?.strikethrough || false);
  const [highlight, setHighlight] = useState(initialSettings?.highlight || false);
  const [highlightColor, setHighlightColor] = useState(initialSettings?.highlightColor || 'rgba(254, 240, 138, 0.9)');
  const [fontFamily, setFontFamily] = useState(initialSettings?.fontFamily || 'monospace');
  const [width, setWidth] = useState(initialSettings?.width || 0);

  const fonts = [
    { name: 'Monospace', value: 'monospace' },
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Inter', value: 'Inter, system-ui, sans-serif' },
    { name: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
    { name: 'Fira Code', value: '"Fira Code", monospace' },
    { name: 'Roboto', value: 'Roboto, sans-serif' },
    { name: 'Open Sans', value: '"Open Sans", sans-serif' },
    { name: 'Lato', value: 'Lato, sans-serif' },
    { name: 'Montserrat', value: 'Montserrat, sans-serif' },
    { name: 'Playfair Display', value: '"Playfair Display", serif' },
    { name: 'Space Grotesk', value: '"Space Grotesk", sans-serif' },
    { name: 'Outfit', value: 'Outfit, sans-serif' },
    { name: 'Poppins', value: 'Poppins, sans-serif' },
    { name: 'Times New Roman', value: '"Times New Roman", serif' },
    { name: 'Courier New', value: '"Courier New", monospace' },
    { name: 'Verdana', value: 'Verdana, sans-serif' },
    { name: 'Georgia', value: 'Georgia, serif' }
  ];

  const handleBold = () => setBold(!bold);
  const handleItalic = () => setItalic(!italic);
  const handleUnderline = () => setUnderline(!underline);
  const handleStrikethrough = () => setStrikethrough(!strikethrough);
  const handleHighlight = () => setHighlight(!highlight);

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
                <button 
                  onClick={handleBold}
                  className={`p-1.5 rounded-md transition-all ${bold ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                  title="Bold"
                >
                  <Bold size={16} />
                </button>
                <button 
                  onClick={handleItalic}
                  className={`p-1.5 rounded-md transition-all ${italic ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                  title="Italic"
                >
                  <Italic size={16} />
                </button>
                <button 
                  onClick={handleUnderline}
                  className={`p-1.5 rounded-md transition-all ${underline ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                  title="Underline"
                >
                  <Underline size={16} />
                </button>
                <button 
                  onClick={handleStrikethrough}
                  className={`p-1.5 rounded-md transition-all ${strikethrough ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                  title="Strikethrough"
                >
                  <StrikethroughIcon size={16} />
                </button>
                <button 
                  onClick={handleHighlight}
                  className={`p-1.5 rounded-md transition-all ${highlight ? 'text-black shadow-lg shadow-white/5 font-bold' : 'text-neutral-500 hover:text-neutral-300'}`}
                  style={{ backgroundColor: highlight ? highlightColor : 'transparent' }}
                  title="Highlighter"
                >
                  <Highlighter size={16} />
                </button>
            </div>

            {highlight && (
              <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-lg border border-white/5 shrink-0 animate-in slide-in-from-left-2 duration-200">
                {[
                  'rgba(254, 240, 138, 0.9)', // Yellow
                  'rgba(138, 254, 150, 0.9)', // Green
                  'rgba(138, 196, 254, 0.9)', // Blue
                  'rgba(254, 138, 138, 0.9)', // Red
                  'rgba(225, 138, 254, 0.9)', // Pink
                  'rgba(254, 178, 138, 0.9)', // Orange
                  'rgba(138, 254, 240, 0.9)', // Cyan
                  'rgba(255, 255, 255, 0.9)'  // White/Full light
                ].map(c => (
                  <button 
                    key={c}
                    onClick={() => setHighlightColor(c)}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${highlightColor === c ? 'border-white scale-110 shadow-lg' : 'border-black/50 overflow-hidden hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}

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
        <div className="flex-1 p-0 overflow-hidden bg-black/40 relative">
          <textarea 
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-full min-h-[400px] bg-transparent text-neutral-200 p-8 outline-none resize-none placeholder:text-neutral-800 leading-[1.6] tracking-wide scrollbar-thin scrollbar-thumb-white/10 relative z-10"
            placeholder="TYPE CONTENT HERE..."
            style={{ 
                textAlign: justification,
                fontSize: `${Math.min(32, Math.max(14, size / 8))}px`,
                fontWeight: bold ? 'bold' : 'normal',
                fontStyle: italic ? 'italic' : 'normal',
                textDecoration: `${underline ? 'underline' : ''} ${strikethrough ? 'line-through' : ''}`.trim() || 'none',
                fontFamily: fontFamily,
                maxWidth: width > 0 ? `${width / 10}px` : 'none',
                margin: '0 auto',
                backgroundColor: highlight ? highlightColor : 'transparent',
                color: highlight ? '#000000' : 'inherit',
                borderRadius: highlight ? '4px' : '0',
                padding: highlight ? '4px 12px' : '0'
            }}
          />
          {highlight && (
            <div 
              className="absolute inset-0 pointer-events-none mix-blend-screen animate-pulse opacity-20" 
              style={{ backgroundColor: highlightColor }}
            />
          )}
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
                onClick={() => onSave(text, { size, rotation, justification, bold, italic, underline, strikethrough, highlight, highlightColor, fontFamily, width })}
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

