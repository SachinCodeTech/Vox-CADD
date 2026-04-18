
import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRightLeft, Calculator as CalculatorIcon, Ruler, Square, Box, FunctionSquare } from 'lucide-react';

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
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [isInteracting, setIsInteracting] = useState(false);
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging.current) return;
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            setPos({
                x: clientX - dragStart.current.x,
                y: clientY - dragStart.current.y
            });
        };
        const handleEnd = () => { 
            isDragging.current = false; 
            setIsInteracting(false);
        };

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
        setIsInteracting(true);
        dragStart.current = { x: clientX - pos.x, y: clientY - pos.y };
    };

    const handleDragStart = (e: React.MouseEvent) => startDrag(e.clientX, e.clientY);
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length > 0) {
            startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    const [mode, setMode] = useState<'calc' | 'conv'>('calc');
    const [sciMode, setSciMode] = useState(false);
    const [display, setDisplay] = useState('');
    const [result, setResult] = useState('');
    const [convType, setConvType] = useState<UnitCategory>('length');
    const [convValue, setConvValue] = useState('');
    const [fromUnit, setFromUnit] = useState('mm');
    const [toUnit, setToUnit] = useState('in');
    const [convResult, setConvResult] = useState('');

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
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_50px_rgba(0,0,0,0.5)] w-80 bg-[#1e1e1e] border border-neutral-700 rounded-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-none font-sans"
            style={{ 
                transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                zIndex: isInteracting ? 9999 : 120
            }}
            onMouseDown={e => {
                e.stopPropagation();
                setIsInteracting(true);
            }}
            onTouchStart={e => {
                e.stopPropagation();
                setIsInteracting(true);
            }}
        >
            <div 
                className="flex justify-between items-center p-3 border-b border-neutral-800 bg-[#252525] cursor-grab active:cursor-grabbing"
                onMouseDown={handleDragStart}
                onTouchStart={handleTouchStart}
            >
                <div className="flex items-center gap-2 pointer-events-none">
                    <div className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400">
                        <CalculatorIcon size={18} />
                    </div>
                    <div className="flex gap-1 bg-neutral-900 p-1 rounded-lg pointer-events-auto">
                        <button onClick={() => setMode('calc')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${mode === 'calc' ? 'bg-cyan-700 text-white shadow-md' : 'text-neutral-500 hover:text-white hover:bg-neutral-800'}`}>Calc</button>
                        <button onClick={() => setMode('conv')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${mode === 'conv' ? 'bg-cyan-700 text-white shadow-md' : 'text-neutral-500 hover:text-white hover:bg-neutral-800'}`}>Unit</button>
                    </div>
                </div>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-900/30 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"><X size={18} /></button>
            </div>

            <div className="p-4 bg-[#1e1e1e]">
                {mode === 'calc' ? (
                    <div className="flex flex-col gap-3">
                        <div className="bg-[#121212] border border-neutral-800 rounded-lg p-3 text-right h-20 flex flex-col justify-end shadow-inner relative overflow-hidden group">
                            <div className="absolute top-2 left-2 text-[10px] text-neutral-600 font-bold uppercase tracking-widest pointer-events-none">LCD DISPLAY</div>
                            <div className="text-neutral-500 text-xs h-5 overflow-hidden text-ellipsis whitespace-nowrap font-mono">{result}</div>
                            <div className="text-cyan-50 text-2xl font-mono tracking-wider overflow-hidden text-ellipsis whitespace-nowrap">{display || '0'}</div>
                        </div>
                        <div className="flex justify-between items-center px-1">
                             <button onClick={() => setSciMode(!sciMode)} className={`text-[9px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded border ${sciMode ? 'bg-cyan-900/30 text-cyan-400 border-cyan-800' : 'text-neutral-600 border-neutral-800 hover:text-neutral-400'}`}>Scientific Mode</button>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                            {sciMode && (
                                <><button onClick={() => handleCalcInput('sqrt(')} className="btn-sci">sqrt</button><button onClick={() => handleCalcInput('sin(')} className="btn-sci">sin</button><button onClick={() => handleCalcInput('cos(')} className="btn-sci">cos</button><button onClick={() => handleCalcInput('tan(')} className="btn-sci">tan</button><button onClick={() => handleCalcInput('π')} className="btn-sci">π</button><button onClick={() => handleCalcInput('^')} className="btn-sci">xʸ</button><button onClick={() => handleCalcInput('(')} className="btn-sci">(</button><button onClick={() => handleCalcInput(')')} className="btn-sci">)</button></>
                            )}
                            {['C', '/', '*', 'DEL', '7', '8', '9', '-', '4', '5', '6', '+', '1', '2', '3', '=', '0', '.'].map((key, i) => (
                                <button key={i} onClick={() => handleCalcInput(key)} className={`h-10 rounded-lg text-sm font-bold transition-all active:scale-95 flex items-center justify-center ${['C', 'DEL'].includes(key) ? 'bg-red-900/10 text-red-400 hover:bg-red-900/20 border border-red-900/20' : key === '=' ? 'bg-cyan-600 text-white hover:bg-cyan-500 col-span-2 shadow-[0_0_15px_rgba(8,145,178,0.4)] border border-cyan-500' : ['/', '*', '-', '+'].includes(key) ? 'bg-neutral-800 text-cyan-400 hover:bg-neutral-700 border border-neutral-700' : 'bg-[#252525] text-neutral-300 hover:bg-[#333] hover:text-white border border-neutral-800 hover:border-neutral-600 shadow-sm'}`}>{key}</button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-3 gap-1 bg-[#252525] p-1 rounded-lg">
                            <button onClick={() => setConvType('length')} className={`flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${convType === 'length' ? 'bg-cyan-900/50 text-cyan-400 shadow-sm' : 'text-neutral-500 hover:text-white'}`}><Ruler size={12} /> Len</button>
                            <button onClick={() => setConvType('area')} className={`flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${convType === 'area' ? 'bg-cyan-900/50 text-cyan-400 shadow-sm' : 'text-neutral-500 hover:text-white'}`}><Square size={12} /> Area</button>
                            <button onClick={() => setConvType('volume')} className={`flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${convType === 'volume' ? 'bg-cyan-900/50 text-cyan-400 shadow-sm' : 'text-neutral-500 hover:text-white'}`}><Box size={12} /> Vol</button>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-neutral-500 uppercase font-bold pl-1">Input</label>
                            <div className="flex gap-2">
                                <input type="number" value={convValue} onChange={e => setConvValue(e.target.value)} className="flex-1 bg-[#121212] border border-neutral-700 rounded-lg p-2 text-white text-base outline-none focus:border-cyan-500 font-mono" placeholder="0" />
                                <select value={fromUnit} onChange={e => setFromUnit(e.target.value)} className="w-24 bg-[#252525] text-white text-xs font-bold border border-neutral-700 rounded-lg outline-none cursor-pointer">{Object.keys(UNIT_DATA[convType]).map(u => <option key={u} value={u}>{u}</option>)}</select>
                            </div>
                        </div>
                        <div className="flex justify-center -my-1 relative z-10"><div className="bg-[#252525] p-1.5 rounded-full border border-neutral-700 text-cyan-500 shadow-lg cursor-pointer hover:scale-110 transition-transform" onClick={() => { const t = fromUnit; setFromUnit(toUnit); setToUnit(t); }}><ArrowRightLeft size={16} className="rotate-90" /></div></div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-neutral-500 uppercase font-bold pl-1">Result</label>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-[#252525] border border-neutral-700 rounded-lg p-2 text-cyan-400 text-base font-mono flex items-center overflow-hidden whitespace-nowrap shadow-inner">{convResult || '0'}</div>
                                <select value={toUnit} onChange={e => setToUnit(e.target.value)} className="w-24 bg-[#252525] text-white text-xs font-bold border border-neutral-700 rounded-lg outline-none cursor-pointer">{Object.keys(UNIT_DATA[convType]).map(u => <option key={u} value={u}>{u}</option>)}</select>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                .btn-sci { height: 32px; border-radius: 6px; font-size: 11px; font-weight: bold; background-color: #222; color: #888; border: 1px solid #333; transition: all 0.2s; }
                .btn-sci:hover { background-color: #333; color: #22d3ee; border-color: #444; }
                .btn-quick { font-size: 10px; background-color: rgba(38, 38, 38, 0.5); color: #a3a3a3; padding: 8px 0; border-radius: 6px; transition: all 0.2s; border: 1px solid transparent; }
                .btn-quick:hover { background-color: #262626; color: #22d3ee; border-color: #404040; }
            `}</style>
        </div>
    );
};

export default CalculatorPanel;
