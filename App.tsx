
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import CADCanvas, { CADCanvasHandle } from './components/CADCanvas';
import Toolbar from './components/Toolbar';
import CommandBar from './components/CommandBar';
import LayerManager from './components/LayerManager';
import FileManager from './components/FileManager';
import MenuBar from './components/MenuBar';
import PropertiesPanel from './components/PropertiesPanel';
import CalculatorPanel from './components/CalculatorPanel';
import DraftingSettings from './components/DraftingSettings';
import DrawingProperties from './components/DrawingProperties';
import InfoPanel from './components/InfoPanel';
import NewFileDialog from './components/NewFileDialog';
import MTextEditor from './components/MTextEditor';
import LoadingScreen from './components/LoadingScreen';
import { generateId } from './services/cadService';
import { getCommandFromAI, connectLiveAgent } from './services/geminiService';
import { shapesToDXF, dxfToShapes } from './services/dxfService';
import { shapesToVox, voxToShapes } from './services/voxService';
import { dwgToShapes } from './services/DwgService';
import { 
  CADCommand, CommandEngine, LineCommand, DoubleLineCommand, CircleCommand, RectCommand, PolyCommand, 
  ArcCommand, MoveCommand, EraseCommand, DistanceCommand, AreaCommand, 
  DimensionCommand, TextCommand, MTextCommand, ZoomCommand, 
  RotateCommand, ScaleCommand, MirrorCommand, CopyCommand,
  ExtendCommand, ExplodeCommand,
  RayCommand, XLineCommand,
  HatchCommand, LeaderCommand, PanCommand, OffsetCommand, TrimCommand, FilletCommand, EllipseCommand, PolygonCommand,
  DonutCommand, PointCommand,
  SelectAllCommand, CopyClipCommand, CutClipCommand, PasteClipCommand, SplineCommand, SketchCommand, StretchCommand, SelectCommand,
  ArrayCommand, BlockCommand, InsertCommand, FilterCommand, FindCommand, ViewportCommand, LayoutCommand
} from './services/commandEngine';
import { Shape, ViewState, AppSettings, LayerConfig, Point, UnitType, BlockDefinition, LayoutDefinition } from './types';
import { Menu, X, Sliders, Layers, FileText, Calculator, Target, Weight, FileEdit, Grid3X3, Layers2, FilePlus, Save } from 'lucide-react';

import VoxIcon from './components/VoxIcon';

const INITIAL_SETTINGS: AppSettings = {
  ortho: true, snap: true, grid: true,
  currentLayer: '0', drawingScale: 1, penThickness: 1,
  activeLineType: 'continuous',
  cursorX: 0, cursorY: 0, units: 'metric', unitSubtype: 'mm', precision: '0.0000',
  fillEnabled: false,
  gridSpacing: 100, snapSpacing: 10,
  snapOptions: { 
    endpoint: true, midpoint: true, center: true, intersection: true, 
    nearest: false, quadrant: true, perpendicular: true, tangent: true,
    node: true, extension: true, parallel: true, gcenter: true, appint: true
  },
  showHUD: true,
  showLineWeights: true,
  textSize: 250,
  textRotation: 0,
  textJustification: 'left',
  metadata: {
    author: '',
    createdAt: new Date().toISOString().split('T')[0],
    lastModified: new Date().toISOString(),
    revision: 'REV-01',
    projectRevision: 'V-1.0',
    description: ''
  }
};

const INITIAL_VIEW: ViewState = { scale: 0.05, originX: 0, originY: 0 };
const INITIAL_LAYERS_CONFIG: Record<string, LayerConfig> = { 
  '0': { id: '0', name: '0', visible: true, locked: false, frozen: false, color: '#FF0000', thickness: 0.25, lineType: 'continuous' },
  'defpoints': { id: 'defpoints', name: 'defpoints', visible: true, locked: false, frozen: false, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' }
};

export type ToolbarCategory = 'Draw' | 'Modify' | 'Anno' | 'View' | 'Tools' | 'History' | 'Edit';
type PanelType = 'none' | 'layers' | 'properties' | 'calculator' | 'drafting' | 'file' | 'mainmenu' | 'drawing_props' | 'help' | 'about' | 'privacy' | 'new_file';

const STORAGE_PREFIX = 'voxcadd_file_v1_';
const REGISTRY_KEY = 'voxcadd_recent_files';

const App: React.FC = () => {
  const [layers, setLayers] = useState<Record<string, Shape[]>>({ '0': [], 'defpoints': [] });
  const [blocks, setBlocks] = useState<Record<string, BlockDefinition>>({});
  const [layouts, setLayouts] = useState<LayoutDefinition[]>([
    { id: 'layout1', name: 'Layout 1', paperSize: { width: 297, height: 210 }, viewports: [] }
  ]);
  const [layerConfig, setLayerConfig] = useState<Record<string, LayerConfig>>(INITIAL_LAYERS_CONFIG);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [activeTab, setActiveTab] = useState<string>('model');
  const [currentFileName, setCurrentFileName] = useState('Draught 1');
  const [recentFiles, setRecentFiles] = useState<string[]>(['Draught 1']);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [fileNameMenuOpen, setFileNameMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ToolbarCategory>('Draw');
  const [isViewportActive, setIsViewportActive] = useState(false);
  const [history, setHistory] = useState<Record<string, Shape[]>[]>([]);
  const [redoStack, setRedoStack] = useState<Record<string, Shape[]>[]>([]);
  const [tabViews, setTabViews] = useState<Record<string, ViewState>>({
    model: { ...INITIAL_VIEW },
    layout1: { scale: 3, originX: 0, originY: 0 },
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [prompt, setPrompt] = useState<string>("COMMAND:");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [logMessage, _setLogMessage] = useState<string | null>(null);
  const setLogMessage = useCallback((msg: string | null) => {
    _setLogMessage(msg);
    if (msg) setCommandHistory(prev => {
        if (prev[prev.length - 1] === msg) return prev;
        return [...prev.slice(-50), msg];
    });
  }, []);
  const [isCommandActive, setIsCommandActive] = useState(false);
  const [activeCommandName, setActiveCommandName] = useState<string | undefined>(undefined);
  const [lastCommandName, setLastCommandName] = useState<string | null>(null);
  const [showCircleOptions, setShowCircleOptions] = useState(false);
  const [showArcOptions, setShowArcOptions] = useState(false);
  const [showEllipseOptions, setShowEllipseOptions] = useState(false);
  const [fileHandle, setFileHandle] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<PanelType>('none');
  const [previewShapes, setPreviewShapes] = useState<Shape[] | null>(null);
  const [mtextEditor, setMtextEditor] = useState<{ initialValue: string, callback: (text: string) => void } | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [lastAiCommandTime, setLastAiCommandTime] = useState(0);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [layoutContextMenu, setLayoutContextMenu] = useState<{ x: number, y: number, layoutId: string } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleLayoutLongPress = (e: React.MouseEvent | React.TouchEvent, layoutId: string) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    longPressTimer.current = setTimeout(() => {
      setLayoutContextMenu({ x: clientX, y: clientY, layoutId });
      if(navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const renameLayout = (id: string) => {
    const layout = layouts.find(l => l.id === id);
    if (!layout) return;
    const newName = prompt('Enter new layout name:', layout.name);
    if (newName) {
      setLayouts(prev => prev.map(l => l.id === id ? { ...l, name: newName } : l));
    }
    setLayoutContextMenu(null);
  };

  const duplicateLayout = (id: string) => {
    const layout = layouts.find(l => l.id === id);
    if (!layout) return;
          const newId = 'layout' + Date.now();
          const newLayout = { ...layout, id: newId, name: `${layout.name} (Copy)` };
          setLayouts(prev => [...prev, newLayout]);
          setTabViews(prev => ({ ...prev, [newId]: tabViews[id] || { scale: 3, originX: 0, originY: 0 } }));
          setLayoutContextMenu(null);
  };

  const deleteLayout = (id: string) => {
    if (layouts.length <= 1) return;
    if (confirm(`Delete layout "${layouts.find(l => l.id === id)?.name}"?`)) {
      setLayouts(prev => prev.filter(l => l.id !== id));
      if (activeTab === id) setActiveTab('model');
    }
    setLayoutContextMenu(null);
  };

  const deleteAllLayouts = () => {
    if (confirm('Delete all layouts? This will reset you to a single default layout.')) {
      const defaultId = 'layout' + Date.now();
      setLayouts([{ id: defaultId, name: 'Layout 1', paperSize: { width: 297, height: 210 }, viewports: [] }]);
      setTabViews(prev => ({ ...prev, [defaultId]: { scale: 3, originX: 0, originY: 0 } }));
      setActiveTab('model');
    }
    setLayoutContextMenu(null);
  };

  const updateLayoutProperties = (id: string) => {
    const layout = layouts.find(l => l.id === id);
    if (!layout) return;
    const width = prompt('Paper Width (mm):', layout.paperSize.width.toString());
    const height = prompt('Paper Height (mm):', layout.paperSize.height.toString());
    if (width && height) {
      setLayouts(prev => prev.map(l => l.id === id ? { ...l, paperSize: { width: parseFloat(width), height: parseFloat(height) } } : l));
    }
    setLayoutContextMenu(null);
  };

  const [draggedLayoutId, setDraggedLayoutId] = useState<string | null>(null);

  const handleDragStart = (id: string) => {
    setDraggedLayoutId(id);
  };

  const handleDragOverTab = (id: string) => {
    if (!draggedLayoutId || draggedLayoutId === id) return;
    const fromIndex = layouts.findIndex(l => l.id === draggedLayoutId);
    const toIndex = layouts.findIndex(l => l.id === id);
    if (fromIndex === -1 || toIndex === -1) return;

    const newLayouts = [...layouts];
    const [moved] = newLayouts.splice(fromIndex, 1);
    newLayouts.splice(toIndex, 0, moved);
    setLayouts(newLayouts);
  };

  const importLayout = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vox';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        try {
          const content = JSON.parse(re.target?.result as string);
          if (content.type === 'layout') {
            const newId = 'layout' + Date.now();
            setLayouts(prev => [...prev, { ...content, id: newId }]);
            setTabViews(prev => ({ ...prev, [newId]: { scale: 3, originX: 0, originY: 0 } }));
            setActiveTab(newId);
          }
        } catch (err) {
          alert('Invalid .vox layout file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
    setLayoutContextMenu(null);
  };

  const moveLayout = (id: string, direction: 'left' | 'right') => {
    const index = layouts.findIndex(l => l.id === id);
    if (index === -1) return;
    const newLayouts = [...layouts];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= layouts.length) return;
    
    [newLayouts[index], newLayouts[targetIndex]] = [newLayouts[targetIndex], newLayouts[index]];
    setLayouts(newLayouts);
    setLayoutContextMenu(null);
  };

  const view = tabViews[activeTab] || { scale: 1, originX: 0, originY: 0 };
  const setView = useCallback((updater: ViewState | ((v: ViewState) => ViewState)) => {
    setTabViews(prev => ({
      ...prev,
      [activeTab]: typeof updater === 'function' ? (updater as (v: ViewState) => ViewState)(prev[activeTab]) : updater
    }));
  }, [activeTab]);

  const updateRecentFiles = useCallback((name: string) => {
    setRecentFiles(prev => {
      const filtered = prev.filter(f => f.name !== name);
      const updated = [{ name, date: Date.now() }, ...filtered].slice(0, 10);
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const engineRef = useRef<CommandEngine | null>(null);
  const settingsRef = useRef(settings);
  const layersRef = useRef(layers);
  const layerConfigRef = useRef(layerConfig);
  const selectedIdsRef = useRef(selectedIds);
  const liveSessionRef = useRef<any>(null);
  const canvasHandleRef = useRef<CADCanvasHandle>(null);

  const tabViewsRef = useRef(tabViews);
  const activeTabRef = useRef(activeTab);
  const blocksRef = useRef(blocks);
  const layoutsRef = useRef(layouts);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { layerConfigRef.current = layerConfig; }, [layerConfig]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { tabViewsRef.current = tabViews; }, [tabViews]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);
  useEffect(() => { layoutsRef.current = layouts; }, [layouts]);

  // Restore session from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('voxcadd_active_workspace');
    const savedRecent = localStorage.getItem(REGISTRY_KEY);
    
    // Seed sample files if empty to demonstrate multi-file switching
    if (!savedRecent || JSON.parse(savedRecent).length === 0) {
        const samples = [
            { name: "1.vox", date: Date.now() - 3000 },
            { name: "2.vox", date: Date.now() - 2000 },
            { name: "3.vox", date: Date.now() - 1000 }
        ];
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(samples));
        setRecentFiles(samples);
        
        // Create sample contents
        samples.forEach((s, i) => {
            const sampleLayers = { 
                '0': [
                    { id: `seed-${i}`, type: 'circle', x: 200 * (i+1), y: 200 * (i+1), radius: 50 * (i+1), color: '#00bcd4', layer: '0' } as Shape
                ], 
                'defpoints': [] 
            };
            localStorage.setItem(`${STORAGE_PREFIX}${s.name}`, JSON.stringify({
                layers: sampleLayers,
                layerConfig: INITIAL_LAYERS_CONFIG,
                settings: INITIAL_SETTINGS,
                fileName: s.name
            }));
        });
    } else {
        try { setRecentFiles(JSON.parse(savedRecent)); } catch(e) {}
    }

    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.layers) setLayers(data.layers);
        if (data.layerConfig) setLayerConfig(data.layerConfig);
        if (data.settings) setSettings({ ...INITIAL_SETTINGS, ...data.settings });
        if (data.fileName) {
          setCurrentFileName(data.fileName);
          updateRecentFiles(data.fileName);
        }
        setLogMessage("SESSION_RESTORED_SUCCESS");
      } catch (e) {
        console.error("Failed to restore session", e);
      }
    } else {
      // Default open with Drawing 1.vox
      setCurrentFileName("Drawing 1.vox");
      updateRecentFiles("Drawing 1.vox");
    }
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (file) {
        const isDwg = file.name.toLowerCase().endsWith('.dwg');
        const content = isDwg ? await file.arrayBuffer() : await file.text();
        handleOpenFile(file.name, content);
      }
    };
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    // Handle PWA File Launch
    if ('launchQueue' in window) {
      (window as any).launchQueue.setConsumer(async (launchParams: any) => {
        if (launchParams.files.length > 0) {
          const fileHandle = launchParams.files[0];
          setFileHandle(fileHandle);
          const file = await fileHandle.getFile();
          const isDwg = file.name.toLowerCase().endsWith('.dwg');
          const content = isDwg ? await file.arrayBuffer() : await file.text();
          handleOpenFile(file.name, content);
        }
      });
    }

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const handleOpenFile = async (fileName: string, content: string | ArrayBuffer) => {
    if (navigator.vibrate) navigator.vibrate(20);
    const isDxf = fileName.toLowerCase().endsWith('.dxf');
    const isDwg = fileName.toLowerCase().endsWith('.dwg');
    const isVox = fileName.toLowerCase().endsWith('.vox');
    
    try {
        let finalLayers: Record<string, Shape[]> = { '0': [], 'defpoints': [] };
        let finalConfig: Record<string, LayerConfig> = INITIAL_LAYERS_CONFIG;
        let finalSettings: AppSettings = INITIAL_SETTINGS;

        if (isDwg) {
            if (!(content instanceof ArrayBuffer)) {
                setLogMessage("LOAD_ERR: BINARY_DATA_REQUIRED");
                return;
            }
            setLogMessage("PARSING_DWG_BINARY...");
            const result = await dwgToShapes(content);
            const { shapes: importedShapes } = result;
            if (importedShapes.length > 0) {
                finalLayers = { '0': importedShapes, 'defpoints': [] };
                setLogMessage(`DWG_IMPORT: ${importedShapes.length} ENTITIES`);
            } else {
                setLogMessage("DWG_EMPTY_OR_UNSUPPORTED");
                return;
            }
        } else if (isDxf || isVox) {
            if (typeof content !== 'string') return;
            
            const voxResult = voxToShapes(content);
            if (voxResult) {
                finalLayers = voxResult.shapes.reduce((acc, s) => {
                    const l = s.layer || '0';
                    if (!acc[l]) acc[l] = [];
                    acc[l].push(s);
                    return acc;
                }, {} as Record<string, Shape[]>);
                finalConfig = voxResult.layers;
                finalSettings = { ...INITIAL_SETTINGS, ...voxResult.settings };
                setLogMessage("VOX_PROJECT_LOADED");
            } else {
                setLogMessage("PARSING_DXF_DATA...");
                const importedShapes = dxfToShapes(content);
                if (importedShapes.length > 0) {
                    finalLayers = { '0': importedShapes, 'defpoints': [] };
                    setLogMessage(`DXF_IMPORT: ${importedShapes.length} ENTITIES`);
                } else {
                    try {
                        const data = JSON.parse(content);
                        if (data.layers || data.shapes) {
                            if (data.layers && !Array.isArray(data.layers)) finalLayers = data.layers;
                            else if (data.shapes) finalLayers = { '0': data.shapes };
                            if (data.layerConfig) finalConfig = data.layerConfig;
                            if (data.settings) finalSettings = { ...INITIAL_SETTINGS, ...data.settings };
                            setLogMessage("LEGACY_WORKSPACE_LOADED");
                        } else {
                            setLogMessage("LOAD_ERR: NO_RECOGNIZABLE_CAD_DATA");
                            return;
                        }
                    } catch (e) {
                        setLogMessage("LOAD_ERR: UNRECOGNIZED_FILE_TYPE");
                        return;
                    }
                }
            }
        }

        // Update State
        setLayers(finalLayers);
        setLayerConfig(finalConfig);
        setSettings(finalSettings);
        setCurrentFileName(fileName);
        updateRecentFiles(fileName);
        setView(INITIAL_VIEW); 
        
        // Immediate Cache
        const cachePayload = {
          layers: finalLayers,
          layerConfig: finalConfig,
          settings: finalSettings,
          fileName: fileName
        };
        localStorage.setItem(`${STORAGE_PREFIX}${fileName}`, JSON.stringify(cachePayload));
        localStorage.setItem('voxcadd_active_workspace', JSON.stringify(cachePayload));
        setActivePanel('none');
    } catch(err) { 
        console.error(err);
        setLogMessage("LOAD_ERR: CORRUPT_FORMAT"); 
    }
  };

  const commitToHistory = useCallback(() => {
    const currentState = JSON.parse(JSON.stringify(layersRef.current));
    setHistory(prev => [...prev.slice(-49), currentState]);
    setRedoStack([]);
    
    // Save to active workspace
    const payload = {
      layers: currentState,
      layerConfig: layerConfigRef.current,
      settings: settingsRef.current,
      fileName: currentFileName
    };
    
    localStorage.setItem('voxcadd_active_workspace', JSON.stringify(payload));
    
    // Save to specific file storage if it's a named file
    if (currentFileName) {
        localStorage.setItem(`${STORAGE_PREFIX}${currentFileName}`, JSON.stringify(payload));
    }
  }, [currentFileName]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    if (navigator.vibrate) navigator.vibrate(10);
    const previous = history[history.length - 1];
    setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(layers))]);
    setLayers(previous);
    setHistory(prev => prev.slice(0, -1));
  }, [history, layers]);

  const handleAction = async (act: string, payload?: any) => {
    switch(act) {
      case 'undo': undo(); break;
      case 'cancel': 
        engineRef.current?.cancel(); 
        setCommandInput(''); 
        setSelectedIds([]); 
        setIsCommandActive(false); 
        setActiveCommandName(undefined);
        setShowCircleOptions(false);
        setShowArcOptions(false);
        setShowEllipseOptions(false);
        break;
      case 'toggleLayers': setActivePanel(activePanel === 'layers' ? 'none' : 'layers'); break;
      case 'toggleProperties': setActivePanel(activePanel === 'properties' ? 'none' : 'properties'); break;
      case 'toggleCalculator': setActivePanel(activePanel === 'calculator' ? 'none' : 'calculator'); break;
      case 'toggleDraftingSettings': setActivePanel(activePanel === 'drafting' ? 'none' : 'drafting'); break;
      case 'toggleMainMenu': setActivePanel(activePanel === 'mainmenu' ? 'none' : 'mainmenu'); break;
      case 'toggleDrawingProps': setActivePanel(activePanel === 'drawing_props' ? 'none' : 'drawing_props'); break;
      case 'toggleHelp': setActivePanel(activePanel === 'help' ? 'none' : 'help'); break;
      case 'toggleAbout': setActivePanel(activePanel === 'about' ? 'none' : 'about'); break;
      case 'togglePrivacy': setActivePanel(activePanel === 'privacy' ? 'none' : 'privacy'); break;
      case 'zoomExtents': setView({ scale: 0.05, originX: 0, originY: 0 }); break;
      case 'zoomIn': setView(v => ({ ...v, scale: v.scale * 1.5 })); break;
      case 'zoomOut': setView(v => ({ ...v, scale: v.scale / 1.5 })); break;
      case 'setUnits': setSettings(s => ({ ...s, units: payload })); break;
      case 'new': 
        setActivePanel('new_file'); 
        break;
      case 'close': {
        // Clear history and reset to default
        setLayers({ '0': [], 'defpoints': [] });
        setLayerConfig(INITIAL_LAYERS_CONFIG);
        setSettings(INITIAL_SETTINGS);
        setCurrentFileName("Drawing 1.vox");
        setFileHandle(null);
        setHistory([]);
        setRedoStack([]);
        setActivePanel('none');
        updateRecentFiles("Drawing 1.vox");
        setLogMessage("WORKSPACE_RESET_SUCCESS");
        break;
      }
      case 'open':
        setLogMessage("AWAITING_FILE_SELECTION...");
        const openInput = document.createElement('input');
        openInput.type = 'file';
        openInput.accept = ".vox,.dxf,.dwg";
        openInput.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) { setLogMessage("OPEN_CANCELLED"); return; }
            const isDwg = file.name.toLowerCase().endsWith('.dwg');
            const content = isDwg ? await file.arrayBuffer() : await file.text();
            handleOpenFile(file.name, content);
        };
        openInput.click();
        break;
      case 'rename': {
        const oldName = currentFileName;
        const newName = payload;
        if (oldName === newName) return;

        // Migrate storage
        const data = localStorage.getItem(`${STORAGE_PREFIX}${oldName}`);
        if (data) {
            localStorage.setItem(`${STORAGE_PREFIX}${newName}`, data);
            localStorage.removeItem(`${STORAGE_PREFIX}${oldName}`);
        }
        
        // Update registry
        const updatedRecent = recentFiles.map(f => f.name === oldName ? { ...f, name: newName } : f);
        setRecentFiles(updatedRecent);
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(updatedRecent));

        setCurrentFileName(newName);
        setLogMessage(`RENAMED_TO: ${newName}`);
        break;
      }
      case 'deleteRecent': {
        const filtered = recentFiles.filter(f => f.name !== payload);
        setRecentFiles(filtered);
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(filtered));
        localStorage.removeItem(`${STORAGE_PREFIX}${payload}`);
        setLogMessage(`FILE_DELETED: ${payload}`);
        break;
      }
      case 'downloadRecent': {
        const data = localStorage.getItem(`${STORAGE_PREFIX}${payload}`);
        if (data) {
            const blob = new Blob([data], { type: 'application/x-vox' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = payload;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setLogMessage(`DOWNLOADING: ${payload}`);
        }
        break;
      }
      case 'openRecent': {
        if (payload === currentFileName) {
            setActivePanel('none');
            return;
        }
        
        // Save current work before switching safely
        const oldState = {
          layers: JSON.parse(JSON.stringify(layersRef.current)),
          layerConfig: layerConfigRef.current,
          settings: settingsRef.current,
          fileName: currentFileName
        };
        localStorage.setItem(`${STORAGE_PREFIX}${currentFileName}`, JSON.stringify(oldState));
        localStorage.setItem('voxcadd_active_workspace', JSON.stringify(oldState));

        setLogMessage(`LOADING: ${payload}...`);
        const savedData = localStorage.getItem(`${STORAGE_PREFIX}${payload}`);
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                // Ensure all keys are present
                const newLayers = data.layers || { '0': [], 'defpoints': [] };
                const newConfig = data.layerConfig || INITIAL_LAYERS_CONFIG;
                const newSettings = data.settings ? { ...INITIAL_SETTINGS, ...data.settings } : INITIAL_SETTINGS;

                setLayers(newLayers);
                setLayerConfig(newConfig);
                setSettings(newSettings);
                setCurrentFileName(payload);
                setFileHandle(null); 
                updateRecentFiles(payload);
                setView(INITIAL_VIEW); // Reset view to ensure content is visible
                setLogMessage(`OPENED: ${payload}`);
                setActivePanel('none');
                
                // Force a view reset or small nudge if needed, but standard prop change should trigger redraw
                // No need for nudges if CADCanvas is robust
            } catch (e) {
                console.error("Load failed", e);
                setLogMessage("LOAD_ERR: CORRUPT_DATA");
            }
        } else {
            setLogMessage("LOAD_ERR: FILE_MISSING");
        }
        break;
      }

      case 'save':
      case 'saveAs':
      case 'saveas':
        // Ensure local storage is updated first
        commitToHistory();
        
        setLogMessage(`${act.toUpperCase()}_INITIATED...`);
        const isDxfExport = payload === 'dxf';
        const finalExt = isDxfExport ? '.dxf' : '.vox';
        const isSaveAs = act.toLowerCase() === 'saveas';
        
        let content: string = "";
        try {
            content = shapesToDXF(Object.values(layers).flat() as Shape[], layerConfig, settings);
            if (!content || content.length < 10) {
                content = shapesToVox(Object.values(layers).flat() as Shape[], layerConfig, settings);
            }
        } catch (err) {
            console.error("Save content generation failed:", err);
            content = shapesToVox(Object.values(layers).flat() as Shape[], layerConfig, settings);
        }

        // Native File System Access
        if ('showSaveFilePicker' in window) {
            try {
                let handle = (!isSaveAs && fileHandle) ? fileHandle : null;
                if (!handle) {
                    handle = await (window as any).showSaveFilePicker({
                        suggestedName: currentFileName.replace(/\.[^/.]+$/, "") + finalExt,
                        types: [{
                            description: isDxfExport ? 'AutoCAD DXF' : 'VoxCADD Project',
                            accept: { [isDxfExport ? 'application/dxf' : 'application/vnd.voxcadd.project']: [finalExt] }
                        }]
                    });
                }
                
                const writable = await handle.createWritable();
                await writable.write(content);
                await writable.close();
                
                setFileHandle(handle);
                setCurrentFileName(handle.name);
                updateRecentFiles(handle.name);
                setLogMessage(`SUCCESS:_${handle.name}_SAVED`);
            } catch (e) {
                console.warn("Save cancelled or failed", e);
                setLogMessage("SAVE_CANCELLED_OR_ERR");
            }
        } else {
            // Fallback for browsers without File System Access API
            let downloadName = currentFileName.replace(/\.[^/.]+$/, "") + finalExt;
            
            if (isSaveAs) {
                const newName = prompt("NAME_YOUR_FILE (Save As):", downloadName);
                if (!newName) { setLogMessage("SAVE_AS_CANCELLED"); return; }
                downloadName = newName.toLowerCase().endsWith(finalExt) ? newName : newName + finalExt;
            }

            const mimeType = isDxfExport ? 'application/dxf' : 'application/vnd.voxcadd.project';
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadName;
            document.body.appendChild(a); 
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            if (isSaveAs) {
              setCurrentFileName(downloadName);
              updateRecentFiles(downloadName);
            } else {
              updateRecentFiles(currentFileName);
            }
            setLogMessage(`DOWNLOADED:_${finalExt.toUpperCase()}`);
        }
        break;
      case 'saveImage': {
        if (canvasHandleRef.current) {
            const dataUrl = canvasHandleRef.current.captureImage();
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = currentFileName.replace(/\.(vox|dxf)$/i, '') + '.png';
            link.click();
            setLogMessage("IMAGE_EXPORT_COMPLETE");
        }
        break;
      }
      case 'share': {
        setLogMessage("GENERATING_SHARE_PKG...");
        const isDxfExport = payload === 'dxf';
        const finalExt = isDxfExport ? '.dxf' : '.vox';
        const content = isDxfExport ? shapesToDXF(Object.values(layersRef.current).flat() as Shape[], layerConfigRef.current, settingsRef.current) : shapesToVox(Object.values(layersRef.current).flat() as Shape[], layerConfigRef.current, settingsRef.current);
        const fileName = (currentFileName.replace(/\.[^/.]+$/, "") + finalExt).replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const blob = new Blob([content], { type: isDxfExport ? 'application/dxf' : 'application/vnd.voxcadd.project' });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: blob.type })] })) {
            try {
                await navigator.share({
                    files: [new File([blob], fileName, { type: blob.type })],
                    title: 'VoxCADD Project',
                    text: `Sharing project: ${currentFileName}`
                });
                setLogMessage("SHARE_SENT");
            } catch (e) {
                setLogMessage("SHARE_CANCELLED");
            }
        } else if (navigator.share) {
             try {
                await navigator.share({ title: 'VoxCADD Pro Design', text: `Sharing ${currentFileName}`, url: window.location.href });
                setLogMessage("SHARE_LINK_SENT");
            } catch (e) {}
        } else {
            setLogMessage("ERR: SHARING_BLOCKED");
        }
        break;
      }
      case 'openFileManager': setActivePanel('file'); break;
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key.toLowerCase()) {
                case 's':
                    e.preventDefault();
                    handleAction('save');
                    break;
                case 'o':
                    e.preventDefault();
                    handleAction('open');
                    break;
                case 'n':
                    e.preventDefault();
                    handleAction('new');
                    break;
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) { /* Redo? */ }
                    else handleAction('undo');
                    break;
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFileName, handleAction]);

  // Auto-Save Effect
  useEffect(() => {
    const timer = setInterval(() => {
        if (layersRef.current && Object.values(layersRef.current).flat().length > 0) {
            commitToHistory();
            setLogMessage("AUTO_SAVE_COMPLETED");
        }
    }, 30000); // Every 30 seconds
    return () => clearInterval(timer);
  }, [commitToHistory]);

  const executeCommand = useCallback((cmdStr: string) => {
    const trimmed = cmdStr.trim();
    
    // Add length safety check to prevent garbled text rendering
    if (trimmed.length > 1000) {
        setLogMessage("ERR: COMMAND_BUFFER_OVERFLOW");
        return;
    }

    if (trimmed && navigator.vibrate) navigator.vibrate(10);
    
    // Repeat last command on Enter/Space if no active command
    if (trimmed === "" && lastCommandName && !engineRef.current?.active) {
      setLogMessage(`REPEATING: ${lastCommandName.toUpperCase()}`);
      executeCommand(lastCommandName);
      return;
    }

    if (trimmed) {
      setCommandHistory(prev => [...prev.slice(-50), "> " + trimmed.toUpperCase()]);
    }

    if (engineRef.current?.active) { 
        if (engineRef.current.input(cmdStr)) { 
            setCommandInput(''); 
            // Requirement 2: Close options when a mode is selected
            if (['2p', '3p', 'ttr', 'center'].includes(trimmed.toLowerCase())) {
                setShowCircleOptions(false);
            }
            return; 
        } 
    }
    if (!trimmed) return;

    const parts = trimmed.split(/\s+/);
    const cmdKey = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    if (cmdKey === 'u' || cmdKey === 'undo') { undo(); setCommandInput(''); return; }
    if (cmdKey === 'cancel' || cmdKey === 'esc') { 
        handleAction('cancel'); 
        setCommandInput(''); 
        setShowCircleOptions(false);
        setShowArcOptions(false);
        setShowEllipseOptions(false);
        return; 
    }

    // Handle sub-commands for Circle, Arc, Ellipse
    const subCommands = ['2p', '3p', 'ttr', 'center', 'tan'];
    if (subCommands.includes(cmdKey)) {
        if (engineRef.current && isCommandActive) {
            if (activeCommandName === 'CIRCLE') {
                engineRef.current.input(cmdKey);
                setShowCircleOptions(false);
                return;
            }
            if (activeCommandName === 'ARC') {
                engineRef.current.input(cmdKey);
                setShowArcOptions(false);
                return;
            }
            if (activeCommandName === 'ELLIPSE') {
                engineRef.current.input(cmdKey);
                setShowEllipseOptions(false);
                return;
            }
        }
    }

    const commandMap: Record<string, any> = {
      'l': LineCommand, 'line': LineCommand, 'dl': DoubleLineCommand, 'dline': DoubleLineCommand,
      'rec': RectCommand, 'rect': RectCommand, 'c': CircleCommand, 'circle': CircleCommand,
      'pl': PolyCommand, 'pline': PolyCommand, 'arc': ArcCommand, 'a': ArcCommand, 'spl': SplineCommand, 'spline': SplineCommand,
      'mt': MTextCommand, 'mtext': MTextCommand, 'm': MoveCommand, 'move': MoveCommand, 
      'e': EraseCommand, 'erase': EraseCommand, 'dist': DistanceCommand, 'di': DistanceCommand, 
      'area': AreaCommand, 'did': AreaCommand, 
      'dim': DimensionCommand, 't': TextCommand, 'text': TextCommand, 
      'z': ZoomCommand, 'zoom': ZoomCommand, 'tr': TrimCommand, 'trim': TrimCommand,
      'h': HatchCommand, 'hatch': HatchCommand, 'lea': LeaderCommand, 'leader': LeaderCommand,
      'p': PanCommand, 'pan': PanCommand, 'o': OffsetCommand, 'offset': OffsetCommand,
      's': StretchCommand, 'stretch': StretchCommand,
      'el': EllipseCommand, 'ellipse': EllipseCommand, 'pol': PolygonCommand, 'polygon': PolygonCommand,
      'sk': SketchCommand, 'sketch': SketchCommand,
      'don': DonutCommand, 'donut': DonutCommand, 'po': PointCommand, 'point': PointCommand,
      'sel': SelectCommand, 'select': SelectCommand,
      'all': SelectAllCommand, 'cut': CutClipCommand, 'copyclip': CopyClipCommand, 'paste': PasteClipCommand,
      'ro': RotateCommand, 'rotate': RotateCommand, 'sc': ScaleCommand, 'scale': ScaleCommand,
      'mi': MirrorCommand, 'mirror': MirrorCommand, 'co': CopyCommand, 'copy': CopyCommand,
      'ex': ExtendCommand, 'extend': ExtendCommand, 'x': ExplodeCommand, 'explode': ExplodeCommand,
      'f': FilletCommand, 'fillet': FilletCommand,
      'ray': RayCommand, 'xl': XLineCommand, 'xline': XLineCommand,
      'ar': ArrayCommand, 'array': ArrayCommand,
      'b': BlockCommand, 'block': BlockCommand,
      'i': InsertCommand, 'insert': InsertCommand,
      'fi': FilterCommand, 'filter': FilterCommand,
      'find': FindCommand, 'vports': ViewportCommand, 'viewport': ViewportCommand, 'layout': LayoutCommand,
    };
    
    const CommandClass = commandMap[cmdKey];
      if (CommandClass) {
        setLastCommandName(cmdKey);
        
        // Command UI State Normalization
        const statusMap: Record<string, string> = {
            'l': 'LINE', 'line': 'LINE',
            'pl': 'POLYLINE', 'pline': 'POLYLINE',
            'spl': 'SPLINE', 'spline': 'SPLINE',
            'c': 'CIRCLE', 'circle': 'CIRCLE',
            'rec': 'RECTANGLE', 'rect': 'RECTANGLE',
            'pol': 'POLYGON', 'polygon': 'POLYGON',
            'a': 'ARC', 'arc': 'ARC',
            'el': 'ELLIPSE', 'ellipse': 'ELLIPSE',
            'xl': 'XLINE', 'xline': 'XLINE',
            'ray': 'RAY', 'xray': 'RAY',
            'dl': 'DLINE', 'dline': 'DLINE',
            'po': 'POINT', 'point': 'POINT',
            'donut': 'DONUT', 'don': 'DONUT',
            'm': 'MOVE', 'move': 'MOVE',
            'ro': 'ROTATE', 'rotate': 'ROTATE',
            'sc': 'SCALE', 'scale': 'SCALE',
            'mi': 'MIRROR', 'mirror': 'MIRROR',
            'co': 'COPY', 'copy': 'COPY',
            's': 'STRETCH', 'stretch': 'STRETCH',
            'tr': 'TRIM', 'trim': 'TRIM',
            'ex': 'EXTEND', 'extend': 'EXTEND',
            'x': 'EXPLODE', 'explode': 'EXPLODE',
            'o': 'OFFSET', 'offset': 'OFFSET',
            'f': 'FILLET', 'fillet': 'FILLET',
            'e': 'ERASE', 'erase': 'ERASE',
            'mt': 'MTEXT', 'mtext': 'MTEXT',
            't': 'TEXT', 'text': 'TEXT',
            'dim': 'DIM', 'dist': 'DIST', 'area': 'AREA',
            'h': 'HATCH', 'lea': 'LEADER', 'p': 'PAN',
            'sk': 'SKETCH', 'sketch': 'SKETCH',
            'sel': 'SELECT', 'select': 'SELECT',
            'ar': 'ARRAY', 'array': 'ARRAY',
            'b': 'BLOCK', 'block': 'BLOCK',
            'i': 'INSERT', 'insert': 'INSERT',
            'fi': 'FILTER', 'filter': 'FILTER',
            'find': 'FIND', 'vports': 'VIEWPORT', 'viewport': 'VIEWPORT', 'layout': 'LAYOUT'
        };
        setActiveCommandName(statusMap[cmdKey] || cmdKey.toUpperCase());
        setIsCommandActive(true);

        // Toggle options for specific commands
      if (cmdKey === 'c' || cmdKey === 'circle') {
          if (activeCommandName === 'CIRCLE') {
              setShowCircleOptions(!showCircleOptions);
              return;
          }
          setShowCircleOptions(true);
          setShowArcOptions(false);
          setShowEllipseOptions(false);
      } else if (cmdKey === 'a' || cmdKey === 'arc') {
          if (activeCommandName === 'ARC') {
              setShowArcOptions(!showArcOptions);
              return;
          }
          setShowArcOptions(true);
          setShowCircleOptions(false);
          setShowEllipseOptions(false);
      } else if (cmdKey === 'el' || cmdKey === 'ellipse') {
          if (activeCommandName === 'ELLIPSE') {
              setShowEllipseOptions(!showEllipseOptions);
              return;
          }
          setShowEllipseOptions(true);
          setShowCircleOptions(false);
          setShowArcOptions(false);
      } else {
          setShowCircleOptions(false);
          setShowArcOptions(false);
          setShowEllipseOptions(false);
      }

      if (engineRef.current) engineRef.current.cancel();
      setPreviewShapes(null);
      setIsCommandActive(true);
      setActivePanel('none'); 
      const cmd = new CommandClass(engineRef.current!.ctx);
      setActiveCommandName(cmd.name);
      engineRef.current!.start(cmd);
      if (args) engineRef.current!.input(args);
    } else {
        setLogMessage(`ERR: CMD NOT FOUND [${cmdKey}]`);
        setIsCommandActive(false);
        setShowCircleOptions(false);
        setActiveCommandName(undefined);
    }
    setCommandInput('');
  }, [undo, commitToHistory, showCircleOptions, handleAction]);

  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new CommandEngine({
        getSettings: () => settingsRef.current,
        getLayers: () => layersRef.current,
        getLayerConfig: () => layerConfigRef.current,
        getSelectedIds: () => selectedIdsRef.current,
        setSelectedIds: setSelectedIds,
        setLayers: (cb) => setLayers(prev => cb(prev)),
        setPreview: setPreviewShapes,
        addLog: (msg) => setLogMessage(msg),
        setMessage: (msg) => {
          if (msg === "Command Finished") { 
              setPrompt("COMMAND:"); 
              setIsCommandActive(false); 
              setActiveCommandName(undefined);
              commitToHistory();
          } else setPrompt(msg?.toUpperCase() || "COMMAND:");
        },
        setView: setView as any,
        getViewState: () => tabViewsRef.current[activeTabRef.current],
        onFinish: () => { 
          setPreviewShapes(null); 
          setPrompt("COMMAND:"); 
          setIsCommandActive(false); 
          setShowCircleOptions(false);
          setShowArcOptions(false);
          setShowEllipseOptions(false);
          setActiveCommandName(undefined);
          commitToHistory(); 
        },
        lastMousePoint: { x: 0, y: 0 },
        getBlocks: () => blocksRef.current,
        setBlocks: (cb) => setBlocks(cb),
        getLayouts: () => layoutsRef.current,
        setLayouts: (v) => setLayouts(v),
        getActiveTab: () => activeTabRef.current,
        start: (cmd: CADCommand) => { setActiveCommandName(cmd.name); engineRef.current?.start(cmd); },
        onExternalRequest: (type, data, cb) => {
            if (type === 'set_active_tab') {
                setActiveTab(data);
                cb(true);
            }
            if (type === 'mtext_editor') {
                setMtextEditor({ initialValue: data || "", callback: cb });
            } else if (type === 'interpret_sketch') {
                // Handle sketch interpretation
                const handleSketch = async () => {
                   setIsAiThinking(true);
                   setLogMessage("INTERPRETING SKETCH...");
                   try {
                     const imgData = canvasHandleRef.current?.captureImage();
                     const res = await getCommandFromAI("Interpret this rough sketch into clean CAD geometry. The sketch is provided as an image.", "", imgData);
                     if (res.commands.length) {
                        res.commands.forEach(c => executeCommand(c));
                        setLastAiCommandTime(Date.now());
                     }
                     if (res.text) setLogMessage(res.text);
                   } catch (e: any) {
                     setLogMessage(`ERR: ${e.message}`);
                   } finally {
                     setIsAiThinking(false);
                   }
                };
                handleSketch();
            }
        }
      });
    }
  }, [setView, commitToHistory]);

  const onCanvasClick = (x: number, y: number, snapped: boolean) => {
    if(engineRef.current) engineRef.current.click({x,y}, snapped);
  };

  const handleLiveToggle = useCallback(async () => {
    if (isLiveActive) {
        if (liveSessionRef.current) { (await liveSessionRef.current).close(); liveSessionRef.current = null; }
        setIsLiveActive(false); setLogMessage("ARCHITECT_LIVE_OFFLINE");
    } else {
        setLogMessage("AWAKENING_ARCHITECT_CORE...");
        try {
            const sessionPromise = connectLiveAgent({
                onCommand: (cmds) => {
                    if (!cmds) return;
                    if (typeof cmds === 'string') {
                        cmds.split('\n').forEach(c => executeCommand(c));
                    } else if (Array.isArray(cmds)) {
                        cmds.forEach(c => executeCommand(c));
                    }
                },
                onTranscript: (t, u) => setLogMessage(u ? `USER: ${t}` : `ARCHITECT: ${t}`),
                onInterrupted: () => {}
            });
            liveSessionRef.current = sessionPromise; setIsLiveActive(true); setLogMessage("ARCHITECT_LIVE_CONNECTED");
        } catch (e: any) { setLogMessage(`ERR: ${e.message}`); }
    }
  }, [isLiveActive, executeCommand]);

  const sidebarButtons = [
    { id: 'drafting', icon: Target, action: 'toggleDraftingSettings', activeOn: 'drafting' },
    { id: 'layers', icon: Layers, action: 'toggleLayers', activeOn: 'layers' },
    { id: 'drawing_props', icon: FileText, action: 'toggleDrawingProps', activeOn: 'drawing_props' },
    { id: 'properties', icon: Sliders, action: 'toggleProperties', activeOn: 'properties' },
    { id: 'calculator', icon: Calculator, action: 'toggleCalculator', activeOn: 'calculator' }
  ];

  return (
    <div className="flex flex-col h-full w-full bg-black text-neutral-300 overflow-hidden select-none">
      {isAppLoading && <LoadingScreen onComplete={() => setIsAppLoading(false)} />}
      <header className="h-14 flex items-center justify-between px-4 shrink-0 bg-black border-b border-white/5 z-[110]">
        <div className="flex items-center gap-3">
          <VoxIcon size={32} className="shrink-0" />
          <div className="flex flex-col h-[32px] justify-between pt-[1px]">
            <div className="flex items-baseline gap-3 leading-none">
              <div className="flex items-baseline">
                <span className="font-black text-[14.5px] uppercase tracking-tighter text-white">VOX</span>
                <span className="font-normal text-[14.5px] uppercase tracking-tighter text-cyan-500 ml-1.5">CADD</span>
              </div>
              <span className="text-neutral-700 font-bold text-[8px] uppercase tracking-[0.2em] leading-none">V-1.0.1</span>
            </div>
            
            <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-wide leading-none mb-0.5">
              <div className="relative">
                <button 
                  onClick={() => setFileMenuOpen(!fileMenuOpen)}
                  className="text-neutral-600 hover:text-neutral-400 transition-colors"
                >
                  File:
                </button>
                {fileMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-[200]" onClick={() => setFileMenuOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 bg-[#1a1a1e] border border-white/10 rounded-md shadow-2xl py-1 z-[201] min-w-[120px] overflow-hidden">
                      <div className="px-3 py-1 border-b border-white/5 mb-1">
                        <div className="text-[7px] font-black uppercase text-neutral-500">Recent Files</div>
                      </div>
                      {recentFiles.map(file => (
                        <button 
                          key={file}
                          onClick={() => {
                            setCurrentFileName(file);
                            setFileMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 hover:bg-cyan-500 hover:text-black transition-colors ${file === currentFileName ? 'text-cyan-400' : 'text-neutral-300'}`}
                        >
                          {file}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              
              <div className="relative">
                <button 
                  onClick={() => setFileNameMenuOpen(!fileNameMenuOpen)}
                  className="text-neutral-400 hover:text-cyan-400 transition-colors"
                >
                  {currentFileName}
                </button>
                {fileNameMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-[200]" onClick={() => setFileNameMenuOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 bg-[#1a1a1e] border border-white/10 rounded-md shadow-2xl py-1 z-[201] min-w-[140px] overflow-hidden">
                      <div className="px-3 py-1 border-b border-white/5 mb-1">
                        <div className="text-[7px] font-black uppercase text-neutral-500">File Operations</div>
                      </div>
                      <div className="px-3 py-1.5 text-[8px] text-neutral-500 border-b border-white/5 truncate max-w-[130px]">
                        Path: C:/Projects/{currentFileName}.vox
                      </div>
                      <button 
                        onClick={() => {
                          const newName = prompt('Rename Project:', currentFileName);
                          if (newName) {
                            const updatedRecent = recentFiles.map(f => f === currentFileName ? newName : f);
                            setRecentFiles(updatedRecent);
                            setCurrentFileName(newName);
                          }
                          setFileNameMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-neutral-300 hover:bg-cyan-500 hover:text-black transition-colors flex items-center gap-2"
                      >
                        <FileEdit size={10} /> Rename
                      </button>
                      <button 
                        onClick={() => {
                          const saveName = prompt('Save Project As:', currentFileName + ' (Copy)');
                          if (saveName) {
                            if (!recentFiles.includes(saveName)) {
                              setRecentFiles([...recentFiles, saveName]);
                            }
                            setCurrentFileName(saveName);
                          }
                          setFileNameMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-neutral-300 hover:bg-cyan-500 hover:text-black transition-colors flex items-center gap-2"
                      >
                        <Save size={10} /> Save As
                      </button>
                      <div className="h-px bg-white/5 my-1" />
                      <button 
                         onClick={() => {
                           if (confirm('Close project?')) {
                             setCurrentFileName('Draught 1');
                           }
                           setFileNameMenuOpen(false);
                         }}
                        className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-500 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <X size={10} /> Close
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => handleAction('toggleMainMenu')} className="p-1 transition-all text-neutral-500 hover:text-white no-tap">
            <Menu size={24} />
          </button>
        </div>
      </header>

      <div className="h-7 bg-black border-b border-white/5 flex items-center px-3 z-[100] shrink-0 gap-4 overflow-x-auto scrollbar-none">
          {['FILE', 'EDIT', 'VIEW', 'DRAW', 'MODIFY', 'ANNO', 'TOOLS'].map((item) => {
            const isSelected = 
              (item === 'FILE' && (activePanel === 'drawing_props' || activePanel === 'file')) ||
              (item === 'TOOLS' && activeCategory === 'Tools') || 
              (item === 'EDIT' && activeCategory === 'Edit') || 
              (item === 'ANNO' && activeCategory === 'Anno') || 
              activeCategory.toUpperCase() === item;
              
            return (
              <button 
                key={item} 
                id={`tab-${item.toLowerCase()}`}
                onClick={() => { 
                  if (navigator.vibrate) navigator.vibrate(5);
                  if (item === 'FILE') handleAction('openFileManager'); 
                  else if (item === 'EDIT') setActiveCategory('Edit'); 
                  else if (item === 'VIEW') setActiveCategory('View'); 
                  else if (item === 'DRAW') setActiveCategory('Draw'); 
                  else if (item === 'MODIFY') setActiveCategory('Modify'); 
                  else if (item === 'ANNO') setActiveCategory('Anno'); 
                  else if (item === 'TOOLS') setActiveCategory('Tools'); 
                }} 
                className={`text-[9px] font-black tracking-widest transition-all no-tap whitespace-nowrap px-1 h-full flex items-center relative ${
                  isSelected 
                    ? 'text-cyan-400' 
                    : 'text-neutral-600 hover:text-neutral-300'
                }`}
              >
                {item}
                {isSelected && <div className="absolute inset-x-0 bottom-0 h-[1.5px] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]"></div>}
              </button>
            );
          })}
      </div>


      <main className="flex-1 relative bg-black overflow-hidden border border-neutral-800/40">
        <CADCanvas 
          ref={canvasHandleRef} 
          layers={layers} 
          blocks={blocks}
          layouts={layouts}
          layerConfig={layerConfig} 
          view={view} 
          setView={setView as any} 
          settings={settings} 
          isCommandActive={isCommandActive} 
          activeTab={activeTab} 
          isViewportActive={isViewportActive} 
          onViewportToggle={() => setIsViewportActive(!isViewportActive)} 
          onClick={onCanvasClick} 
          onMouseMove={(x,y,s) => { if(engineRef.current) engineRef.current.move({x,y}, s); }} 
          selectedIds={selectedIds} 
          onSelectionChange={(ids, additive) => {
            if (additive) {
              setSelectedIds(prev => {
                const combined = [...prev];
                ids.forEach(id => {
                  if (combined.includes(id)) {
                    const idx = combined.indexOf(id);
                    combined.splice(idx, 1);
                  } else {
                    combined.push(id);
                  }
                });
                return combined;
              });
            } else {
              setSelectedIds(ids);
            }
          }} 
          onCommand={executeCommand}
          previewShapes={previewShapes} 
          activeCommandName={activeCommandName} 
          isAiThinking={isAiThinking}
          lastAiCommandTime={lastAiCommandTime}
        />
        
        <div className="absolute top-3 left-3 pointer-events-none">
            <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-md px-2 py-0.5 flex gap-2">
                <span className="text-[7px] font-mono text-neutral-500 uppercase tracking-widest">PRECISION: <span className="text-[#00bcd4]">{settings.precision}</span></span>
                <span className="w-[1px] h-2.5 bg-white/10" />
                <span className="text-[7px] font-mono text-neutral-500 uppercase tracking-widest">SNAP: <span className={settings.snap ? 'text-[#00bcd4]' : 'text-neutral-600'}>{settings.snap ? 'ON' : 'OFF'}</span></span>
            </div>
        </div>

        <div className="absolute right-3 top-3 flex flex-col gap-2 z-10">
          {sidebarButtons.map(p => (
            <button key={p.id} onClick={() => { if(navigator.vibrate) navigator.vibrate(5); handleAction(p.action); }} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border no-tap ${activePanel === p.activeOn ? 'bg-[#00bcd4] text-black border-[#00bcd4]' : 'bg-black/60 backdrop-blur-sm border-white/10 text-neutral-400 hover:text-white'}`}><p.icon size={16} /></button>
          ))}
        </div>

        {activePanel === 'layers' && <LayerManager layers={layerConfig} activeLayer={settings.currentLayer} onClose={() => setActivePanel('none')} onUpdateLayer={(id, upd) => setLayerConfig(prev => ({...prev, [id]: {...prev[id], ...upd} }))} onAddLayer={(name) => { const id = generateId(); setLayerConfig(prev => ({...prev, [id]: { id, name, visible: true, locked: false, frozen: false, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' }})); }} onRemoveLayer={(id) => setLayerConfig(prev => { const n = {...prev}; delete n[id]; return n; })} onSetActive={(id) => setSettings(s => ({...s, currentLayer: id}))} />}
        {activePanel === 'properties' && <PropertiesPanel selectedShapes={(Object.values(layers).flat() as Shape[]).filter(s => selectedIds.includes(s.id))} onUpdateShape={(id, upd) => setLayers(prev => { const n = {...prev}; Object.keys(n).forEach(l => n[l] = n[l].map(s => s.id === id ? {...s, ...upd} : s)); return n; })} layers={layerConfig} settings={settings} onUpdateSettings={(upd) => setSettings(s => ({...s, ...upd}))} onClose={() => setActivePanel('none')} />}
        {activePanel === 'calculator' && <CalculatorPanel onClose={() => setActivePanel('none')} />}
        {activePanel === 'drafting' && <DraftingSettings options={settings.snapOptions} settings={settings} onSettingsChange={(upd) => setSettings(s => ({...s, ...upd}))} onChange={(upd) => setSettings(s => ({...s, snapOptions: { ...s.snapOptions, ...upd }}))} onClose={() => setActivePanel('none')} />}
        {activePanel === 'file' && <FileManager currentName={currentFileName} recentFiles={recentFiles} onAction={handleAction} onClose={() => setActivePanel('none')} />}
        {activePanel === 'drawing_props' && (
          <DrawingProperties 
            settings={settings} 
            onConfirm={(metadata, newTitle) => {
              setSettings(s => ({...s, metadata}));
              if (newTitle !== currentFileName) {
                handleAction('rename', newTitle);
              }
              setActivePanel('none');
              setLogMessage("PROJECT_PROPERTIES_UPDATED");
              // Use a slight timeout to allow state refs to sync
              setTimeout(() => commitToHistory(), 50);
            }} 
            onClose={() => setActivePanel('none')} 
            entityCount={(Object.values(layers).flat() as Shape[]).length} 
            currentFileName={currentFileName} 
          />
        )}
        {activePanel === 'help' && <InfoPanel type="help" onSwitch={(t) => setActivePanel(t)} onClose={() => setActivePanel('none')} />}
        {activePanel === 'about' && <InfoPanel type="about" onSwitch={(t) => setActivePanel(t)} onClose={() => setActivePanel('none')} />}
        {activePanel === 'privacy' && <InfoPanel type="privacy" onSwitch={(t) => setActivePanel(t)} onClose={() => setActivePanel('none')} />}
        {activePanel === 'new_file' && <NewFileDialog onSelect={(cfg) => { 
            const name = cfg.name + '.vox';
            setLayers({ '0': [], 'defpoints': [] }); 
            setSettings(s => ({...s, units: cfg.units, precision: cfg.precision })); 
            setCurrentFileName(name); 
            setActivePanel('none'); 
            updateRecentFiles(name);
            commitToHistory();
        }} onClose={() => setActivePanel('none')} />}
        {mtextEditor && (
          <MTextEditor 
            initialValue={mtextEditor.initialValue} 
            onSave={(text) => {
              mtextEditor.callback(text);
              setMtextEditor(null);
            }}
            onCancel={() => {
              mtextEditor.callback("");
              setMtextEditor(null);
            }}
          />
        )}
        {activePanel === 'mainmenu' && (
          <div className="absolute inset-0 z-[500] bg-black flex flex-col animate-in slide-in-from-top duration-300">
             <header className="h-12 flex justify-between items-center px-4 border-b border-white/5">
                <h2 className="text-[10px] font-black text-white uppercase tracking-widest">VOXCADD PANEL</h2>
                <button onClick={() => setActivePanel('none')} className="p-2 text-neutral-500"><X size={20}/></button>
             </header>
             <MenuBar onAction={(a,p) => handleAction(a,p)} currentFileName={currentFileName} units={settings.units} />
          </div>
        )}
      </main>

      <div className="h-7 bg-[#0a0a0c] border-t border-white/5 flex items-center shrink-0 cursor-default select-none">
        {/* Fixed Model & Add */}
        <div className="flex items-center h-full shrink-0">
          <button 
            onClick={() => setActiveTab('model')} 
            className={`h-full px-2 text-[9px] font-black uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'model' ? 'text-[#00bcd4]' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            <Grid3X3 size={10} /> Model
          </button>
          <button 
            onClick={() => {
              const id = 'layout' + Date.now();
              const newLayout = { id, name: 'Layout ' + (layouts.length + 1), paperSize: { width: 297, height: 210 }, viewports: [] };
              setLayouts([...layouts, newLayout]);
              setTabViews(prev => ({ ...prev, [id]: { scale: 3, originX: 0, originY: 0 } }));
              setActiveTab(id);
            }}
            className="h-full px-1.5 text-neutral-500 hover:text-[#00bcd4] transition-all flex items-center border-x border-white/5"
            title="New Layout"
          >
            <FilePlus size={11} />
          </button>
        </div>

        {/* Scrollable Layout List */}
        <div className="flex-1 flex items-center h-full overflow-x-auto scrollbar-none gap-px">
          {layouts.map(l => (
            <button 
              key={l.id}
              draggable
              onDragStart={() => handleDragStart(l.id)}
              onDragOver={(e) => { e.preventDefault(); handleDragOverTab(l.id); }}
              onClick={() => setActiveTab(l.id)} 
              onMouseDown={(e) => handleLayoutLongPress(e, l.id)}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onTouchStart={(e) => handleLayoutLongPress(e, l.id)}
              onTouchEnd={cancelLongPress}
              className={`h-full px-1.5 text-[9px] font-black uppercase transition-all flex items-center gap-1 whitespace-nowrap group relative ${activeTab === l.id ? 'text-[#00bcd4] bg-white/5' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              <Layers2 size={9} /> {l.name}
            </button>
          ))}
        </div>
      </div>

      {layoutContextMenu && (
        <>
          <div className="fixed inset-0 z-[1000]" onClick={() => setLayoutContextMenu(null)} />
          <div 
            className="fixed bg-[#1a1a1e] border border-white/10 rounded-xl shadow-2xl py-1.5 z-[1001] min-w-[150px] overflow-hidden"
            style={{ 
              left: Math.max(10, Math.min(layoutContextMenu.x - 75, window.innerWidth - 160)), 
              top: Math.max(10, layoutContextMenu.y - 285) 
            }}
          >
            <div className="px-3 py-1 border-b border-white/5 mb-1">
              <div className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">Layout Options</div>
            </div>
            
            <button onClick={() => renameLayout(layoutContextMenu.layoutId)} className="w-full text-left px-3 py-1.5 text-[9px] text-neutral-300 hover:bg-cyan-500 hover:text-black transition-all font-black uppercase flex items-center gap-2.5">
              <FileEdit size={12} className="opacity-70" /> Rename
            </button>
            <button onClick={() => updateLayoutProperties(layoutContextMenu.layoutId)} className="w-full text-left px-3 py-1.5 text-[9px] text-neutral-300 hover:bg-cyan-500 hover:text-black transition-all font-black uppercase flex items-center gap-2.5">
              <Sliders size={12} className="opacity-70" /> Properties
            </button>
            <button onClick={() => duplicateLayout(layoutContextMenu.layoutId)} className="w-full text-left px-3 py-1.5 text-[9px] text-neutral-300 hover:bg-cyan-500 hover:text-black transition-all font-black uppercase flex items-center gap-2.5">
              <Layers2 size={12} className="opacity-70" /> Duplicate
            </button>
            <button onClick={importLayout} className="w-full text-left px-3 py-1.5 text-[9px] text-neutral-300 hover:bg-cyan-500 hover:text-black transition-all font-black uppercase flex items-center gap-2.5">
              <FilePlus size={12} className="opacity-70" /> Import
            </button>

            <div className="h-px bg-white/5 my-1" />
            
            <button onClick={() => moveLayout(layoutContextMenu.layoutId, 'left')} className="w-full text-left px-3 py-1 text-[9px] text-neutral-400 hover:bg-white/5 transition-all font-black uppercase flex items-center gap-2.5">
              <Target size={12} className="-rotate-90 opacity-50" /> Move Left
            </button>
            <button onClick={() => moveLayout(layoutContextMenu.layoutId, 'right')} className="w-full text-left px-3 py-1 text-[9px] text-neutral-400 hover:bg-white/5 transition-all font-black uppercase flex items-center gap-2.5">
              <Target size={12} className="rotate-90 opacity-50" /> Move Right
            </button>

            <div className="h-px bg-white/5 my-1" />
            
            <button onClick={() => deleteLayout(layoutContextMenu.layoutId)} className="w-full text-left px-3 py-1.5 text-[9px] text-red-500/80 hover:bg-red-500 hover:text-white transition-all font-black uppercase flex items-center gap-2.5">
              <X size={12} /> Delete
            </button>
            <button onClick={deleteAllLayouts} className="w-full text-left px-3 py-1.5 text-[9px] text-red-500/80 hover:bg-red-500 hover:text-white transition-all font-black uppercase flex items-center gap-2.5">
              <X size={12} strokeWidth={3} /> Delete All
            </button>
          </div>
        </>
      )}

      <footer className="bg-black shrink-0 pb-[env(safe-area-inset-bottom)]">
        <Toolbar 
            category={activeCategory} 
            settings={settings} 
            onSettingChange={setSettings} 
            onAction={handleAction} 
            onCommand={executeCommand} 
            activeCommandName={activeCommandName} 
            showCircleOptions={showCircleOptions} 
            showArcOptions={showArcOptions}
            showEllipseOptions={showEllipseOptions}
            canUndo={history.length > 0} 
            canRedo={redoStack.length > 0} 
        />
        <CommandBar 
          onCommand={executeCommand} 
          onAiQuery={async (q, sketch) => { 
            setIsAiThinking(true);
            setCommandHistory(prev => [...prev, "> AI: " + q]);
            setLogMessage("CONSULTING PRINCIPAL ARCHITECT..."); 
            try {
              const res = await getCommandFromAI(q, `Drawing: ${(Object.values(layers).flat() as Shape[]).length} entities. Settings: ${settings.units}.`, sketch); 
              if (res.commands.length) {
                res.commands.forEach(c => executeCommand(c)); 
                setLastAiCommandTime(Date.now());
              }
              if (res.text) {
                let finalMsg = res.text;
                if (res.groundingLinks && res.groundingLinks.length > 0) {
                  finalMsg += "\n\nSOURCES FOUND:\n" + res.groundingLinks.map(l => `• ${l.title}: ${l.uri}`).join('\n');
                }
                setLogMessage(finalMsg);
                setCommandHistory(prev => [...prev, finalMsg]);
              }
            } catch (e: any) {
              setLogMessage(`ERR: ${e.message}`);
              setCommandHistory(prev => [...prev, `ERR: ${e.message}`]);
            } finally {
              setIsAiThinking(false);
            }
          }} 
          isAiThinking={isAiThinking}
          onLiveToggle={handleLiveToggle} 
          isLiveActive={isLiveActive} 
          isCommandActive={isCommandActive} 
          prompt={prompt} 
          history={commandHistory}
          value={commandInput} 
          onChange={setCommandInput} 
        />
      </footer>
    </div>
  );
};
export default App;
