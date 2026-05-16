
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Shape, ViewState, AppSettings, LayerConfig, LineTypeDefinition, BlockDefinition, LayoutDefinition } from '../types';
import { storageService } from '../services/storageService';

interface CADContextType {
  layers: Record<string, Shape[]>;
  setLayers: React.Dispatch<React.SetStateAction<Record<string, Shape[]>>>;
  layerConfig: Record<string, LayerConfig>;
  setLayerConfig: React.Dispatch<React.SetStateAction<Record<string, LayerConfig>>>;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  blocks: Record<string, BlockDefinition>;
  setBlocks: React.Dispatch<React.SetStateAction<Record<string, BlockDefinition>>>;
  layouts: LayoutDefinition[];
  setLayouts: React.Dispatch<React.SetStateAction<LayoutDefinition[]>>;
  currentFileName: string;
  setCurrentFileName: (name: string) => void;
  commitToHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const CADContext = createContext<CADContextType | undefined>(undefined);

export const CADProvider: React.FC<{ children: React.ReactNode, initialSettings: AppSettings, initialLayers: Record<string, LayerConfig> }> = ({ 
  children, initialSettings, initialLayers 
}) => {
  const [layers, setLayers] = useState<Record<string, Shape[]>>({ '0': [], 'defpoints': [] });
  const [layerConfig, setLayerConfig] = useState<Record<string, LayerConfig>>(initialLayers);
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<Record<string, BlockDefinition>>({});
  const [layouts, setLayouts] = useState<LayoutDefinition[]>([
    { id: 'layout1', name: 'Layout 1', paperSize: { width: 297, height: 210 }, viewports: [] }
  ]);
  const [currentFileName, setCurrentFileName] = useState('Drawing 1.vox');
  
  const [history, setHistory] = useState<Record<string, Shape[]>[]>([]);
  const [redoStack, setRedoStack] = useState<Record<string, Shape[]>[]>([]);

  const layersRef = useRef(layers);
  useEffect(() => { layersRef.current = layers; }, [layers]);

  const commitToHistory = useCallback(() => {
    const currentState: Record<string, Shape[]> = {};
    Object.keys(layersRef.current).forEach(key => {
      currentState[key] = [...layersRef.current[key]];
    });
    
    setHistory(prev => [...prev.slice(-49), currentState]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const current = { ...layersRef.current };
    setRedoStack(prev => [...prev, current]);
    setLayers(previous);
    setHistory(prev => prev.slice(0, -1));
  }, [history]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const current = { ...layersRef.current };
    setHistory(prev => [...prev, current]);
    setLayers(next);
    setRedoStack(prev => prev.slice(0, -1));
  }, [redoStack]);

  return (
    <CADContext.Provider value={{
      layers, setLayers,
      layerConfig, setLayerConfig,
      settings, setSettings,
      selectedIds, setSelectedIds,
      blocks, setBlocks,
      layouts, setLayouts,
      currentFileName, setCurrentFileName,
      commitToHistory, undo, redo,
      canUndo: history.length > 0,
      canRedo: redoStack.length > 0
    }}>
      {children}
    </CADContext.Provider>
  );
};

export const useCAD = () => {
  const context = useContext(CADContext);
  if (context === undefined) {
    throw new Error('useCAD must be used within a CADProvider');
  }
  return context;
};
