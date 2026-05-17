
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
import GlobalCommandPalette from './GlobalCommandPalette';
import { COMMAND_LIST } from './CommandBar';
import NewFileDialog from './NewFileDialog';
import HatchPatternSelector from './HatchPatternSelector';
import LineTypeManager from './LineTypeManager';
import MTextEditor from './MTextEditor';
import DimensionStyleManager from './DimStyleManager'; // Assuming it's already imported
import ColorSelector from './ColorSelector';
import CtbManager from './CtbManager';
import LoadingScreen from './LoadingScreen';
import OfflineIndicator from './OfflineIndicator';
import { useSession } from './SessionContext';
import { Share as CapacitorShare } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { generateId, hitTestGrip, getAllShapesBounds, getShapeBounds, scaleShape } from '../services/cadService';
import { getCommandFromAI, connectLiveAgent } from '../services/geminiService';
import { shapesToDXF, dxfToProject } from '../services/dxfService';
import { shapesToVox, voxToProject, createEmptyVoxProject } from '../services/voxService';
import { dwgToProject } from '../services/DwgService';
import { 
  CADCommand, CommandEngine, LineCommand, DoubleLineCommand, CircleCommand, RectCommand, PolyCommand, 
  ArcCommand, MoveCommand, EraseCommand, DistanceCommand, AreaCommand, 
  DimensionCommand, TextCommand, MTextCommand, ZoomCommand, ZoomRealTimeCommand, 
  RotateCommand, ScaleCommand, MirrorCommand, CopyCommand,
  ExtendCommand, ExplodeCommand, JoinCommand, BreakCommand, BreakAtPointCommand,
  RayCommand, XLineCommand,
  HatchCommand, LeaderCommand, PanCommand, OffsetCommand, TrimCommand, FilletCommand, ChamferCommand, EllipseCommand, PolygonCommand, MatchPropertiesCommand,
  DonutCommand, PointCommand,
  SelectAllCommand, CopyClipCommand, CutClipCommand, PasteClipCommand, SplineCommand, SketchCommand, StretchCommand, SelectCommand,
  ArrayCommand, BlockCommand, InsertCommand, FilterCommand, FindCommand, ViewportCommand, LayoutCommand, GripEditCommand, ImportCommand
} from '../services/commandEngine';
import { Shape, ViewState, AppSettings, LayerConfig, Point, UnitType, BlockDefinition, LayoutDefinition, LayoutViewport, LineTypeDefinition } from '../types';
import { Menu, X, Sliders, Layers, FileText, Calculator, Target, Weight, FileEdit, Grid3X3, Layers2, FilePlus, Save, RotateCw, FolderOpen, Share2, XCircle, HardDrive, AlertTriangle, Cpu, Move, Copy, Maximize2, FlipHorizontal, Trash2, History, Palette, Check, Settings2, Terminal } from 'lucide-react';

import VoxIcon from './VoxIcon';
import ImportSummaryDialog from './ImportSummaryDialog';
import { storageService } from '../services/storageService';
import { cloudStorageService } from '../services/cloudStorageService';
import { trackFileMetadata, syncUserMetadata, onAuthChange, logAppEvent } from '../services/firebaseService';

import { createVoxCtb, createDefaultCtb } from '../services/ctbService';

const voxCtb = createVoxCtb();
const monoCtb = createDefaultCtb();

const INITIAL_SETTINGS: AppSettings = {
  ortho: true, snap: true, grid: true,
  currentLayer: '0', drawingScale: 1, penThickness: 'BYLAYER',
  activeLineType: 'bylayer',
  cursorX: 0, cursorY: 0, 
  units: 'metric', unitSubtype: 'mm', 
  linearFormat: 'decimal', angularFormat: 'decimalDegrees', anglePrecision: '0', 
  precision: '0.0000',
  fillEnabled: false,
  gridSpacing: 100, 
  gridMajorInterval: 5,
  snapSpacing: 10,
  polarTrackingEnabled: true,
  polarAngles: [90, 45, 30],
  snapOptions: { 
    endpoint: true, midpoint: true, center: true, intersection: true, 
    nearest: false, quadrant: true, perpendicular: true, tangent: true,
    node: true, extension: true, parallel: true, gcenter: true, appint: true, polar: true
  },
  showHUD: true,
  showLineWeights: true,
  textSize: 350,
  textRotation: 0,
  textJustification: 'left',
  activeDimStyle: 'standard',
  dimStyles: {
    'standard': { 
      id: 'standard', name: 'Standard', 
      arrowSize: 300, textSize: 350, textOffset: 120, 
      extendLine: 180, offsetLine: 120, precision: 2,
      textPlacement: 'above',
      arrowType: 'closed'
    },
    'architectural': { 
      id: 'architectural', name: 'Architectural', 
      arrowSize: 150, textSize: 180, textOffset: 80, 
      extendLine: 100, offsetLine: 80, precision: 1 
    }
  },
  ltScale: 1.0,
  limitsMin: { x: 0, y: 0 },
  limitsMax: { x: 42000, y: 29700 }, // Default A3 in mm (scaled up for visibility)
  metadata: {
    author: '',
    createdAt: new Date().toISOString().split('T')[0],
    lastModified: new Date().toISOString(),
    revision: 'REV-01',
    projectRevision: 'V-1.0',
    description: ''
  },
  activeCtbId: 'voxcadd',
  showCtbInView: false,
  ctbFiles: {
    'voxcadd': voxCtb,
    'monochrome': monoCtb
  }
};

const INITIAL_VIEW: ViewState = { scale: 0.05, originX: 0, originY: 0 };
const INITIAL_LAYERS_CONFIG: Record<string, LayerConfig> = { 
  '0': { id: '0', name: '0', visible: true, locked: false, frozen: false, plottable: true, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' },
  'defpoints': { id: 'defpoints', name: 'defpoints', visible: true, locked: false, frozen: false, plottable: false, color: '#666666', thickness: 0.1, lineType: 'continuous' }
};

export type ToolbarCategory = 'Draw' | 'Modify' | 'Anno' | 'View' | 'Tools' | 'History' | 'Edit';
type PanelType = 'none' | 'layers' | 'properties' | 'calculator' | 'drafting' | 'file' | 'mainmenu' | 'drawing_props' | 'help' | 'about' | 'privacy' | 'new_file' | 'dimstyle' | 'linetypes';

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
  const { user, isAuthenticated } = useSession();
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
  const [promptValue, setPromptValue] = useState("");

  useEffect(() => {
    if (promptDialog) {
      setPromptValue(promptDialog.initialValue || "");
    }
  }, [promptDialog]);
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
  const [ctbFlyoutOpen, setCtbFlyoutOpen] = useState(false);
  const [layerFlyoutOpen, setLayerFlyoutOpen] = useState(false);
  const [simplifiedLayerMenu, setSimplifiedLayerMenu] = useState(false);
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
  const [objectContextMenu, setObjectContextMenu] = useState<{ x: number, y: number } | null>(null);
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

  useEffect(() => {
    // Clear global bootstrap timer from index.html if it exists
    if ((window as any).voxBootTimer) {
      clearTimeout((window as any).voxBootTimer);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [loadingFile, setLoadingFile] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const [isPlotting, setIsPlotting] = useState(false);
  const [pendingCapture, setPendingCapture] = useState<{type: 'image' | 'share', payload?: any} | null>(null);

  useEffect(() => {
    if (pendingCapture && isPlotting) {
        const handleCapture = async () => {
            const capture = pendingCapture;
            setPendingCapture(null); // Clear immediately to avoid loops
            
            // Wait a tiny bit for the reactive render to complete
            await new Promise(r => setTimeout(r, 50));
            
            if (canvasHandleRef.current) {
                const dataUrl = canvasHandleRef.current.captureImage({ isPlotting: true });
                
                if (capture.type === 'image') {
                    const link = document.createElement('a');
                    link.href = dataUrl;
                    link.download = currentFileName.replace(/\.(vox|dxf)$/i, '') + '.png';
                    link.click();
                    setLogMessage("IMAGE_EXPORT_COMPLETE");
                } else if (capture.type === 'share') {
                    const payload = capture.payload;
                    setLoadingFile(true);
                    setLoadingStatus("GENERATING EXPORT...");

                    try {
                        const isDxfExport = payload === 'dxf';
                        const isPdfExport = payload === 'pdf';
                        const finalExt = isPdfExport ? '.pdf' : (isDxfExport ? '.dxf' : '.vox');
                        let mimeType = 'application/octet-stream';
                        
                        if (isDxfExport) mimeType = 'application/dxf';
                        else if (isPdfExport) mimeType = 'application/pdf';
                        
                        setLoadingStatus(`COMPILING ${finalExt.substring(1).toUpperCase()} DATA...`);
                        
                        let content: string | Blob;
                        if (isPdfExport) {
                            const res = await fetch(dataUrl);
                            content = await res.blob();
                        } else if (isDxfExport) {
                            content = shapesToDXF(Object.values(layers).flat() as Shape[], layerConfig, settings, blocks);
                        } else {
                            content = shapesToVox(Object.values(layers).flat() as Shape[], layerConfig, settings, lineTypes, blocks, layouts);
                        }
                        
                        const fileName = (currentFileName.replace(/\.[^/.]+$/, "") + finalExt).replace(/[^a-zA-Z0-9.\-_]/g, '_');
                        
                        // Capacitor Logic
                        if (Capacitor.isNativePlatform()) {
                            try {
                                const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
                                const reader = new FileReader();
                                const base64Promise = new Promise<string>((resolve) => {
                                    reader.onloadend = () => resolve(reader.result as string);
                                    reader.readAsDataURL(blob);
                                });
                                const base64data = await base64Promise;
                                const savedFile = await Filesystem.writeFile({
                                    path: fileName,
                                    data: base64data,
                                    directory: Directory.Cache
                                });
                                await CapacitorShare.share({
                                    title: `VoxCADD: ${currentFileName}`,
                                    text: `Project: ${currentFileName}`,
                                    url: savedFile.uri,
                                    dialogTitle: 'Share Document'
                                });
                                setLogMessage(`SUCCESS: ${fileName.toUpperCase()} SHARED NATIVELY`);
                                setLoadingFile(false);
                                setLoadingStatus("");
                                setIsPlotting(false);
                                return;
                            } catch (capErr) {
                                console.warn("Native share failed", capErr);
                            }
                        }

                        const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
                        const shareData: ShareData = {
                            title: `VoxCADD: ${currentFileName}`,
                            text: `Check out this CAD drawing: ${currentFileName}`,
                            url: window.location.href
                        };

                        if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: mimeType })] })) {
                            try {
                                const file = new File([blob], fileName, { type: mimeType });
                                await navigator.share({ ...shareData, files: [file] });
                                setLogMessage("SHARE_SUCCESS");
                            } catch (e) {
                                console.error("Share failed", e);
                                // Fallback to download if sharing failed or cancelled
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = fileName;
                                a.click();
                            }
                        } else {
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = fileName;
                            a.click();
                            setLogMessage("DOWNLOAD_STARTED");
                        }
                    } catch (err: any) {
                        setLogMessage(`ERR: ${err.message}`);
                    } finally {
                        setLoadingFile(false);
                        setLoadingStatus("");
                    }
                }
            }
            setIsPlotting(false);
        };
        handleCapture();
    }
  }, [pendingCapture, isPlotting, currentFileName, layers, layerConfig, settings, blocks, lineTypes, layouts]);
  const setLogMessage = useCallback((msg: string | null) => {
    _setLogMessage(msg);
    if (msg) setCommandHistory(prev => {
        if (prev[prev.length - 1] === msg) return prev;
        return [...prev.slice(-50), msg];
    });
  }, []);

  // Firebase Init & Metadata Sync
  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      if (user) {
        syncUserMetadata({ 
           theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
           deviceInfo: navigator.userAgent.substring(0, 50)
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync settings metadata when units or important state changes
  useEffect(() => {
    syncUserMetadata({ theme: settings.units });
  }, [settings.units]);

  const onFilterType = useCallback((type: string) => {
    const newSelectedIds = selectedIdsRef.current.filter(id => {
      const layers = layersRef.current as Record<string, Shape[]>;
      for (const layer of Object.values(layers)) {
         const shape = layer.find(s => s.id === id);
         if (shape) return shape.type === type;
      }
      return false;
    });
    setSelectedIds(newSelectedIds);
    setLogMessage(`FILTERED_BY: ${type.toUpperCase()} (${newSelectedIds.length})`);
  }, []);
  const [isCommandActive, setIsCommandActive] = useState(false);
  const [activeCommandName, setActiveCommandName] = useState<string | undefined>(undefined);
  const [lastCommandName, setLastCommandName] = useState<string | null>(null);
  const [showCircleOptions, setShowCircleOptions] = useState(false);
  const [showArcOptions, setShowArcOptions] = useState(false);
  const [showEllipseOptions, setShowEllipseOptions] = useState(false);
  const [fileHandle, setFileHandle] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<PanelType>('none');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [previewShapes, setPreviewShapes] = useState<Shape[] | null>(null);
  const [mtextEditor, setMtextEditor] = useState<{ 
    initialValue: string, 
    callback: (text: string, props?: any) => void 
  } | null>(null);
  const [importSummary, setImportSummary] = useState<{ fileName: string, stats: any } | null>(null);
  const [hatchSelector, setHatchSelector] = useState<{ 
    callback: (pattern: string) => void 
  } | null>(null);
  const [colorSelector, setColorSelector] = useState<{
    currentColor: string,
    onSelect: (color: string) => void,
    title?: string
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

  const handleLayoutContextMenu = (e: React.MouseEvent, layoutId: string) => {
    e.preventDefault();
    setLayoutContextMenu({ x: e.clientX, y: e.clientY, layoutId });
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
    
    // As per user request: ask for height and width
    setPromptDialog({
      title: 'Paper Height (mm)',
      message: 'Enter paper height in millimeters (e.g. 210 for A4):',
      initialValue: layout.paperSize.height.toString(),
      type: 'prompt',
      onConfirm: (height) => {
        if (!height || isNaN(parseFloat(height))) return;
        setPromptDialog({
          title: 'Paper Width (mm)',
          message: 'Enter paper width in millimeters (e.g. 297 for A4):',
          initialValue: layout.paperSize.width.toString(),
          type: 'prompt',
          onConfirm: (width) => {
            if (width && !isNaN(parseFloat(width))) {
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

  const clampViewState = (next: ViewState, prev: ViewState): ViewState => {
    let s = next.scale;
    if (isNaN(s) || !isFinite(s)) s = prev.scale;
    s = Math.max(0.0000001, Math.min(10000000, s));
    
    let ox = next.originX;
    let oy = next.originY;
    if (isNaN(ox) || !isFinite(ox)) ox = prev.originX;
    if (isNaN(oy) || !isFinite(oy)) oy = prev.originY;
    
    const limit = 1e12;
    ox = Math.max(-limit, Math.min(limit, ox));
    oy = Math.max(-limit, Math.min(limit, oy));
    
    return { scale: s, originX: ox, originY: oy };
  };

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
          const current = vp.viewState;
          const next = typeof updater === 'function' ? (updater as any)(current) : updater;
          vp.viewState = clampViewState(next, current);
          
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
      const clamped = clampViewState(next, current);
      return { ...prev, [activeTab]: clamped };
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

  const [viewHistory, setViewHistory] = useState<ViewState[]>([]);
  const saveToViewHistory = useCallback(() => {
    let current: ViewState | undefined;
    if (activeTabRef.current !== 'model' && isViewportActive && activeViewportIdRef.current) {
        const layout = layoutsRef.current.find(l => l.id === activeTabRef.current);
        const vp = layout?.viewports.find(v => v.id === activeViewportIdRef.current);
        current = vp?.viewState;
    } else {
        current = tabViewsRef.current[activeTabRef.current];
    }
    
    if (current) {
      setViewHistory(prev => [...prev.slice(-15), { ...current }]);
    }
  }, [isViewportActive]);

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

      // Ensure unique by name to prevent key collisions
      const uniqueValid: {name: string, date: number}[] = [];
      const seenNames = new Set<string>();
      for (const f of validRecentFiles) {
        if (!seenNames.has(f.name)) {
          uniqueValid.push(f);
          seenNames.add(f.name);
        }
      }

      localStorage.setItem(REGISTRY_KEY, JSON.stringify(uniqueValid));
      setRecentFiles(uniqueValid);

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
    
    // Close menu immediately
    setActivePanel('none');
    setFileNameMenuOpen(false);
    setFileMenuOpen(false);
    setLoadingFile(true);
    setLoadingStatus(`Importing ${fileName}...`);
    
    // Yield to let the loading screen render
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        let project: any = null;

        if (isDwg) {
            if (!(content instanceof ArrayBuffer)) {
                setLogMessage("LOAD_ERR: BINARY_DATA_REQUIRED");
                setLoadingFile(false);
                return;
            }
            project = await dwgToProject(content, settingsRef.current);
        } else if (isDxf) {
            if (typeof content !== 'string') {
                setLoadingFile(false);
                return;
            }
            project = await dxfToProject(content, settingsRef.current);
        } else if (isVox) {
            if (typeof content !== 'string') {
                setLoadingFile(false);
                return;
            }
            try {
                project = voxToProject(content);
            } catch (e) {
                console.warn("VOX parsing failed, trying DXF fallback", e);
                project = null;
            }
            
            // Fallback for DXF-formatted .vox files (legacy or renamed)
            if (!project && (content.trim().startsWith('999') || content.includes('SECTION'))) {
                project = await dxfToProject(content, settingsRef.current);
            }
        }

        if (project) {
            // Normalize entities into internal layers map
            const layerMap: Record<string, Shape[]> = {};
            const finalLayerConfig = { ...project.layers };

            // Initialize all defined layers- Optimized
            const layerKeys = Object.keys(finalLayerConfig);
            for (let i = 0; i < layerKeys.length; i++) {
                layerMap[layerKeys[i]] = [];
            }

            // Ensure standard default layers exist
            if (!finalLayerConfig['0']) {
                finalLayerConfig['0'] = { id: '0', name: '0', visible: true, locked: false, frozen: false, plottable: true, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' };
                layerMap['0'] = layerMap['0'] || [];
            }
            if (!finalLayerConfig['defpoints']) {
                finalLayerConfig['defpoints'] = { id: 'defpoints', name: 'defpoints', visible: true, locked: false, frozen: false, plottable: false, color: '#666666', thickness: 0.1, lineType: 'continuous' };
                layerMap['defpoints'] = layerMap['defpoints'] || [];
            }

            // Map entities and discover any missing layers - Optimized with chunking for large files
            const entitiesList = project.entities;
            const numEntities = entitiesList.length;
            const chunkSize = 2000;
            
            const processChunk = (startIndex: number) => {
                const endIndex = Math.min(startIndex + chunkSize, numEntities);
                setLoadingStatus(`Processing entities ${startIndex} to ${endIndex} of ${numEntities}...`);
                
                for (let i = startIndex; i < endIndex; i++) {
                    const s = entitiesList[i];
                    // Pre-calculate bounds for rendering performance
                    getShapeBounds(s, project.blocks || {});
                    
                    const l = s.layer || '0';
                    if (!layerMap[l]) {
                        layerMap[l] = [];
                        if (!finalLayerConfig[l]) {
                            finalLayerConfig[l] = { 
                                id: l, name: l, visible: true, locked: false, frozen: false, 
                                plottable: l.toLowerCase() !== 'defpoints', 
                                color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' 
                            };
                        }
                    }
                    layerMap[l].push(s);
                }
                
                if (endIndex < numEntities) {
                    setTimeout(() => processChunk(endIndex), 0);
                } else {
                    finishImport();
                }
            };

            const finishImport = () => {
                // Update state
                setLayers(layerMap);
                setLayerConfig(finalLayerConfig);
                setLineTypes(project.lineTypes || { 'continuous': { name: 'continuous', description: 'Solid line', pattern: [] } });
                setSettings(project.settings);
                setBlocks(project.blocks || {});
                setLayouts(() => {
                    const layoutsArr = project.layouts ? Object.values(project.layouts) : [];
                    if (layoutsArr.length === 0) {
                        const defaultLayout = { id: 'layout1', name: 'Layout 1', paperSize: { width: 297, height: 210 }, viewports: [] };
                        setTabViews(prev => ({ ...prev, model: prev.model || INITIAL_VIEW, layout1: { scale: 3, originX: 0, originY: 0 } }));
                        return [defaultLayout];
                    }
                    const newTabViews: Record<string, ViewState> = { model: tabViews.model || INITIAL_VIEW };
                    layoutsArr.forEach((l: any) => {
                        newTabViews[l.id] = { scale: 3, originX: 0, originY: 0 };
                    });
                    setTabViews(newTabViews);
                    return layoutsArr as LayoutDefinition[];
                });
                setActiveTab('model'); // Always reset to model on open
                setIsViewportActive(false);
                setActiveViewportId(null);
                setCurrentFileName(fileName);
                setFileSource(source);
                updateRecentFiles(fileName);
                setLoadingFile(false);
                
                // Save to internal storage (Deferred)
                setTimeout(async () => {
                    const stateToSave = {
                        layers: layerMap,
                        layerConfig: finalLayerConfig,
                        settings: project.settings,
                        lineTypes: project.lineTypes,
                        blocks: project.blocks,
                        layouts: project.layouts,
                        fileName: fileName
                    };
                    await storageService.saveLarge(`${STORAGE_PREFIX}${fileName}`, stateToSave);
                    // Also save as active workspace
                    await storageService.saveActiveWorkspace(stateToSave);
                    commitToHistory();
                }, 500);

                // Zoom extents if bounds exist
                if (project.bounds) {
                    setTimeout(() => handleAction('zoomExtents'), 100);
                }

                if (project.stats) {
                    setImportSummary({ fileName, stats: project.stats });
                }

                setLogMessage(`${fileName.toUpperCase()}_LOADED_SUCCESS`);
            };

            processChunk(0);
            return;
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
    // Avoid slow deep cloning via JSON methods
    const current = layersRef.current;
    const currentState: Record<string, Shape[]> = {};
    const keys = Object.keys(current);
    for (let k = 0; k < keys.length; k++) {
        const key = keys[k];
        // We only clone the layer array, treating shapes as immutable
        currentState[key] = [...current[key]];
    }
    
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

  const handleSettingsChange = useCallback((upd: Partial<AppSettings>) => {
    const prev = settingsRef.current;
    
    // Check if units or subunits changed for potential conversion
    const unitsChanged = upd.units !== undefined && upd.units !== prev.units;
    const subtypeChanged = upd.unitSubtype !== undefined && upd.unitSubtype !== prev.unitSubtype;
    
    if (unitsChanged || subtypeChanged) {
        const nextUnits = upd.units || prev.units;
        const nextSubtype = upd.unitSubtype || prev.unitSubtype;
        
        setPromptDialog({
            title: 'Convert Units',
            message: `You are switching to ${nextSubtype}. Would you like to rescale existing geometry to maintain physical size?`,
            initialValue: '',
            type: 'confirm',
            onConfirm: () => {
                // Conversion Factors to MM
                const factors: Record<string, number> = {
                    'mm': 1, 'cm': 10, 'm': 1000, 'km': 1000000,
                    'inches': 25.4, 'feet': 304.8, 'yards': 914.4, 'miles': 1609344
                };
                
                const fromFactor = factors[prev.unitSubtype] || 1;
                const toFactor = factors[nextSubtype] || 1;
                const factor = fromFactor / toFactor;
                
                if (Math.abs(factor - 1) > 0.000001) {
                    setLayers(prevLayers => {
                        const next = { ...prevLayers };
                        Object.keys(next).forEach(l => {
                            next[l] = next[l].map(s => scaleShape(s, { x: 0, y: 0 }, factor));
                        });
                        return next;
                    });
                    commitToHistory();
                    setLogMessage(`DRAWING_RESCALED_BY_FACTOR: ${factor.toFixed(4)}`);
                }
                setSettings(s => ({ ...s, ...upd }));
            }
        });
        return;
    }
    
    setSettings(s => ({ ...s, ...upd }));
  }, [commitToHistory]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    if (navigator.vibrate) navigator.vibrate(10);
    const previous = history[history.length - 1];
    setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(layers))]);
    setLayers(previous);
    setHistory(prev => prev.slice(0, -1));
  }, [history, layers]);

  const handleAction = async (act: string, payload?: any) => {
    // Determine if we should close the active panel
    const closeOnAction = [
        'undo', 'redo', 'erase', 'zoomExtents', 'zoomAll', 'zoomIn', 'zoomOut', 'zoomPrevious',
        'setUnits', 'new', 'close', 'save', 'saveAs', 'saveImage', 'share', 'publish', 'openRecent'
    ];
    if (closeOnAction.includes(act)) {
        setActivePanel('none');
        setFileNameMenuOpen(false);
        setFileMenuOpen(false);
    }

    switch(act) {
      case 'undo': undo(); break;
      case 'redo': {
        if (redoStack.length > 0) {
            const next = redoStack[0];
            setRedoStack(prev => prev.slice(1));
            setHistory(prev => [...prev, JSON.parse(JSON.stringify(layersRef.current))]);
            setLayers(next);
            setLogMessage("REDO_ACTION_SUCCESS");
            if(navigator.vibrate) navigator.vibrate(10);
        }
        break;
      }
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
      case 'toggleLineTypes': setActivePanel(activePanel === 'linetypes' ? 'none' : 'linetypes'); break;
      case 'toggleProperties': setActivePanel(activePanel === 'properties' ? 'none' : 'properties'); break;
      case 'toggleCtbManager': setActivePanel(activePanel === 'ctb' ? 'none' : 'ctb'); break;
      case 'toggleCalculator': setActivePanel(activePanel === 'calculator' ? 'none' : 'calculator'); break;
      case 'toggleDimStyle': setActivePanel(activePanel === 'dimstyle' ? 'none' : 'dimstyle'); break;
      case 'toggleDraftingSettings': setActivePanel(activePanel === 'drafting' ? 'none' : 'drafting'); break;
      case 'toggleMainMenu': setActivePanel(activePanel === 'mainmenu' ? 'none' : 'mainmenu'); break;
      case 'toggleDrawingProps': setActivePanel(activePanel === 'drawing_props' ? 'none' : 'drawing_props'); break;
      case 'toggleHelp': setActivePanel(activePanel === 'help' ? 'none' : 'help'); break;
      case 'setCtb':
        if (payload) {
          if (navigator.vibrate) navigator.vibrate(5);
          setSettings(s => ({ ...s, activeCtbId: payload }));
          setLogMessage(`CTB_ACTIVE: ${settings.ctbFiles?.[payload]?.name || payload}`);
        }
        break;
      case 'setActiveLayer':
        if (payload) {
          if (navigator.vibrate) navigator.vibrate(5);
          setSettings(s => ({ ...s, currentLayer: payload }));
          setLayerConfig(prev => ({
              ...prev,
              [payload]: { ...prev[payload], visible: true, frozen: false }
          }));
          setLogMessage(`LAYER_ACTIVE: ${layerConfig[payload]?.name || payload}`);
        }
        break;
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
      case 'selectAll': {
        const allShapes = Object.values(layersRef.current).flat() as Shape[];
        const selectableIds = allShapes.filter(s => {
          const conf = layerConfigRef.current[s.layer];
          return conf && !conf.locked && !conf.frozen && conf.visible;
        }).map(s => s.id);
        setSelectedIds(selectableIds);
        setLogMessage(`SELECTED ${selectableIds.length} OBJECTS`);
        break;
      }
      case 'toggleAbout': setActivePanel(activePanel === 'about' ? 'none' : 'about'); break;
      case 'togglePrivacy': setActivePanel(activePanel === 'privacy' ? 'none' : 'privacy'); break;
      case 'zoomExtents':
      case 'zoomAll': {
        saveToViewHistory();
        const limits = act === 'zoomAll' ? { min: settingsRef.current.limitsMin, max: settingsRef.current.limitsMax } : undefined;
        const bounds = getAllShapesBounds(layersRef.current, blocksRef.current, limits);
        
        let targetW, targetH, ts_scale;
        
        const isLayoutVP = activeTab !== 'model' && isViewportActive && activeViewportId;
        if (isLayoutVP) {
            const layout = layouts.find(l => l.id === activeTab);
            const vp = layout?.viewports.find(v => v.id === activeViewportId);
            if (vp) {
                targetW = vp.width;
                targetH = vp.height;
                ts_scale = 1; // Viewport internal drawing scale is handled differently in CADCanvas
            }
        }
        
        if (!targetW && canvasHandleRef.current) {
            const size = canvasHandleRef.current.getCanvasSize();
            targetW = size.width;
            targetH = size.height;
            ts_scale = settingsRef.current.drawingScale;
        }

        if (bounds && targetW && targetH && ts_scale !== undefined) {
            const w = Math.max(0.1, bounds.xMax - bounds.xMin);
            const h = Math.max(0.1, bounds.yMax - bounds.yMin);
            const centerX = (bounds.xMax + bounds.xMin) / 2;
            const centerY = (bounds.yMax + bounds.yMin) / 2;
            
            const padding = 1.1; 
            const scale = Math.min(targetW / (w * padding * ts_scale), targetH / (h * padding * ts_scale));
            
            setView({ 
                scale, 
                originX: -centerX * scale * ts_scale, 
                originY: centerY * scale * ts_scale 
            });
            setLogMessage(`VOX_Z-${act === 'zoomAll' ? 'A' : 'E'}: [${w.toFixed(1)} x ${h.toFixed(1)}]`);
        } else {
            setView({ scale: 0.1, originX: 0, originY: 0 });
            setLogMessage(`VOX_Z-${act === 'zoomAll' ? 'A' : 'E'}: (No Extents)`);
        }
        break;
      }
      case 'zoomIn': 
      case 'zoomOut': {
        saveToViewHistory();
        const factor = act === 'zoomIn' ? 1.5 : 1 / 1.5;
        setView(v => ({ 
            ...v, 
            scale: v.scale * factor,
            originX: v.originX * factor,
            originY: v.originY * factor 
        }));
        break;
      }
      case 'zoomRealTime': {
        if (engineRef.current) {
            engineRef.current.start(new ZoomRealTimeCommand(engineRef.current.ctx));
        }
        break;
      }
      case 'zoomPrevious': {
        if (viewHistory.length > 0) {
            const prevView = viewHistory[viewHistory.length - 1];
            setView(prevView as any);
            setViewHistory(prev => prev.slice(0, -1));
            setLogMessage("VOX_Z-P: PREVIOUS_VIEW_LOADED");
        } else {
            setLogMessage("VOX_Z-P: NO_HISTORY_DATA");
        }
        break;
      }
      case 'setUnits': 
        setActivePanel('none');
        setSettings(s => ({ ...s, units: payload })); 
        break;
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
        const targetName = payload || currentFileName;
        setPromptDialog({
          title: 'Rename Drawing',
          message: `Enter new name for "${targetName}":`,
          initialValue: targetName.replace(/\.(vox|dxf)$/i, ''),
          type: 'prompt',
          onConfirm: async (newName) => {
            if (!newName || newName === targetName.replace(/\.(vox|dxf)$/i, '')) return;
            
            const ext = targetName.split('.').pop() || 'vox';
            const finalNewName = newName.toLowerCase().endsWith(`.${ext}`) ? newName : `${newName}.${ext}`;

            // Migrate storage via IndexedDB
            await storageService.renameLarge(`${STORAGE_PREFIX}${targetName}`, `${STORAGE_PREFIX}${finalNewName}`);
            
            // Update registry
            setRecentFiles(prev => {
              const updated = prev.map(f => f.name === targetName ? { ...f, name: finalNewName } : f);
              localStorage.setItem(REGISTRY_KEY, JSON.stringify(updated));
              return updated;
            });

            if (targetName === currentFileName) {
              setCurrentFileName(finalNewName);
            }
            
            setLogMessage(`SUCCESS: RENAMED TO ${finalNewName.toUpperCase()}`);
          }
        });
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

      case 'save': {
        setActivePanel('none');
        if (loadingFile) return;
        setLoadingFile(true);
        setLoadingStatus("SAVING TO STORAGE...");

        setTimeout(async () => {
          try {
            commitToHistory();
            const stateToSave = {
                layers: JSON.parse(JSON.stringify(layersRef.current)),
                layerConfig: layerConfigRef.current,
                settings: settingsRef.current,
                lineTypes: lineTypesRef.current,
                blocks: blocksRef.current,
                layouts: layoutsRef.current,
                fileName: currentFileName
            };
            await storageService.saveLarge(`${STORAGE_PREFIX}${currentFileName}`, stateToSave);
            updateRecentFiles(currentFileName);
            trackFileMetadata(currentFileName, JSON.stringify(stateToSave).length);
            logAppEvent('file_save', { name: currentFileName });
            
            // Auto-sync if authenticated
            if (isAuthenticated) {
               await cloudStorageService.saveToCloud(currentFileName.replace(/[^a-zA-Z0-9]/g, '_'), stateToSave);
               setLogMessage(`SUCCESS: ${currentFileName} SAVED & SYNCED`);
            } else {
               setLogMessage(`SUCCESS: ${currentFileName} SAVED LOCALLY`);
            }
          } catch (e) {
            setLogMessage("ERR: STORAGE_SAVE_FAILED");
          } finally {
            setLoadingFile(false);
            setLoadingStatus("");
          }
        }, 50);
        break;
      }
      case 'syncToCloud': {
        if (!isAuthenticated) {
            setLogMessage("ERR: AUTHORIZATION_REQUIRED");
            return;
        }
        setLoadingFile(true);
        setLoadingStatus("SYNCING TO CLOUD...");
        try {
            const data = {
                layers: JSON.parse(JSON.stringify(layersRef.current)),
                layerConfig: layerConfigRef.current,
                settings: settingsRef.current,
                lineTypes: lineTypesRef.current,
                blocks: blocksRef.current,
                layouts: layoutsRef.current,
                fileName: currentFileName
            };
            const success = await cloudStorageService.saveToCloud(currentFileName.replace(/[^a-zA-Z0-9]/g, '_'), data);
            if (success) {
                setLogMessage(`CLOUD_SYNC_SUCCESS: ${currentFileName}`);
            } else {
                setLogMessage("ERR: CLOUD_SYNC_FAILED");
            }
        } catch (e) {
            setLogMessage("ERR: SYNC_EXCEPTION");
        } finally {
            setLoadingFile(false);
            setLoadingStatus("");
        }
        break;
      }
      case 'saveAs':
      case 'saveas':
        if (loadingFile) return;
        setLoadingFile(true);
        setLoadingStatus("PREPARING EXPORT...");

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
            if (isDxfExport) {
                content = shapesToDXF(Object.values(layersRef.current).flat() as Shape[], layerConfigRef.current, settingsRef.current, blocksRef.current);
            } else {
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

                    // Also save to internal storage for "Recent Files" consistency
                    const stateToSave = {
                        layers: JSON.parse(JSON.stringify(layersRef.current)),
                        layerConfig: layerConfigRef.current,
                        settings: settingsRef.current,
                        lineTypes: lineTypesRef.current,
                        blocks: blocksRef.current,
                        layouts: layoutsRef.current,
                        fileName: handle.name
                    };
                    await storageService.saveLarge(`${STORAGE_PREFIX}${handle.name}`, stateToSave);
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
                    
                    const finalName = isSaveAs ? name : currentFileName;
                    if (isSaveAs) {
                      setCurrentFileName(name);
                    }
                    updateRecentFiles(finalName);

                    // Also save to internal storage for "Recent Files" consistency
                    const stateToSave = {
                        layers: JSON.parse(JSON.stringify(layersRef.current)),
                        layerConfig: layerConfigRef.current,
                        settings: settingsRef.current,
                        lineTypes: lineTypesRef.current,
                        blocks: blocksRef.current,
                        layouts: layoutsRef.current,
                        fileName: finalName
                    };
                    storageService.saveLarge(`${STORAGE_PREFIX}${finalName}`, stateToSave);

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
        setActivePanel('none');
        if (canvasHandleRef.current) {
            setIsPlotting(true);
            setPendingCapture({ type: 'image' });
        }
        break;
      }
      case 'share': {
        setActivePanel('none');
        if (loadingFile) return;
        setIsPlotting(true);
        setPendingCapture({ type: 'share', payload });
        break;
      }
      case 'publish': {
        setActivePanel('none');
        if (loadingFile) return;
        setLoadingFile(true);
        setLoadingStatus("PUBLISHING TO GLOBAL STORAGE...");
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
            const content = shapesToVox(Object.values(layersRef.current).flat() as Shape[], layerConfigRef.current, settingsRef.current, lineTypesRef.current, blocksRef.current, layoutsRef.current);
            const blob = new Blob([content], { type: 'application/octet-stream' });
            const formData = new FormData();
            formData.append('file', blob, currentFileName);
            
            setLoadingStatus("UPLOADING TO SECURE_NET...");
            const response = await fetch('https://file.io/?expires=1d', {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });
            const result = await response.json();
            
            if (result.success) {
                const link = result.link;
                setPromptDialog({
                    title: 'Global Share Link',
                    message: 'Copy this link to share your drawing. It will expire in 24 hours or after first download.',
                    initialValue: link,
                    type: 'prompt',
                    onConfirm: (val) => {
                        navigator.clipboard.writeText(val);
                        setLogMessage("SUCCESS: SHARE_LINK_COPIED");
                    }
                });
            } else {
                throw new Error("UPLOAD_FAILED");
            }
        } catch (e: any) {
            if (e.name === 'AbortError') {
                setLogMessage("ERR: UPLOAD_TIMEOUT");
            } else {
                setLogMessage("ERR: GLOBAL_PUBLISH_FAILED");
            }
            console.error("Publish error:", e);
        } finally {
            clearTimeout(timeoutId);
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
                    if (e.shiftKey) handleAction('redo');
                    else handleAction('undo');
                    break;
                case 'y':
                    if (!e.shiftKey) {
                        e.preventDefault();
                        handleAction('redo');
                    }
                    break;
                case 'a':
                    e.preventDefault();
                    handleAction('selectAll');
                    break;
            }
        } else {
            switch(e.key) {
                case 'F3':
                    e.preventDefault();
                    setSettings(prev => ({ ...prev, snap: !prev.snap }));
                    setLogMessage(settingsRef.current.snap ? "OSNAP_OFF" : "OSNAP_ON");
                    break;
                case 'F7':
                    e.preventDefault();
                    setSettings(prev => ({ ...prev, grid: !prev.grid }));
                    setLogMessage(settingsRef.current.grid ? "GRID_OFF" : "GRID_ON");
                    break;
                case 'F8':
                    e.preventDefault();
                    setSettings(prev => ({ ...prev, ortho: !prev.ortho }));
                    setLogMessage(settingsRef.current.ortho ? "ORTHO_OFF" : "ORTHO_ON");
                    break;
                case 'F10':
                    e.preventDefault();
                    setSettings(prev => ({ ...prev, polarTrackingEnabled: !prev.polarTrackingEnabled }));
                    setLogMessage(settingsRef.current.polarTrackingEnabled ? "POLAR_OFF" : "POLAR_ON");
                    break;
                case 'F11':
                    e.preventDefault();
                    // OTRACK is essentially tracked by having snap on and hover logic, 
                    // but we can have a toggle for the acquisition logic if needed.
                    // For now, let's treat F11 as a UX toggle for tracking visibility.
                    setLogMessage("OTRACK_TOGGLED");
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
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && !isNavigatingInput()) {
        if (e.key.toLowerCase() === 'z') {
           e.preventDefault();
           handleAction('zoomRealTime');
        } else {
          const cmdInput = document.getElementById('command-input') as HTMLInputElement;
          if (cmdInput) {
            cmdInput.focus();
          }
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
    
    // Handle special internal commands
    if (trimmed.toUpperCase() === 'CLEARLOGS' || trimmed.toUpperCase() === 'CLS') {
        setCommandHistory([]);
        setLogMessage("INFO: COMMAND_LOGS_CLEARED");
        return;
    }

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
      'za': ZoomCommand, 'ze': ZoomCommand, 'zw': ZoomCommand, 'zi': ZoomCommand, 'zo': ZoomCommand,
      'zr': ZoomRealTimeCommand,
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
      'j': JoinCommand, 'join': JoinCommand, 'br': BreakCommand, 'break': BreakCommand,
      'brp': BreakAtPointCommand, 'breakatpoint': BreakAtPointCommand,
      'f': FilletCommand, 'fillet': FilletCommand,
      'cha': ChamferCommand, 'chamfer': ChamferCommand,
      'ray': RayCommand, 'xl': XLineCommand, 'xline': XLineCommand,
      'ar': ArrayCommand, 'array': ArrayCommand,
      'b': BlockCommand, 'block': BlockCommand,
      'i': InsertCommand, 'insert': InsertCommand,
      'fi': FilterCommand, 'filter': FilterCommand,
      'find': FindCommand, 'vports': ViewportCommand, 'viewport': ViewportCommand, 'layout': LayoutCommand,
      'import': ImportCommand, 'import_blocks': ImportCommand,
    };
    
    const CommandClass = commandMap[cmdKey];
    if (CommandClass && typeof CommandClass === 'function' && Object.prototype.hasOwnProperty.call(commandMap, cmdKey)) {
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
            'j': 'JOIN', 'join': 'JOIN',
            'br': 'BREAK', 'break': 'BREAK',
            'brp': 'BREAKATPOINT', 'breakatpoint': 'BREAKATPOINT',
            'x': 'EXPLODE', 'explode': 'EXPLODE',
            'o': 'OFFSET', 'offset': 'OFFSET',
            'f': 'FILLET', 'fillet': 'FILLET',
            'e': 'ERASE', 'erase': 'ERASE', 'del': 'ERASE',
            'ma': 'MATCHPROP', 'matchprop': 'MATCHPROP', 'match': 'MATCHPROP',
            'mt': 'MTEXT', 'mtext': 'MTEXT',
            't': 'TEXT', 'text': 'TEXT',
            'dim': 'DIM', 'dist': 'DIST', 'area': 'AREA',
            'za': 'ZOOM', 'ze': 'ZOOM', 'zw': 'ZOOM', 'zi': 'ZOOM', 'zo': 'ZOOM',
            'zr': 'ZOOM_RT',
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
      else if (cmdKey === 'za') cmd = new ZoomCommand(engineRef.current!.ctx, 'all');
      else if (cmdKey === 'ze') cmd = new ZoomCommand(engineRef.current!.ctx, 'extents');
      else if (cmdKey === 'zw') cmd = new ZoomCommand(engineRef.current!.ctx, 'window');
      else if (cmdKey === 'zr') cmd = new ZoomRealTimeCommand(engineRef.current!.ctx);
      else if (cmdKey === 'zi') cmd = new ZoomCommand(engineRef.current!.ctx, 'in');
      else if (cmdKey === 'zo') cmd = new ZoomCommand(engineRef.current!.ctx, 'out');
      else if (cmdKey === 'lea:closed') cmd = new LeaderCommand(engineRef.current!.ctx, 'closed');
      else if (cmdKey === 'lea:open') cmd = new LeaderCommand(engineRef.current!.ctx, 'open');
      else if (cmdKey === 'lea:tick') cmd = new LeaderCommand(engineRef.current!.ctx, 'tick');
      else if (cmdKey === 'lea:dot') cmd = new LeaderCommand(engineRef.current!.ctx, 'dot');
      else cmd = new CommandClass(engineRef.current!.ctx);
      
      setActiveCommandName(cmd.name);
      engineRef.current!.start(cmd);
      
      if (args) {
          // Robust multi-part argument handling for AI emitted strings like "dim 0,0 500,500" or "l 10,10 20,20 30,30"
          // We split by spaces but carefully preserve coordinate pairs if they don't have spaces
          // If the engine fails to consume the whole string at once, we try feeding it parts
          const inputParts = args.split(/\s+/);
          inputParts.forEach(part => {
              if (part.trim()) engineRef.current!.input(part.trim());
          });
      }
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
        saveToViewHistory,
        getViewHistory: () => viewHistory,
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
        isCommandActive: isCommandActive,
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

  const onCanvasClick = (x: number, y: number, snapped: boolean, shiftKey: boolean = false) => {
    // If no command is active and we have a selection, check for grips first
    if (engineRef.current && !engineRef.current.active && selectedIds.length > 0) {
        const ts = view.scale * settings.drawingScale;
        const threshold = 16 / ts; // Increased for better pro-tool feel and touch response
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

    if(engineRef.current) engineRef.current.click({x,y}, snapped, shiftKey);
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
    <div className="flex flex-col h-[100dvh] w-full bg-black text-neutral-300 overflow-hidden select-none relative font-sans">
      <AnimatePresence mode="wait">
        {isAppLoading && (
          <LoadingScreen 
            key="app-loading-screen"
            onComplete={() => setIsAppLoading(false)} 
          />
        )}
      </AnimatePresence>

      <header className="h-10 flex items-center justify-between px-4 shrink-0 bg-black border-b border-white/5 z-[110]">
        <div className="flex items-center gap-3 shrink-0">
          <VoxIcon size={22} className="text-cyan-400" />
          <div className="flex items-center gap-2">
            <div className="flex items-baseline gap-1 leading-none">
              <span className="font-black text-[15px] uppercase tracking-tighter text-white">VOX</span>
              <span className="font-normal text-[15px] uppercase tracking-tighter text-cyan-500">CADD</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group/status-toggle">
            <button 
              onPointerDown={(e) => {
                const timer = setTimeout(() => {
                  if (settings.showCtbInView) {
                    setCtbFlyoutOpen(true);
                  } else {
                    setSimplifiedLayerMenu(true);
                    setLayerFlyoutOpen(true);
                  }
                  if (navigator.vibrate) navigator.vibrate(5);
                }, 400);
                const clear = () => clearTimeout(timer);
                e.currentTarget.addEventListener('pointerup', clear, { once: true });
                e.currentTarget.addEventListener('pointerleave', clear, { once: true });
              }}
              onClick={() => {
                if(navigator.vibrate) navigator.vibrate(2);
                setSettings(s => ({ ...s, showCtbInView: !s.showCtbInView }));
              }}
              className={`text-[9px] font-black uppercase tracking-widest px-2 h-full flex items-center transition-all ${settings.showCtbInView ? 'text-cyan-400' : 'text-neutral-500 hover:text-cyan-400'}`}
            >
              {settings.showCtbInView ? 'CTB' : 'LAYER'}
            </button>
            
            {/* Layer Quick Switch Flyout */}
            {layerFlyoutOpen && (
              <>
                <div className="fixed inset-0 z-[1000]" onClick={() => { setLayerFlyoutOpen(false); setSimplifiedLayerMenu(false); }} />
                <div className="absolute top-full right-0 mt-2 bg-[#0a0a0c]/98 backdrop-blur-2xl border border-white/10 rounded-2xl p-1 flex flex-col gap-0.5 shadow-[0_20px_40px_rgba(0,0,0,0.5)] z-[1100] min-w-[200px] animate-in slide-in-from-top-2 fade-in duration-200">
                  <div className="px-3 py-2 border-b border-white/5 mb-1 flex items-center justify-between">
                    <span className="text-[7px] font-black uppercase text-cyan-400 tracking-widest">{simplifiedLayerMenu ? 'Layer Name Swift' : 'Active Layer'}</span>
                    <Layers size={10} className="text-neutral-700" />
                  </div>
                  <div className="max-h-[300px] overflow-y-auto scrollbar-none">
                    {(Object.values(layerConfig) as LayerConfig[]).map(l => (
                      <button 
                        key={l.id}
                        onClick={() => {
                          handleAction('setActiveLayer', l.id);
                          setLayerFlyoutOpen(false);
                          setSimplifiedLayerMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-[9px] font-bold uppercase transition-all flex items-center justify-between ${settings.currentLayer === l.id ? 'text-cyan-400 bg-cyan-400/10 shadow-[inner_0_0_10px_rgba(6,182,212,0.1)]' : 'text-neutral-400 hover:text-cyan-400 hover:bg-cyan-400/5'}`}
                      >
                        <div className="flex items-center gap-2">
                           {!simplifiedLayerMenu && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />}
                           {l.name}
                        </div>
                        {settings.currentLayer === l.id && <Check size={10} />}
                      </button>
                    ))}
                  </div>
                  {!simplifiedLayerMenu && (
                    <>
                      <div className="h-px bg-white/5 my-1" />
                      <button 
                        onClick={() => { setActivePanel('none'); handleAction('toggleLayerManager'); setLayerFlyoutOpen(false); }}
                        className="w-full text-left px-3 py-2.5 rounded-xl text-[9px] font-bold uppercase text-neutral-500 hover:text-cyan-400 hover:bg-cyan-400/5 flex items-center gap-3 transition-all"
                      >
                        <Settings2 size={12} className="text-neutral-700" /> Layer Properties...
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {ctbFlyoutOpen && (
              <>
               <div className="fixed inset-0 z-[1000]" onClick={() => setCtbFlyoutOpen(false)} />
               <div 
                 className="absolute top-full right-0 mt-2 bg-[#0a0a0c]/98 backdrop-blur-2xl border border-white/10 rounded-2xl p-1 flex flex-col gap-0.5 shadow-[0_20px_40px_rgba(0,0,0,0.5)] z-[1100] min-w-[160px] animate-in slide-in-from-top-2 fade-in duration-200"
               >
                 <div className="px-3 py-2 border-b border-white/5 mb-1 flex items-center justify-between">
                   <span className="text-[7px] font-black uppercase text-cyan-400 tracking-widest">Plot Styles</span>
                   <FileText size={10} className="text-neutral-700" />
                 </div>
                 {(Object.values(settings.ctbFiles || {}) as any[]).map((ctb: any) => (
                   <button 
                     key={ctb.id}
                     onClick={() => {
                       handleAction('setCtb', ctb.id);
                       setCtbFlyoutOpen(false);
                     }}
                     className={`w-full text-left px-3 py-2.5 rounded-xl text-[9px] font-bold uppercase transition-all flex items-center justify-between ${settings.activeCtbId === ctb.id ? 'text-cyan-400 bg-cyan-400/10 shadow-[inner_0_0_10px_rgba(6,182,212,0.1)]' : 'text-neutral-400 hover:text-cyan-400 hover:bg-cyan-400/5'}`}
                   >
                     {ctb.name}
                     {settings.activeCtbId === ctb.id && <Check size={10} />}
                   </button>
                 ))}
                 <div className="h-px bg-white/5 my-1" />
                 <button 
                   onClick={() => { setActivePanel('none'); handleAction('toggleCtbManager'); setCtbFlyoutOpen(false); }}
                   className="w-full text-left px-3 py-2.5 rounded-xl text-[9px] font-bold uppercase text-neutral-500 hover:text-cyan-400 hover:bg-cyan-400/5 flex items-center gap-3 transition-all"
                 >
                   <Settings2 size={12} className="text-neutral-700" /> Plot Styles...
                 </button>
               </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center h-full">
          <button onClick={() => handleAction('toggleMainMenu')} className="p-2 transition-all text-white no-tap hover:text-cyan-400">
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* SUB-HEADER Space */}
      <div className="h-0.5 bg-[#0a0a0c]" />

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
                    {recentFiles.length > 0 ? recentFiles.map((file, i) => {
                      const fileName = typeof file === 'string' ? file : file.name;
                      return (
                        <div key={`${fileName}-${i}`} className="flex items-center gap-1">
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
                  <button 
                    onClick={() => { handleAction('toggleCtbManager'); setFileMenuOpen(false); }}
                    className="w-full text-left px-3 py-3 rounded-xl text-[10px] text-neutral-400 hover:bg-white/10 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                  >
                    <Palette size={16} className="text-yellow-500" /> Plot Styles (CTB)
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

      <div className="h-9 bg-black border-b border-white/5 flex items-center px-4 z-[99] shrink-0 gap-0 overflow-x-auto no-scrollbar scroll-smooth">
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
            onMouseMove={(x,y,s,shift) => { if(engineRef.current) engineRef.current.move({x,y}, s, shift); }} 
            onAction={handleAction}
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
            onObjectContextMenu={(x, y) => setObjectContextMenu({ x, y })}
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
          {sidebarButtons.map((p, index) => (
            <button key={`${p.id}-${index}`} onClick={() => { if(navigator.vibrate) navigator.vibrate(5); handleAction(p.action); }} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border no-tap ${activePanel === p.activeOn ? 'bg-[#00bcd4] text-black border-[#00bcd4]' : 'bg-black/60 backdrop-blur-sm border-white/10 text-neutral-400 hover:text-[#00bcd4] hover:border-[#00bcd4] hover:bg-[#00bcd4]/5'}`}><p.icon size={16} /></button>
          ))}
        </div>

        <AnimatePresence>
          {activePanel === 'layers' && (
            <motion.div 
              key="panel-layers-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex items-center justify-center sm:p-4 bg-black/40 backdrop-blur-[2px] pointer-events-none"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="pointer-events-auto w-full h-full sm:h-auto sm:w-auto flex items-center justify-center p-2 sm:p-0"
              >
                <LayerManager 
                  layers={layerConfig} 
                  lineTypeDefinitions={lineTypes}
                  activeLayer={settings.currentLayer} 
                  onClose={() => setActivePanel('none')} 
                  onOpenColorSelector={(currentColor, onSelect, title) => setColorSelector({ currentColor, onSelect, title })}
                  onUpdateLayer={(id, upd) => {
                    const layerName = layerConfig[id]?.name || id;
                    setLayerConfig(prev => ({...prev, [id]: {...prev[id], ...upd} }));
                    
                    // If visual properties changed, ask if we should apply to all shapes on this layer
                    if (upd.color !== undefined || upd.thickness !== undefined || upd.lineType !== undefined) {
                      setPromptDialog({
                        title: 'Apply Layer Properties',
                        message: `Would you like to apply these changes to all existing shapes on layer "${layerName}"? (This resets individual overrides)`,
                        type: 'confirm',
                        initialValue: '',
                        onConfirm: () => {
                          setLayers(prev => {
                            const next = { ...prev };
                            if (next[id]) {
                              next[id] = next[id].map(s => {
                                const newShape = { ...s };
                                if (upd.color !== undefined) delete newShape.color;
                                if (upd.thickness !== undefined) newShape.thickness = 'BYLAYER';
                                if (upd.lineType !== undefined) newShape.lineType = 'bylayer';
                                return newShape;
                              });
                            }
                            return next;
                          });
                          setLogMessage(`LAYER_SYNCCED: ${layerName.toUpperCase()}`);
                          setTimeout(commitToHistory, 100);
                        }
                      });
                    }
                  }} 
                  onAddLayer={(name) => { 
                      const id = generateId(); 
                      setLayerConfig(prev => ({...prev, [id]: { id, name, visible: true, locked: false, frozen: false, plottable: true, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' }})); 
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
                      setLayerConfig(prev => ({
                          ...prev,
                          [id]: { ...prev[id], visible: true, frozen: false }
                      }));
                  }} 
                  onOpenLineTypes={() => setActivePanel('linetypes')}
                />
              </motion.div>
            </motion.div>
          )}

          {activePanel === 'properties' && (
             <motion.div 
               key="panel-properties-overlay"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-[1000] flex items-center justify-center sm:p-4 bg-black/40 backdrop-blur-[2px] pointer-events-none"
             >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="pointer-events-auto w-full h-full sm:h-auto sm:w-auto flex items-center justify-center p-2 sm:p-0"
                >
                  <PropertiesPanel 
                    selectedShapes={(Object.values(layers).flat() as Shape[]).filter(s => selectedIds.includes(s.id))} 
                    onUpdateShape={(id, upd) => setLayers(prev => { const n = {...prev}; Object.keys(n).forEach(l => n[l] = n[l].map(s => s.id === id ? {...s, ...upd} : s)); return n; })} 
                    lineTypeDefinitions={lineTypes}
                    layers={layerConfig} 
                    settings={settings} 
                    onUpdateSettings={(upd) => setSettings(s => ({...s, ...upd}))} 
                    onCommand={executeCommand} 
                    onClose={() => setActivePanel('none')} 
                    onOpenColorSelector={(currentColor, onSelect, title) => setColorSelector({ currentColor, onSelect, title })}
                    activeLayout={activeTab !== 'model' ? layouts.find(l => l.id === activeTab) : undefined}
                    onUpdateLayout={(id, upd) => setLayouts(prev => prev.map(l => l.id === id ? { ...l, ...upd } : l))}
                  />
                </motion.div>
             </motion.div>
          )}

          {activePanel === 'calculator' && (
            <motion.div 
              key="panel-calculator-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex items-center justify-center sm:p-4 bg-black/40 backdrop-blur-[2px] pointer-events-none"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="pointer-events-auto w-full h-full sm:h-auto sm:w-auto flex items-center justify-center p-2 sm:p-0"
              >
                <CalculatorPanel onClose={() => setActivePanel('none')} />
              </motion.div>
            </motion.div>
          )}

          {activePanel === 'ctb' && (
            <motion.div 
              key="panel-ctb-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex items-center justify-center sm:p-4 bg-black/40 backdrop-blur-[2px] pointer-events-none"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="pointer-events-auto w-full h-full sm:h-auto sm:w-auto flex items-center justify-center p-2 sm:p-0"
              >
                <CtbManager 
                  isOpen={true} 
                  settings={settings} 
                  onUpdateSettings={(s) => setSettings(s)} 
                  onClose={() => setActivePanel('none')} 
                  onOpenColorSelector={(currentColor, onSelect, title) => setColorSelector({ currentColor, onSelect, title })}
                />
              </motion.div>
            </motion.div>
          )}

          {colorSelector && (
            <ColorSelector 
              key="panel-color-selector"
              isOpen={true}
              title={colorSelector.title}
              currentColor={colorSelector.currentColor}
              onSelect={colorSelector.onSelect}
              onClose={() => setColorSelector(null)}
            />
          )}

          {activePanel === 'drafting' && (
            <motion.div 
              key="panel-drafting-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex items-center justify-center sm:p-4 bg-black/40 backdrop-blur-[2px] pointer-events-none"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="pointer-events-auto w-full h-full sm:h-auto sm:w-auto flex items-center justify-center p-2 sm:p-0"
              >
                <DraftingSettings options={settings.snapOptions} settings={settings} onSettingsChange={handleSettingsChange} onChange={(upd) => setSettings(s => ({...s, snapOptions: { ...s.snapOptions, ...upd }}))} onClose={() => setActivePanel('none')} />
              </motion.div>
            </motion.div>
          )}

          {activePanel === 'file' && (
            <motion.div 
              key="panel-file-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex items-center justify-center sm:p-4 bg-black/40 backdrop-blur-[2px] pointer-events-none"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="pointer-events-auto w-full h-full sm:h-auto sm:w-auto flex items-center justify-center p-2 sm:p-0"
              >
                <FileManager currentName={currentFileName} recentFiles={recentFiles} onAction={handleAction} onClose={() => setActivePanel('none')} />
              </motion.div>
            </motion.div>
          )}

          {activePanel === 'drawing_props' && (
            <motion.div 
              key="panel-props-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex items-center justify-center sm:p-4 bg-black/40 backdrop-blur-[2px] pointer-events-none"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="pointer-events-auto w-full h-full sm:h-auto sm:w-auto flex items-center justify-center p-2 sm:p-0"
              >
                <DrawingProperties 
                  settings={settings} 
                  onConfirm={(metadata, newTitle) => {
                    setSettings(s => ({...s, metadata}));
                    if (newTitle !== currentFileName) {
                      handleAction('rename', newTitle);
                    }
                    setActivePanel('none');
                    setLogMessage("PROJECT_PROPERTIES_UPDATED");
                    setTimeout(() => commitToHistory(), 50);
                  }} 
                  onClose={() => setActivePanel('none')} 
                  entityCount={(Object.values(layers).flat() as Shape[]).length} 
                  currentFileName={currentFileName} 
                />
              </motion.div>
            </motion.div>
          )}

          {activePanel === 'help' && (
            <motion.div 
              key="panel-help-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] pointer-events-none"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="pointer-events-auto"
              >
                <InfoPanel type="help" onSwitch={(t) => setActivePanel(t as PanelType)} onClose={() => setActivePanel('none')} />
              </motion.div>
            </motion.div>
          )}

          {activePanel === 'about' && (
            <motion.div 
              key="panel-about-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] pointer-events-none"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="pointer-events-auto"
              >
                <InfoPanel type="about" onSwitch={(t) => setActivePanel(t as PanelType)} onClose={() => setActivePanel('none')} />
              </motion.div>
            </motion.div>
          )}

          {activePanel === 'privacy' && (
            <motion.div 
              key="panel-privacy-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] pointer-events-none"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="pointer-events-auto"
              >
                <InfoPanel type="privacy" onSwitch={(t) => setActivePanel(t as PanelType)} onClose={() => setActivePanel('none')} />
              </motion.div>
            </motion.div>
          )}

          {activePanel === 'new_file' && (
            <motion.div 
              key="panel-new-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] pointer-events-none"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="pointer-events-auto"
              >
                <NewFileDialog onSelect={(cfg) => { 
                    const name = cfg.name + '.vox';
                    setLayers({ '0': [], 'defpoints': [] }); 
                    setLayerConfig(INITIAL_LAYERS_CONFIG);
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
                }} onClose={() => setActivePanel('none')} />
              </motion.div>
            </motion.div>
          )}

          {activePanel === 'linetypes' && (
            <motion.div 
              key="panel-linetypes-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] pointer-events-none"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="pointer-events-auto"
              >
                <LineTypeManager 
                  lineTypes={lineTypes} 
                  onUpdate={(name, def) => setLineTypes(prev => ({ ...prev, [name]: def }))}
                  onRemove={(name) => {
                    setLineTypes(prev => {
                      const next = { ...prev };
                      delete next[name];
                      return next;
                    });
                  }}
                  onClose={() => setActivePanel('none')} 
                />
              </motion.div>
            </motion.div>
          )}

          {activePanel === 'dimstyle' && (
            <motion.div 
              key="panel-dimstyle-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] pointer-events-none"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="pointer-events-auto"
              >
                <DimensionStyleManager settings={settings} onUpdateSettings={setSettings} onClose={() => setActivePanel('none')} />
              </motion.div>
            </motion.div>
          )}

          {activePanel === 'mainmenu' && (
            <motion.div 
              key="panel-main-menu"
              initial={{ y: '-100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-0 z-[1500] bg-[#050507] flex flex-col"
            >
               <header className="h-12 flex justify-between items-center px-4 border-b border-white/5 bg-black">
                  <div className="flex items-center gap-2">
                    <VoxIcon size={18} className="text-cyan-400" />
                    <h2 className="text-[10px] font-black text-white uppercase tracking-widest">VOXCADD PANEL</h2>
                  </div>
                  <button onClick={() => setActivePanel('none')} className="p-2 text-neutral-500 hover:text-white transition-colors duration-200"><X size={20}/></button>
               </header>
               <div className="flex-1 overflow-auto bg-black">
                 <MenuBar onAction={(a,p) => handleAction(a,p)} currentFileName={currentFileName} units={settings.units} />
               </div>
            </motion.div>
          )}
        </AnimatePresence>
        {mtextEditor && (
          <MTextEditor 
            initialValue={mtextEditor.initialValue} 
            initialSettings={{
              size: settings.textSize,
              rotation: settings.textRotation,
              justification: settings.textJustification as any,
              bold: settings.textBold,
              italic: settings.textItalic,
              underline: settings.textUnderline,
              strikethrough: settings.textStrikethrough,
              highlight: settings.textHighlight
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
                textStrikethrough: props.strikethrough,
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
      </main>

      {objectContextMenu && (
        <>
          <div className="fixed inset-0 z-[1050]" onClick={() => setObjectContextMenu(null)} />
          <div 
            className="fixed bg-[#0a0a0c]/98 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 flex flex-col gap-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[1100] animate-in zoom-in-95 fade-in slide-in-from-top-4 duration-200 min-w-[180px]"
            style={{ 
              left: Math.max(10, Math.min(objectContextMenu.x, window.innerWidth - 190)), 
              top: Math.max(10, Math.min(objectContextMenu.y, window.innerHeight - 300))
            }}
          >
            <div className="px-3 py-1.5 border-b border-white/5 mb-1 flex items-center justify-between">
              <div className="text-[8px] font-black uppercase text-cyan-500 tracking-widest">Selection Menu</div>
              <div className="text-[7px] text-neutral-500 font-mono">{selectedIds.length} ITEMS</div>
            </div>
            
            <button onClick={() => { executeCommand('m'); setObjectContextMenu(null); }} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
              <Move className="text-cyan-500" size={14} /> Move
            </button>
            <button onClick={() => { executeCommand('co'); setObjectContextMenu(null); }} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
              <Copy className="text-cyan-500" size={14} /> Copy
            </button>
            <button onClick={() => { executeCommand('ro'); setObjectContextMenu(null); }} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
              <RotateCw className="text-cyan-500" size={14} /> Rotate
            </button>
            <button onClick={() => { executeCommand('sc'); setObjectContextMenu(null); }} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
              <Maximize2 className="text-cyan-500" size={14} /> Scale
            </button>
            <button onClick={() => { executeCommand('mi'); setObjectContextMenu(null); }} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
              <FlipHorizontal className="text-cyan-500" size={14} /> Mirror
            </button>
            
            <div className="h-px bg-white/5 my-1" />
            
            <button onClick={() => { executeCommand('e'); setObjectContextMenu(null); }} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-red-500/80 hover:bg-red-500 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
              <Trash2 size={14} /> Erase
            </button>
            <button onClick={() => { setSelectedIds([]); setObjectContextMenu(null); }} className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] text-neutral-500 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
              <X size={14} /> Deselect All
            </button>
          </div>
        </>
      )}

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

      {/* History Panel (Slidable) */}
      <div 
        id="command-history-panel"
        className="fixed bottom-[100px] sm:bottom-[60px] left-1/2 -translate-x-1/2 w-[95%] sm:w-[600px] bg-black/95 backdrop-blur-3xl border border-white/10 rounded-2xl overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] z-[200] transition-all duration-500 flex flex-col"
        style={{ height: '0px', opacity: 0 }}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <History size={12} className="text-cyan-500" />
            <span className="text-[9px] font-black uppercase text-neutral-400 tracking-widest">Command History</span>
          </div>
          <button 
            onClick={() => {
              const el = document.getElementById('command-history-panel');
              if (el) { el.style.height = '0px'; el.style.opacity = '0'; }
            }}
            className="text-neutral-600 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 scrollbar-none font-mono">
          {commandHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 opacity-20">
              <Terminal size={40} className="mb-4" />
              <span className="text-[10px] font-black uppercase">No active history buffer</span>
            </div>
          ) : (
            commandHistory.map((msg, i) => {
              const isCommand = msg.startsWith("> ");
              const isAi = msg.startsWith("AI: ") || msg.includes("PRINCIPAL ARCHITECT");
              return (
                <div 
                  key={`history-${i}`} 
                  className={`p-3 rounded-xl border-l-4 text-[10px] font-bold uppercase transition-all ${
                    isCommand ? 'bg-cyan-500/5 border-cyan-500 text-cyan-400' :
                    isAi ? 'bg-indigo-500/5 border-indigo-500 text-indigo-400' :
                    'bg-white/5 border-neutral-700 text-neutral-500'
                  }`}
                >
                  {msg}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="h-7 bg-[#0a0a0c] border-t border-white/5 flex items-center shrink-0 cursor-default select-none relative z-[150]">
        {/* Fixed Model & Add */}
        <div className="flex items-center h-full shrink-0">
          <button 
            onClick={() => setActiveTab('model')} 
            className={`h-full px-2 text-[9px] font-black uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'model' ? 'text-cyan-400 bg-cyan-400/5' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            <Grid3X3 size={10} /> Model
          </button>
          <button 
            onClick={() => {
              const id = 'layout' + Date.now() + Math.random().toString(36).substr(2, 5);
              const defaultName = 'Layout ' + (layouts.length + 1);
              
              setPromptDialog({
                title: 'New Layout: Height (mm)',
                message: 'Enter paper height for the new layout:',
                initialValue: '210',
                type: 'prompt',
                onConfirm: (height) => {
                  if (!height || isNaN(parseFloat(height))) return;
                  setPromptDialog({
                    title: 'New Layout: Width (mm)',
                    message: 'Enter paper width for the new layout:',
                    initialValue: '297',
                    type: 'prompt',
                    onConfirm: (width) => {
                      if (width && !isNaN(parseFloat(width))) {
                        const newLayout = { 
                          id, 
                          name: defaultName, 
                          paperSize: { width: parseFloat(width), height: parseFloat(height) }, 
                          viewports: [] 
                        };
                        setLayouts(prev => [...prev, newLayout]);
                        setTabViews(prev => ({ ...prev, [id]: { scale: 3, originX: 0, originY: 0 } }));
                        setActiveTab(id);
                        setLogMessage(`LAYOUT_CREATED: ${defaultName} (${width}x${height})`);
                      }
                    }
                  });
                }
              });
            }}
            className="h-full px-1.5 text-neutral-500 hover:text-cyan-400 transition-all flex items-center border-x border-white/5"
            title="New Layout"
          >
            <FilePlus size={11} />
          </button>
        </div>

        {/* Scrollable Layout List */}
        <div className="flex-1 flex items-center h-full overflow-x-auto scrollbar-none gap-px touch-pan-x overscroll-x-contain">
          {layouts.map((l, index) => (
            <button 
              key={`${l.id}-${index}`}
              draggable
              onDragStart={() => handleDragStart(l.id)}
              onDragOver={(e) => { 
                e.preventDefault(); 
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
              className={`h-full px-2.5 text-[9px] font-black uppercase transition-all flex items-center gap-1 whitespace-nowrap group relative ${activeTab === l.id ? 'text-cyan-400 bg-cyan-400/5' : 'text-neutral-500 hover:text-neutral-300'}`}
              onContextMenu={(e) => handleLayoutContextMenu(e, l.id)}
            >
              {activeTab === l.id && <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-cyan-400" />}
              <Layers2 size={9} /> {l.name}
            </button>
          ))}
        </div>
      </div>

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

              if (res.commands && res.commands.length) {
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
          onToggleHistory={() => {
            const el = document.getElementById('command-history-panel');
            if (el) {
              const isHidden = el.style.height === '0px' || !el.style.height;
              el.style.height = isHidden ? '200px' : '0px';
              el.style.opacity = isHidden ? '1' : '0';
            }
          }}
          isLiveActive={isLiveActive} 
          isCommandActive={isCommandActive} 
          prompt={commandPrompt} 
          history={commandHistory}
          value={commandInput} 
          onChange={setCommandInput} 
        />
      </footer>
      
      <GlobalCommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelect={(cmd) => executeCommand(cmd)}
        commands={COMMAND_LIST}
      />

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
                  name="vox-prompt-input"
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                       const val = promptValue;
                       const cb = promptDialog.onConfirm;
                       setPromptDialog(null);
                       cb(val);
                    } else if (e.key === 'Escape') {
                       setPromptDialog(null);
                    }
                  }}
                  id="vox-prompt-input"
                  autoComplete="off"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-bold focus:outline-none focus:border-cyan-500/50 transition-all mb-6"
                />
              )}
              
              <div className="flex gap-3">
                 <button onClick={() => setPromptDialog(null)} className="flex-1 py-3 rounded-xl bg-white/5 text-neutral-400 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95">Cancel</button>
                 <button 
                                       onClick={() => {
                      const val = promptValue;
                      const cb = promptDialog.onConfirm;
                      setPromptDialog(null);
                      cb(val);
                    }} 
                   className="flex-1 py-3 rounded-xl bg-cyan-500 text-black text-[9px] font-black uppercase tracking-widest hover:bg-cyan-400 transition-all active:scale-95"
                 >
                   {promptDialog.type === 'confirm' ? 'Confirm Action' : 'Confirm'}
                 </button>
              </div>
           </div>
        </div>
      )}
      <OfflineIndicator />
    </div>
  );
};
export default App;
