import React, { useState, useMemo } from 'react';
import { X, Check, Filter } from 'lucide-react';
import { Shape } from '../types';

interface QuickSelectPanelProps {
  layers: Record<string, Shape[]>;
  layerConfig: Record<string, { name: string; color: string }>;
  selectedIds: string[];
  onSelectAll: (ids: string[]) => void;
  onClose: () => void;
}

export const QuickSelectPanel: React.FC<QuickSelectPanelProps> = ({
  layers,
  layerConfig,
  selectedIds,
  onSelectAll,
  onClose
}) => {
  const [selectedProperty, setSelectedProperty] = useState<'layer' | 'color' | 'type'>('layer');
  const [selectedValue, setSelectedValue] = useState<string>('');

  // Extract all shapes
  const allShapes = useMemo(() => {
    return Object.values(layers).flat();
  }, [layers]);

  // Extract unique properties available in current drawing
  const propertiesData = useMemo(() => {
    const uniqueLayers = new Set<string>();
    const uniqueColors = new Set<string>();
    const uniqueTypes = new Set<string>();

    allShapes.forEach(s => {
      if (s.layer) uniqueLayers.add(s.layer);
      if (s.color) uniqueColors.add(s.color.toUpperCase());
      if (s.type) uniqueTypes.add(s.type);
    });

    return {
      layers: Array.from(uniqueLayers).sort(),
      colors: Array.from(uniqueColors).sort(),
      types: Array.from(uniqueTypes).sort()
    };
  }, [allShapes]);

  // Handle auto-selecting the first value when switching property category
  React.useEffect(() => {
    if (selectedProperty === 'layer') {
      setSelectedValue(propertiesData.layers[0] || '');
    } else if (selectedProperty === 'color') {
      setSelectedValue(propertiesData.colors[0] || '');
    } else {
      setSelectedValue(propertiesData.types[0] || '');
    }
  }, [selectedProperty, propertiesData]);

  // Matching shapes
  const matchingShapes = useMemo(() => {
    if (!selectedValue) return [];
    return allShapes.filter(s => {
      if (selectedProperty === 'layer') {
        return s.layer === selectedValue;
      }
      if (selectedProperty === 'color') {
        return s.color?.toUpperCase() === selectedValue.toUpperCase();
      }
      if (selectedProperty === 'type') {
        return s.type === selectedValue;
      }
      return false;
    });
  }, [allShapes, selectedProperty, selectedValue]);

  const matchingIds = useMemo(() => {
    return matchingShapes.map(s => s.id);
  }, [matchingShapes]);

  const handleApply = (mode: 'new' | 'add' | 'remove') => {
    if (navigator.vibrate) navigator.vibrate(10);
    if (mode === 'new') {
      onSelectAll(matchingIds);
    } else if (mode === 'add') {
      const merged = Array.from(new Set([...selectedIds, ...matchingIds]));
      onSelectAll(merged);
    } else if (mode === 'remove') {
      const remaining = selectedIds.filter(id => !matchingIds.includes(id));
      onSelectAll(remaining);
    }
  };

  return (
    <div className="w-[340px] max-w-full bg-[#0a0a0c]/98 backdrop-blur-2xl border border-white/10 rounded-2xl flex flex-col shadow-[0_24px_50px_rgba(0,0,0,0.6)] animate-in zoom-in-95 fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02] rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#00bcd4]" />
          <span className="text-[10px] font-black tracking-[0.2em] uppercase text-neutral-200">Quick Select Entities</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-all active:scale-90"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body content */}
      <div className="p-4 flex flex-col gap-4">
        {/* Category selection */}
        <div>
          <label className="text-[8px] font-bold tracking-widest text-neutral-500 uppercase block mb-1.5">Filter category</label>
          <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 border border-white/5 rounded-xl">
            {(['layer', 'color', 'type'] as const).map(prop => (
              <button
                key={prop}
                onClick={() => setSelectedProperty(prop)}
                className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all
                  ${selectedProperty === prop 
                    ? 'bg-[#00bcd4]/10 text-[#00bcd4] border border-[#00bcd4]/20' 
                    : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                {prop}
              </button>
            ))}
          </div>
        </div>

        {/* Value selector */}
        <div>
          <label className="text-[8px] font-bold tracking-widest text-neutral-500 uppercase block mb-1.5">Matching value</label>
          <div className="max-h-[140px] overflow-y-auto border border-white/5 bg-black/40 rounded-xl p-1 flex flex-col gap-0.5 custom-scrollbar">
            {selectedProperty === 'layer' && propertiesData.layers.map(val => {
              const cfg = layerConfig[val];
              const isSelected = selectedValue === val;
              return (
                <button
                  key={val}
                  onClick={() => setSelectedValue(val)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-bold text-left transition-all
                    ${isSelected ? 'bg-white/5 text-white' : 'text-neutral-400 hover:bg-white/[0.02] hover:text-neutral-200'}`}
                >
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-2.5 h-2.5 rounded-full border border-white/10" 
                      style={{ backgroundColor: cfg?.color || '#ffffff' }} 
                    />
                    <span className="truncate">{cfg?.name || val}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#00bcd4]" />}
                </button>
              );
            })}

            {selectedProperty === 'color' && propertiesData.colors.map(val => {
              const isSelected = selectedValue === val;
              return (
                <button
                  key={val}
                  onClick={() => setSelectedValue(val)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-bold text-left transition-all
                    ${isSelected ? 'bg-white/5 text-white' : 'text-neutral-400 hover:bg-white/[0.02] hover:text-neutral-200'}`}
                >
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-2.5 h-2.5 rounded-full border border-white/10 shadow-sm" 
                      style={{ backgroundColor: val }} 
                    />
                    <span className="font-mono text-[9px]">{val}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#00bcd4]" />}
                </button>
              );
            })}

            {selectedProperty === 'type' && propertiesData.types.map(val => {
              const isSelected = selectedValue === val;
              return (
                <button
                  key={val}
                  onClick={() => setSelectedValue(val)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider text-left transition-all
                    ${isSelected ? 'bg-white/5 text-white' : 'text-neutral-400 hover:bg-white/[0.02] hover:text-neutral-200'}`}
                >
                  <span className="truncate">{val}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#00bcd4]" />}
                </button>
              );
            })}

            {((selectedProperty === 'layer' && propertiesData.layers.length === 0) ||
              (selectedProperty === 'color' && propertiesData.colors.length === 0) ||
              (selectedProperty === 'type' && propertiesData.types.length === 0)) && (
              <div className="p-4 text-center text-neutral-600 text-[9px] font-bold uppercase tracking-wider">
                No properties detected
              </div>
            )}
          </div>
        </div>

        {/* Info stats */}
        <div className="bg-[#00bcd4]/5 border border-[#00bcd4]/10 rounded-xl px-3 py-2.5 flex items-center justify-between">
          <span className="text-[8px] font-bold tracking-widest text-[#00bcd4]/80 uppercase">Matching entities:</span>
          <span className="text-xs font-black text-white">{matchingShapes.length}</span>
        </div>

        {/* Filter Selection Modes - SINGLE CLICK TO SELECT ALL */}
        <div className="flex flex-col gap-1.5 mt-1">
          <button
            onClick={() => handleApply('new')}
            disabled={matchingShapes.length === 0}
            className="w-full py-2.5 rounded-xl bg-[#00bcd4] text-black text-[9px] font-black uppercase tracking-[0.2em] hover:bg-cyan-400 transition-all active:scale-98 disabled:opacity-30 disabled:pointer-events-none"
          >
            Create New Selection
          </button>
          
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => handleApply('add')}
              disabled={matchingShapes.length === 0}
              className="py-2 rounded-xl bg-white/5 border border-white/5 text-white text-[8px] font-bold uppercase tracking-wider hover:bg-white/10 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
            >
              Add to Selected
            </button>
            <button
              onClick={() => handleApply('remove')}
              disabled={matchingShapes.length === 0}
              className="py-2 rounded-xl bg-white/5 border border-white/5 text-white text-[8px] font-bold uppercase tracking-wider hover:bg-white/10 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
            >
              Excl. from Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
