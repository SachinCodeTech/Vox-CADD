
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import CADCanvas, { CADCanvasHandle } from './CADCanvas';
import Toolbar from './Toolbar';
import CommandBar from './CommandBar';
import LayerManager from './LayerManager';
import FileManager from './FileManager';
import MenuBar from './MenuBar';
import PropertiesPanel from './PropertiesPanel';
import CalculatorPanel from './CalculatorPanel';
import DraftingSettings from './DraftingSettings';
import DrawingProperties from './DrawingProperties';
import InfoPanel from './InfoPanel';
import NewFileDialog from './NewFileDialog';
import HatchPatternSelector from './HatchPatternSelector';
import MTextEditor from './MTextEditor';
import DimStyleManager from './DimStyleManager';
import LoadingScreen from './LoadingScreen';
import { Share as CapacitorShare } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { generateId, hitTestGrip, getAllShapesBounds } from '../services/cadService';
import { getCommandFromAI, connectLiveAgent } from '../services/geminiService';
import { shapesToDXF, dxfToProject } from '../services/dxfService';
import { shapesToVox, voxToProject, createEmptyVoxProject } from '../services/voxService';
import { dwgToProject } from '../services/DwgService';
import { 
  CADCommand, CommandEngine, LineCommand, DoubleLineCommand, CircleCommand, RectCommand, PolyCommand, 
  ArcCommand, MoveCommand, EraseCommand, DistanceCommand, AreaCommand, 
  DimensionCommand, TextCommand, MTextCommand, ZoomCommand, 
  RotateCommand, ScaleCommand, MirrorCommand, CopyCommand,
  ExtendCommand, ExplodeCommand,
  RayCommand, XLineCommand,
  HatchCommand, LeaderCommand, PanCommand, OffsetCommand, TrimCommand, FilletCommand, EllipseCommand, PolygonCommand, MatchPropertiesCommand,
  DonutCommand, PointCommand,
  SelectAllCommand, CopyClipCommand, CutClipCommand, PasteClipCommand, SplineCommand, SketchCommand, StretchCommand, SelectCommand,
  ArrayCommand, BlockCommand, InsertCommand, FilterCommand, FindCommand, ViewportCommand, LayoutCommand, GripEditCommand, ImportCommand
} from '../services/commandEngine';
import { Shape, ViewState, AppSettings, LayerConfig, Point, UnitType, BlockDefinition, LayoutDefinition, LayoutViewport, LineTypeDefinition } from '../types';
import { Menu, X, Sliders, Layers, FileText, Calculator, Target, Weight, FileEdit, Grid3X3, Layers2, FilePlus, Save, RotateCw, FolderOpen, Share2, XCircle, HardDrive, AlertTriangle, Cpu } from 'lucide-react';

import VoxIcon from './VoxIcon';
import ImportSummaryDialog from './ImportSummaryDialog';
import { storageService } from '../services/storageService';

const INITIAL_SETTINGS: AppSettings = {
  ortho: true, snap: true, grid: true,
  currentLayer: '0', drawingScale: 1, penThickness: 1,
  activeLineType: 'continuous',
  cursorX: 0, cursorY: 0, 
  units: 'metric', unitSubtype: 'mm', 
  linearFormat: 'decimal', angularFormat: 'decimalDegrees', anglePrecision: '0', 
  precision: '0.0000',
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
  activeDimStyle: 'standard',
  dimStyles: {
    'standard': { 
      id: 'standard', name: 'Standard', 
      arrowSize: 200, textSize: 250, textOffset: 100, 
      extendLine: 150, offsetLine: 100, precision: 2 
    },
    'architectural': { 
      id: 'architectural', name: 'Architectural', 
      arrowSize: 150, textSize: 180, textOffset: 80, 
      extendLine: 100, offsetLine: 80, precision: 1 
    }
  },
  limitsMin: { x: 0, y: 0 },
  limitsMax: { x: 42000, y: 29700 }, // Default A3 in mm (scaled up for visibility)
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
  'defpoints': { id: 'defpoints', name: 'defpoints', visible: true, locked: false, frozen: false, color: '#666666', thickness: 0.1, lineType: 'continuous' }
};

export type ToolbarCategory = 'Draw' | 'Modify' | 'Anno' | 'View' | 'Tools' | 'History' | 'Edit';
type PanelType = 'none' | 'layers' | 'properties' | 'calculator' | 'drafting' | 'file' | 'mainmenu' | 'drawing_props' | 'help' | 'about' | 'privacy' | 'new_file' | 'dimstyle' | 'glossary';

const STORAGE_PREFIX = 'voxcadd_file_v1_';
const REGISTRY_KEY = 'voxcadd_recent_files';

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        resolve(base64data.split(',')[1] || base64data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
};

const App: React.FC = () => {
  const [layers, setLayers] = useState<Record<string, Shape[]>>({ '0': [], 'defpoints': [] });
  const [blocks, setBlocks] = useState<Record<string, BlockDefinition>>({});
  const [layouts, setLayouts] = useState<LayoutDefinition[]>([
    { id: 'layout1', name: 'Layout 1', paperSize: { width: 297, height: 210 }, viewports: [] }
  ]);
  const [layerConfig, setLayerConfig] = useState<Record<string, LayerConfig>>(INITIAL_LAYERS_CONFIG);
  const [lineTypes, setLineTypes] = useState<Record<string, LineTypeDefinition>>({ 'continuous': { name: 'continuous', description: 'Solid line', pattern: [] } });
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [activeTab, setActiveTab] = useState<string>('model');
  const [currentFileName, setCurrentFileName] = useState('Drawing 1.vox');
  const [fileSource, setFileSource] = useState('storage');
  const [recentFiles, setRecentFiles] = useState<{name: string, date: number}[]>([]);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [fileNameMenuOpen, setFileNameMenuOpen] = useState(false);
  const [fileNameMenuPos, setFileNameMenuPos] = useState({ x: 0, y: 0 });
  const [promptDialog, setPromptDialog] = useState<{
    title: string;
    message: string;
    initialValue: string;
    type?: 'prompt' | 'confirm';
    onConfirm: (val: string) => void;
  } | null>(null);
  const fileNameBtnRef = useRef<HTMLButtonElement>(null);

  const layoutContextMenuRef = useRef<HTMLDivElement>(null);
  const fileNameMenuRef = useRef<HTMLDivElement>(null);
  const blockNextClick = useRef(false);

  const toggleFileNameMenu = () => {
    if (blockNextClick.current) {
      blockNextClick.current = false;
      return;
    }
    if (fileNameBtnRef.current) {
        const rect = fileNameBtnRef.current.getBoundingClientRect();
        setFileNameMenuPos({ x: rect.left + rect.width / 2, y: rect.bottom });
    }
    setFileNameMenuOpen(!fileNameMenuOpen);
    setFileMenuOpen(false);
  };
  const [activeCategory, setActiveCategory] = useState<ToolbarCategory>('Draw');
  const [isViewportActive, setIsViewportActive] = useState(false);
  const [activeViewportId, setActiveViewportId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, Shape[]>[]>([]);
  const [redoStack, setRedoStack] = useState<Record<string, Shape[]>[]>([]);
  const [tabViews, setTabViews] = useState<Record<string, ViewState>>({
    model: { ...INITIAL_VIEW },
    layout1: { scale: 3, originX: 0, originY: 0 },
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [commandPrompt, setCommandPrompt] = useState<string>("COMMAND:");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [aiConversation, setAiConversation] = useState<{role: string, parts: any[]}[]>([]);
  const [logMessage, _setLogMessage] = useState<string | null>(null);
  
  useEffect(() => {
    if (logMessage) {
      const timer = setTimeout(() => _setLogMessage(null), logMessage.startsWith('ERR:') ? 5000 : 3000);
      return () => clearTimeout(timer);
    }
  }, [logMessage]);

  const [loadingFile, setLoadingFile] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("");

  const withTimeout = useCallback(<T,>(promise: Promise<T>, ms: number = 20000): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("OPERATION_TIMEOUT")), ms))
    ]);
  }, []);
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
  const [mtextEditor, setMtextEditor] = useState<{ 
    initialValue: string, 
    callback: (text: string, props?: any) => void 
  } | null>(null);
  const [importSummary, setImportSummary] = useState<{ fileName: string, stats: any } | null>(null);
  const [hatchSelector, setHatchSelector] = useState<{ 
    callback: (pattern: string) => void 
  } | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [lastAiCommandTime, setLastAiCommandTime] = useState(0);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [layoutContextMenu, setLayoutContextMenu] = useState<{ x: number, y: number, layoutId: string } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleLayoutLongPress = (e: React.MouseEvent | React.TouchEvent, layoutId: string) => {
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    
    longPressTimer.current = setTimeout(() => {
      blockNextClick.current = true;
      setLayoutContextMenu({ x: clientX, y: clientY, layoutId });
      if(navigator.vibrate) navigator.vibrate([30, 50]);
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
    setPromptDialog({
      title: 'Rename Layout',
      message: 'Enter new layout name:',
      initialValue: layout.name,
      type: 'prompt',
      onConfirm: (newName) => {
        if (newName && newName.trim()) {
          const trimmedName = newName.trim();
          setLayouts(prev => prev.map(l => l.id === id ? { ...l, name: trimmedName } : l));
          setLogMessage(`LAYOUT_RENAMED: ${trimmedName}`);
        }
      }
    });
    setLayoutContextMenu(null);
  };

  const duplicateLayout = (id: string) => {
    const layout = layouts.find(l => l.id === id);
    if (!layout) return;
    const newId = 'layout' + Date.now();
    const newLayout = { ...layout, id: newId, name: `${layout.name} (Copy)` };
    setLayouts(prev => [...prev, newLayout]);
    setTabViews(prev => ({ ...prev, [newId]: { ...(prev[id] || { scale: 3, originX: 0, originY: 0 }) } }));
    setLayoutContextMenu(null);
  };

  const deleteLayout = (id: string) => {
    if (layouts.length <= 1) {
      setLogMessage("ERR: CANNOT_DELETE_LAST_LAYOUT");
      return;
    }
    const layout = layouts.find(l => l.id === id);
    setPromptDialog({
      title: 'Delete Layout',
      message: `Are you sure you want to delete "${layout?.name}"?`,
      initialValue: '',
      type: 'confirm',
      onConfirm: () => {
        setLayouts(prev => prev.filter(l => l.id !== id));
        setTabViews(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        if (activeTab === id) setActiveTab('model');
        setLogMessage(`LAYOUT_DELETED: ${layout?.name}`);
      }
    });
    setLayoutContextMenu(null);
  };

  const deleteAllLayouts = () => {
    setPromptDialog({
      title: 'Delete All Layouts',
      message: 'Delete all layouts? This will reset you to a single default layout.',
      initialValue: '',
      type: 'confirm',
      onConfirm: () => {
        const defaultId = 'layout' + Date.now();
        setLayouts([{ id: defaultId, name: 'Layout 1', paperSize: { width: 297, height: 210 }, viewports: [] }]);
        setTabViews(prev => ({ ...prev, [defaultId]: { scale: 3, originX: 0, originY: 0 } }));
        setActiveTab('model');
        setLogMessage("ALL_LAYOUTS_DELETED");
      }
    });
    setLayoutContextMenu(null);
  };

  const updateLayoutProperties = (id: string) => {
    const layout = layouts.find(l => l.id === id);
    if (!layout) return;
    
    // For properties, we'll just use a double prompt pattern for now with the new dialog
    setPromptDialog({
      title: 'Paper Width (mm)',
      message: 'Enter paper width in millimeters:',
      initialValue: layout.paperSize.width.toString(),
      type: 'prompt',
      onConfirm: (width) => {
        if (!width) return;
        setPromptDialog({
          title: 'Paper Height (mm)',
          message: 'Enter paper height in millimeters:',
          initialValue: layout.paperSize.height.toString(),
          type: 'prompt',
          onConfirm: (height) => {
            if (height) {
              setLayouts(prev => prev.map(l => l.id === id ? { ...l, paperSize: { width: parseFloat(width), height: parseFloat(height) } } : l));
              setLogMessage("LAYOUT_PROPERTIES_UPDATED");
            }
          }
        });
      }
    });
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
    if (activeTab !== 'model' && isViewportActive && activeViewportId) {
      setLayouts(prevLayouts => {
        const layoutIndex = prevLayouts.findIndex(l => l.id === activeTab);
        if (layoutIndex === -1) return prevLayouts;
        
        const newLayouts = [...prevLayouts];
        const layout = { ...newLayouts[layoutIndex] };
        const vpIndex = layout.viewports.findIndex(vp => vp.id === activeViewportId);
        
        if (vpIndex !== -1) {
          const vp = { ...layout.viewports[vpIndex] };
          vp.viewState = typeof updater === 'function' ? (updater as any)(vp.viewState) : updater;
          
          const newVps = [...layout.viewports];
          newVps[vpIndex] = vp;
          layout.viewports = newVps;
          newLayouts[layoutIndex] = layout;
          return newLayouts;
        }
        return prevLayouts;
      });
      return;
    }

    setTabViews(prev => {
      const current = prev[activeTab] || { scale: 1, originX: 0, originY: 0 };
      const next = typeof updater === 'function' ? (updater as (v: ViewState) => ViewState)(current) : updater;
      return { ...prev, [activeTab]: next };
    });
  }, [activeTab, isViewportActive, activeViewportId]);

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
  const lineTypesRef = useRef(lineTypes);
  const layoutsRef = useRef(layouts);
  const activeViewportIdRef = useRef(activeViewportId);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { layerConfigRef.current = layerConfig; }, [layerConfig]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { tabViewsRef.current = tabViews; }, [tabViews]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);
  useEffect(() => { lineTypesRef.current = lineTypes; }, [lineTypes]);
  useEffect(() => { layoutsRef.current = layouts; }, [layouts]);
  useEffect(() => { activeViewportIdRef.current = activeViewportId; }, [activeViewportId]);

  // Restore session from IndexedDB/LocalStorage
  useEffect(() => {
    const initStorage = async () => {
      const saved = await storageService.loadActiveWorkspace();
      const savedRecent = localStorage.getItem(REGISTRY_KEY);
      
      // Seed sample files if empty or if they are missing from IndexedDB
      let recentFilesParsed = [];
      try { recentFilesParsed = JSON.parse(savedRecent || "[]"); } catch(e) {}
      
      const samples = [
          { name: "1.vox", date: Date.now() - 3000 },
          { name: "2.vox", date: Date.now() - 2000 },
          { name: "3.vox", date: Date.now() - 1000 }
      ];

      if (recentFilesParsed.length === 0) {
          localStorage.setItem(REGISTRY_KEY, JSON.stringify(samples));
          recentFilesParsed = samples;
      }

      // Ensure that all files in the recent list actually exist in storage
      const validRecentFiles = [];
      for (const s of recentFilesParsed) {
          const data = await storageService.loadLarge(`${STORAGE_PREFIX}${s.name}`);
          if (data) {
              validRecentFiles.push(s);
          } else {
              // If it's one of our expected samples, recreate if missing
              const isSample = samples.some(sample => sample.name === s.name);
              if (isSample) {
                  const i = samples.findIndex(sample => sample.name === s.name);
                  const sampleLayers = { 
                      '0': [
                          { id: `seed-${s.name}-${i}`, type: 'circle', x: 200 * (i+1), y: 200 * (i+1), radius: 50 * (i+1), color: '#00bcd4', layer: '0' } as Shape
                      ], 
                      'defpoints': [] 
                  };
                  await storageService.saveLarge(`${STORAGE_PREFIX}${s.name}`, {
                      layers: sampleLayers,
                      layerConfig: INITIAL_LAYERS_CONFIG,
                      settings: INITIAL_SETTINGS,
                      fileName: s.name
                  });
                  validRecentFiles.push(s);
                  console.log(`RECREATED_MISSING_SAMPLE: ${s.name}`);
              } else {
                  console.warn(`REMOVING_MISSING_FILE_FROM_RECENT: ${s.name}`);
              }
          }
      }

      localStorage.setItem(REGISTRY_KEY, JSON.stringify(validRecentFiles));
      setRecentFiles(validRecentFiles);

      if (saved) {
        try {
          if (saved.layers) setLayers(saved.layers);
          if (saved.layerConfig) setLayerConfig(saved.layerConfig);
          if (saved.settings) setSettings({ ...INITIAL_SETTINGS, ...saved.settings });
          if (saved.fileName) {
            setCurrentFileName(saved.fileName);
            updateRecentFiles(saved.fileName);
          }
          setLogMessage("SESSION_RESTORED_SUCCESS");
        } catch (e) {
          console.error("Failed to restore session", e);
        }
      } else {
        // Default open with Drawing 1.vox
        setCurrentFileName("Drawing 1.vox");
        setFileSource("storage");
        updateRecentFiles("Drawing 1.vox");
      }
    };

    initStorage();
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (file) {
        const isDwg = file.name.toLowerCase().endsWith('.dwg');
        const content = isDwg ? await file.arrayBuffer() : await file.text();
        handleOpenFile(file.name, content, "external");
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
          handleOpenFile(file.name, content, "device/storage");
        }
      });
    }

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const handleOpenFile = async (fileName: string, content: string | ArrayBuffer, source: string = "storage") => {
    if (navigator.vibrate) navigator.vibrate(20);
    const isDxf = fileName.toLowerCase().endsWith('.dxf');
    const isDwg = fileName.toLowerCase().endsWith('.dwg');
    const isVox = fileName.toLowerCase().endsWith('.vox');
    
    setLoadingFile(true);
    setLoadingStatus(`Importing ${fileName}...`);
    
    try {
        let project: any = null;

        if (isDwg) {
            if (!(content instanceof ArrayBuffer)) {
                setLogMessage("LOAD_ERR: BINARY_DATA_REQUIRED");
                return;
            }
            project = await dwgToProject(content, settingsRef.current);
        } else if (isDxf) {
            if (typeof content !== 'string') return;
            project = dxfToProject(content, settingsRef.current);
        } else if (isVox) {
            if (typeof content !== 'string') return;
            project = voxToProject(content);
        }

        if (project) {
            // Normalize entities into internal layers map
            const layerMap: Record<string, Shape[]> = { '0': [], 'defpoints': [] };
            project.entities.forEach((s: Shape) => {
                const l = s.layer || '0';
                if (!layerMap[l]) layerMap[l] = [];
                layerMap[l].push(s);
            });

            // Update state
            setLayers(layerMap);
            setLayerConfig(project.layers);
            setLineTypes(project.lineTypes || { 'continuous': { name: 'continuous', description: 'Solid line', pattern: [] } });
            setSettings(project.settings);
            setBlocks(project.blocks || {});
            setCurrentFileName(fileName);
            setFileSource(source);
            updateRecentFiles(fileName);
            
            // Zoom extents if bounds exist
            if (project.bounds) {
                setTimeout(() => handleAction('zoomExtents'), 100);
            }

            if (project.stats) {
                setImportSummary({ fileName, stats: project.stats });
            }

            setLogMessage(`${fileName.toUpperCase()}_LOADED_SUCCESS`);
        } else {
            setLogMessage("LOAD_ERR: INVALID_PROJECT_CONTENT");
        }

        setActivePanel('none');
    } catch(err) { 
        console.error(err);
        setLogMessage("LOAD_ERR: IMPORT_FAILED"); 
    } finally {
        setLoadingFile(false);
        setLoadingStatus("");
    }
  };

  const commitToHistory = useCallback(() => {
    const currentState = JSON.parse(JSON.stringify(layersRef.current));
    setHistory(prev => [...prev.slice(-49), currentState]);
    setRedoStack([]);
    
    // Save to active workspace (via IndexedDB to avoid quota issues)
    const payload = {
      layers: currentState,
      layerConfig: layerConfigRef.current,
      settings: settingsRef.current,
      fileName: currentFileName
    };
    
    storageService.saveActiveWorkspace(payload);
    
    // Save to specific file storage if it's a named file
    if (currentFileName) {
        storageService.saveLarge(`${STORAGE_PREFIX}${currentFileName}`, payload);
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
        setPreviewShapes(null);
        setIsCommandActive(false); 
        setActiveCommandName(undefined);
        setCommandPrompt("COMMAND:");
        setShowCircleOptions(false);
        setShowArcOptions(false);
        setShowEllipseOptions(false);
        break;
      case 'toggleLayers': setActivePanel(activePanel === 'layers' ? 'none' : 'layers'); break;
      case 'toggleProperties': setActivePanel(activePanel === 'properties' ? 'none' : 'properties'); break;
      case 'toggleCalculator': setActivePanel(activePanel === 'calculator' ? 'none' : 'calculator'); break;
      case 'toggleDimStyle': setActivePanel(activePanel === 'dimstyle' ? 'none' : 'dimstyle'); break;
      case 'toggleDraftingSettings': setActivePanel(activePanel === 'drafting' ? 'none' : 'drafting'); break;
      case 'toggleMainMenu': setActivePanel(activePanel === 'mainmenu' ? 'none' : 'mainmenu'); break;
      case 'toggleDrawingProps': setActivePanel(activePanel === 'drawing_props' ? 'none' : 'drawing_props'); break;
      case 'toggleHelp': setActivePanel(activePanel === 'help' ? 'none' : 'help'); break;
      case 'erase':
        if (selectedIds.length > 0) {
            setLayers(prev => {
                const next = { ...prev };
                Object.keys(next).forEach(l => {
                    next[l] = next[l].filter(s => !selectedIds.includes(s.id));
                });
                return next;
            });
            setSelectedIds([]);
            setLogMessage(`ERASED ${selectedIds.length} OBJECTS`);
            commitToHistory();
        }
        break;
      case 'toggleAbout': setActivePanel(activePanel === 'about' ? 'none' : 'about'); break;
      case 'togglePrivacy': setActivePanel(activePanel === 'privacy' ? 'none' : 'privacy'); break;
      case 'toggleGlossary': setActivePanel(activePanel === 'glossary' ? 'none' : 'glossary'); break;
      case 'zoomExtents':
      case 'zoomAll': {
        const limits = act === 'zoomAll' ? { min: settingsRef.current.limitsMin, max: settingsRef.current.limitsMax } : undefined;
        const bounds = getAllShapesBounds(layersRef.current, blocksRef.current, limits);
        if (bounds && canvasHandleRef.current) {
            const w = Math.max(1, bounds.xMax - bounds.xMin);
            const h = Math.max(1, bounds.yMax - bounds.yMin);
            const centerX = (bounds.xMax + bounds.xMin) / 2;
            const centerY = (bounds.yMax + bounds.yMin) / 2;
            
            const canvas = canvasHandleRef.current.getCanvasSize();
            const ts_scale = settingsRef.current.drawingScale;
            const padding = 1.15;
            
            const scale = Math.min(canvas.width / (w * padding * ts_scale), canvas.height / (h * padding * ts_scale));
            
            setView({ scale, originX: -centerX * scale * ts_scale, originY: centerY * scale * ts_scale });
            setLogMessage(`VOX_Z-${act === 'zoomAll' ? 'A' : 'E'}: [${w.toFixed(2)} x ${h.toFixed(2)}]`);
        } else {
            setView({ scale: 1, originX: 0, originY: 0 });
            setLogMessage(`VOX_Z-${act === 'zoomAll' ? 'A' : 'E'}: (Empty drawing)`);
        }
        break;
      }
      case 'zoomIn': 
      case 'zoomOut': {
        const factor = act === 'zoomIn' ? 1.5 : 1 / 1.5;
        setView(v => {
            const canvasSize = canvasHandleRef.current?.getCanvasSize() || { width: 800, height: 600 };
            const ts = v.scale * settingsRef.current.drawingScale;
            // Center of the canvas in world space
            const cx = -v.originX / ts;
            const cy = v.originY / ts;
            
            const newScale = v.scale * factor;
            const newTs = newScale * settingsRef.current.drawingScale;
            
            return {
                ...v,
                scale: newScale,
                originX: -cx * newTs,
                originY: cy * newTs
            };
        });
        break;
      }
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
            handleOpenFile(file.name, content, "external/sd-card");
        };
        openInput.click();
        break;
      case 'rename': {
        const oldName = currentFileName;
        let newName = payload;
        if (newName && !newName.toLowerCase().endsWith('.vox') && !newName.toLowerCase().endsWith('.dxf')) {
          newName += '.vox';
        }
        if (!newName || oldName === newName) return;

        // Migrate storage via IndexedDB
        storageService.renameLarge(`${STORAGE_PREFIX}${oldName}`, `${STORAGE_PREFIX}${newName}`);
        
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
        storageService.deleteLarge(`${STORAGE_PREFIX}${payload}`);
        setLogMessage(`FILE_DELETED: ${payload}`);
        break;
      }
      case 'downloadRecent': {
        storageService.loadLarge(`${STORAGE_PREFIX}${payload}`).then(data => {
            if (data) {
                const blob = new Blob([JSON.stringify(data)], { type: 'application/x-vox' });
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
        });
        break;
      }
      case 'openRecent': {
        if (payload === currentFileName) {
            setActivePanel('none');
            return;
        }
        
        if (loadingFile) return;
        setLoadingFile(true);
        setLoadingStatus("PREPARING WORKSPACE...");

        setTimeout(async () => {
          try {
            setLoadingStatus("SAVING CURRENT STATE...");
            // Save current work before switching safely
            const oldState = {
              layers: JSON.parse(JSON.stringify(layersRef.current)),
              layerConfig: layerConfigRef.current,
              settings: settingsRef.current,
              fileName: currentFileName
            };
            await storageService.saveLarge(`${STORAGE_PREFIX}${currentFileName}`, oldState);
            await storageService.saveActiveWorkspace(oldState);

            setLoadingStatus(`OPENING ${payload}...`);
            await new Promise(r => setTimeout(r, 50)); // Allow UI to breathe

            let data = await storageService.loadLarge<any>(`${STORAGE_PREFIX}${payload}`);
            
            // Self-repair: If it's a sample and missing, recreate it
            if (!data) {
                const samples = ["1.vox", "2.vox", "3.vox"];
                const sampleIdx = samples.indexOf(payload);
                if (sampleIdx !== -1) {
                    setLoadingStatus(`REPAIRING ${payload}...`);
                    const sampleLayers = { 
                        '0': [
                            { id: `repair-${payload}-${Date.now()}`, type: 'circle', x: 200 * (sampleIdx+1), y: 200 * (sampleIdx+1), radius: 50 * (sampleIdx+1), color: '#00bcd4', layer: '0' } as Shape
                        ], 
                        'defpoints': [] 
                    };
                    data = {
                        layers: sampleLayers,
                        layerConfig: INITIAL_LAYERS_CONFIG,
                        settings: INITIAL_SETTINGS,
                        fileName: payload
                    };
                    await storageService.saveLarge(`${STORAGE_PREFIX}${payload}`, data);
                }
            }

            if (!data) {
              // If still missing (not a sample), clean up registry
              setRecentFiles(prev => {
                const updated = prev.filter(f => f.name !== payload);
                localStorage.setItem(REGISTRY_KEY, JSON.stringify(updated));
                return updated;
              });
              throw new Error("FILE_DATA_NOT_FOUND");
            }

            setLoadingStatus("PARSING GEOMETRY...");
            await new Promise(r => setTimeout(r, 50));

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
            
            setLogMessage(`INFO: OPENED_${payload}`);
            setActivePanel('none');
          } catch (e) {
            const errorMsg = (e as Error).message;
            console.error("Load failed", e);
            if (errorMsg === "FILE_DATA_NOT_FOUND") {
                setLogMessage(`ERR: FILE_NOT_FOUND_IN_STORAGE`);
            } else {
                setLogMessage(`ERR: LOAD_FAILED_${errorMsg}`);
            }
          } finally {
            setLoadingFile(false);
            setLoadingStatus("");
          }
        }, 50);
        break;
      }

      case 'save':
      case 'saveAs':
      case 'saveas':
        if (loadingFile) return;
        setLoadingFile(true);
        setLoadingStatus("PREPARING DATA...");

        setTimeout(async () => {
          try {
            // Ensure local storage is updated first
            commitToHistory();
            
            setLogMessage(`INFO:_${act.toUpperCase()}_INITIATED`);
            const isDxfExport = payload === 'dxf';
            const finalExt = isDxfExport ? '.dxf' : '.vox';
            const isSaveAs = act.toLowerCase() === 'saveas';
            
            setLoadingStatus("ENCODING GEOMETRY...");
            await new Promise(r => setTimeout(r, 50));

            let content: string = "";
            try {
                content = shapesToDXF(Object.values(layersRef.current).flat() as Shape[], layerConfigRef.current, settingsRef.current, blocksRef.current);
                if (!content || content.length < 10) {
                    content = shapesToVox(Object.values(layersRef.current).flat() as Shape[], layerConfigRef.current, settingsRef.current, lineTypesRef.current, blocksRef.current, layoutsRef.current);
                }
            } catch (err) {
                console.error("Save content generation failed:", err);
                content = shapesToVox(Object.values(layersRef.current).flat() as Shape[], layerConfigRef.current, settingsRef.current, lineTypesRef.current, blocksRef.current, layoutsRef.current);
            }

            // Native File System Access
            let usePicker = 'showSaveFilePicker' in window;
            if (usePicker) {
                try {
                    let handle = (!isSaveAs && fileHandle) ? fileHandle : null;
                    if (!handle) {
                        setLoadingStatus("WAITING FOR USER...");
                        handle = await (window as any).showSaveFilePicker({
                            suggestedName: currentFileName.replace(/\.[^/.]+$/, "") + finalExt,
                            types: [{
                                description: isDxfExport ? 'AutoCAD DXF' : 'VoxCADD Project',
                                accept: { [isDxfExport ? 'application/dxf' : 'application/vnd.voxcadd.project']: [finalExt] }
                            }]
                        });
                    }
                    
                    setLoadingStatus("WRITING TO DISK...");
                    const writable = await handle.createWritable();
                    await writable.write(content);
                    await writable.close();
                    
                    setFileHandle(handle);
                    setCurrentFileName(handle.name);
                    updateRecentFiles(handle.name);
                    setLogMessage(`INFO:_${handle.name}_SAVED`);
                } catch (e: any) {
                    if (e.name === 'AbortError') {
                      setLogMessage("INFO: SAVE_CANCELLED");
                    } else if (e.name === 'SecurityError' || e.name === 'NotAllowedError') {
                        usePicker = false;
                    } else {
                        setLogMessage("ERR: SAVE_FAILED");
                    }
                }
            }

            if (!usePicker) {
                // Fallback for browsers without File System Access API
                let downloadName = currentFileName.replace(/\.[^/.]+$/, "") + finalExt;
                
                const performDownload = (name: string) => {
                    const mimeType = isDxfExport ? 'application/dxf' : 'application/vnd.voxcadd.project';
                    const blob = new Blob([content], { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = name;
                    document.body.appendChild(a); 
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    if (isSaveAs) {
                      setCurrentFileName(name);
                      updateRecentFiles(name);
                    } else {
                      updateRecentFiles(currentFileName);
                    }
                    setLogMessage(`INFO: DOWNLOADED_${finalExt.toUpperCase()}`);
                };

                if (isSaveAs) {
                    setPromptDialog({
                      title: 'Save As',
                      message: 'Enter filename:',
                      initialValue: downloadName,
                      type: 'prompt',
                      onConfirm: (newName) => {
                        if (newName) {
                          const finalName = newName.toLowerCase().endsWith(finalExt) ? newName : newName + finalExt;
                          performDownload(finalName);
                        } else {
                          setLogMessage("INFO: SAVE_AS_CANCELLED");
                        }
                      }
                    });
                } else {
                    performDownload(downloadName);
                }
            }
          } catch (e) {
            setLogMessage("ERR: SAVE_OPERATION_FAILED");
          } finally {
            setLoadingFile(false);
            setLoadingStatus("");
          }
        }, 50);
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
        if (loadingFile) return; 
        setLoadingFile(true);
        setLoadingStatus("GENERATING EXPORT...");
        
        const loadingTimeout = setTimeout(() => {
          if (loadingFile) {
            setLoadingFile(false);
            setLogMessage("ERR: OPERATION_TIMEOUT");
          }
        }, 60000); // 60s for share

        try {
          const isDxfExport = payload === 'dxf';
          const finalExt = isDxfExport ? '.dxf' : '.vox';
          setLoadingStatus(`COMPILING ${finalExt.substring(1).toUpperCase()} DATA...`);
          
          const content = isDxfExport 
            ? shapesToDXF(Object.values(layersRef.current).flat() as Shape[], layerConfigRef.current, settingsRef.current, blocksRef.current) 
            : shapesToVox(Object.values(layersRef.current).flat() as Shape[], layerConfigRef.current, settingsRef.current, lineTypesRef.current, blocksRef.current, layoutsRef.current);
          
          const fileName = (currentFileName.replace(/\.[^/.]+$/, "") + finalExt).replace(/[^a-zA-Z0-9.\-_]/g, '_');
          const blob = new Blob([content], { type: isDxfExport ? 'application/dxf' : 'application/octet-stream' });
          
          const shareData = {
            title: 'VoxCADD File',
            text: `File: ${currentFileName} shared from VoxCadd Professional`,
            url: window.location.href
          };

          const executeDownload = () => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setLogMessage("INFO: FILE_DOWNLOADED (SHARE_FALLBACK)");
          };

          setLoadingStatus("SHARE_INIT...");

          // 1. TRY NATIVE SHARE (Capacitor)
          if (Capacitor.isNativePlatform()) {
            try {
               setLoadingStatus("PREPARING NATIVE FILE...");
               const base64 = await blobToBase64(blob);
               const tempPath = `vox_share_${Date.now()}_${fileName}`;
               
               // Save to local cache
               await Filesystem.writeFile({
                 path: tempPath,
                 data: base64,
                 directory: Directory.Cache
               });

               // Get absolute URI for sharing
               const fileUriInfo = await Filesystem.getUri({
                 path: tempPath,
                 directory: Directory.Cache
               });

               setLoadingStatus("OPENING SHARE DIALOG...");
               await CapacitorShare.share({
                 title: shareData.title,
                 text: shareData.text,
                 url: shareData.url, // includes link too
                 files: [fileUriInfo.uri],
                 dialogTitle: "Share VoxCADD File"
               });
               
               setLogMessage("INFO: NATIVE_SHARE_COMPLETE");
               setLoadingFile(false);
               clearTimeout(loadingTimeout);
               return;
            } catch (nativeErr: any) {
               console.error("Native share failed", nativeErr);
               // fall through to web share if native fails for any reason
            }
          }

          // 2. TRY WEB SHARE API
          if (navigator.share) {
              const file = new File([blob], fileName, { type: blob.type });
              if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                   await navigator.share({ ...shareData, files: [file] });
                   setLogMessage(`SUCCESS: ${fileName.toUpperCase()}_SHARED`);
                   setLoadingFile(false);
                   clearTimeout(loadingTimeout);
                   return;
                } catch (se: any) {
                  if (se.name === 'AbortError') {
                    setLogMessage("INFO: SHARE_CANCELLED");
                    setLoadingFile(false);
                    clearTimeout(loadingTimeout);
                    return;
                  }
                  // try simple link share if file share fails
                  try {
                    await navigator.share(shareData);
                    setLogMessage("INFO: LINK_SHARED");
                  } catch (e) { /* ignore */ }
                }
              } else {
                 try {
                    await navigator.share(shareData);
                    setLogMessage("INFO: LINK_SHARED (FILE_DOWNLOADING)");
                 } catch (e) { /* ignore */ }
                 executeDownload();
              }
          } else {
              // 3. FINAL FALLBACK: Download + Clipboard
              setLogMessage("INFO: SHARING_NOT_SUPP_DOWNLOADING");
              try {
                await navigator.clipboard.writeText(window.location.href);
                setLogMessage("INFO: FILE_DOWNLOADED. LINK_COPIED.");
              } catch (e) { 
                setLogMessage("INFO: FILE_DOWNLOADED.");
              }
              executeDownload();
          }

        } catch (err: any) {
          console.error("Share system error:", err);
          setLogMessage(`ERR: SHARE_FAILED (${err.message})`);
        } finally {
          clearTimeout(loadingTimeout);
          setLoadingFile(false);
          setLoadingStatus("");
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
                    if (e.shiftKey) handleAction('saveAs');
                    else handleAction('save');
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
                    if (e.shiftKey) { 
                        // Redo logic
                        if (redoStack.length > 0) {
                            const next = redoStack[0];
                            setRedoStack(prev => prev.slice(1));
                            setHistory(prev => [...prev, layers]);
                            setLayers(next);
                            setLogMessage("REDO_ACTION_SUCCESS");
                        }
                    }
                    else handleAction('undo');
                    break;
                case 'y':
                    if (!e.shiftKey) {
                        e.preventDefault();
                        // Redo logic
                        if (redoStack.length > 0) {
                            const next = redoStack[0];
                            setRedoStack(prev => prev.slice(1));
                            setHistory(prev => [...prev, layers]);
                            setLayers(next);
                            setLogMessage("REDO_ACTION_SUCCESS");
                        }
                    }
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

    // Global Escape/Delete Key Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mtextEditor) {
          mtextEditor.callback("");
          setMtextEditor(null);
        } else if (activePanel !== 'none') {
          setActivePanel('none');
        } else if (engineRef.current?.active) {
          handleAction('cancel');
        } else if (selectedIds.length > 0) {
          setSelectedIds([]);
        }
      } else if (e.key === 'Delete' || (e.key === 'Backspace' && !isNavigatingInput())) {
        if (!engineRef.current?.active && selectedIds.length > 0) {
            handleAction('erase');
        }
      }
    };
    
    // Helper to check if we are typing in an input
    const isNavigatingInput = () => {
        const active = document.activeElement;
        return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mtextEditor, activePanel, selectedIds, handleAction]);

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
      'dim': DimensionCommand, 'dimlinear': DimensionCommand, 'aligned': DimensionCommand,
      'dimradius': DimensionCommand, 'dimdiam': DimensionCommand, 'dimord': DimensionCommand,
      'angular': DimensionCommand, 'dimarc': DimensionCommand,
      't': TextCommand, 'text': TextCommand, 
      'z': ZoomCommand, 'zoom': ZoomCommand, 'tr': TrimCommand, 'trim': TrimCommand,
      'h': HatchCommand, 'hatch': HatchCommand, 'lea': LeaderCommand, 'leader': LeaderCommand,
      'ma': MatchPropertiesCommand, 'match': MatchPropertiesCommand, 'matchprop': MatchPropertiesCommand,
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
      'import': ImportCommand, 'import_blocks': ImportCommand,
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
            'e': 'ERASE', 'erase': 'ERASE', 'del': 'ERASE',
            'ma': 'MATCHPROP', 'matchprop': 'MATCHPROP', 'match': 'MATCHPROP',
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
      let cmd;
      if (cmdKey === 'dimlinear' || cmdKey === 'dim') cmd = new DimensionCommand(engineRef.current!.ctx, 'linear');
      else if (cmdKey === 'aligned') cmd = new DimensionCommand(engineRef.current!.ctx, 'aligned');
      else if (cmdKey === 'dimradius') cmd = new DimensionCommand(engineRef.current!.ctx, 'radius');
      else if (cmdKey === 'dimdiam') cmd = new DimensionCommand(engineRef.current!.ctx, 'diameter');
      else if (cmdKey === 'dimord') cmd = new DimensionCommand(engineRef.current!.ctx, 'ordinate');
      else if (cmdKey === 'angular') cmd = new DimensionCommand(engineRef.current!.ctx, 'angular');
      else if (cmdKey === 'dimarc') cmd = new DimensionCommand(engineRef.current!.ctx, 'arc');
      else cmd = new CommandClass(engineRef.current!.ctx);
      
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
        setLayers: (cb) => setLayers(prev => {
          const next = cb(prev);
          layersRef.current = next;
          return next;
        }),
        setPreview: setPreviewShapes,
        addLog: (msg) => setLogMessage(msg),
        setMessage: (msg) => {
          if (msg === "Command Finished") { 
              setCommandPrompt("COMMAND:"); 
              setIsCommandActive(false); 
              setActiveCommandName(undefined);
              // Use a small timeout or just rely on the sync ref update we just did
              commitToHistory();
          } else setCommandPrompt(msg?.toUpperCase() || "COMMAND:");
        },
        setView: setView as any,
        getViewState: () => tabViewsRef.current[activeTabRef.current],
        getCanvasSize: () => {
          const size = canvasHandleRef.current?.getCanvasSize();
          return size || { width: window.innerWidth, height: window.innerHeight };
        },
        getActiveViewport: () => {
          const layout = layoutsRef.current.find(l => l.id === activeTabRef.current);
          return layout?.viewports.find(v => v.id === activeViewportIdRef.current);
        },
        onFinish: () => { 
          setPreviewShapes(null); 
          setCommandPrompt("COMMAND:"); 
          setIsCommandActive(false); 
          setShowCircleOptions(false);
          setShowArcOptions(false);
          setShowEllipseOptions(false);
          setActiveCommandName(undefined);
          commitToHistory(); 
        },
        lastMousePoint: { x: 0, y: 0 },
        getBlocks: () => blocksRef.current,
        setBlocks: (cb) => setBlocks(prev => {
          const next = cb(prev);
          blocksRef.current = next;
          return next;
        }),
        getLayouts: () => layoutsRef.current,
        setLayouts: (cb) => setLayouts(prev => {
          const next = typeof cb === 'function' ? (cb as any)(prev) : cb;
          layoutsRef.current = next;
          return next;
        }),
        getActiveTab: () => activeTabRef.current,
        start: (cmd: CADCommand) => { setActiveCommandName(cmd.name); engineRef.current?.start(cmd); },
        onExternalRequest: (type, data, cb: (res: any, props?: any) => void) => {
            if (type === 'set_active_tab') {
                setActiveTab(data);
                cb(true);
            }
            if (type === 'mtext_editor') {
                setMtextEditor({ initialValue: data || "", callback: cb });
            } else if (type === 'hatch_selector') {
                setHatchSelector({ callback: cb });
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

  const handleViewportToggle = (x_screen?: number, y_screen?: number) => {
    if (activeTab === 'model') return;

    if (isViewportActive && x_screen !== undefined && y_screen !== undefined) {
      // If we are already in a viewport, check if we clicked the same one or another one
      const index = layouts.findIndex(l => l.id === activeTab);
      if (index !== -1) {
        const layout = layouts[index];
        const view = tabViews[activeTab] || { scale: 1, originX: 0, originY: 0 };
        const ts = view.scale * settings.drawingScale;
        const canvas = canvasHandleRef.current?.getCanvasSize() || { width: 800, height: 600 };
        const w = canvas.width, h = canvas.height;
        const px = (x_screen - w/2 - view.originX) / ts;
        const py = -(y_screen - h/2 - view.originY) / ts;
        const papX = px + layout.paperSize.width/2;
        const papY = -py + layout.paperSize.height/2;

        const targetVp = layout.viewports.find(vp => 
          papX >= vp.x && papX <= vp.x + vp.width &&
          papY >= vp.y && papY <= vp.y + vp.height
        );

        if (targetVp && targetVp.id !== activeViewportId) {
          // Switch to another viewport
          setActiveViewportId(targetVp.id);
          return;
        }
      }
      
      // Default: exit viewport
      setIsViewportActive(false);
      setActiveViewportId(null);
      setLogMessage("PAPER_SPACE_ACTIVE");
    } else if (x_screen !== undefined && y_screen !== undefined) {
      // We are entering a viewport
      const index = layouts.findIndex(l => l.id === activeTab);
      if (index !== -1) {
        const layout = layouts[index];
        
        // Find which viewport was clicked
        // Need to map screen to paper units
        const view = tabViews[activeTab] || { scale: 1, originX: 0, originY: 0 };
        const ts = view.scale * settings.drawingScale;
        const canvas = canvasHandleRef.current?.getCanvasSize() || { width: 800, height: 600 };
        const w = canvas.width, h = canvas.height;
        
        // screenToWorld for layout:
        const px = (x_screen - w/2 - view.originX) / ts;
        const py = -(y_screen - h/2 - view.originY) / ts;
        
        // Paper coords (0,0 is center of paper)
        // Convert to (0,0 is top-left of paper)
        const papX = px + layout.paperSize.width/2;
        const papY = -py + layout.paperSize.height/2;

        let targetVp = layout.viewports.find(vp => 
          papX >= vp.x && papX <= vp.x + vp.width &&
          papY >= vp.y && papY <= vp.y + vp.height
        );

        if (!targetVp && layout.viewports.length === 0) {
          // Create default if none exist
          const margin = 10;
          const vw = layout.paperSize.width - margin * 2;
          const vh = layout.paperSize.height - margin * 2;
          const vpId = 'vp_' + Date.now();
          
          const bounds = getAllShapesBounds(layers, blocks);
          let initialViewState = { scale: 0.05, originX: 0, originY: 0 };
          if (bounds) {
            const bw = Math.max(1, bounds.xMax - bounds.xMin);
            const bh = Math.max(1, bounds.yMax - bounds.yMin);
            const bcx = (bounds.xMax + bounds.xMin) / 2;
            const bcy = (bounds.yMax + bounds.yMin) / 2;
            const vScale = Math.min(vw / (bw * 1.1), vh / (bh * 1.1));
            initialViewState = { scale: vScale, originX: -bcx * vScale, originY: bcy * vScale };
          }

          const defaultViewport: LayoutViewport = {
            id: vpId,
            x: margin, y: margin, width: vw, height: vh,
            viewState: initialViewState
          };
          const newLayouts = [...layouts];
          newLayouts[index] = { ...layout, viewports: [defaultViewport] };
          setLayouts(newLayouts);
          setIsViewportActive(true);
          setActiveViewportId(vpId);
          setLogMessage("MODEL_SPACE_ACTIVE (VP)");
          return;
        }

        if (targetVp) {
          setIsViewportActive(true);
          setActiveViewportId(targetVp.id);
          setLogMessage("MODEL_SPACE_ACTIVE (VP)");
        }
      }
    }
  };

  const onCanvasClick = (x: number, y: number, snapped: boolean) => {
    // If no command is active and we have a selection, check for grips first
    if (engineRef.current && !engineRef.current.active && selectedIds.length > 0) {
        const ts = view.scale * settings.drawingScale;
        const threshold = 12 / ts;
        const allShapes = Object.values(layers).flat() as Shape[];
        const selectedShapes = allShapes.filter(s => selectedIds.includes(s.id));
        
        for (const s of selectedShapes) {
            const gripIdx = hitTestGrip({x, y}, s, threshold);
            if (gripIdx !== -1) {
                if (navigator.vibrate) navigator.vibrate(20);
                engineRef.current.start(new GripEditCommand(engineRef.current.ctx, { shapeId: s.id, gripIndex: gripIdx }));
                return;
            }
        }
    }

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
    { id: 'calculator', icon: Calculator, action: 'toggleCalculator', activeOn: 'calculator' },
    { id: 'glossary', icon: Cpu, action: 'toggleGlossary', activeOn: 'glossary' }
  ];

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-black text-neutral-300 overflow-hidden select-none">
      {isAppLoading && <LoadingScreen onComplete={() => setIsAppLoading(false)} />}
      <header className="h-10 flex items-center justify-between px-4 shrink-0 bg-black border-b border-white/5 z-[110]">
        <div className="flex items-center gap-3 shrink-0">
          <VoxIcon size={22} className="text-cyan-400" />
          <div className="flex items-center gap-2">
            <div className="flex items-baseline gap-1 leading-none">
              <span className="font-black text-[15px] uppercase tracking-tighter text-white">VOX</span>
              <span className="font-normal text-[15px] uppercase tracking-tighter text-cyan-500">CADD</span>
            </div>
            <div className="text-[7px] font-black text-neutral-600 uppercase tracking-[0.2em] bg-white/5 px-1.5 py-0.5 rounded-sm border border-white/5">V-1.0.1</div>
          </div>
        </div>

        <button onClick={() => handleAction('toggleMainMenu')} className="p-2 transition-all text-white no-tap hover:text-cyan-400">
          <Menu size={18} />
        </button>
      </header>

      <div className="h-6.5 bg-[#0a0a0c] border-b border-white/5 flex items-center px-4 z-[100] shrink-0 gap-3">
          <div className="relative h-full flex items-center">
            <button 
              onClick={() => { setFileMenuOpen(!fileMenuOpen); setFileNameMenuOpen(false); }}
              className={`text-[9px] font-black uppercase transition-colors flex items-center gap-1.5 ${fileMenuOpen ? 'text-cyan-400' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              {fileMenuOpen ? <RotateCw size={10} className="animate-spin-slow" /> : <FolderOpen size={10} />}
            </button>
            {fileMenuOpen && (
              <>
                <div className="fixed inset-0 z-[200]" onClick={() => setFileMenuOpen(false)} />
                <div className="absolute top-full left-0 mt-2 bg-[#0a0a0c]/98 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 flex flex-col gap-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[201] min-w-[220px] animate-in zoom-in-95 fade-in slide-in-from-top-3 duration-200">
                  <div className="px-3 py-1.5 border-b border-white/5 mb-1">
                    <div className="text-[7.5px] font-black uppercase text-cyan-500 tracking-widest">Recent Documents</div>
                  </div>
                  <div className="max-h-[240px] overflow-y-auto overflow-x-hidden scrollbar-none flex flex-col gap-1">
                    {recentFiles.length > 0 ? recentFiles.map(file => {
                      const fileName = typeof file === 'string' ? file : file.name;
                      return (
                        <div key={fileName} className="flex items-center gap-1">
                            <button 
                              onClick={() => {
                                handleAction('openRecent', fileName);
                                setFileMenuOpen(false);
                              }}
                              className={`flex-1 text-left px-3 py-2.5 rounded-xl text-[10.5px] font-bold uppercase transition-all truncate group active:scale-95 ${fileName === currentFileName ? 'text-cyan-400 bg-cyan-400/5' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
                            >
                              {fileName}
                            </button>
                            <button 
                              onClick={() => handleAction('downloadRecent', fileName)}
                              className="p-2 text-neutral-600 hover:text-cyan-400 transition-colors"
                            >
                              <Save size={14} />
                            </button>
                        </div>
                      );
                    }) : (
                      <div className="px-3 py-4 text-[9px] text-neutral-600 uppercase text-center font-bold tracking-tighter">No Recent Files</div>
                    )}
                  </div>
                  <div className="h-px bg-white/5 my-1" />
                  <div className="grid grid-cols-3 gap-1 px-1">
                    <button 
                      onClick={() => { handleAction('new'); setFileMenuOpen(false); }}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl text-neutral-500 hover:bg-white/5 hover:text-cyan-400 transition-all group"
                    >
                      <FilePlus size={16} />
                      <span className="text-[7px] font-black uppercase">New</span>
                    </button>
                    <button 
                      onClick={() => { handleAction('open'); setFileMenuOpen(false); }}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl text-neutral-500 hover:bg-white/5 hover:text-cyan-400 transition-all"
                    >
                      <FolderOpen size={16} />
                      <span className="text-[7px] font-black uppercase">Open</span>
                    </button>
                    <button 
                      onClick={() => { handleAction('save'); setFileMenuOpen(false); }}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl text-neutral-500 hover:bg-white/5 hover:text-cyan-400 transition-all"
                    >
                      <Save size={16} />
                      <span className="text-[7px] font-black uppercase">Save</span>
                    </button>
                  </div>
                  <div className="h-px bg-white/5 my-1" />
                  <button 
                    onClick={() => { handleAction('saveAs'); setFileMenuOpen(false); }}
                    className="w-full text-left px-3 py-3 rounded-xl text-[10px] text-neutral-400 hover:bg-white/10 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                  >
                    <Share2 size={16} className="text-cyan-500" /> Save As...
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="w-px h-3 bg-white/5" />

          <button 
            ref={fileNameBtnRef}
            onClick={() => { 
              if (blockNextClick.current) { blockNextClick.current = false; return; }
              if(navigator.vibrate) navigator.vibrate(5); toggleFileNameMenu(); 
            }}
            className={`text-[10px] font-mono tracking-tight transition-colors no-tap font-bold ${fileNameMenuOpen ? 'text-cyan-400' : 'text-neutral-600 hover:text-cyan-400'}`}
          >
            {currentFileName}
          </button>
      </div>

      <div className="h-7 bg-black border-b border-white/5 flex items-center px-4 z-[99] shrink-0 gap-0 overflow-x-auto no-scrollbar scroll-smooth">
          {['FILE', 'EDIT', 'VIEW', 'DRAW', 'MODIFY', 'ANNO', 'TOOLS'].map((item, index) => {
            const isSelected = 
              (item === 'FILE' && (activePanel === 'drawing_props' || activePanel === 'file')) ||
              (item === 'TOOLS' && activeCategory === 'Tools') || 
              (item === 'EDIT' && activeCategory === 'Edit') || 
              (item === 'ANNO' && activeCategory === 'Anno') || 
              activeCategory.toUpperCase() === item;
              
            return (
              <button 
                key={item} 
                onClick={() => { 
                  if (blockNextClick.current) { blockNextClick.current = false; return; }
                  if (navigator.vibrate) navigator.vibrate(5);
                  if (item === 'FILE') handleAction('openFileManager'); 
                  else if (item === 'EDIT') setActiveCategory('Edit'); 
                  else if (item === 'VIEW') setActiveCategory('View'); 
                  else if (item === 'DRAW') setActiveCategory('Draw'); 
                  else if (item === 'MODIFY') setActiveCategory('Modify'); 
                  else if (item === 'ANNO') setActiveCategory('Anno'); 
                  else if (item === 'TOOLS') setActiveCategory('Tools'); 
                }} 
                className={`text-[9.5px] font-black tracking-widest transition-all no-tap whitespace-nowrap h-full flex items-center relative active:bg-white/5 ${
                  isSelected 
                    ? 'text-cyan-400' 
                    : 'text-neutral-500 hover:text-neutral-400'
                } ${index === 0 ? 'pr-2' : 'px-2'}`}
              >
                <div className="h-full flex flex-col justify-center items-center px-1">
                  <span className="mt-1">{item}</span>
                  {isSelected && (
                      <motion.div 
                      layoutId="tab-underline"
                      className="w-full h-[1.5px] bg-cyan-400 mt-0.5 rounded-full"
                    />
                  )}
                </div>
              </button>
            );
          })}
      </div>


      <main className="flex-1 relative bg-black overflow-hidden border border-neutral-800/40">
        <motion.div 
          animate={{ 
            scale: loadingFile ? 0.98 : 1, 
            opacity: loadingFile ? 0.3 : 1, 
            filter: loadingFile ? 'blur(10px)' : 'blur(0px)' 
          }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="w-full h-full"
        >
          <CADCanvas 
            ref={canvasHandleRef} 
            layers={layers} 
            blocks={blocks}
            lineTypes={lineTypes}
            layouts={layouts}
            layerConfig={layerConfig} 
            view={view} 
            setView={setView as any} 
            settings={settings} 
            isCommandActive={isCommandActive} 
            activeTab={activeTab} 
            isViewportActive={isViewportActive} 
            activeViewportId={activeViewportId}
            onViewportToggle={handleViewportToggle} 
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
            setLogMessage={setLogMessage}
          />
        </motion.div>
        
        <div className="absolute top-3 left-3 pointer-events-none flex items-center gap-3">
            <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-md px-2 py-0.5 flex items-center gap-1.5">
                <span className="text-[7px] font-mono text-neutral-500 uppercase tracking-widest flex items-center">PRECISION: <span className="text-[#00bcd4] ml-1">{settings.precision}</span></span>
                <span className="w-[1px] h-2.5 bg-white/10" />
                <span className="text-[7px] font-mono text-neutral-500 uppercase tracking-widest flex items-center">SNAP: <span className={settings.snap ? 'text-[#00bcd4] ml-1' : 'text-neutral-600 ml-1'}>{settings.snap ? 'ON' : 'OFF'}</span></span>
            </div>
            {logMessage && (
                <span className={`text-[7px] font-mono uppercase tracking-widest font-black whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300 ${
                  logMessage.startsWith('ERR:') ? 'text-red-500' : 
                  logMessage.startsWith('WARN:') ? 'text-amber-500' : 
                  'text-[#00bcd4]'
                }`}>
                  {logMessage.replace(/^(ERR:|WARN:|INFO:)/, '').replace(/_/g, ' ')}
                </span>
            )}
        </div>

        <div className="absolute right-3 top-3 flex flex-col gap-2 z-10">
          {sidebarButtons.map(p => (
            <button key={p.id} onClick={() => { if(navigator.vibrate) navigator.vibrate(5); handleAction(p.action); }} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border no-tap ${activePanel === p.activeOn ? 'bg-[#00bcd4] text-black border-[#00bcd4]' : 'bg-black/60 backdrop-blur-sm border-white/10 text-neutral-400 hover:text-[#00bcd4] hover:border-[#00bcd4] hover:bg-[#00bcd4]/5'}`}><p.icon size={16} /></button>
          ))}
        </div>

        {activePanel === 'layers' && (
          <LayerManager 
            layers={layerConfig} 
            activeLayer={settings.currentLayer} 
            onClose={() => setActivePanel('none')} 
            onUpdateLayer={(id, upd) => setLayerConfig(prev => ({...prev, [id]: {...prev[id], ...upd} }))} 
            onAddLayer={(name) => { 
                const id = generateId(); 
                setLayerConfig(prev => ({...prev, [id]: { id, name, visible: true, locked: false, frozen: false, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' }})); 
                setLayers(prev => ({ ...prev, [id]: [] }));
            }} 
            onRemoveLayer={(id) => {
                if (id === '0' || id === 'defpoints') return;
                setPromptDialog({
                  title: 'Delete Layer',
                  message: `Delete layer "${layerConfig[id]?.name}" and all shapes in it?`,
                  initialValue: '',
                  type: 'confirm',
                  onConfirm: () => {
                    setLayerConfig(prev => { const n = {...prev}; delete n[id]; return n; });
                    setLayers(prev => { const n = {...prev}; delete n[id]; return n; });
                    if (settings.currentLayer === id) {
                        setSettings(s => ({ ...s, currentLayer: '0' }));
                    }
                    setLogMessage(`LAYER_REMOVED: ${layerConfig[id]?.name}`);
                  }
                });
            }} 
            onSetActive={(id) => {
                if(navigator.vibrate) navigator.vibrate(5);
                setSettings(s => ({ ...s, currentLayer: id }));
                // Automatically turn on and thaw the layer if it becomes current
                setLayerConfig(prev => ({
                    ...prev,
                    [id]: { ...prev[id], visible: true, frozen: false }
                }));
            }} 
          />
        )}
        {activePanel === 'properties' && <PropertiesPanel selectedShapes={(Object.values(layers).flat() as Shape[]).filter(s => selectedIds.includes(s.id))} onUpdateShape={(id, upd) => setLayers(prev => { const n = {...prev}; Object.keys(n).forEach(l => n[l] = n[l].map(s => s.id === id ? {...s, ...upd} : s)); return n; })} layers={layerConfig} settings={settings} onUpdateSettings={(upd) => setSettings(s => ({...s, ...upd}))} onCommand={executeCommand} onClose={() => setActivePanel('none')} />}
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
        {activePanel === 'glossary' && <InfoPanel type="glossary" onSwitch={(t) => setActivePanel(t)} onClose={() => setActivePanel('none')} />}
        {activePanel === 'new_file' && <NewFileDialog onSelect={(cfg) => { 
            const name = cfg.name + '.vox';
            setLayers({ '0': [], 'defpoints': [] }); 
            setSettings(s => ({
              ...s, 
              units: cfg.units, 
              unitSubtype: cfg.subUnit,
              precision: cfg.precision,
              linearFormat: cfg.linearFormat,
              angularFormat: cfg.angularFormat,
              anglePrecision: cfg.anglePrecision
            })); 
            setCurrentFileName(name); 
            setActivePanel('none'); 
            updateRecentFiles(name);
            commitToHistory();
        }} onClose={() => setActivePanel('none')} />}
        {activePanel === 'dimstyle' && <DimStyleManager settings={settings} onUpdateSettings={setSettings} onClose={() => setActivePanel('none')} />}
        {mtextEditor && (
          <MTextEditor 
            initialValue={mtextEditor.initialValue} 
            initialSettings={{
              size: settings.textSize,
              rotation: settings.textRotation,
              justification: settings.textJustification as any
            }}
            onSave={(text, props) => {
              // Update app settings for next time
              setSettings(s => ({
                ...s, 
                textSize: props.size, 
                textRotation: props.rotation,
                textJustification: props.justification,
                textBold: props.bold,
                textItalic: props.italic,
                textUnderline: props.underline,
                textHighlight: props.highlight,
                fontFamily: props.fontFamily
              }));
              // Pass values to callback for current command
              mtextEditor.callback(text, props);
              setMtextEditor(null);
            }}
            onCancel={() => {
              mtextEditor.callback("");
              setMtextEditor(null);
            }}
          />
        )}
        {hatchSelector && (
          <HatchPatternSelector 
            onSelect={(pattern) => {
              hatchSelector.callback(pattern);
              setHatchSelector(null);
            }}
            onCancel={() => {
              hatchSelector.callback("");
              setHatchSelector(null);
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

      <div className="h-7 bg-[#0a0a0c] border-t border-white/5 flex items-center shrink-0 cursor-default select-none relative z-[150]">
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
        <div className="flex-1 flex items-center h-full overflow-x-auto scrollbar-none gap-px touch-pan-x overscroll-x-contain">
          {layouts.map(l => (
            <button 
              key={l.id}
              draggable
              onDragStart={() => handleDragStart(l.id)}
              onDragOver={(e) => { 
                e.preventDefault(); 
                // Requirement: listen for drag operations on layout tabs
                handleDragOverTab(l.id); 
              }}
              onDrop={() => setDraggedLayoutId(null)}
              onClick={() => {
                if (blockNextClick.current) {
                  blockNextClick.current = false;
                  return;
                }
                if (longPressTimer.current) {
                  clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
                }
                setActiveTab(l.id);
              }} 
              onMouseDown={(e) => handleLayoutLongPress(e, l.id)}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onTouchStart={(e) => handleLayoutLongPress(e, l.id)}
              onTouchMove={cancelLongPress}
              onTouchEnd={cancelLongPress}
              onTouchCancel={cancelLongPress}
              className={`h-full px-2.5 text-[9px] font-black uppercase transition-all flex items-center gap-1 whitespace-nowrap group relative ${activeTab === l.id ? 'text-[#00bcd4] bg-white/5 border-b-[1.5px] border-[#00bcd4]' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              <Layers2 size={9} /> {l.name}
            </button>
          ))}
        </div>
      </div>

      {fileNameMenuOpen && (
        <>
          <div className="fixed inset-0 z-[1050]" onClick={() => setFileNameMenuOpen(false)} />
          <div 
              ref={fileNameMenuRef}
              className="fixed bg-[#0a0a0c]/98 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 flex flex-col gap-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[1100] animate-in zoom-in-95 fade-in slide-in-from-top-4 duration-200 min-w-[180px]"
              style={{ 
                  left: Math.max(10, Math.min(fileNameMenuPos.x - 90, window.innerWidth - 190)), 
                  top: fileNameMenuPos.y + 12
              }}
          >
            <div className="px-3 py-2 mb-2 bg-[#00bcd4]/5 border border-[#00bcd4]/20 rounded-xl">
              <div className="text-[7px] font-black text-[#00bcd4]/50 mb-1 tracking-widest uppercase">System Path</div>
              <div className="text-[9px] text-neutral-200 font-mono flex items-center gap-2">
                <HardDrive size={10} className="text-[#00bcd4]" />
                <span className="truncate">STORAGE:/{currentFileName}</span>
              </div>
            </div>
            <button 
              onClick={() => {
                setPromptDialog({
                  title: 'Rename Project',
                  message: 'Enter new project name:',
                  initialValue: currentFileName,
                  type: 'prompt',
                  onConfirm: (newName) => {
                    if (newName && newName !== currentFileName) {
                      handleAction('rename', newName);
                    }
                  }
                });
                setFileNameMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
            >
              <FileEdit size={14} className="text-cyan-500" /> Rename
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleAction('saveAs');
                setFileNameMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
            >
              <Save size={14} className="text-cyan-500" /> Save As
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleAction('share');
                setFileNameMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
            >
              <Share2 size={14} className="text-cyan-500" /> Share File
            </button>
            <div className="h-px bg-white/5 my-1" />
            <button 
               onClick={() => {
                 handleAction('close');
                 setFileNameMenuOpen(false);
               }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-red-500/80 hover:bg-red-500 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
            >
              <XCircle size={14} /> Close File
            </button>
          </div>
        </>
      )}

      {layoutContextMenu && (
        <>
          <div className="fixed inset-0 z-[1050]" onClick={() => setLayoutContextMenu(null)} />
          <div 
            ref={layoutContextMenuRef}
            className="fixed bg-[#0a0a0c]/98 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 flex flex-col gap-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[1100] animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-200 min-w-[180px]"
            style={{ 
              left: Math.max(10, Math.min(layoutContextMenu.x - 90, window.innerWidth - 190)), 
              bottom: (window.innerHeight - layoutContextMenu.y) + 8
            }}
          >
            <div className="px-3 py-1.5 border-b border-white/5 mb-1 text-center">
              <div className="text-[8px] font-black uppercase text-cyan-500 tracking-widest">Layout Options</div>
            </div>
            
            <button onClick={() => renameLayout(layoutContextMenu.layoutId)} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
              <FileEdit size={14} className="text-cyan-500" /> Rename
            </button>
            <button onClick={() => updateLayoutProperties(layoutContextMenu.layoutId)} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
              <Sliders size={14} className="text-cyan-500" /> Properties
            </button>
            <button onClick={() => duplicateLayout(layoutContextMenu.layoutId)} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
              <Layers2 size={14} className="text-cyan-500" /> Duplicate
            </button>
            <button onClick={importLayout} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
              <FilePlus size={14} className="text-cyan-500" /> Import
            </button>

            <div className="h-px bg-white/5 my-1" />
            
            <button onClick={() => moveLayout(layoutContextMenu.layoutId, 'left')} className="w-full text-left px-3 py-2 rounded-xl text-[9px] text-neutral-500 hover:bg-white/5 hover:text-white transition-all font-black uppercase flex items-center gap-3 active:scale-95">
              <Target size={14} className="-rotate-90 opacity-70" /> Move Left
            </button>
            <button onClick={() => moveLayout(layoutContextMenu.layoutId, 'right')} className="w-full text-left px-3 py-2 rounded-xl text-[9px] text-neutral-500 hover:bg-white/5 hover:text-white transition-all font-black uppercase flex items-center gap-3 active:scale-95">
              <Target size={14} className="rotate-90 opacity-70" /> Move Right
            </button>

            <div className="h-px bg-white/5 my-1" />
            
            <button onClick={() => deleteLayout(layoutContextMenu.layoutId)} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-red-500/80 hover:bg-red-500 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
              <X size={14} /> Delete
            </button>
            <button onClick={deleteAllLayouts} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-red-500/50 hover:bg-red-600 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
              <XCircle size={14} /> Delete All
            </button>
          </div>
        </>
      )}

      <footer className="bg-black shrink-0 pb-[env(safe-area-inset-bottom)]">
        <Toolbar 
            category={activeCategory} 
            settings={settings} 
            activePanel={activePanel}
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
            
            // Collect metadata for Gemini
            const totalEntities = (Object.values(layersRef.current).flat() as Shape[]).length;
            const context = `
              Units: ${settingsRef.current.units} (${settingsRef.current.unitSubtype})
              Active Layer: ${settingsRef.current.currentLayer}
              Total Entities: ${totalEntities}
              Viewport: scale=${view.scale}, origin=${view.originX},${view.originY}
              Last Mouse: ${engineRef.current?.ctx.lastMousePoint.x.toFixed(0)},${engineRef.current?.ctx.lastMousePoint.y.toFixed(0)}
            `;

            try {
              const res = await getCommandFromAI(q, context, sketch, aiConversation.slice(-6)); 
              
              // Update AI conversation history
              setAiConversation(prev => [
                ...prev,
                { role: 'user', parts: [{ text: q }] },
                { role: 'model', parts: [{ text: JSON.stringify({ explanation: res.text, commands: res.commands }) }] }
              ].slice(-10)); // Keep last 5 rounds

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
          prompt={commandPrompt} 
          history={commandHistory}
          value={commandInput} 
          onChange={setCommandInput} 
        />
      </footer>
      <AnimatePresence>
        {loadingFile && (
          <motion.div 
            key="vox-loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-[1000] backdrop-blur-2xl transition-all duration-700"
          >
             <div className="relative mb-10 overflow-hidden">
               <motion.div 
                 animate={{ rotate: 360 }}
                 transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                 className="w-20 h-20 rounded-full border-2 border-white/5 border-t-cyan-500 shadow-[0_0_30px_rgba(34,211,238,0.2)]"
               />
               <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-2 h-2 bg-cyan-500 rounded-full shadow-[0_0_15px_cyan]" 
                  />
               </div>
             </div>
             <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.2 }}
               className="text-cyan-400 font-mono text-[10px] tracking-[0.5em] font-black uppercase px-8 text-center"
             >
               {loadingStatus || "INITIALIZING PROJECT..."}
             </motion.div>
             <div className="mt-8 flex items-center gap-3">
               <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-white/10" />
               <div className="text-white/10 font-mono text-[7px] uppercase tracking-widest font-black italic">VoxCADD Kernel Phase 4</div>
               <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-white/10" />
             </div>
          </motion.div>
        )}
      </AnimatePresence>
      {importSummary && (
        <ImportSummaryDialog 
          isOpen={!!importSummary}
          onClose={() => setImportSummary(null)}
          fileName={importSummary.fileName}
          stats={importSummary.stats}
        />
      )}
      
      {promptDialog && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
           <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPromptDialog(null)} />
           <div className="relative w-full max-w-sm bg-[#0a0a0c] border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-2">{promptDialog.title}</h3>
              <p className="text-neutral-500 text-[10px] mb-6">{promptDialog.message}</p>
              
              {promptDialog.type === 'prompt' && (
                <input 
                  type="text" 
                  autoFocus
                  name={`vox-prompt-${Date.now()}`}
                  defaultValue={promptDialog.initialValue}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                       promptDialog.onConfirm(e.currentTarget.value);
                       setPromptDialog(null);
                    } else if (e.key === 'Escape') {
                       setPromptDialog(null);
                    }
                  }}
                  id="prompt-input"
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  data-lpignore="true"
                  data-form-type="other"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-bold focus:outline-none focus:border-cyan-500/50 transition-all mb-6"
                />
              )}
              
              <div className="flex gap-3">
                 <button onClick={() => setPromptDialog(null)} className="flex-1 py-3 rounded-xl bg-white/5 text-neutral-400 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95">Cancel</button>
                 <button 
                   onClick={() => {
                     const val = (document.getElementById('prompt-input') as HTMLInputElement)?.value || '';
                     setPromptDialog(null);
                     setTimeout(() => {
                        promptDialog.onConfirm(val);
                     }, 10);
                   }} 
                   className="flex-1 py-3 rounded-xl bg-cyan-500 text-black text-[9px] font-black uppercase tracking-widest hover:bg-cyan-400 transition-all active:scale-95"
                 >
                   {promptDialog.type === 'confirm' ? 'Confirm Action' : 'Confirm'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
export default App;
