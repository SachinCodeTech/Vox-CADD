
import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRightLeft, Calculator as CalculatorIcon, Ruler, Square, Box, FunctionSquare, ChevronDown } from 'lucide-react';

interface CalculatorPanelProps {
    onClose: () => void;
}

type UnitCategory = 'length' | 'area' | 'volume';

const UNIT_DATA: Record<UnitCategory, Record<string, number>> = {
    length: {
        'mm': 1, 'cm': 10, 'm': 1000, 'km': 1000000, 'in': 25.4, 'ft': 304.8, 'yd': 914.4, 'mi': 1609344
    },
    area: {
        'sq mm': 1, 'sq cm': 100, 'sq m': 1000000, 'sq ft': 92903.04, 'sq yd': 836127.36, 'acre': 4046856422.4, 'ha': 10000000000
    },
    volume: {
        'cu mm': 1, 'cu cm': 1000, 'cu m': 1000000000, 'ml': 1000, 'l': 1000000, 'cu in': 16387.064, 'cu ft': 28316846.592, 'cu yd': 764554857.984, 'gal': 3785411.784
    }
};

const CalculatorPanel: React.FC<CalculatorPanelProps> = ({ onClose }) => {
    const [mode, setMode] = useState<'calc' | 'conv'>('calc');
    const [sciMode, setSciMode] = useState(false);
    const [display, setDisplay] = useState('');
    const [result, setResult] = useState('');
    const [convType, setConvType] = useState<UnitCategory>('length');
    const [convValue, setConvValue] = useState('');
    const [fromUnit, setFromUnit] = useState('mm');
    const [toUnit, setToUnit] = useState('in');
    const [convResult, setConvResult] = useState('');

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

    const safeCalculate = (expression: string): string => {
        try {
            let sanitized = expression
                .replace(/π/g, 'Math.PI')
                .replace(/sqrt\(/g, 'Math.sqrt(')
                .replace(/sin\(([^)]+)\)/g, 'Math.sin(($1) * Math.PI / 180)')
                .replace(/cos\(([^)]+)\)/g, 'Math.cos(($1) * Math.PI / 180)')
                .replace(/tan\(([^)]+)\)/g, 'Math.tan(($1) * Math.PI / 180)')
                .replace(/\^/g, '**');
            if (sanitized.includes('(') && !sanitized.includes(')')) sanitized += ')';
            if (!/[0-9+\-*/()..MathPIsqrtincostan**]/.test(sanitized)) return 'Error';
            const res = new Function(`return (${sanitized})`)();
            if (!isFinite(res) || isNaN(res)) return 'Error';
            return String(parseFloat(res.toFixed(8)));
        } catch (e) { return 'Error'; }
    };

    const handleCalcInput = (char: string) => {
        if (char === 'C') { setDisplay(''); setResult(''); }
        else if (char === 'DEL') { setDisplay(prev => prev.slice(0, -1)); }
        else if (char === '=') { if (!display) return; const res = safeCalculate(display); setResult(res); if (res !== 'Error') setDisplay(res); }
        else { setDisplay(prev => (result && result !== 'Error' && !['+', '-', '*', '/', '^', '(', ')'].includes(char)) ? char : prev + char); }
    };

    useEffect(() => {
        const units = Object.keys(UNIT_DATA[convType]);
        setFromUnit(units[0]);
        setToUnit(units[1] || units[0]);
        setConvValue('');
        setConvResult('');
    }, [convType]);

    useEffect(() => {
        if (!convValue) { setConvResult(''); return; }
        const val = parseFloat(convValue);
        if (isNaN(val)) { setConvResult('---'); return; }
        const factors = UNIT_DATA[convType];
        const fromFactor = factors[fromUnit];
        const toFactor = factors[toUnit];
        if (!fromFactor || !toFactor) { setConvResult('Error'); return; }
        const baseVal = val * fromFactor;
        const targetVal = baseVal / toFactor;
        let decimals = 4;
        if (targetVal !== 0 && Math.abs(targetVal) < 0.001) decimals = 8;
        if (targetVal !== 0 && Math.abs(targetVal) > 1000) decimals = 2;
        setConvResult(targetVal.toLocaleString('en-US', { maximumFractionDigits: decimals }).replace(/,/g, ''));
    }, [convValue, fromUnit, toUnit, convType]);

    return (
        <div 
            className="relative w-80 max-w-[calc(100vw-40px)] bg-[#35353a] border border-white/10 rounded-2xl shadow-[0_30px_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden select-none font-sans"
            style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, zIndex: 160 }}
        >
            {/* Professional Header */}
            <div 
                className="flex justify-between items-center p-3 border-b border-white/5 bg-[#35353a] cursor-grab active:cursor-grabbing touch-none shrink-0"
                onMouseDown={e => startDrag(e.clientX, e.clientY)}
                onTouchStart={e => e.touches.length > 0 && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
            >
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                        <CalculatorIcon size={18} />
                    </div>
                    <div className="flex bg-black/20 p-0.5 rounded-lg border border-white/5">
                        <button 
                            onClick={() => setMode('calc')} 
                            className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${mode === 'calc' ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-neutral-400 hover:text-white'}`}
                        >
                            CALC
                        </button>
                        <button 
                            onClick={() => setMode('conv')} 
                            className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${mode === 'conv' ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-neutral-400 hover:text-white'}`}
                        >
                            UNIT
                        </button>
                    </div>
                </div>
                <button 
                    onClick={onClose} 
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-all duration-200"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="p-4 space-y-4 bg-[#25252a]">
                {mode === 'calc' ? (
                    <div className="space-y-3">
                        {/* High-Contrast Display */}
                        <div className="bg-[#0f0f12] border border-white/10 rounded-xl p-3 text-right h-20 flex flex-col justify-end shadow-inner relative group">
                            <div className="absolute top-2 left-3 text-[6px] text-cyan-500/50 font-black uppercase tracking-[0.4em] pointer-events-none">LCD_MATRIX</div>
                            <div className="text-neutral-400 text-[10px] h-4 overflow-hidden text-ellipsis whitespace-nowrap font-mono tracking-tighter">
                                {result ? `PREV_RESULT: ${result}` : display}
                            </div>
                            <div className="text-white text-2xl font-mono tracking-tighter overflow-hidden text-ellipsis whitespace-nowrap pt-0.5">
                                {display || '0'}
                            </div>
                        </div>


                        {/* Control Bar */}
                        <div className="grid grid-cols-4 gap-1.5 bg-[#2a2a2e] rounded-lg p-1 border border-white/10">
                             <button 
                                onClick={() => setSciMode(!sciMode)} 
                                className={`text-[7px] font-black uppercase tracking-widest px-2 py-1 rounded-md transition-all duration-300 ${sciMode ? 'bg-cyan-950/40 text-cyan-400 border border-cyan-500/30' : 'text-neutral-400 hover:text-white'}`}
                             >
                                Sci_Mode
                             </button>
                             <div className="w-1 h-1 rounded-full bg-cyan-500/30 mr-1" />
                        </div>

                        {/* Keypad */}
                        <div className="grid grid-cols-4 gap-1.5">
                            {sciMode && (
                                <div className="col-span-4 grid grid-cols-4 gap-1.5 pb-1">
                                    {['sqrt(', 'sin(', 'cos(', 'tan(', 'π', '^', '(', ')'].map(k => (
                                        <button key={k} onClick={() => handleCalcInput(k)} className="btn-sci text-[9px] py-1.5 rounded-lg bg-white/5 border border-white/5 text-neutral-300 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/20 transition-all font-mono">
                                            {k.replace('(', '')}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {['C', '/', '*', 'DEL', '7', '8', '9', '-', '4', '5', '6', '+', '1', '2', '3', '=', '0', '.'].map((key, i) => (
                                <button 
                                    key={`calc-k-${key}-${i}`} 
                                    onClick={() => handleCalcInput(key)} 
                                    className={`h-10 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center uppercase tracking-widest ${
                                        ['C', 'DEL'].includes(key) 
                                            ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20' 
                                            : key === '=' 
                                                ? 'bg-cyan-600 text-white hover:bg-cyan-500 col-span-2 border border-cyan-400/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                                                : ['/', '*', '-', '+'].includes(key)
                                                    ? 'bg-[#2a2a2e] text-cyan-400 hover:text-white border border-white/10'
                                                    : 'bg-[#35353a] text-neutral-200 hover:text-white border border-white/10 hover:bg-[#404045]'
                                    }`}

                                >
                                    {key === '*' ? '×' : key === '/' ? '÷' : key}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Unit Type Selection */}
                        <div className="grid grid-cols-3 gap-1.5 bg-[#25252a] p-1.5 rounded-xl border border-white/10">
                            {(['length', 'area', 'volume'] as UnitCategory[]).map((type, i) => (
                                <button 
                                    key={`${type}-${i}`}
                                    onClick={() => setConvType(type)} 
                                    className={`flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg transition-all duration-300 ${convType === type ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,121,0.1)]' : 'text-neutral-500 hover:text-neutral-300 opacity-60'}`}
                                >
                                    {type === 'length' && <Ruler size={16} />}
                                    {type === 'area' && <Square size={16} />}
                                    {type === 'volume' && <Box size={16} />}
                                    <span className="text-[7px] font-black uppercase tracking-[0.2em]">{type}</span>
                                </button>
                            ))}
                        </div>

                        {/* Conversion Interface */}
                        <div className="space-y-4 relative">
                            {/* Input Field */}
                            <div className="space-y-1.5">
                                <label className="text-[8px] text-cyan-400/80 uppercase font-black px-1 tracking-widest">Input Value</label>
                                <div className="flex gap-2">
                                    <div className="flex-1 min-w-0">
                                        <input 
                                            type="number" 
                                            value={convValue} 
                                            onChange={e => setConvValue(e.target.value)} 
                                            className="w-full bg-[#151518] border border-white/10 rounded-lg p-3 text-white text-base outline-none focus:border-cyan-500/50 font-mono transition-all shadow-inner" 
                                            placeholder="0.00" 
                                        />
                                    </div>
                                    <div className="relative w-32 shrink-0">
                                        <select 
                                            value={fromUnit} 
                                            onChange={e => setFromUnit(e.target.value)} 
                                            className="w-full h-full bg-[#35353a] text-white text-[10px] font-black border border-white/10 rounded-lg outline-none cursor-pointer appearance-none px-3 pr-8 uppercase tracking-widest"
                                        >
                                            {Object.keys(UNIT_DATA[convType]).map((u, i) => <option key={`from-${u}-${i}`} value={u} className="bg-[#2a2a2e]">{u}</option>)}
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-400">
                                            <ChevronDown size={14} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Swap Button */}
                            <div className="flex justify-center -my-4 relative z-10">
                                <button 
                                    onClick={() => { const t = fromUnit; setFromUnit(toUnit); setToUnit(t); }}
                                    className="bg-[#2a2a2e] p-2.5 rounded-full border border-white/20 text-cyan-400 hover:text-white hover:border-cyan-400 shadow-xl transition-all hover:rotate-180 active:scale-90"
                                >
                                    <ArrowRightLeft size={16} className="rotate-90" />
                                </button>
                            </div>

                            {/* Result Field (renamed from Output Field) */}
                            <div className="space-y-1.5">
                                <label className="text-[8px] text-cyan-400/80 uppercase font-black px-1 tracking-widest">Result</label>
                                <div className="flex gap-2">
                                    <div className="flex-1 min-w-0 bg-[#0f0f12] border border-cyan-500/20 rounded-lg p-3 text-cyan-400 text-lg font-mono flex items-center overflow-hidden whitespace-nowrap shadow-inner border-l-4 border-l-cyan-500">
                                        {convResult || '0.000'}
                                    </div>
                                    <div className="relative w-32 shrink-0">
                                        <select 
                                            value={toUnit} 
                                            onChange={e => setToUnit(e.target.value)} 
                                            className="w-full h-full bg-[#35353a] text-white text-[10px] font-black border border-white/10 rounded-lg outline-none cursor-pointer appearance-none px-3 pr-8 uppercase tracking-widest"
                                        >
                                            {Object.keys(UNIT_DATA[convType]).map((u, i) => <option key={`to-${u}-${i}`} value={u} className="bg-[#2a2a2e]">{u}</option>)}
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-400">
                                            <ChevronDown size={14} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Metadata Footer */}
                        <div className="flex justify-center pt-2">
                            <div className="text-[6px] text-neutral-500 font-black uppercase tracking-[0.5em] border-t border-white/5 w-full text-center pt-3 opacity-50">
                                PRECISION_UNIT_CONVERTER_PRO
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CalculatorPanel;
