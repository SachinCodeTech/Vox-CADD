
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
  HatchCommand, LeaderCommand, PanCommand, OffsetCommand, TrimCommand, EllipseCommand, PolygonCommand,
  SelectAllCommand, CopyClipCommand, CutClipCommand, PasteClipCommand, SplineCommand, SketchCommand
} from './services/commandEngine';
import { Shape, ViewState, AppSettings, LayerConfig, Point, UnitType } from './types';
import { Menu, X, Sliders, Layers, FileText, Calculator, Target, Weight, FileEdit } from 'lucide-react';

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
  textJustification: 'left'
};

const INITIAL_VIEW: ViewState = { scale: 0.05, originX: 0, originY: 0 };
const INITIAL_LAYERS_CONFIG: Record<string, LayerConfig> = { 
  '0': { id: '0', name: '0', visible: true, locked: false, frozen: false, color: '#FF0000', thickness: 0.25, lineType: 'continuous' },
  'defpoints': { id: 'defpoints', name: 'defpoints', visible: true, locked: false, frozen: false, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' }
};

export type ToolbarCategory = 'Draw' | 'Modify' | 'Anno' | 'View' | 'Assist' | 'History' | 'Edit';
type PanelType = 'none' | 'layers' | 'properties' | 'calculator' | 'drafting' | 'file' | 'mainmenu' | 'drawing_props' | 'help' | 'about' | 'privacy' | 'new_file';

const STORAGE_PREFIX = 'voxcadd_file_v1_';
const REGISTRY_KEY = 'voxcadd_recent_files';

const App: React.FC = () => {
  const [layers, setLayers] = useState<Record<string, Shape[]>>({ '0': [], 'defpoints': [] });
  const [layerConfig, setLayerConfig] = useState<Record<string, LayerConfig>>(INITIAL_LAYERS_CONFIG);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [activeTab, setActiveTab] = useState<'model' | 'layout'>('model');
  const [activeCategory, setActiveCategory] = useState<ToolbarCategory>('Draw');
  const [isViewportActive, setIsViewportActive] = useState(false);
  const [history, setHistory] = useState<Record<string, Shape[]>[]>([]);
  const [redoStack, setRedoStack] = useState<Record<string, Shape[]>[]>([]);
  const [tabViews, setTabViews] = useState<Record<'model' | 'layout', ViewState>>({
    model: { ...INITIAL_VIEW },
    layout: { scale: 0.02, originX: 0, originY: 0 },
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
  const [showCircleOptions, setShowCircleOptions] = useState(false);
  const [showArcOptions, setShowArcOptions] = useState(false);
  const [showEllipseOptions, setShowEllipseOptions] = useState(false);
  const [currentFileName, setCurrentFileName] = useState<string>("Drawing1.vox");
  const [fileHandle, setFileHandle] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<PanelType>('none');
  const [previewShapes, setPreviewShapes] = useState<Shape[] | null>(null);
  const [mtextEditor, setMtextEditor] = useState<{ initialValue: string, callback: (text: string) => void } | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [lastAiCommandTime, setLastAiCommandTime] = useState(0);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [recentFiles, setRecentFiles] = useState<{name: string, date: number}[]>([]);

  const view = tabViews[activeTab];
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

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { layerConfigRef.current = layerConfig; }, [layerConfig]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { tabViewsRef.current = tabViews; }, [tabViews]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

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
      case 'saveAs':
        if (payload === 'vox') {
          // Internal Save As - essentially just ask for a new name
          const newName = prompt("Enter new filename:", currentFileName.replace(/\.vox$/, "") + "_copy.vox");
          if (newName) {
              const cleanedName = newName.endsWith('.vox') ? newName : newName + '.vox';
              // Clone current data
              const currentState = JSON.parse(JSON.stringify(layersRef.current));
              const newPayload = {
                  layers: currentState,
                  layerConfig: layerConfigRef.current,
                  settings: settingsRef.current,
                  fileName: cleanedName
              };
              localStorage.setItem(`${STORAGE_PREFIX}${cleanedName}`, JSON.stringify(newPayload));
              setCurrentFileName(cleanedName);
              updateRecentFiles(cleanedName);
              setLogMessage(`SAVED_AS: ${cleanedName}`);
              setFileHandle(null); // Reset native handle for new file
          }
        } else if (payload === 'dxf') {
          // Export to DXF
          handleAction('save', 'dxf');
        }
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
      case 'open':
        setLogMessage("AWAITING_FILE_SELECTION...");
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = ".vox,.dxf,.dwg";
        input.onchange = (e: any) => {
            const file = e.target.files[0];
            if (!file) { setLogMessage("OPEN_CANCELLED"); return; }
            const reader = new FileReader();
            if (file.name.toLowerCase().endsWith('.dwg')) {
                reader.onload = (res: any) => {
                    handleOpenFile(file.name, res.target.result);
                };
                reader.readAsArrayBuffer(file);
            } else {
                reader.onload = (res: any) => {
                    handleOpenFile(file.name, res.target.result);
                };
                reader.readAsText(file);
            }
        };
        input.click();
        break;
      case 'save':
      case 'saveAs':
        // Ensure local storage is updated first
        commitToHistory();
        
        setLogMessage("PREPARING_DATA...");
        const isDxfExport = payload === 'dxf';
        const finalExt = isDxfExport ? '.dxf' : '.vox';
        
        let content: string = "";
        try {
            // For .vox, we now use DXF format internally to ensure "any CAD tool" support as requested
            content = shapesToDXF(Object.values(layers).flat() as Shape[], layerConfig, settings);
            if (!content || content.length < 10) {
                // If DXF failed or is too small, fallback to legacy VOX JSON to avoid 0B
                content = shapesToVox(Object.values(layers).flat() as Shape[], layerConfig, settings);
            }
        } catch (err) {
            console.error("Save content generation failed:", err);
            content = shapesToVox(Object.values(layers).flat() as Shape[], layerConfig, settings);
        }

        // Native File System Access
        if ('showSaveFilePicker' in window) {
            try {
                let handle = (act === 'save' && fileHandle) ? fileHandle : null;
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
                setLogMessage(`SAVED_TO: ${handle.name}`);
            } catch (e) {
                console.warn("Save cancelled or failed", e);
                setLogMessage("SAVE_ERR: DISK_ACCESS_DENIED");
            }
        } else {
            // Fallback for browsers without File System Access API (like Chrome for Android)
            // Using application/x-vox for .vox helps Android identify the app as a handler
            const mimeType = isDxfExport ? 'application/dxf' : 'application/x-vox';
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = currentFileName.replace(/\.[^/.]+$/, "") + finalExt;
            document.body.appendChild(a); // Recommended for mobile
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            updateRecentFiles(currentFileName);
            setLogMessage(`FILE_DOWNLOADED: ${finalExt.toUpperCase()}`);
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
      case 'share':
        setLogMessage("GENERATING_SHARE_PKG...");
        if (navigator.share) {
            try {
                await navigator.share({ title: 'VoxCADD Pro Design', text: `Sharing ${currentFileName}`, url: window.location.href });
                setLogMessage("SHARE_SENT");
            } catch (e) {}
        } else {
            setLogMessage("ERR: SHARING_BLOCKED");
        }
        break;
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
      'el': EllipseCommand, 'ellipse': EllipseCommand, 'pol': PolygonCommand, 'polygon': PolygonCommand,
      'sk': SketchCommand, 'sketch': SketchCommand,
      'all': SelectAllCommand, 'cut': CutClipCommand, 'copy': CopyClipCommand, 'paste': PasteClipCommand
    };
    
    const CommandClass = commandMap[cmdKey];
    if (CommandClass) {
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
        start: (cmd: CADCommand) => { setActiveCommandName(cmd.name); engineRef.current?.start(cmd); },
        onExternalRequest: (type, data, cb) => {
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
                onCommand: (cmds) => cmds.split('\n').forEach(c => executeCommand(c)),
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
          <div className="flex flex-col justify-center translate-y-[1px]">
            <div className="flex items-center leading-none">
              <span className="font-black text-[16.5px] uppercase tracking-tighter text-white">VOX</span>
              <span className="font-bold text-[16.5px] uppercase tracking-tighter text-cyan-500 ml-1.5">CADD</span>
            </div>
            <span className="text-neutral-700 font-bold text-[7px] uppercase tracking-[0.35em] leading-none mt-1.5 ml-0.5">V-1.0.0</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-[#121214] rounded-md p-0.5 border border-white/5 items-center h-7">
            <button 
                onClick={() => setActiveTab('model')} 
                className={`h-6 px-3.5 rounded-[4px] font-black uppercase transition-all flex items-center justify-center text-[9px] ${activeTab === 'model' ? 'bg-cyan-500 text-black' : 'text-neutral-500 hover:text-neutral-400'}`}
            >
                Model
            </button>
            <button 
                onClick={() => setActiveTab('layout')} 
                className={`h-6 px-3.5 rounded-[4px] font-black uppercase transition-all flex items-center justify-center text-[9px] ${activeTab === 'layout' ? 'bg-cyan-500 text-black' : 'text-neutral-500 hover:text-neutral-400'}`}
            >
                Layout
            </button>
          </div>
          <button onClick={() => handleAction('toggleMainMenu')} className="p-1 transition-all text-neutral-500 hover:text-white no-tap">
            <Menu size={24} />
          </button>
        </div>
      </header>

      <div className="h-7 bg-black border-b border-white/5 flex items-center px-3 z-[100] shrink-0 gap-4 overflow-x-auto scrollbar-none">
          {['FILE', 'EDIT', 'VIEW', 'DRAW', 'MODIFY', 'ANNO', 'TOOLS'].map((item) => {
            const isSelected = (item === 'TOOLS' && activeCategory === 'Assist') || (item === 'EDIT' && activeCategory === 'Edit') || (item === 'ANNO' && activeCategory === 'Anno') || activeCategory.toUpperCase() === item;
            return (
              <button key={item} onClick={() => { if (item === 'FILE') handleAction('openFileManager'); else if (item === 'EDIT') setActiveCategory('Edit'); else if (item === 'VIEW') setActiveCategory('View'); else if (item === 'DRAW') setActiveCategory('Draw'); else if (item === 'MODIFY') setActiveCategory('Modify'); else if (item === 'ANNO') setActiveCategory('Anno'); else if (item === 'TOOLS') setActiveCategory('Assist'); }} className={`text-[9px] font-black tracking-widest transition-all no-tap whitespace-nowrap px-1 h-full flex items-center border-b-2 ${isSelected ? 'text-white border-cyan-500' : 'text-neutral-600 border-transparent hover:text-neutral-300'}`}>{item}</button>
            );
          })}
      </div>

      <main className="flex-1 relative bg-black overflow-hidden border border-neutral-800/40">
        <CADCanvas 
          ref={canvasHandleRef} 
          layers={layers} 
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
          onSelectionChange={(ids) => setSelectedIds(ids)} 
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
            <button key={p.id} onClick={() => handleAction(p.action)} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border no-tap ${activePanel === p.activeOn ? 'bg-[#00bcd4] text-black border-[#00bcd4]' : 'bg-black/60 backdrop-blur-sm border-white/10 text-neutral-400 hover:text-white'}`}><p.icon size={16} /></button>
          ))}
        </div>

        {activePanel === 'layers' && <LayerManager layers={layerConfig} activeLayer={settings.currentLayer} onClose={() => setActivePanel('none')} onUpdateLayer={(id, upd) => setLayerConfig(prev => ({...prev, [id]: {...prev[id], ...upd} }))} onAddLayer={(name) => { const id = generateId(); setLayerConfig(prev => ({...prev, [id]: { id, name, visible: true, locked: false, frozen: false, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' }})); }} onRemoveLayer={(id) => setLayerConfig(prev => { const n = {...prev}; delete n[id]; return n; })} onSetActive={(id) => setSettings(s => ({...s, currentLayer: id}))} />}
        {activePanel === 'properties' && <PropertiesPanel selectedShapes={(Object.values(layers).flat() as Shape[]).filter(s => selectedIds.includes(s.id))} onUpdateShape={(id, upd) => setLayers(prev => { const n = {...prev}; Object.keys(n).forEach(l => n[l] = n[l].map(s => s.id === id ? {...s, ...upd} : s)); return n; })} layers={layerConfig} settings={settings} onUpdateSettings={(upd) => setSettings(s => ({...s, ...upd}))} onClose={() => setActivePanel('none')} />}
        {activePanel === 'calculator' && <CalculatorPanel onClose={() => setActivePanel('none')} />}
        {activePanel === 'drafting' && <DraftingSettings options={settings.snapOptions} settings={settings} onSettingsChange={(upd) => setSettings(s => ({...s, ...upd}))} onChange={(upd) => setSettings(s => ({...s, snapOptions: { ...s.snapOptions, ...upd }}))} onClose={() => setActivePanel('none')} />}
        {activePanel === 'file' && <FileManager currentName={currentFileName} recentFiles={recentFiles} onAction={handleAction} onClose={() => setActivePanel('none')} />}
        {activePanel === 'drawing_props' && <DrawingProperties settings={settings} onUpdateSettings={(upd) => setSettings(s => ({...s, ...upd}))} onClose={() => setActivePanel('none')} entityCount={(Object.values(layers).flat() as Shape[]).length} currentFileName={currentFileName} onAction={handleAction} />}
        {activePanel === 'help' && <InfoPanel type="help" onSwitch={(t) => setActivePanel(t)} onClose={() => setActivePanel('none')} />}
        {activePanel === 'about' && <InfoPanel type="about" onSwitch={(t) => setActivePanel(t)} onClose={() => setActivePanel('none')} />}
        {activePanel === 'privacy' && <InfoPanel type="privacy" onSwitch={(t) => setActivePanel(t)} onClose={() => setActivePanel('none')} />}
        {activePanel === 'new_file' && <NewFileDialog onSelect={(cfg) => { setLayers({ '0': [], 'defpoints': [] }); setSettings(s => ({...s, units: cfg.units, precision: cfg.precision })); setCurrentFileName(cfg.name + '.vox'); setActivePanel('none'); }} onClose={() => setActivePanel('none')} />}
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
