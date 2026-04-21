
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

const STORAGE_KEY = 'voxcadd_active_workspace';

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
  const [currentFileName, setCurrentFileName] = useState<string>("Drawing1.vox");
  const [fileHandle, setFileHandle] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<PanelType>('none');
  const [previewShapes, setPreviewShapes] = useState<Shape[] | null>(null);
  const [mtextEditor, setMtextEditor] = useState<{ initialValue: string, callback: (text: string) => void } | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [lastAiCommandTime, setLastAiCommandTime] = useState(0);
  const [isAppLoading, setIsAppLoading] = useState(true);

  const view = tabViews[activeTab];
  const setView = useCallback((updater: ViewState | ((v: ViewState) => ViewState)) => {
    setTabViews(prev => ({
      ...prev,
      [activeTab]: typeof updater === 'function' ? (updater as (v: ViewState) => ViewState)(prev[activeTab]) : updater
    }));
  }, [activeTab]);

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
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.layers) setLayers(data.layers);
        if (data.layerConfig) setLayerConfig(data.layerConfig);
        if (data.settings) setSettings({ ...INITIAL_SETTINGS, ...data.settings });
        if (data.fileName) setCurrentFileName(data.fileName);
        setLogMessage("SESSION_RESTORED_SUCCESS");
      } catch (e) {
        console.error("Failed to restore session", e);
      }
    }

    // Global Drag and Drop support
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
        if (isDwg) {
            if (!(content instanceof ArrayBuffer)) {
                // If we got string (e.g. from file reader mistakenly using readAsText), this shouldn't happen if we use readAsArrayBuffer
                // But let's handle it gracefully if possible or just assume ArrayBuffer for DWG
                setLogMessage("LOAD_ERR: BINARY_EXPECTED");
                return;
            }
            setLogMessage("DWG_PARSING...");
            const result = await dwgToShapes(content);
            const { shapes: importedShapes, stats } = result;
            
            if (importedShapes.length > 0) {
                setLayers(prev => {
                    const newLayers = { ...prev };
                    importedShapes.forEach(s => {
                        const l = s.layer || '0';
                        if (!newLayers[l]) newLayers[l] = [];
                        newLayers[l].push(s);
                    });
                    return newLayers;
                });
                
                const statsMsg = `DWG_IMPORT: ${importedShapes.length} ENTITIES | UNSUPPORTED: ${stats.unsupported}`;
                setLogMessage(statsMsg);
                console.log("DWG IMPORT STATS:", stats);
            } else {
                setLogMessage("DWG_ERR: NO_DATA_OR_FAIL");
            }
        } else if (isDxf || isVox) {
            if (typeof content !== 'string') return;
            
            // Try VOX (JSON) first, then fallback to DXF
            const voxResult = voxToShapes(content);
            if (voxResult) {
                setLayers(voxResult.shapes.reduce((acc, s) => {
                    const l = s.layer || '0';
                    if (!acc[l]) acc[l] = [];
                    acc[l].push(s);
                    return acc;
                }, {} as Record<string, Shape[]>));
                setLayerConfig(voxResult.layers);
                setSettings({ ...INITIAL_SETTINGS, ...voxResult.settings });
                setLogMessage("VOX_PROJECT_LOADED");
            } else {
                const importedShapes = dxfToShapes(content);
                if (importedShapes.length > 0) {
                    setLayers({ '0': importedShapes, 'defpoints': [] });
                    setLogMessage(`${isVox ? 'VOX' : 'DXF'}_IMPORT: ${importedShapes.length} ENTITIES`);
                } else {
                    setLogMessage("LOAD_ERR: UNRECOGNIZED_FORMAT");
                }
            }
        } else {
            if (typeof content !== 'string') return;
            const result = voxToShapes(content);
            if (result) {
                setLayers(result.shapes.reduce((acc, s) => {
                    const l = s.layer || '0';
                    if (!acc[l]) acc[l] = [];
                    acc[l].push(s);
                    return acc;
                }, {} as Record<string, Shape[]>));
                setLayerConfig(result.layers);
                setSettings({ ...INITIAL_SETTINGS, ...result.settings });
                setLogMessage("VOX_PROJECT_LOADED");
            } else {
                // Try legacy format
                try {
                    const data = JSON.parse(content);
                    if (data.layers) setLayers(data.layers);
                    if (data.layerConfig) setLayerConfig(data.layerConfig);
                    if (data.settings) setSettings({ ...INITIAL_SETTINGS, ...data.settings });
                    setLogMessage("VOX_WORKSPACE_LOADED");
                } catch (e) {
                    setLogMessage("LOAD_ERR: CORRUPT_FORMAT");
                }
            }
        }
        setCurrentFileName(fileName);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      layers: currentState,
      layerConfig: layerConfigRef.current,
      settings: settingsRef.current,
      fileName: currentFileName
    }));
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
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: 'Untitled.vox',
                    types: [{
                        description: 'VoxCADD Project',
                        accept: { 'application/vnd.voxcadd.project': ['.vox'] }
                    }]
                });
                setFileHandle(handle);
                setCurrentFileName(handle.name);
                setLayers(INITIAL_LAYERS);
                setLayerConfig(INITIAL_LAYER_CONFIG);
                setSettings(INITIAL_SETTINGS);
                setHistory([]);
                setRedoStack([]);
                setLogMessage(`NEW_FILE_CREATED: ${handle.name}`);
                setActivePanel('none');
            } catch (e) {
                console.warn("User cancelled file creation");
            }
        } else {
            setActivePanel('new_file'); 
        }
        break;
      case 'rename': setCurrentFileName(payload); commitToHistory(); setLogMessage(`RENAMED_TO: ${payload}`); break;
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
        setLogMessage("PREPARING_DATA...");
        const isDxfExport = payload === 'dxf';
        const finalExt = isDxfExport ? '.dxf' : '.vox';
        
        let content: string = "";
        // For .vox, we now use DXF format internally to ensure "any CAD tool" support as requested
        content = shapesToDXF(Object.values(layers).flat() as Shape[], layerConfig, settings);

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
                setLogMessage(`SAVED_TO: ${handle.name}`);
            } catch (e) {
                console.warn("Save cancelled or failed", e);
                setLogMessage("SAVE_ERR: DISK_ACCESS_DENIED");
            }
        } else {
            // Fallback for browsers without File System Access API
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = currentFileName.replace(/\.[^/.]+$/, "") + finalExt;
            a.click();
            URL.revokeObjectURL(url);
            setLogMessage("EXPORTED_VIA_DOWNLOAD");
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
      case 'rename': setCurrentFileName(payload + '.vox'); break;
    }
  };

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
        return; 
    }

    // Handle sub-commands for Circle
    const subCommands = ['2p', '3p', 'ttr', 'center'];
    if (subCommands.includes(cmdKey)) {
        if (engineRef.current && isCommandActive && activeCommandName === 'CIRCLE') {
            engineRef.current.input(cmdKey);
            setShowCircleOptions(false);
            return;
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
      // Requirement: Toggle circle options if clicking circle again
      if (cmdKey === 'c' || cmdKey === 'circle') {
          if (activeCommandName === 'CIRCLE') {
              // If already in circle command, just toggle the options visibility
              setShowCircleOptions(!showCircleOptions);
              return;
          }
          setShowCircleOptions(true);
      } else {
          // Requirement: Close circle options if another tool is selected
          setShowCircleOptions(false);
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
      <header className="h-10 flex items-center justify-between px-3 shrink-0 bg-black border-b border-white/5 z-[110]">
        <div className="flex items-center gap-2.5">
          <VoxIcon size={32} className="shrink-0" />
          <div className="flex flex-col justify-center -space-y-0.5">
            <span className="font-black text-[12px] uppercase tracking-[0.12em] text-white leading-tight">VOXCADD</span>
            <span className="text-neutral-600 font-bold text-[9px] uppercase tracking-[0.05em] leading-tight">v1.0.0</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <div className="flex bg-[#121214] rounded-lg p-0.5 border border-white/5">
                <button onClick={() => setActiveTab('model')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${activeTab === 'model' ? 'bg-[#00bcd4] text-black' : 'text-neutral-500'}`}>Model</button>
                <button onClick={() => setActiveTab('layout')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${activeTab === 'layout' ? 'bg-[#00bcd4] text-black' : 'text-neutral-500'}`}>Layout</button>
            </div>
            <button onClick={() => handleAction('toggleMainMenu')} className="p-1.5 transition-colors text-neutral-400 hover:text-white no-tap"><Menu size={20} /></button>
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
        {activePanel === 'file' && <FileManager currentName={currentFileName} onAction={handleAction} onClose={() => setActivePanel('none')} />}
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
        <Toolbar category={activeCategory} settings={settings} onSettingChange={setSettings} onAction={handleAction} onCommand={executeCommand} activeCommandName={activeCommandName} showCircleOptions={showCircleOptions} canUndo={history.length > 0} canRedo={redoStack.length > 0} />
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
