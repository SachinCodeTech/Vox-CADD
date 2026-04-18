
import React, { useState, useEffect } from 'react';
import { X, Check, Type, AlignLeft, AlignCenter, AlignRight, Bold, Italic } from 'lucide-react';

interface MTextEditorProps {
  initialValue: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}

const MTextEditor: React.FC<MTextEditorProps> = ({ initialValue, onSave, onCancel }) => {
  const [text, setText] = useState(initialValue);

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
              <h2 className="text-lg font-black text-white uppercase tracking-tight">MText Editor</h2>
              <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-[0.2em] mt-0.5">Multi-line Text Processor</p>
            </div>
          </div>
          <button onClick={onCancel} className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full text-neutral-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 bg-[#0a0a0c] border-b border-white/5 flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-white/5 text-neutral-500 transition-all"><AlignLeft size={16} /></button>
            <button className="p-2 rounded-lg hover:bg-white/5 text-neutral-500 transition-all"><AlignCenter size={16} /></button>
            <button className="p-2 rounded-lg hover:bg-white/5 text-neutral-500 transition-all"><AlignRight size={16} /></button>
            <div className="w-px h-6 bg-white/5 mx-1" />
            <button className="p-2 rounded-lg hover:bg-white/5 text-neutral-500 transition-all"><Bold size={16} /></button>
            <button className="p-2 rounded-lg hover:bg-white/5 text-neutral-500 transition-all"><Italic size={16} /></button>
        </div>
        
        {/* Editor Area */}
        <div className="flex-1 p-6 overflow-hidden">
          <textarea 
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-full bg-transparent text-white font-sans text-base outline-none resize-none placeholder:text-neutral-800 leading-relaxed"
            placeholder="Enter architectural notes or text content..."
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
            onClick={() => onSave(text)}
            className="px-8 py-3 bg-cyan-600 text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-cyan-950/20 active:scale-95 transition-all flex items-center gap-2"
          >
            <Check size={16} strokeWidth={3} /> Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default MTextEditor;
