
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import CADCanvas, { CADCanvasHandle } from './CADCanvas';
import Toolbar from './Toolbar';
import CommandBar from './CommandBar';
import LayerManager from './LayerManager';
import FileManager from './FileManager';
import MenuBar from './MenuBar';
import PropertiesPanel from './PropertiesPanel';
import CalculatorPanel from './CalculatorPanel';
import DraftingSettings from './DraftingSettings';
import AiDraftingPanel from './AiDraftingPanel';
import DrawingProperties from './DrawingProperties';
import InfoPanel from './InfoPanel';
import ProjectDashboardPanel from './ProjectDashboardPanel';
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
import { SyncConflictDialog } from './SyncConflictDialog';
import { useSession } from './SessionContext';
import { Share as CapacitorShare } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { generateId, hitTestGrip, getAllShapesBounds, getShapeBounds, scaleShape, cleanupWallSegments, getPurgeableItems, generateRoomLabelsMText } from '../services/cadService';
import { planSpaceLayout } from '../services/planningEngine';
import { getCommandFromAI, connectLiveAgent } from '../services/geminiService';
import { draft12x18ModernVillaPlan, draft20x30CommercialOfficePlan, draft10x15DuplexPlan } from '../services/premiumDraftingEngine';
import { shapesToDXF, dxfToProject } from '../services/dxfService';
import { shapesToVox, voxToProject, createEmptyVoxProject, calculateVoxProjectStats, incrementProjectRevision, VoxService } from '../services/voxService';
import { dwgToProject, DwgService } from '../services/DwgService';
import { 
  CADCommand, CommandEngine, LineCommand, DoubleLineCommand, CircleCommand, RectCommand, PolyCommand, 
  ArcCommand, MoveCommand, EraseCommand, CleanCommand, DistanceCommand, AreaCommand, 
  DimensionCommand, TextCommand, MTextCommand, ZoomCommand, ZoomRealTimeCommand, 
  RotateCommand, ScaleCommand, MirrorCommand, CopyCommand,
  ExtendCommand, ExplodeCommand, JoinCommand, BreakCommand, BreakAtPointCommand,
  RayCommand, XLineCommand,
  HatchCommand, LeaderCommand, PanCommand, OffsetCommand, TrimCommand, FilletCommand, ChamferCommand, EllipseCommand, PolygonCommand, MatchPropertiesCommand,
  DonutCommand, PointCommand,
  SelectAllCommand, CopyClipCommand, CutClipCommand, PasteClipCommand, SplineCommand, SketchCommand, StretchCommand, SelectCommand,
  ArrayCommand, BlockCommand, InsertCommand, FilterCommand, FindCommand, ViewportCommand, LayoutCommand, GripEditCommand, ImportCommand, TableCommand,
  AutoDimensionCommand, SectionLineCommand, PathArrayCommand, RevCloudCommand
} from '../services/commandEngine';
import { QuickSelectPanel } from './QuickSelectPanel';
import { Shape, ViewState, AppSettings, LayerConfig, Point, UnitType, BlockDefinition, LayoutDefinition, LayoutViewport, LineTypeDefinition, NamedView, DimensionShape, LineShape, CircleShape, RectShape, TextShape } from '../types';
import { Menu, X, Sliders, Layers, FileText, Calculator, Target, Weight, FileEdit, Grid3X3, Layers2, FilePlus, Save, RotateCw, FolderOpen, Share2, XCircle, HardDrive, AlertTriangle, Cpu, Move, Copy, Maximize2, FlipHorizontal, Trash2, History, Palette, Check, Settings2, Terminal, Camera, Sparkles, Box, LayoutDashboard, Scissors } from 'lucide-react';

import VoxIcon from './VoxIcon';
import ImportSummaryDialog from './ImportSummaryDialog';
import ViewManager from './ViewManager';
import BlockLibraryPanel, { PREDEFINED_BLOCKS } from './BlockLibraryPanel';
import BlockDefinitionDialog from './BlockDefinitionDialog';
import WallAlignmentPanel from './WallAlignmentPanel';
import SectionGeneratorPanel from './SectionGeneratorPanel';
import { storageService } from '../services/storageService';
import { cloudStorageService } from '../services/cloudStorageService';
import { trackFileMetadata, syncUserMetadata, onAuthChange, logAppEvent, syncLiveCursor, subscribeToLiveCursors } from '../services/firebaseService';

import { createVoxCtb, createDefaultCtb } from '../services/ctbService';

const voxCtb = createVoxCtb();
const monoCtb = createDefaultCtb();

const INITIAL_SETTINGS: AppSettings = {
  ortho: true, snap: true, grid: true, geometricConstraintsEnabled: true, isometricGrid: false,
  showSimulatedCollaborators: true, unlimitedGrid: true,
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
  gridSnap: false,
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
  doubleLineThickness: 230,
  doubleLineJustification: 'zero',
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
  aiSuggestionsEnabled: true,
  wallCleanupMode: false,
  snapViewportToGrid: false,
  autoFitPadding: 350,
  ctbFiles: {
    'voxcadd': voxCtb,
    'monochrome': monoCtb
  }
};

const INITIAL_VIEW: ViewState = { scale: 0.05, originX: 0, originY: 0 };

export function getCadStandardForLayer(layerName: string): { color: string; lineType: string; thickness: number } | null {
  const norm = layerName.trim().toUpperCase();
  if (norm === 'WALL' || norm === 'A-WALL') {
    return { color: '#FF9800', lineType: 'continuous', thickness: 0.30 };
  }
  if (norm === 'A-WALL-INT') {
    return { color: '#FF9800', lineType: 'continuous', thickness: 0.25 };
  }
  if (norm === 'DOOR' || norm === 'A-DOOR') {
    return { color: '#4CAF50', lineType: 'continuous', thickness: 0.20 };
  }
  if (norm === 'WINDOW' || norm === 'A-WINDOW') {
    return { color: '#00BCD4', lineType: 'continuous', thickness: 0.20 };
  }
  if (norm === 'COLUMN' || norm === 'A-COLS') {
    return { color: '#FF00FF', lineType: 'continuous', thickness: 0.35 };
  }
  if (norm === 'BEAM_CENTER' || norm === 'A-BEAMS') {
    return { color: '#F44336', lineType: 'dashed', thickness: 0.18 };
  }
  if (norm === 'DIMENSION' || norm === 'A-DIM') {
    return { color: '#FFEB3B', lineType: 'continuous', thickness: 0.15 };
  }
  if (norm === 'TEXT' || norm === 'A-TEXT') {
    return { color: '#FFFFFF', lineType: 'continuous', thickness: 0.18 };
  }
  if (norm === 'GRID' || norm === 'A-GRID') {
    return { color: '#607D8B', lineType: 'continuous', thickness: 0.15 };
  }
  if (norm === 'FURNITURE' || norm === 'A-FURN') {
    return { color: '#81C784', lineType: 'continuous', thickness: 0.15 };
  }
  return null;
}

const INITIAL_LAYERS_CONFIG: Record<string, LayerConfig> = { 
  '0': { id: '0', name: '0', visible: true, locked: false, frozen: false, plottable: true, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' },
  'defpoints': { id: 'defpoints', name: 'defpoints', visible: true, locked: false, frozen: false, plottable: false, color: '#666666', thickness: 0.1, lineType: 'continuous' },
  
  // Standard User-specified layers
  'WALL': { id: 'WALL', name: 'WALL', visible: true, locked: false, frozen: false, plottable: true, color: '#FF9800', thickness: 0.30, lineType: 'continuous' },
  'DOOR': { id: 'DOOR', name: 'DOOR', visible: true, locked: false, frozen: false, plottable: true, color: '#4CAF50', thickness: 0.20, lineType: 'continuous' },
  'WINDOW': { id: 'WINDOW', name: 'WINDOW', visible: true, locked: false, frozen: false, plottable: true, color: '#00BCD4', thickness: 0.20, lineType: 'continuous' },
  'COLUMN': { id: 'COLUMN', name: 'COLUMN', visible: true, locked: false, frozen: false, plottable: true, color: '#FF00FF', thickness: 0.35, lineType: 'continuous' },
  'BEAM_CENTER': { id: 'BEAM_CENTER', name: 'BEAM_CENTER', visible: true, locked: false, frozen: false, plottable: true, color: '#F44336', thickness: 0.18, lineType: 'dashed' },
  'DIMENSION': { id: 'DIMENSION', name: 'DIMENSION', visible: true, locked: false, frozen: false, plottable: true, color: '#FFEB3B', thickness: 0.15, lineType: 'continuous' },
  'TEXT': { id: 'TEXT', name: 'TEXT', visible: true, locked: false, frozen: false, plottable: true, color: '#FFFFFF', thickness: 0.18, lineType: 'continuous' },
  'GRID': { id: 'GRID', name: 'GRID', visible: true, locked: false, frozen: false, plottable: true, color: '#607D8B', thickness: 0.15, lineType: 'continuous' },
  'FURNITURE': { id: 'FURNITURE', name: 'FURNITURE', visible: true, locked: false, frozen: false, plottable: true, color: '#81C784', thickness: 0.15, lineType: 'continuous' },

  // A- prefixed legacy/alternate standard layers
  'A-WALL': { id: 'A-WALL', name: 'A-WALL', visible: true, locked: false, frozen: false, plottable: true, color: '#FF9800', thickness: 0.30, lineType: 'continuous' },
  'A-WALL-INT': { id: 'A-WALL-INT', name: 'A-WALL-INT', visible: true, locked: false, frozen: false, plottable: true, color: '#FF9800', thickness: 0.25, lineType: 'continuous' },
  'A-DOOR': { id: 'A-DOOR', name: 'A-DOOR', visible: true, locked: false, frozen: false, plottable: true, color: '#4CAF50', thickness: 0.20, lineType: 'continuous' },
  'A-WINDOW': { id: 'A-WINDOW', name: 'A-WINDOW', visible: true, locked: false, frozen: false, plottable: true, color: '#00BCD4', thickness: 0.20, lineType: 'continuous' },
  'A-COLS': { id: 'A-COLS', name: 'A-COLS', visible: true, locked: false, frozen: false, plottable: true, color: '#FF00FF', thickness: 0.35, lineType: 'continuous' },
  'A-BEAMS': { id: 'A-BEAMS', name: 'A-BEAMS', visible: true, locked: false, frozen: false, plottable: true, color: '#F44336', thickness: 0.18, lineType: 'dashed' },
  'A-DIM': { id: 'A-DIM', name: 'A-DIM', visible: true, locked: false, frozen: false, plottable: true, color: '#FFEB3B', thickness: 0.15, lineType: 'continuous' },
  'A-TEXT': { id: 'A-TEXT', name: 'A-TEXT', visible: true, locked: false, frozen: false, plottable: true, color: '#FFFFFF', thickness: 0.18, lineType: 'continuous' },
  'A-GRID': { id: 'A-GRID', name: 'A-GRID', visible: true, locked: false, frozen: false, plottable: true, color: '#607D8B', thickness: 0.15, lineType: 'continuous' },
  'A-FURN': { id: 'A-FURN', name: 'A-FURN', visible: true, locked: false, frozen: false, plottable: true, color: '#81C784', thickness: 0.15, lineType: 'continuous' }
};

export type ToolbarCategory = 'Draw' | 'Modify' | 'Anno' | 'View' | 'Tools' | 'History' | 'Edit' | 'Macros';
type PanelType = 'none' | 'layers' | 'properties' | 'calculator' | 'drafting' | 'file' | 'mainmenu' | 'drawing_props' | 'help' | 'about' | 'privacy' | 'new_file' | 'dimstyle' | 'linetypes' | 'views' | 'ai_drafting' | 'blocks' | 'wall_align' | 'dashboard' | 'section_generator' | 'block_definition';

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

const findMostRecentRectangularBoundary = (layers: Record<string, Shape[]>): { xMin: number, yMin: number, xMax: number, yMax: number } | null => {
  // Candidate layers in order of relevance for walls
  const wallLayers = ['A-WALL', 'A-WALL-INT', '0', 'A-SKETCH'];
  const otherLayers = Object.keys(layers).filter(l => !wallLayers.includes(l));
  const searchLayers = [...wallLayers, ...otherLayers];

  for (const layerName of searchLayers) {
    const shapes = layers[layerName];
    if (!shapes || shapes.length === 0) continue;

    // Traverse from latest (end of array) to earliest
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      if (!s) continue;

      // Case 1: Direct 'rect' shape
      if (s.type === 'rect') {
        const r = s as any;
        if (r.width !== 0 && r.height !== 0) {
          return {
            xMin: Math.min(r.x, r.x + r.width),
            xMax: Math.max(r.x, r.x + r.width),
            yMin: Math.min(r.y, r.y + r.height),
            yMax: Math.max(r.y, r.y + r.height)
          };
        }
      }

      // Case 2: Polyline (poly, pline, polygon) with 4 or 5 vertices forming a rectangle
      if (s.type === 'poly' || s.type === 'pline' || s.type === 'polygon') {
        const p = s as any;
        if (p.points && p.points.length >= 4) {
          const pts: Point[] = p.points.map((pt: any) => {
            if (typeof pt === 'object' && pt !== null && 'x' in pt && 'y' in pt) {
              return pt as Point;
            } else if (Array.isArray(pt) && pt.length >= 2) {
              return { x: pt[0], y: pt[1] };
            }
            return null;
          }).filter((pt: any): pt is Point => pt !== null);

          if (pts.length >= 4) {
            const xs = pts.map(pt => pt.x);
            const ys = pts.map(pt => pt.y);
            const xMin = Math.min(...xs);
            const xMax = Math.max(...xs);
            const yMin = Math.min(...ys);
            const yMax = Math.max(...ys);

            const isRect = pts.every(pt => 
              (Math.abs(pt.x - xMin) < 5.0 || Math.abs(pt.x - xMax) < 5.0) &&
              (Math.abs(pt.y - yMin) < 5.0 || Math.abs(pt.y - yMax) < 5.0)
            );
            if (isRect && (xMax - xMin) > 10.0 && (yMax - yMin) > 10.0) {
              return { xMin, xMax, yMin, yMax };
            }
          }
        }
      }

      // Case 3: Double Line 'dline' forming a closed box
      if (s.type === 'dline') {
        const dl = s as any;
        if (dl.points && dl.points.length >= 4) {
          const pts = dl.points;
          const xs = pts.map((pt: any) => pt.x);
          const ys = pts.map((pt: any) => pt.y);
          const xMin = Math.min(...xs);
          const xMax = Math.max(...xs);
          const yMin = Math.min(...ys);
          const yMax = Math.max(...ys);
          
          const isRect = pts.every((pt: any) => 
            (Math.abs(pt.x - xMin) < 5.0 || Math.abs(pt.x - xMax) < 5.0) &&
            (Math.abs(pt.y - yMin) < 5.0 || Math.abs(pt.y - yMax) < 5.0)
          );
          if (isRect && (xMax - xMin) > 10.0 && (yMax - yMin) > 10.0) {
            return { xMin, xMax, yMin, yMax };
          }
        }
      }
    }
  }

  // Case 4: Group of 4 connected perpendicular lines in a wall layer
  for (const layerName of ['A-WALL', 'A-WALL-INT', '0']) {
    const shapes = layers[layerName];
    if (!shapes || shapes.length < 4) continue;

    const lines = shapes.filter(s => s.type === 'line') as any[];
    if (lines.length < 4) continue;

    const sliceCount = Math.min(lines.length, 12);
    const recentLines = lines.slice(-sliceCount);

    for (let i = 0; i < recentLines.length; i++) {
      for (let j = i + 1; j < recentLines.length; j++) {
        for (let k = j + 1; k < recentLines.length; k++) {
          for (let l = k + 1; l < recentLines.length; l++) {
            const cand = [recentLines[i], recentLines[j], recentLines[k], recentLines[l]];
            
            const isOrtho = cand.every(line => 
              Math.abs(line.x1 - line.x2) < 5.0 || Math.abs(line.y1 - line.y2) < 5.0
            );
            if (!isOrtho) continue;

            const tolerance = 25.0;
            const uniquePoints: Point[] = [];
            const addPt = (p: Point) => {
              if (!uniquePoints.some(up => Math.hypot(up.x - p.x, up.y - p.y) < tolerance)) {
                uniquePoints.push(p);
              }
            };
            cand.forEach(line => {
              addPt({ x: line.x1, y: line.y1 });
              addPt({ x: line.x2, y: line.y2 });
            });

            if (uniquePoints.length === 4) {
              const xs = uniquePoints.map(p => p.x);
              const ys = uniquePoints.map(p => p.y);
              const xMin = Math.min(...xs);
              const xMax = Math.max(...xs);
              const yMin = Math.min(...ys);
              const yMax = Math.max(...ys);

              const formsRect = uniquePoints.every(p => 
                (Math.abs(p.x - xMin) < tolerance || Math.abs(p.x - xMax) < tolerance) &&
                (Math.abs(p.y - yMin) < tolerance || Math.abs(p.y - yMax) < tolerance)
              );
              if (formsRect && (xMax - xMin) > tolerance && (yMax - yMin) > tolerance) {
                return { xMin, xMax, yMin, yMax };
              }
            }
          }
        }
      }
    }
  }

  return null;
};

const App: React.FC = () => {
  const { user, isAuthenticated } = useSession();
  const [layers, setLayers] = useState<Record<string, Shape[]>>({ '0': [], 'defpoints': [] });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<Record<string, BlockDefinition>>({});
  const [layouts, setLayouts] = useState<LayoutDefinition[]>([
    { id: 'layout1', name: 'Layout 1', paperSize: { width: 297, height: 210 }, viewports: [] }
  ]);
  const [layerConfig, setLayerConfig] = useState<Record<string, LayerConfig>>(INITIAL_LAYERS_CONFIG);
  const [lineTypes, setLineTypes] = useState<Record<string, LineTypeDefinition>>({ 'continuous': { name: 'continuous', description: 'Solid line', pattern: [] } });
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [activeTab, setActiveTab] = useState<string>('model');
  const [collaborators, setCollaborators] = useState<any[]>([]);

  const [editingBlockName, setEditingBlockName] = useState<string | null>(null);
  const editingBlockNameRef = useRef<string | null>(null);
  const [originalLayers, setOriginalLayers] = useState<Record<string, Shape[]> | null>(null);
  const [originalViewState, setOriginalViewState] = useState<ViewState | null>(null);
  const [blockDefPickedPoint, setBlockDefPickedPoint] = useState<Point | null>(null);
  const [blockDefTempValues, setBlockDefTempValues] = useState<{ name: string; action: 'retain' | 'convert' | 'delete' } | null>(null);
  const [isPickingBlockBasePoint, setIsPickingBlockBasePoint] = useState<boolean>(false);

  const localUserId = useMemo(() => {
    return user?.uid || `user_${Math.random().toString(36).substring(2, 11)}`;
  }, [user]);

  const localUserName = useMemo(() => {
    return user?.displayName || user?.email?.split('@')[0] || "Draftsman (Guest)";
  }, [user]);

  const localUserColor = useMemo(() => {
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    const codes = localUserId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[Math.abs(codes) % colors.length];
  }, [localUserId]);

  // Synchronize local cursor location and active selections to Firestore
  useEffect(() => {
    let lastSync = 0;
    const syncFunc = async () => {
      const now = Date.now();
      if (now - lastSync < 200) return; // limit to 5hz
      lastSync = now;
      await syncLiveCursor(localUserId, {
        name: localUserName,
        color: localUserColor,
        x: settings.cursorX || 0,
        y: settings.cursorY || 0,
        selection: selectedIds
      });
    };
    syncFunc();
  }, [settings.cursorX, settings.cursorY, selectedIds, localUserId, localUserName, localUserColor]);

  // Subscribe to collaborative cursors and run local simulator drift loop
  useEffect(() => {
    const unsubscribe = subscribeToLiveCursors((remoteCursors) => {
      const peers = remoteCursors.filter(c => c.userId !== localUserId);
      setCollaborators(prev => {
        const simulated = settings.showSimulatedCollaborators ? prev.filter(p => p.isSimulated) : [];
        return [...simulated, ...peers];
      });
    });

    if (!settings.showSimulatedCollaborators) {
      setCollaborators(prev => prev.filter(p => !p.isSimulated));
      return () => unsubscribe();
    }

    const sim1 = {
      userId: 'peer_sim_liam',
      name: 'Liam (Structure)',
      color: '#a855f7',
      x: 35,
      y: 20,
      selection: [],
      lastActive: Date.now(),
      isSimulated: true
    };
    const sim2 = {
      userId: 'peer_sim_sofia',
      name: 'Sofia (HVAC)',
      color: '#f59e0b',
      x: -45,
      y: -15,
      selection: [],
      lastActive: Date.now(),
      isSimulated: true
    };
    setCollaborators(prev => {
      const real = prev.filter(p => !p.isSimulated);
      return [...real, sim1, sim2];
    });

    const interval = setInterval(() => {
      setCollaborators(prev => {
        return prev.map(p => {
          if (!p.isSimulated) return p;
          const dx = (Math.random() - 0.5) * 8;
          const dy = (Math.random() - 0.5) * 8;
          
          let nextSelection = p.selection;
          if (Math.random() < 0.15) {
            const allShapes = Object.values(layersRef.current || {}).flat();
            if (allShapes.length > 0) {
              const randomShape = allShapes[Math.floor(Math.random() * allShapes.length)] as any;
              nextSelection = randomShape ? [randomShape.id] : [];
            } else {
              nextSelection = [];
            }
          }

          return {
            ...p,
            x: Math.max(-500, Math.min(500, p.x + dx)),
            y: Math.max(-500, Math.min(500, p.y + dy)),
            selection: nextSelection,
            lastActive: Date.now()
          };
        });
      });
    }, 1500);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [localUserId, settings.showSimulatedCollaborators]);
  const [currentFileName, setCurrentFileName] = useState('Drawing 1.vox');

  // Sync Conflict & Offline queuing integration
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictData, setConflictData] = useState<any>(null);

  const checkSyncConflict = useCallback(async (fileName: string) => {
    if (!navigator.onLine || !isAuthenticated) return;
    try {
      const queue = await storageService.getOfflineQueue(fileName);
      if (queue.length === 0) return;

      const cloudData = await cloudStorageService.loadFromCloud(fileName);
      if (!cloudData) {
        // Safe to push clean offline changes to cloud (no collisions)
        const latestOfflineSnap = queue[queue.length - 1];
        const ok = await cloudStorageService.saveToCloud(fileName, {
          layers: latestOfflineSnap.layers,
          settings: settingsRef.current,
          blocks: latestOfflineSnap.blocks,
          layouts: latestOfflineSnap.layouts,
          fileName
        });
        if (ok) {
          await storageService.clearOfflineQueue(fileName);
          setLogMessage("OFFLINE CHANGES AUTO-SYNCED TO CLOUD SUCESSFULLY.");
        }
        return;
      }

      // Conflict present: prompt user with choices
      const latestOfflineSnap = queue[queue.length - 1];
      setConflictData({
        fileName,
        localState: {
          layers: latestOfflineSnap.layers,
          layouts: latestOfflineSnap.layouts,
          blocks: latestOfflineSnap.blocks,
          timestamp: latestOfflineSnap.timestamp
        },
        cloudState: {
          layers: cloudData.layers,
          layouts: cloudData.layouts || [],
          blocks: cloudData.blocks || {},
          timestamp: Date.now()
        }
      });
      setShowConflictDialog(true);
    } catch (err) {
      console.error("FAILED_SYNC_CONFLICT_CHECK:", err);
    }
  }, [isAuthenticated]);

  const resolveSyncConflict = async (strategy: 'local' | 'cloud' | 'blend') => {
    if (!conflictData) return;
    const { fileName, localState, cloudState } = conflictData;
    
    try {
      if (strategy === 'local') {
        const ok = await cloudStorageService.saveToCloud(fileName, {
          layers: localState.layers,
          settings: settingsRef.current,
          blocks: localState.blocks,
          layouts: localState.layouts,
          fileName
        });
        if (ok) {
          setLogMessage("CONFLICT RESOLVED: FOREGROUNDED LOCAL DRAFT");
        }
      } else if (strategy === 'cloud') {
        setLayers(cloudState.layers);
        setBlocks(cloudState.blocks);
        setLayouts(cloudState.layouts);
        setLogMessage("CONFLICT RESOLVED: FOREGROUNDED CLOUD HUB SCHEME");
      } else if (strategy === 'blend') {
        const localLayers = localState.layers || {};
        const cloudLayers = cloudState.layers || {};
        const mergedLayers: any = {};
        
        const allLayerNames = new Set([
          ...Object.keys(localLayers),
          ...Object.keys(cloudLayers)
        ]);

        allLayerNames.forEach(layerName => {
          const lGeo = localLayers[layerName] || [];
          const cGeo = cloudLayers[layerName] || [];
          const seenIds = new Set<string>();
          const unified: any[] = [];
          
          lGeo.forEach((s: any) => {
            if (s && s.id) {
              seenIds.add(s.id);
              unified.push(s);
            }
          });

          cGeo.forEach((s: any) => {
            if (s && s.id && !seenIds.has(s.id)) {
              seenIds.add(s.id);
              unified.push(s);
            }
          });

          mergedLayers[layerName] = unified;
        });

        const mergedBlocks = { ...(cloudState.blocks || {}), ...(localState.blocks || {}) };
        const mergedLayouts = [
          ...localState.layouts,
          ...(cloudState.layouts || []).filter((cl: any) => !localState.layouts.some((ll: any) => ll.id === cl.id))
        ];

        setLayers(mergedLayers);
        setBlocks(mergedBlocks);
        setLayouts(mergedLayouts);

        const ok = await cloudStorageService.saveToCloud(fileName, {
          layers: mergedLayers,
          settings: settingsRef.current,
          blocks: mergedBlocks,
          layouts: mergedLayouts,
          fileName
        });
        if (ok) {
          setLogMessage("CONFLICT RESOLVED: MERGED BLUEPRINTS SYNCED SUCCESSFULLY");
        }
      }
      
      await storageService.clearOfflineQueue(fileName);
      setShowConflictDialog(false);
      setConflictData(null);
    } catch (err) {
      console.error("RECONCILIATION_ERROR:", err);
      setLogMessage("ERR RESOLVING SYNC CONFLICT");
    }
  };

  // Check sync on filename changing
  useEffect(() => {
    if (currentFileName) {
      checkSyncConflict(currentFileName);
    }
  }, [currentFileName, checkSyncConflict]);

  // Online connection listener
  useEffect(() => {
    const handleOnline = () => {
      if (currentFileName) {
        checkSyncConflict(currentFileName);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [currentFileName, checkSyncConflict]);
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
  const [showPurgeDialog, setShowPurgeDialog] = useState(false);
  const [purgeInfo, setPurgeInfo] = useState<{ layers: string[], blocks: string[], dimStyles: string[] } | null>(null);

  // Macro States
  const [savedMacros, setSavedMacros] = useState<Array<{ id: string, name: string, commands: string[] }>>(() => {
    try {
      const stored = localStorage.getItem('voxcadd_saved_macros');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isRecordingMacro, setIsRecordingMacro] = useState(false);
  const [recordedCommands, setRecordedCommands] = useState<string[]>([]);
  const isRecordingMacroRef = useRef(false);

  useEffect(() => {
    isRecordingMacroRef.current = isRecordingMacro;
  }, [isRecordingMacro]);

  const [isViewportActive, setIsViewportActive] = useState(false);
  const [activeViewportId, setActiveViewportId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, Shape[]>[]>([]);
  const [redoStack, setRedoStack] = useState<Record<string, Shape[]>[]>([]);
  const [tabViews, setTabViews] = useState<Record<string, ViewState>>({
    model: { ...INITIAL_VIEW },
    layout1: { scale: 3, originX: 0, originY: 0 },
  });

  const [objectContextMenu, setObjectContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [commandContextMenu, setCommandContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [lockedMousePoint, setLockedMousePoint] = useState<Point | null>(null);
  const [contextDistanceInput, setContextDistanceInput] = useState('');
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
                        
                        let content: string | Blob | Uint8Array;
                        if (isPdfExport) {
                            const res = await fetch(dataUrl);
                            content = await res.blob();
                        } else if (isDxfExport) {
                            content = shapesToDXF(Object.values(layers).flat() as Shape[], layerConfig, settings, blocks);
                        } else {
                            const updatedMetadata = { ...(settings.metadata || {}) };
                            content = VoxService.save(Object.values(layers).flat() as Shape[], currentFileName, updatedMetadata);
                            setSettings(prev => ({ ...prev, metadata: updatedMetadata }));
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
                            } catch (e: any) {
                                console.warn("Share failed. Downloading file as fallback.", e);
                                // Fallback to download if sharing failed or cancelled
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = fileName;
                                a.click();
                                setLogMessage("INFO: Sharing restricted by browser iframe. File downloaded instead.");
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
  const [importSummary, setImportSummary] = useState<{ 
    fileName: string; 
    stats: any;
    layers?: string[];
    blocks?: string[];
  } | null>(null);
  const [hatchSelector, setHatchSelector] = useState<{ 
    callback: (pattern: string) => void 
  } | null>(null);
  const [colorSelector, setColorSelector] = useState<{
    currentColor: string,
    onSelect: (color: string) => void,
    title?: string
  } | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  
  const getCommandFromAIWithState = useCallback(async (
    prompt: string, 
    contextSummary: string = "", 
    sketchData?: string | null, 
    history: any[] = [],
    drawingType?: string,
    standards?: string
  ) => {
    setIsAiThinking(true);
    try {
      const res = await getCommandFromAI(prompt, contextSummary, sketchData, history, drawingType, standards);
      return res;
    } finally {
      setIsAiThinking(false);
    }
  }, []);

  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [prevUnits, setPrevUnits] = useState(settings.units);
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
  const recognitionRef = useRef<any>(null);
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
    let active = true;
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
          if (!active) return;
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
                  if (!active) return;
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
      if (!active) return;
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
        const isVox = file.name.toLowerCase().endsWith('.vox');
        const content = (isDwg || isVox) ? await file.arrayBuffer() : await file.text();
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
          const isVox = file.name.toLowerCase().endsWith('.vox');
          const content = (isDwg || isVox) ? await file.arrayBuffer() : await file.text();
          handleOpenFile(file.name, content, "device/storage");
        }
      });
    }

    return () => {
      active = false;
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const fitToScreen = useCallback((currentShapes: any[]) => {
    if (!currentShapes || currentShapes.length === 0) return;

    // Record the previous viewport scale and position before calling autoFitToDrawing
    saveToViewHistory();

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // Use our custom getAllShapesBounds as the primary bounds
    const bounds = getAllShapesBounds(currentShapes, blocks);
    if (bounds && bounds.xMin !== Infinity && bounds.yMin !== Infinity && bounds.xMax !== -Infinity && bounds.yMax !== -Infinity) {
      minX = bounds.xMin;
      minY = bounds.yMin;
      maxX = bounds.xMax;
      maxY = bounds.yMax;
    }

    // Secondary fallback bounds checking from raw points if bounds are rawly requested
    if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
      currentShapes.forEach((shape) => {
        if (shape.type === 'line' && (shape.points || shape.x1 !== undefined)) {
          if (shape.points) {
            for (let i = 0; i < shape.points.length; i += 2) {
              minX = Math.min(minX, shape.points[i]);
              minY = Math.min(minY, shape.points[i + 1]);
              maxX = Math.max(maxX, shape.points[i]);
              maxY = Math.max(maxY, shape.points[i + 1]);
            }
          } else {
            minX = Math.min(minX, shape.x1, shape.x2);
            minY = Math.min(minY, shape.y1, shape.y2);
            maxX = Math.max(maxX, shape.x1, shape.x2);
            maxY = Math.max(maxY, shape.y1, shape.y2);
          }
        } else {
          const x = shape.x || shape.centerX || shape.x1 || 0;
          const y = shape.y || shape.centerY || shape.y1 || 0;
          const size = 600; // Large safety buffer
          minX = Math.min(minX, x - size);
          minY = Math.min(minY, y - size);
          maxX = Math.max(maxX, x + size);
          maxY = Math.max(maxY, y + size);
        }
      });
    }

    if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
      return;
    }

    // Use user-defined safe padding from drafting settings if available
    const padding = settingsRef.current?.autoFitPadding !== undefined ? settingsRef.current.autoFitPadding : 350;
    const width = maxX - minX;
    const height = maxY - minY;

    if (width < 100 || height < 100) return;

    // Use extremely robust physical screenspace calculations to bypass race conditions
    const stageWidth = window.innerWidth * 0.8;
    const stageHeight = window.innerHeight * 0.7;

    // Calculate optimal scale using the user's aggressive 0.75 factor and padding
    const baseScale = Math.min(stageWidth / (width + padding), stageHeight / (height + padding));
    let scale = baseScale * 0.75; 

    if (scale <= 0 || !isFinite(scale)) return;

    // Calculate dynamic center: base bounding box center weighted with shape density centroid to prevent severe outliner skew
    let midX = minX + width / 2;
    let midY = minY + height / 2;

    const centroidShapes = currentShapes.filter(s => s && s.type !== 'ray' && s.type !== 'xline');
    if (centroidShapes.length > 0) {
      let sumX = 0;
      let sumY = 0;
      let cnt = 0;
      centroidShapes.forEach(shape => {
         const sx = shape.x || shape.centerX || shape.x1 || (shape.points ? shape.points[0] : undefined);
         const sy = shape.y || shape.centerY || shape.y1 || (shape.points ? shape.points[1] : undefined);
         if (sx !== undefined && sy !== undefined && isFinite(sx) && isFinite(sy)) {
           sumX += sx;
           sumY += sy;
           cnt++;
         }
      });
      if (cnt > 0) {
        const cx = sumX / cnt;
        const cy = sumY / cnt;
        // 50% bounding box center, 50% geometric centroid
        midX = midX * 0.5 + cx * 0.5;
        midY = midY * 0.5 + cy * 0.5;
      }
    }

    const drawingScaleVal = settingsRef.current?.drawingScale || 1.0;
    let finalScale = scale / drawingScaleVal;

    // Maximum zoom limit to prevent extreme magnification with sparse/empty files
    const MAX_ZOOM_LIMIT = 5.0;
    if (finalScale > MAX_ZOOM_LIMIT) {
      finalScale = MAX_ZOOM_LIMIT;
      scale = finalScale * drawingScaleVal;
    }

    setView({
       scale: finalScale,
       originX: -midX * scale,
       originY: midY * scale
    });

    console.log(`🚀 FINAL Auto-Fit Applied | Scale: ${finalScale.toFixed(3)} | Center: (${(-midX * scale).toFixed(0)}, ${(midY * scale).toFixed(0)}) | Padding: ${padding}`);
  }, [setView, blocks, saveToViewHistory]);

  const autoFitDrawing = fitToScreen;

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
            if (typeof content !== 'string' && !(content instanceof ArrayBuffer)) {
                setLoadingFile(false);
                return;
            }
            try {
                // Try standard voxToProject first
                project = voxToProject(content);
            } catch (e) {
                console.warn("VOX parsing failed, trying fallbacks", e);
                project = null;
            }

            // Fallback: Use new robust VoxService.load to parsed requested format
            if (!project || !project.entities || project.entities.length === 0) {
                try {
                    let text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                    if (text && text.trim().startsWith('{')) {
                        const loaded = VoxService.load(text);
                        if (loaded && loaded.shapes && loaded.shapes.length > 0) {
                            const statsCounts: Record<string, number> = {};
                            loaded.shapes.forEach(s => {
                                statsCounts[s.type] = (statsCounts[s.type] || 0) + 1;
                            });
                            project = {
                                version: "2.0",
                                meta: {
                                    name: loaded.metadata.name || "Untitled",
                                    author: loaded.metadata.author || "Sachin",
                                    createdAt: loaded.metadata.createdAt || new Date().toISOString(),
                                    lastModified: loaded.metadata.modifiedAt || new Date().toISOString(),
                                    revision: "REV-01",
                                    projectRevision: "V-1.0"
                                },
                                settings: {
                                    ...settingsRef.current,
                                    gridSize: 20,
                                    snapEnabled: true,
                                    units: loaded.metadata.units || "mm",
                                    metadata: loaded.metadata
                                },
                                layers: {
                                    '0': { id: '0', name: '0', visible: true, locked: false, frozen: false, plottable: true, color: '#FFFFFF', thickness: 0.25, lineType: 'continuous' }
                                },
                                lineTypes: {},
                                textStyles: {},
                                blocks: {},
                                entities: loaded.shapes,
                                layouts: {},
                                bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
                                stats: {
                                    total: loaded.shapes.length,
                                    unsupported: 0,
                                    counts: statsCounts
                                }
                            };

                            const finalName = fileName;
                            const finalCount = loaded.shapes.length;
                            const projName = loaded.metadata.name || 'Untitled';
                            setTimeout(() => {
                                alert(`✅ Import Successful!\n\n` +
                                  `File: ${finalName}\n` +
                                  `Entities Loaded: ${finalCount}\n` +
                                  `Project: ${projName}\n\n` +
                                  `Check console for detailed breakdown.`
                                );
                                console.log(`✅ Import Summary:\nFile: ${finalName}\nEntities Loaded: ${finalCount}\nProject: ${projName}\nShapes:`, loaded.shapes);
                            }, 500);
                        }
                    }
                } catch (fallbackErr) {
                    console.error("VoxService load fallback failed", fallbackErr);
                }
            } else {
                // If standard voxToProject handles it
                const finalName = fileName;
                const finalCount = project.entities.length;
                const projName = project.meta?.name || 'Untitled';
                setTimeout(() => {
                    alert(`✅ Import Successful!\n\n` +
                      `File: ${finalName}\n` +
                      `Entities Loaded: ${finalCount}\n` +
                      `Project: ${projName}\n\n` +
                      `Check console for detailed breakdown.`
                    );
                    console.log(`✅ Import Summary:\nFile: ${finalName}\nEntities Loaded: ${finalCount}\nProject: ${projName}\nShapes:`, project.entities);
                }, 500);
            }
            
            // Fallback for DXF-formatted .vox files (legacy or renamed)
            if (!project && typeof content === 'string') {
                const trimmed = content.trim();
                if (trimmed.startsWith('999') || trimmed.includes('SECTION')) {
                    project = await dxfToProject(content, settingsRef.current);
                }
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

                // Zoom extents on fresh drawing contents to ensure they fit correctly within the viewport on open
                if (project.entities && project.entities.length > 0) {
                    setTimeout(() => {
                        autoFitDrawing(project.entities);
                    }, 50);
                    setTimeout(() => {
                        autoFitDrawing(project.entities);
                    }, 200);
                    setTimeout(() => {
                        autoFitDrawing(project.entities);
                    }, 450);   // Delayed auto-centering update as requested
                    setTimeout(() => {
                        autoFitDrawing(project.entities);
                    }, 700);
                    setTimeout(() => {
                        autoFitDrawing(project.entities);
                    }, 1200);
                }

                if (project.stats) {
                    setImportSummary({ 
                        fileName, 
                        stats: project.stats,
                        layers: Object.keys(finalLayerConfig),
                        blocks: Object.keys(project.blocks || {})
                    });
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
    // If Wall Cleanup Mode is enabled, automatically trigger cleanup of existing walls
    if (settingsRef.current.wallCleanupMode) {
      const wallLayers = ['A-WALL', 'A-WALL-INT'];
      const current = layersRef.current;
      let countUpdated = 0;

      wallLayers.forEach((layerName) => {
        const shapes = current[layerName];
        if (shapes && shapes.length > 0) {
          const cleaned = cleanupWallSegments(shapes);
          if (JSON.stringify(cleaned) !== JSON.stringify(shapes)) {
            current[layerName] = cleaned;
            countUpdated++;
          }
        }
      });

      const shapesZero = current['0'];
      if (shapesZero && shapesZero.length > 0) {
        const wallShapesZero = shapesZero.filter(s => s && (s.type === 'line' || s.type === 'dline'));
        if (wallShapesZero.length > 0) {
          const cleaned = cleanupWallSegments(shapesZero);
          if (JSON.stringify(cleaned) !== JSON.stringify(shapesZero)) {
            current['0'] = cleaned;
            countUpdated++;
          }
        }
      }

      if (countUpdated > 0) {
         setLayers({ ...current });
      }
    }

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
        if (!navigator.onLine) {
            storageService.pushOfflineCommand(currentFileName, currentState, layoutsRef.current, blocksRef.current);
            setLogMessage("SAVED LOCAL OFFLINE COMMAND OK. REMOTE RECONCILIATION QUEUED.");
        }
    }
  }, [currentFileName]);

  const executePurge = () => {
    if (!purgeInfo) return;

    // 1. Snapshot layers for undo
    setHistory(prev => [...prev.slice(-49), JSON.parse(JSON.stringify(layersRef.current))]);

    // 2. Remove purged empty layers from layers and config
    const nextLayers = { ...layersRef.current };
    const nextConfig = { ...layerConfig };
    purgeInfo.layers.forEach(layerName => {
      delete nextLayers[layerName];
      delete nextConfig[layerName];
    });

    // 3. Remove purged unused blocks
    const nextBlocks = { ...blocks };
    purgeInfo.blocks.forEach(blockId => {
      delete nextBlocks[blockId];
    });

    // 4. Remove purged dimension styles
    const nextSettings = { ...settings };
    if (nextSettings.dimStyles) {
      const nextStyles = { ...nextSettings.dimStyles };
      purgeInfo.dimStyles.forEach(styleId => {
        delete nextStyles[styleId];
      });
      nextSettings.dimStyles = nextStyles;
    }

    // 5. Update state
    layersRef.current = nextLayers;
    setLayers(nextLayers);
    setLayerConfig(nextConfig);
    setBlocks(nextBlocks);
    setSettings(nextSettings);

    // 6. Notify success
    const logStr = `PURGE: Successfully eliminated ${purgeInfo.layers.length} empty layers, ${purgeInfo.blocks.length} unused block definitions, and ${purgeInfo.dimStyles.length} unused dimension styles.`;
    setLogMessage(logStr);

    // 7. Save history
    commitToHistory();

    // 8. Close modal
    setShowPurgeDialog(false);
    setPurgeInfo(null);
  };

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
      case 'toggleDashboard': setActivePanel(activePanel === 'dashboard' ? 'none' : 'dashboard'); break;
      case 'toggleQSelect': setActivePanel(activePanel === 'qselect' ? 'none' : 'qselect'); break;
      case 'toggleLineTypes': setActivePanel(activePanel === 'linetypes' ? 'none' : 'linetypes'); break;
      case 'toggleProperties': setActivePanel(activePanel === 'properties' ? 'none' : 'properties'); break;
      case 'toggleCtbManager': setActivePanel(activePanel === 'ctb' ? 'none' : 'ctb'); break;
      case 'toggleCalculator': setActivePanel(activePanel === 'calculator' ? 'none' : 'calculator'); break;
      case 'toggleDimStyle': setActivePanel(activePanel === 'dimstyle' ? 'none' : 'dimstyle'); break;
      case 'toggleDraftingSettings': setActivePanel(activePanel === 'drafting' ? 'none' : 'drafting'); break;
      case 'toggleMainMenu': setActivePanel(activePanel === 'mainmenu' ? 'none' : 'mainmenu'); break;
      case 'toggleDrawingProps': setActivePanel(activePanel === 'drawing_props' ? 'none' : 'drawing_props'); break;
      case 'toggleHelp': setActivePanel(activePanel === 'help' ? 'none' : 'help'); break;
      case 'toggleAiDrafting': setActivePanel(activePanel === 'ai_drafting' ? 'none' : 'ai_drafting'); break;
      case 'toggleBlocks': setActivePanel(activePanel === 'blocks' ? 'none' : 'blocks'); break;
      case 'toggleWallAlignment': setActivePanel(activePanel === 'wall_align' ? 'none' : 'wall_align'); break;
      case 'toggleSectionGenerator': setActivePanel(activePanel === 'section_generator' ? 'none' : 'section_generator'); break;
      case 'enterBlockEditor': {
        const blockName = payload?.blockName;
        if (!blockName) break;
        const bDef = blocks[blockName] || PREDEFINED_BLOCKS[blockName];
        if (!bDef) {
          setLogMessage(`ERR: BLOCK "${blockName}" NOT FOUND`);
          break;
        }

        // 1. Back up current layout state
        setOriginalLayers(JSON.parse(JSON.stringify(layersRef.current)));
        setOriginalViewState({ ...view });
        
        // 2. Clear selections
        setSelectedIds([]);
        setPreviewShapes(null);
        engineRef.current?.cancel();

        // 3. Set editing state
        setEditingBlockName(blockName);
        editingBlockNameRef.current = blockName;

        // 4. Load block definition's shapes into live canvas layers
        const nextLayers: Record<string, Shape[]> = {};
        bDef.shapes.forEach((s: any) => {
          const ly = s.layer || '0';
          if (!nextLayers[ly]) nextLayers[ly] = [];
          
          const shapeCopy = JSON.parse(JSON.stringify(s));
          if (!shapeCopy.id) shapeCopy.id = Math.random().toString(36).substr(2, 9);
          nextLayers[ly].push(shapeCopy);
        });

        setLayers(nextLayers);
        layersRef.current = nextLayers;

        // 5. Center viewpoint directly to (0,0) with high zoom so they can easily edit
        setView({ scale: 0.1, originX: 0, originY: 0 });
        setLogMessage(`BLOCK_EDIT_MODE_ACTIVE: ${blockName}`);
        break;
      }
      case 'saveBlockEditor': {
        if (!editingBlockNameRef.current) {
          setLogMessage("ERR: NOT_IN_BLOCK_EDITOR");
          break;
        }
        
        const blockName = editingBlockNameRef.current;
        const currentShapesOnCanvas = Object.values(layersRef.current).flat() as Shape[];
        const clonedNewShapes = JSON.parse(JSON.stringify(currentShapesOnCanvas));

        setBlocks(prev => {
          const originalDef = prev[blockName] || PREDEFINED_BLOCKS[blockName];
          const nextDef: BlockDefinition = {
            id: originalDef?.id || Math.random().toString(36).substr(2, 9),
            name: originalDef?.name || blockName,
            basePoint: { x: 0, y: 0 },
            shapes: clonedNewShapes
          };
          const next = { ...prev, [blockName]: nextDef };
          blocksRef.current = next;
          return next;
        });

        setLogMessage(`BLOCK_EDIT_SAVED: ${blockName}`);
        break;
      }
      case 'closeBlockEditor': {
        if (!editingBlockNameRef.current) break;
        
        if (originalLayers) {
          setLayers(originalLayers);
          layersRef.current = originalLayers;
        }
        if (originalViewState) {
          setView(originalViewState);
        }
        
        setEditingBlockName(null);
        editingBlockNameRef.current = null;
        setOriginalLayers(null);
        setOriginalViewState(null);
        setSelectedIds([]);
        setPreviewShapes(null);
        engineRef.current?.cancel();
        setLogMessage("BLOCK_EDITOR_CLOSED");
        break;
      }
      case 'updateShapeRotation': {
        const { id, rotation } = payload;
        const current = layersRef.current;
        const next = { ...current };
        let updated = false;
        for (const layerName in next) {
          const arr = next[layerName];
          const idx = arr.findIndex(s => s.id === id);
          if (idx !== -1) {
            const copy = [...arr];
            copy[idx] = { ...copy[idx], rotation };
            next[layerName] = copy;
            updated = true;
            break;
          }
        }
        if (updated) {
          layersRef.current = next;
          setLayers(next);
        }
        break;
      }
      case 'commitHistory': {
        commitToHistory();
        break;
      }
      case 'startRecordingMacro': {
        setIsRecordingMacro(true);
        isRecordingMacroRef.current = true;
        setRecordedCommands([]);
        setLogMessage("MACRO_RECORDING_STARTED");
        break;
      }
      case 'cancelRecordingMacro': {
        setIsRecordingMacro(false);
        isRecordingMacroRef.current = false;
        setRecordedCommands([]);
        setLogMessage("MACRO_RECORDING_DISCARDED");
        break;
      }
      case 'stopRecordingMacro': {
        if (recordedCommands.length === 0) {
          setLogMessage("MACRO_EMPTY_DISCARDED");
          setIsRecordingMacro(false);
          isRecordingMacroRef.current = false;
          break;
        }
        setPromptDialog({
          title: "Save Custom Macro Button",
          message: `Confirm to save custom toolbar button containing ${recordedCommands.length} command sequence. Enter macro name:`,
          initialValue: `macro_${savedMacros.length + 1}`,
          type: 'prompt',
          onConfirm: (name) => {
            const macroName = (name || "").trim().toLowerCase();
            if (!macroName) return;
            const newMacro = {
              id: Date.now().toString(),
              name: macroName,
              commands: [...recordedCommands]
            };
            setSavedMacros(prev => {
              const updated = [...prev, newMacro];
              localStorage.setItem('voxcadd_saved_macros', JSON.stringify(updated));
              return updated;
            });
            setIsRecordingMacro(false);
            isRecordingMacroRef.current = false;
            setRecordedCommands([]);
            setPromptDialog(null);
            setLogMessage(`SAVED_MACRO: ${macroName.toUpperCase()}`);
          }
        });
        break;
      }
      case 'playMacro': {
        const cmds: string[] = payload || [];
        if (cmds.length === 0) break;
        setLogMessage(`RUNNING_MACRO: Executing sequence of ${cmds.length} commands...`);
        let delayIndex = 0;
        cmds.forEach((cmd) => {
          setTimeout(() => {
            executeCommand(cmd);
          }, delayIndex * 130);
          delayIndex++;
        });
        break;
      }
      case 'deleteMacro': {
        const macroId = payload;
        setPromptDialog({
          title: "Delete Custom Macro",
          message: "Are you sure you want to delete this custom macro button from your toolbar?",
          initialValue: "",
          type: 'confirm',
          onConfirm: () => {
            setSavedMacros(prev => {
              const updated = prev.filter(m => m.id !== macroId);
              localStorage.setItem('voxcadd_saved_macros', JSON.stringify(updated));
              return updated;
            });
            setPromptDialog(null);
            setLogMessage("MACRO_REMOVED_SUCCESS");
          }
        });
        break;
      }
      case 'toggleWallCleanupMode': {
        const nextMode = !settings.wallCleanupMode;
        setSettings(prev => ({
          ...prev,
          wallCleanupMode: nextMode
        }));

        if (nextMode) {
          // Pass execution to executeWallCleanup
          handleAction('executeWallCleanup');
        } else {
          setLogMessage("INFO: WALL_CLEANUP_MODE_DISABLED");
        }
        break;
      }
      case 'executeWallCleanup': {
        const wallLayers = ['A-WALL', 'A-WALL-INT'];
        const currentLayersMap = { ...layersRef.current };
        let countUpdated = 0;

        wallLayers.forEach((layerName) => {
          const shapes = currentLayersMap[layerName];
          if (shapes && shapes.length > 0) {
            const cleaned = cleanupWallSegments(shapes);
            if (JSON.stringify(cleaned) !== JSON.stringify(shapes)) {
              currentLayersMap[layerName] = cleaned;
              countUpdated++;
            }
          }
        });

        const shapesZero = currentLayersMap['0'];
        if (shapesZero && shapesZero.length > 0) {
          const wallShapesZero = shapesZero.filter(s => s && (s.type === 'line' || s.type === 'dline'));
          if (wallShapesZero.length > 0) {
            const cleaned = cleanupWallSegments(shapesZero);
            if (JSON.stringify(cleaned) !== JSON.stringify(shapesZero)) {
              currentLayersMap['0'] = cleaned;
              countUpdated++;
            }
          }
        }

        if (countUpdated > 0) {
          setHistory(prev => [...prev, JSON.parse(JSON.stringify(layersRef.current))]);
          layersRef.current = currentLayersMap;
          setLayers(currentLayersMap);
          setLogMessage("SUCCESS: WALL_INTERSECTIONS_CLEANED");
          commitToHistory();
        } else {
          setLogMessage("INFO: WALLS_ALREADY_CLEAN");
        }
        break;
      }
      case 'purge': {
        const info = getPurgeableItems(layersRef.current, blocks, settings);
        const total = info.layers.length + info.blocks.length + info.dimStyles.length;
        if (total === 0) {
          setLogMessage("PURGE: Drawing is already optimized. No unused layers, blocks, or dimension styles found.");
        } else {
          setPurgeInfo(info);
          setShowPurgeDialog(true);
        }
        break;
      }
      case 'batchPlotLayouts': {
        const selectedIds: string[] = payload || [];
        if (selectedIds.length === 0) {
          setLogMessage("ERR: NO_LAYOUTS_SELECTED");
          break;
        }

        const originalTab = activeTab;
        
        // Show loading spinner
        setLoadingFile(true);
        setLoadingStatus("INITIALIZING BATCH PLOT...");

        // Create a timeout promise helper
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        try {
          // Identify first page dimensions to initialize PDF
          const firstLayoutId = selectedIds[0];
          const firstLayout = layouts.find(l => l.id === firstLayoutId);
          if (!firstLayout) {
            throw new Error("Could not find layout: " + firstLayoutId);
          }
          const firstWidth = firstLayout.paperSize?.width || 297;
          const firstHeight = firstLayout.paperSize?.height || 210;
          const firstWidthPt = firstWidth * 2.83465;
          const firstHeightPt = firstHeight * 2.83465;

          const pdf = new jsPDF({
            orientation: firstWidthPt > firstHeightPt ? 'l' : 'p',
            unit: 'pt',
            format: [firstWidthPt, firstHeightPt]
          });

          let isFirstPage = true;

          // Sequential capture layout by layout
          for (let idx = 0; idx < selectedIds.length; idx++) {
            const layoutId = selectedIds[idx];
            const layout = layouts.find(l => l.id === layoutId);
            if (!layout) continue;

            const width = layout.paperSize?.width || 297;
            const height = layout.paperSize?.height || 210;
            const widthPt = width * 2.83465;
            const heightPt = height * 2.83465;

            // Update loading status
            setLoadingStatus(`PLOTTING SHEET ${idx + 1} OF ${selectedIds.length}: "${layout.name.toUpperCase()}"...`);
            
            // Swap active layout tab to enforce viewport render
            setActiveTab(layoutId);
            
            // Wait for React to mount, clean canvas, scale, and finish rendering layout
            await sleep(400);

            // Capture rendered paper space canvas
            const imgData = canvasHandleRef.current?.captureImage({ isPlotting: true });
            if (!imgData) {
              console.warn(`Could not capture image for layout: ${layout.name}`);
              continue;
            }

            if (isFirstPage) {
              isFirstPage = false;
              // Page 1 is already created with firstWidthPt/firstHeightPt, just draw image
              pdf.addImage(imgData, 'PNG', 0, 0, firstWidthPt, firstHeightPt);
            } else {
              // Add a new page matching the current layout's dimensions
              pdf.addPage([widthPt, heightPt], widthPt > heightPt ? 'l' : 'p');
              pdf.addImage(imgData, 'PNG', 0, 0, widthPt, heightPt);
            }
          }

          // Restore original tab
          setActiveTab(originalTab);
          await sleep(150);

          // Trigger download
          const pdfName = `batch_plot_${currentFileName.split('.')[0] || 'drawing'}_${Date.now()}.pdf`;
          pdf.save(pdfName);

          setLogMessage(`SUCCESS: BATCH_PLOTTED_${selectedIds.length}_PAGES`);
        } catch (err: any) {
          console.error("Batch plot failed", err);
          setLogMessage(`ERR: BATCH_PLOT_FAILED_${err?.message}`);
          setActiveTab(originalTab);
        } finally {
          setLoadingFile(false);
          setLoadingStatus("");
        }
        break;
      }
      case 'batchRename': {
        const { files, prefix, startFrom } = payload;
        if (!files || files.length === 0) break;
        
        let startSeq = startFrom || 1;
        let currentActiveName = currentFileName;
        
        for (let idx = 0; idx < files.length; idx++) {
          const targetName = files[idx];
          const ext = targetName.split('.').pop() || 'vox';
          const finalNewName = `${prefix}${startSeq + idx}.${ext}`;
          
          if (targetName === finalNewName) {
            continue;
          }
          
          try {
            const conflictExists = recentFiles.some(f => f.name.toLowerCase() === finalNewName.toLowerCase() && f.name !== targetName);
            if (conflictExists) {
              await storageService.deleteLarge(`${STORAGE_PREFIX}${finalNewName}`);
            }
            await storageService.renameLarge(`${STORAGE_PREFIX}${targetName}`, `${STORAGE_PREFIX}${finalNewName}`);
            
            if (targetName === currentActiveName) {
              currentActiveName = finalNewName;
            }
          } catch (err) {
            console.error(`Failed renaming ${targetName}`, err);
          }
        }
        
        setRecentFiles(prev => {
          let updated = [...prev];
          for (let idx = 0; idx < files.length; idx++) {
            const targetName = files[idx];
            const ext = targetName.split('.').pop() || 'vox';
            const finalNewName = `${prefix}${startSeq + idx}.${ext}`;
            updated = updated.filter(f => f.name.toLowerCase() !== finalNewName.toLowerCase() || f.name === targetName);
            updated = updated.map(f => f.name === targetName ? { ...f, name: finalNewName } : f);
          }
          localStorage.setItem(REGISTRY_KEY, JSON.stringify(updated));
          return updated;
        });
        
        if (currentActiveName !== currentFileName) {
          setCurrentFileName(currentActiveName);
        }
        
        setLogMessage(`SUCCESS: SEQUENTIALLY RENAMED ${files.length} FILE(S)`);
        break;
      }
      case 'dropBlock': {
        const { blockId, x, y, blockJson } = payload;
        let finalBlockId = blockId;
        
        if (blockJson) {
          try {
            const parsed = JSON.parse(blockJson);
            const blockName = parsed.name || blockId;
            if (!blocksRef.current[blockName]) {
              setBlocks(prev => ({ ...prev, [blockName]: parsed }));
              blocksRef.current[blockName] = parsed;
            }
            finalBlockId = blockName;
          } catch(e) {
            console.error("Failed to parse dropped block JSON", e);
          }
        } else if (!blocksRef.current[blockId] && PREDEFINED_BLOCKS[blockId]) {
          const pb = PREDEFINED_BLOCKS[blockId];
          setBlocks(prev => ({ ...prev, [blockId]: pb }));
          blocksRef.current[blockId] = pb;
        }

        const currentActiveLayer = settingsRef.current.currentLayer || '0';
        const instance: Shape = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'block',
          blockId: finalBlockId,
          x: x,
          y: y,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          layer: currentActiveLayer,
          color: 'BYLAYER'
        } as any;

        setLayers(prev => {
          const next = {
            ...prev,
            [currentActiveLayer]: [...(prev[currentActiveLayer] || []), instance]
          };
          layersRef.current = next;
          return next;
        });
        setLogMessage(`INSERTED: ${finalBlockId}`);
        commitToHistory();
        break;
      }
      case 'interpret_sketch': {
        const triggerSketchInterpretation = async (providedImage?: string) => {
           setIsAiThinking(true);
           setLogMessage("INTERPRETING SKETCH...");
           try {
             const imgData = providedImage || canvasHandleRef.current?.captureImage();
             const context = getAiContextSummary() + "\nScreen capture provided. Use the visible lines/sketches to infer geometry.";
             const res = await getCommandFromAI("Analyze this image as a CAD sketch. Convert the rough visual strokes into precise commands (RECT, LINE, CIRCLE, etc). Maintain relative proportions and align to axes where obvious.", context, imgData);
             if (res.commands && res.commands.length) {
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
        
        if (payload && typeof payload === 'string' && payload.startsWith('data:image')) {
            triggerSketchInterpretation(payload);
        } else {
            // Default to capture screen
            triggerSketchInterpretation();
        }
        break;
      }
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
            // Removed ts_scale division - zoom extents should fit model geometry regardless of drawing scale
        }

        if (bounds && targetW && targetH) {
            const w = Math.max(0.1, bounds.xMax - bounds.xMin);
            const h = Math.max(0.1, bounds.yMax - bounds.yMin);
            const centerX = (bounds.xMax + bounds.xMin) / 2;
            const centerY = (bounds.yMax + bounds.yMin) / 2;
            
            const padding = 1.25; 
            const scale = Math.min(targetW / (w * padding), targetH / (h * padding));
            const drawingScaleFactor = settingsRef.current.drawingScale || 1.0;
            
            setView({ 
                scale: scale / drawingScaleFactor, 
                originX: -centerX * scale, 
                originY: centerY * scale 
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
      case 'toggleViews': setActivePanel(activePanel === 'views' ? 'none' : 'views'); break;
      case 'saveView': {
        const name = payload;
        const newView: NamedView = {
          id: generateId(),
          name,
          ...view
        };
        setSettings(s => ({
          ...s,
          namedViews: [...(s.namedViews || []), newView]
        }));
        setLogMessage(`VIEW_SAVED: ${name.toUpperCase()}`);
        break;
      }
      case 'recallView': {
        const namedView = payload as NamedView;
        setView({
          scale: namedView.scale,
          originX: namedView.originX,
          originY: namedView.originY
        });
        setLogMessage(`VIEW_RECALLED: ${namedView.name.toUpperCase()}`);
        break;
      }
      case 'deleteView': {
        const viewId = payload;
        setSettings(s => ({
          ...s,
          namedViews: (s.namedViews || []).filter(v => v.id !== viewId)
        }));
        setLogMessage("VIEW_DELETED");
        break;
      }
      case 'commandContextMenu': {
        setCommandContextMenu(payload);
        if (payload && payload.wp) {
          setLockedMousePoint(payload.wp);
          if (engineRef.current) {
            engineRef.current.ctx.lastMousePoint = { ...payload.wp };
            engineRef.current.move(payload.wp, false);
          }
        } else if (engineRef.current && engineRef.current.ctx.lastMousePoint) {
          setLockedMousePoint({ ...engineRef.current.ctx.lastMousePoint });
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
        const shapeCount = Object.values(layersRef.current || {}).flat().length;
        const doClose = () => {
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
        };

        if (shapeCount > 0) {
          setPromptDialog({
            title: 'Close Workspace',
            message: 'Are you sure you want to close this drawing? Any unsaved changes will be permanently lost.',
            initialValue: '',
            type: 'confirm',
            onConfirm: doClose
          });
        } else {
          doClose();
        }
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
            const isVox = file.name.toLowerCase().endsWith('.vox');
            const content = (isDwg || isVox) ? await file.arrayBuffer() : await file.text();
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

            // Check if finalNewName already exists!
            const exists = recentFiles.some(f => f.name.toLowerCase() === finalNewName.toLowerCase() && f.name !== targetName);
            if (exists) {
              setPromptDialog({
                title: 'File Already Exists',
                message: `A file named "${finalNewName}" already exists. Would you like to overwrite it?`,
                initialValue: '',
                type: 'confirm',
                onConfirm: async () => {
                  // Delete existing file
                  await storageService.deleteLarge(`${STORAGE_PREFIX}${finalNewName}`);
                  // Rename target
                  await storageService.renameLarge(`${STORAGE_PREFIX}${targetName}`, `${STORAGE_PREFIX}${finalNewName}`);
                  
                  setRecentFiles(prev => {
                    const filtered = prev.filter(f => f.name.toLowerCase() !== finalNewName.toLowerCase());
                    const updated = filtered.map(f => f.name === targetName ? { ...f, name: finalNewName } : f);
                    localStorage.setItem(REGISTRY_KEY, JSON.stringify(updated));
                    return updated;
                  });

                  if (targetName === currentFileName) {
                    setCurrentFileName(finalNewName);
                  }
                  
                  setLogMessage(`SUCCESS: OVERWRITTEN AND RENAMED TO ${finalNewName.toUpperCase()}`);
                }
              });
              return;
            }

            // Normal rename if no conflict
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
        setPromptDialog({
          title: 'Delete Recent Drawing',
          message: `Are you sure you want to permanently delete "${payload}"? This action cannot be undone.`,
          initialValue: '',
          type: 'confirm',
          onConfirm: () => {
            const filtered = recentFiles.filter(f => f.name !== payload);
            setRecentFiles(filtered);
            localStorage.setItem(REGISTRY_KEY, JSON.stringify(filtered));
            storageService.deleteLarge(`${STORAGE_PREFIX}${payload}`);
            setLogMessage(`FILE_DELETED: ${payload}`);
          }
        });
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
            const updatedMeta = incrementProjectRevision(settingsRef.current.metadata);
            settingsRef.current.metadata = updatedMeta;
            setSettings({ ...settingsRef.current });

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

            let content: string | Uint8Array = "";
            if (isDxfExport) {
                content = shapesToDXF(Object.values(layersRef.current).flat() as Shape[], layerConfigRef.current, settingsRef.current, blocksRef.current);
            } else {
                const updatedMetadata = { ...(settingsRef.current.metadata || {}) };
                content = VoxService.save(Object.values(layersRef.current).flat() as Shape[], currentFileName, updatedMetadata);
                settingsRef.current.metadata = updatedMetadata;
                setSettings({ ...settingsRef.current });
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
            const updatedMetadata = { ...(settingsRef.current.metadata || {}) };
            const content = VoxService.save(Object.values(layersRef.current).flat() as Shape[], currentFileName, updatedMetadata);
            settingsRef.current.metadata = updatedMetadata;
            setSettings({ ...settingsRef.current });
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

  // Auto-Save Effect
  useEffect(() => {
    const timer = setInterval(() => {
        if (layersRef.current && Object.values(layersRef.current).flat().length > 0) {
            setLogMessage("Saving...");
            setTimeout(() => {
                commitToHistory();
                setLogMessage("AUTO_SAVE_COMPLETED");
            }, 800);
        }
    }, 30000); // Every 30 seconds
    return () => clearInterval(timer);
  }, [commitToHistory]);

  const getAiContextSummary = useCallback(() => {
    const allShapes = (Object.values(layersRef.current).flat() as Shape[]);
    const totalEntities = allShapes.length;
    const layerNames = Object.keys(layerConfig).join(', ');
    const bounds = getAllShapesBounds(allShapes, blocks);
    const sketchShapes = (layersRef.current['A-SKETCH'] || []).length;
    
    // Detailed Selected Entity context
    const selected = allShapes.filter(s => selectedIds.includes(s.id));
    const selectionContext = selected.length > 0 
      ? `\n      - Active Selection (${selected.length} items):\n` + selected.map(s => {
          if (s.type === 'line') return `        * Line [id: ${s.id}, layer: ${s.layer}, start: (${s.x1.toFixed(1)},${s.y1.toFixed(1)}), end: (${s.x2.toFixed(1)},${s.y2.toFixed(1)})]`;
          if (s.type === 'rect') return `        * Rect [id: ${s.id}, layer: ${s.layer}, origin: (${s.x.toFixed(1)},${s.y.toFixed(1)}), w: ${s.width.toFixed(1)}, h: ${s.height.toFixed(1)}]`;
          if (s.type === 'circle') return `        * Circle [id: ${s.id}, layer: ${s.layer}, center: (${s.x.toFixed(1)},${s.y.toFixed(1)}), r: ${s.radius.toFixed(1)}]`;
          if (s.type === 'arc') return `        * Arc [id: ${s.id}, layer: ${s.layer}, center: (${s.x.toFixed(1)},${s.y.toFixed(1)}), r: ${s.radius.toFixed(1)}, angles: ${s.startAngle.toFixed(1)} to ${s.endAngle.toFixed(1)}]`;
          if (s.type === 'pline' || s.type === 'spline' || s.type === 'polygon' || s.type === 'dline') {
            const count = (s as any).points?.length || 0;
            return `        * ${s.type.toUpperCase()} [id: ${s.id}, layer: ${s.layer}, vertices: ${count}, closed: ${(s as any).closed ? 'Yes' : 'No'}]`;
          }
          if (s.type === 'text' || s.type === 'mtext') return `        * Text [id: ${s.id}, layer: ${s.layer}, content: "${(s as any).content || ''}"]`;
          return `        * ${s.type.toUpperCase()} [id: ${s.id}, layer: ${s.layer}]`;
        }).join('\n')
      : '\n      - Active Selection: None';

    // === GRANULAR ARCHITECTURAL METRICS ===
    // 1. Floor Area vs Window Area
    let totalFloorArea = 60000000; // default 60 sq.m in mm2
    if (bounds) {
      const wPlan = bounds.xMax - bounds.xMin;
      const hPlan = bounds.yMax - bounds.yMin;
      if (wPlan > 1000 && hPlan > 1000) {
        totalFloorArea = wPlan * hPlan;
      }
    }
    
    let totalWindowArea = 0;
    const windowShapes = layersRef.current['A-WINDOW'] || [];
    windowShapes.forEach(ws => {
      if (ws.type === 'rect') {
        const r = ws as any;
        totalWindowArea += r.width * r.height;
      } else if (ws.type === 'line') {
        const l = ws as LineShape;
        const len = Math.sqrt((l.x2 - l.x1) ** 2 + (l.y2 - l.y1) ** 2);
        totalWindowArea += len * 1200; // Assume standard window lintel height 1200mm
      } else if (ws.type === 'dline') {
        const dl = ws as any;
        const len = Math.sqrt((dl.x2 - dl.x1) ** 2 + (dl.y2 - dl.y1) ** 2);
        totalWindowArea += len * 1200;
      }
    });
    
    const windowFloorRatio = (totalWindowArea / totalFloorArea) * 100;
    const complianceStatus = windowFloorRatio >= 10.0 ? "CRITICAL VALUE COMPLIANT (>10% ratio)" : "HEURISTIC WARNING: INSUFFICIENT NATURAL LIGHTING (<10% ratio)";

    // 2. Room label detections and topological adjacency matching (within 6.5m range threshold)
    const textShapes = layersRef.current['A-TEXT'] || [];
    const roomsCoords: { name: string; x: number; y: number }[] = [];
    textShapes.forEach(ts => {
      const content = ((ts as any).content || "").trim().toUpperCase();
      // Match room keywords
      if (content && /ROOM|BED|BATH|KITCHEN|TOILET|LIVING|LOUNGE|BALCONY|HALL|STUDY/.test(content)) {
        roomsCoords.push({ name: content.split('\n')[0], x: (ts as any).x || (ts as any).x1 || 0, y: (ts as any).y || (ts as any).y1 || 0 });
      }
    });

    const adjacencies: string[] = [];
    for (let i = 0; i < roomsCoords.length; i++) {
      for (let j = i + 1; j < roomsCoords.length; j++) {
        const rA = roomsCoords[i];
        const rB = roomsCoords[j];
        const dist = Math.sqrt((rA.x - rB.x) ** 2 + (rA.y - rB.y) ** 2);
        if (dist < 6500) { // sharing adjacency if within 6.5 meters
          adjacencies.push(`${rA.name} <-> ${rB.name} (${(dist/1000).toFixed(1)}m spacing)`);
        }
      }
    }

    // 3. Structural Column & Wall grid Beam Centerlines
    const beamCenterlines: string[] = [];
    const walls = layersRef.current['A-WALL'] || [];
    // Separate distinct structural alignments
    const vertCentres: number[] = [];
    const horizCentres: number[] = [];
    walls.forEach(w => {
      if (w.type === 'line') {
        const l = w as LineShape;
        if (Math.abs(l.x1 - l.x2) < 20) vertCentres.push((l.x1 + l.x2)/2);
        if (Math.abs(l.y1 - l.y2) < 20) horizCentres.push((l.y1 + l.y2)/2);
      } else if (w.type === 'rect') {
        const r = w as any;
        if (r.width > 20 && r.height > 1000) vertCentres.push(r.x + r.width / 2);
        if (r.height > 20 && r.width > 1000) horizCentres.push(r.y + r.height / 2);
      }
    });

    // Deduplicate beam alignments
    const dedup = (arr: number[]) => {
      const res: number[] = [];
      arr.sort((a,b)=>a-b).forEach(v => {
        if (!res.some(existing => Math.abs(existing - v) < 200)) {
          res.push(v);
        }
      });
      return res;
    };
    const finalVertBeams = dedup(vertCentres);
    const finalHorizBeams = dedup(horizCentres);
    
    finalVertBeams.slice(0, 6).forEach((bx, idx) => beamCenterlines.push(`Vertical Beam Axis V-${idx+1} at x=${bx.toFixed(0)}mm`));
    finalHorizBeams.slice(0, 6).forEach((by, idx) => beamCenterlines.push(`Horizontal Beam Axis H-${idx+1} at y=${by.toFixed(0)}mm`));

    return `
      Drawing Context:
      - Units: ${settingsRef.current.units} (${settingsRef.current.unitSubtype})
      - Active Layer: ${settingsRef.current.currentLayer}
      - Visible Layers: ${layerNames}
      - Entity Count: ${totalEntities}
      - Sketches in 'A-SKETCH': ${sketchShapes}
      - Extents: ${bounds ? `Min(${bounds.xMin.toFixed(0)}, ${bounds.yMin.toFixed(0)}), Max(${bounds.xMax.toFixed(0)}, ${bounds.yMax.toFixed(0)})` : 'None'}
      - Viewport: Scale=${view.scale.toFixed(3)}, Origin=(${view.originX.toFixed(0)}, ${view.originY.toFixed(0)})
      - Cursor: (${engineRef.current?.ctx.lastMousePoint.x.toFixed(0)}, ${engineRef.current?.ctx.lastMousePoint.y.toFixed(0)})
      - Active Command: ${activeCommandName || 'None'}
      - Snap Settings: ${settingsRef.current.snapEnabled ? 'ON' : 'OFF'} (Endpoint: ${settingsRef.current.snapEndpoint ? 'Y' : 'N'}, Midpoint: ${settingsRef.current.snapMidpoint ? 'Y' : 'N'}, Center: ${settingsRef.current.snapCenter ? 'Y' : 'N'})
      - Ortho Mode: ${settingsRef.current.ortho ? 'ON' : 'OFF'}
      - Polar Tracking: ${settingsRef.current.polarTrackingEnabled ? 'ON' : 'OFF'} (Step: ${settingsRef.current.polarTrackingAngle}°)${selectionContext}
      
      === PREMIUM AI ARCHITECT ENVIRONMENTAL SUMMARY ===
      - Room-to-Room Adjacencies:
        ${adjacencies.length > 0 ? adjacencies.map(a => `* ${a}`).join('\n        ') : 'No adjacencies computed.'}
      - Structural Load-Bearing Beams Centerlines (Grid Plan Matrix):
        ${beamCenterlines.length > 0 ? beamCenterlines.map(b => `* ${b}`).join('\n        ') : 'No beam alignments detected.'}
      - Lighting & Ventilation Analysis:
        * Total Floor Area: ${(totalFloorArea / 1000000).toFixed(2)} m²
        * Total Window Aperture: ${(totalWindowArea / 1000000).toFixed(2)} m²
        * Window-to-Floor Area Ratio (WFR): ${windowFloorRatio.toFixed(1)}%
        * Daylight Compliance status: ${complianceStatus}
    `.trim();
  }, [layerConfig, view, activeCommandName, blocks, selectedIds]);

  // Real-time architectural suggestions
  useEffect(() => {
    if (!activeCommandName) {
      setAiRecommendation(null);
      return;
    }

    const cmd = activeCommandName.toUpperCase();
    if (cmd === 'LINE' || cmd === 'PLINE' || cmd === 'DLINE') {
      setAiRecommendation("Wall Standard: 230mm (Ext) / 115mm (Int)");
    } else if (cmd === 'RECT' || cmd === 'RECTANGLE') {
      setAiRecommendation("Master Bedroom: 4500x4000 | Bath: 2400x1500");
    } else if (cmd === 'CIRCLE') {
      setAiRecommendation("R: 150 (Circular Column) | 600 (Vent Fan)");
    } else if (cmd === 'OFFSET') {
      setAiRecommendation("Offset 230 for walls | 100 for path edge");
    } else {
      setAiRecommendation(null);
    }
  }, [activeCommandName]);

  // Global Escape/Delete Key Handler
  useEffect(() => {
    if (settings.units !== prevUnits) {
       const factor = (prevUnits === 'mm' && settings.units === 'in') ? 1/25.4 : 
                      (prevUnits === 'in' && settings.units === 'mm') ? 25.4 : 1;
       
       if (factor !== 1) {
          setPromptDialog({
            title: `Unit Conversion (${prevUnits} → ${settings.units})`,
            message: `The drawing units changed. Would you like to rescale all existing geometry by ${factor.toFixed(4)} to maintain physical dimensions?`,
            initialValue: '',
            type: 'confirm',
            onConfirm: () => {
               handleRescale(factor);
               setLogMessage(`Auto-Rescaled drawing by ${factor.toFixed(4)} to match new units (${settings.units}).`);
            }
          });
       }
       setPrevUnits(settings.units);
    }
  }, [settings.units]);

  const handleRescale = (factor: number) => {
     setLayers(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(lId => {
           next[lId] = next[lId].map(shape => rescaleShape(shape, factor));
        });
        return next;
     });
     commitToHistory();
  };

  const rescaleShape = (s: Shape, f: number): Shape => {
      const ns = JSON.parse(JSON.stringify(s));
      if ('x' in ns) { ns.x *= f; ns.y *= f; }
      if ('x1' in ns) { ns.x1 *= f; ns.y1 *= f; ns.x2 *= f; ns.y2 *= f; }
      if ('radius' in ns) ns.radius *= f;
      if (ns.type === 'circle' && ns.radius) ns.radius *= f;
      if ('width' in ns) { ns.width *= f; ns.height *= f; }
      if ('rx' in ns) { ns.rx *= f; ns.ry *= f; }
      if ('points' in ns && Array.isArray(ns.points)) ns.points = ns.points.map((p: Point) => ({ ...p, x: p.x * f, y: p.y * f, bulge: p.bulge }));
      if ('points2' in ns && Array.isArray(ns.points2)) ns.points2 = ns.points2.map((p: Point) => ({ ...p, x: p.x * f, y: p.y * f }));
      if ('fontSize' in ns) ns.fontSize *= f;
      if ('dimX' in ns) { ns.dimX *= f; ns.dimY *= f; }
      if ('thickness' in ns && typeof ns.thickness === 'number') ns.thickness *= f;
      return ns;
  };

  const ensureLayer = (lName: string, color: string, lineType: string = 'continuous', thickness: number = 0.25) => {
    if (!layerConfigRef.current[lName]) {
      setLayerConfig(prev => {
        if (prev[lName]) return prev;
        const next = {
          ...prev,
          [lName]: {
            id: lName,
            name: lName,
            visible: true,
            locked: false,
            frozen: false,
            plottable: true,
            color: color,
            thickness: thickness,
            lineType: lineType
          }
        };
        layerConfigRef.current = next;
        return next;
      });
    }
  };

  const executeStructuralGrid = (colSize: number) => {
    if (isNaN(colSize) || colSize <= 0) {
      setLogMessage("ERR: INVALID_COLUMN_SIZE");
      setCommandHistory(prev => [...prev, "ERROR: Structural grid column size must be a positive number."]);
      return;
    }

    // Grid size (spacing) is colSize * 10
    const S = colSize * 10;
    
    // Ensure layers exist
    ensureLayer('A-WALL', '#f44336', 'continuous', 0.5);
    ensureLayer('A-GRID', '#7f8c8d', 'center', 0.18);
    ensureLayer('A-DIM', '#00bcd4', 'continuous', 0.18);

    const wallLayer = 'A-WALL';
    const gridLayer = 'A-GRID';
    const dimLayer = 'A-DIM';

    const wallColor = layerConfigRef.current[wallLayer]?.color || '#f44336';
    const gridColor = layerConfigRef.current[gridLayer]?.color || '#7f8c8d';
    const dimColor = layerConfigRef.current[dimLayer]?.color || '#00bcd4';

    const wallShapes: Shape[] = [];
    const gridShapes: Shape[] = [];
    
    // 1. Create 4 columns centered at (0,0), (S,0), (S,S), (0,S)
    const corners = [
      { cx: 0, cy: 0 },
      { cx: S, cy: 0 },
      { cx: S, cy: S },
      { cx: 0, cy: S }
    ];

    corners.forEach(corner => {
      const colShape: RectShape = {
        id: generateId(),
        type: 'rect',
        layer: wallLayer,
        color: wallColor,
        x: corner.cx - colSize / 2,
        y: corner.cy - colSize / 2,
        width: colSize,
        height: colSize
      };
      wallShapes.push(colShape);
    });

    // 2. Create Grid lines extended by S * 0.15
    const ext = S * 0.15;
    const bubbleSize = Math.max(150, colSize * 0.5);
    
    // Vertical grid lines
    const vG1: LineShape = {
      id: generateId(),
      type: 'line',
      layer: gridLayer,
      color: gridColor,
      x1: 0,
      y1: -ext,
      x2: 0,
      y2: S + ext
    };
    const vG2: LineShape = {
      id: generateId(),
      type: 'line',
      layer: gridLayer,
      color: gridColor,
      x1: S,
      y1: -ext,
      x2: S,
      y2: S + ext
    };

    // Horizontal grid lines
    const hG1: LineShape = {
      id: generateId(),
      type: 'line',
      layer: gridLayer,
      color: gridColor,
      x1: -ext,
      y1: 0,
      x2: S + ext,
      y2: 0
    };
    const hG2: LineShape = {
      id: generateId(),
      type: 'line',
      layer: gridLayer,
      color: gridColor,
      x1: -ext,
      y1: S,
      x2: S + ext,
      y2: S
    };

    gridShapes.push(vG1, vG2, hG1, hG2);

    // 3. Grid Bubbles & Labels
    const bubbleLabelA: CircleShape = {
      id: generateId(),
      type: 'circle',
      layer: gridLayer,
      color: gridColor,
      x: -ext - bubbleSize,
      y: 0,
      radius: bubbleSize
    };
    const textLabelA: TextShape = {
      id: generateId(),
      type: 'text',
      layer: gridLayer,
      color: gridColor,
      x: -ext - bubbleSize,
      y: 0,
      size: bubbleSize * 1.0,
      content: 'A',
      attachmentPoint: 5,
      fontFamily: 'standard'
    };

    const bubbleLabelB: CircleShape = {
      id: generateId(),
      type: 'circle',
      layer: gridLayer,
      color: gridColor,
      x: -ext - bubbleSize,
      y: S,
      radius: bubbleSize
    };
    const textLabelB: TextShape = {
      id: generateId(),
      type: 'text',
      layer: gridLayer,
      color: gridColor,
      x: -ext - bubbleSize,
      y: S,
      size: bubbleSize * 1.0,
      content: 'B',
      attachmentPoint: 5,
      fontFamily: 'standard'
    };

    const bubbleLabel1: CircleShape = {
      id: generateId(),
      type: 'circle',
      layer: gridLayer,
      color: gridColor,
      x: 0,
      y: S + ext + bubbleSize,
      radius: bubbleSize
    };
    const textLabel1: TextShape = {
      id: generateId(),
      type: 'text',
      layer: gridLayer,
      color: gridColor,
      x: 0,
      y: S + ext + bubbleSize,
      size: bubbleSize * 1.0,
      content: '1',
      attachmentPoint: 5,
      fontFamily: 'standard'
    };

    const bubbleLabel2: CircleShape = {
      id: generateId(),
      type: 'circle',
      layer: gridLayer,
      color: gridColor,
      x: S,
      y: S + ext + bubbleSize,
      radius: bubbleSize
    };
    const textLabel2: TextShape = {
      id: generateId(),
      type: 'text',
      layer: gridLayer,
      color: gridColor,
      x: S,
      y: S + ext + bubbleSize,
      size: bubbleSize * 1.0,
      content: '2',
      attachmentPoint: 5,
      fontFamily: 'standard'
    };

    gridShapes.push(
      bubbleLabelA, textLabelA,
      bubbleLabelB, textLabelB,
      bubbleLabel1, textLabel1,
      bubbleLabel2, textLabel2
    );

    // 4. Dimensions measuring the grid nodes on A-DIM layer
    const styleId = settingsRef.current.activeDimStyle || 'default';
    const dimOffset = S * 0.12;

    const lowerDim: DimensionShape = {
      id: generateId(),
      type: 'dimension',
      dimType: 'linear',
      layer: dimLayer,
      color: dimColor,
      x1: 0,
      y1: 0,
      x2: S,
      y2: 0,
      dimX: S / 2,
      dimY: -dimOffset,
      text: '<>',
      styleId: styleId
    };

    const leftDim: DimensionShape = {
      id: generateId(),
      type: 'dimension',
      dimType: 'linear',
      layer: dimLayer,
      color: dimColor,
      x1: 0,
      y1: 0,
      x2: 0,
      y2: S,
      dimX: -dimOffset,
      dimY: S / 2,
      text: '<>',
      styleId: styleId
    };

    // Update layers
    setLayers(prev => {
      const next = { ...prev };
      next[wallLayer] = [...(next[wallLayer] || []), ...wallShapes];
      next[gridLayer] = [...(next[gridLayer] || []), ...gridShapes];
      next[dimLayer] = [...(next[dimLayer] || []), lowerDim, leftDim];
      layersRef.current = next;
      return next;
    });

    setCommandHistory(prev => [
      ...prev,
      `BUILDING DYNAMIC STRUCTURAL GRID (${S/1000}m x ${S/1000}m)`,
      `  > Placed 4 columns size ${colSize}mm x ${colSize}mm on layer A-WALL`,
      `  > Placed centerline grid lines A, B, 1, 2 on layer A-GRID`,
      `  > Auto-measured grid boundaries on layer A-DIM`,
      `> la A-WALL`,
      `> rect centroid at (0,0), (${S},0), (${S},${S}), (0,${S})`,
      `> la A-GRID`,
      `> centerline grid intersections A-1, A-2, B-1, B-2`
    ]);

    setLogMessage("SUCCESS: STRUCTURAL_GRID_GENERATED");
    
    // Zoom extents so the user can see everything beautifully!
    setTimeout(() => {
      executeCommand('ze');
      commitToHistory();
    }, 100);
  };

  const executeAutoDim = () => {
    const boundary = findMostRecentRectangularBoundary(layersRef.current);
    if (!boundary) {
      setLogMessage("ERR: NO_RECTANGULAR_ROOM_FOUND");
      setCommandHistory(prev => [...prev, "ERROR: No rectangular room boundary found to dimension."]);
      return;
    }

    const { xMin, yMin, xMax, yMax } = boundary;
    const width = xMax - xMin;
    const height = yMax - yMin;
    const offset = Math.max(250, Math.min(width, height) * 0.12);

    const dimLayer = 'A-DIM';
    const color = layerConfigRef.current[dimLayer]?.color || '#00bcd4';
    const styleId = settingsRef.current.activeDimStyle || 'default';

    const lowerDim: DimensionShape = {
      id: generateId(),
      type: 'dimension',
      dimType: 'linear',
      layer: dimLayer,
      color: color,
      x1: xMin,
      y1: yMin,
      x2: xMax,
      y2: yMin,
      dimX: (xMin + xMax) / 2,
      dimY: yMin - offset,
      text: '<>',
      styleId: styleId
    };

    const upperDim: DimensionShape = {
      id: generateId(),
      type: 'dimension',
      dimType: 'linear',
      layer: dimLayer,
      color: color,
      x1: xMin,
      y1: yMax,
      x2: xMax,
      y2: yMax,
      dimX: (xMin + xMax) / 2,
      dimY: yMax + offset,
      text: '<>',
      styleId: styleId
    };

    const leftDim: DimensionShape = {
      id: generateId(),
      type: 'dimension',
      dimType: 'linear',
      layer: dimLayer,
      color: color,
      x1: xMin,
      y1: yMin,
      x2: xMin,
      y2: yMax,
      dimX: xMin - offset,
      dimY: (yMin + yMax) / 2,
      text: '<>',
      styleId: styleId
    };

    const rightDim: DimensionShape = {
      id: generateId(),
      type: 'dimension',
      dimType: 'linear',
      layer: dimLayer,
      color: color,
      x1: xMax,
      y1: yMin,
      x2: xMax,
      y2: yMax,
      dimX: xMax + offset,
      dimY: (yMin + yMax) / 2,
      text: '<>',
      styleId: styleId
    };

    const c1 = `dimlinear ${xMin.toFixed(1)},${yMin.toFixed(1)} ${xMax.toFixed(1)},${yMin.toFixed(1)} ${((xMin + xMax) / 2).toFixed(1)},${(yMin - offset).toFixed(1)}`;
    const c2 = `dimlinear ${xMin.toFixed(1)},${yMax.toFixed(1)} ${xMax.toFixed(1)},${yMax.toFixed(1)} ${((xMin + xMax) / 2).toFixed(1)},${(yMax + offset).toFixed(1)}`;
    const c3 = `dimlinear ${xMin.toFixed(1)},${yMin.toFixed(1)} ${xMin.toFixed(1)},${yMax.toFixed(1)} ${(xMin - offset).toFixed(1)},${((yMin + yMax) / 2).toFixed(1)}`;
    const c4 = `dimlinear ${xMax.toFixed(1)},${yMin.toFixed(1)} ${xMax.toFixed(1)},${yMax.toFixed(1)} ${(xMax + offset).toFixed(1)},${((yMin + yMax) / 2).toFixed(1)}`;

    setCommandHistory(prev => [
      ...prev,
      `Executing autodim for room boundaries: (W: ${width.toFixed(0)}, H: ${height.toFixed(0)})`,
      `> la A-DIM`,
      `> ${c1}`,
      `> ${c2}`,
      `> ${c3}`,
      `> ${c4}`
    ]);

    setLayers(prev => {
      const next = { ...prev };
      next[dimLayer] = [...(next[dimLayer] || []), lowerDim, upperDim, leftDim, rightDim];
      layersRef.current = next;
      return next;
    });

    setLogMessage("SUCCESS: WALLS_AUTO_DIMENSIONED");
    setTimeout(() => {
      commitToHistory();
    }, 50);
  };

  const getWallsGeometryDescription = (): string => {
    const wallLayers = ['A-WALL', 'A-WALL-INT'];
    const wallShapes: Shape[] = [];
    wallLayers.forEach(l => {
      if (layersRef.current[l]) {
        wallShapes.push(...layersRef.current[l]);
      }
    });

    if (wallShapes.length === 0 && layersRef.current['0']) {
      wallShapes.push(...layersRef.current['0'].filter(s => s.type === 'rect' || s.type === 'line' || s.type === 'dline'));
    }

    if (wallShapes.length === 0) {
      return "No explicit A-WALL shapes drawn yet.";
    }

    return wallShapes.map(s => {
      if (s.type === 'rect') {
        return `Rect (x: ${s.x.toFixed(0)}, y: ${s.y.toFixed(0)}, w: ${s.width.toFixed(0)}, h: ${s.height.toFixed(0)})`;
      }
      if (s.type === 'line') {
        return `Line (from: ${s.x1.toFixed(0)},${s.y1.toFixed(0)} to: ${s.x2.toFixed(0)},${s.y2.toFixed(0)})`;
      }
      if (s.type === 'dline') {
        return `DoubleLine (${s.points?.map(p => `(${p.x.toFixed(0)},${p.y.toFixed(0)})`).join(' -> ')})`;
      }
      if (s.type === 'poly' || s.type === 'pline') {
        return `${s.type.toUpperCase()} (${(s as any).points?.map((p: any) => `(${p.x.toFixed(0)},${p.y.toFixed(0)})`).join(' -> ')})`;
      }
      return `${s.type.toUpperCase()}`;
    }).join(', ');
  };

  const executeAiSuggestLayout = async () => {
    const wallsDesc = getWallsGeometryDescription();
    if (wallsDesc === "No explicit A-WALL shapes drawn yet.") {
      setLogMessage("ERR: NO_A-WALL_GEOMETRY");
      setCommandHistory(prev => [...prev, "ERROR: No A-WALL geometry found. Please draw some walls on A-WALL layer first."]);
      return;
    }

    setIsAiThinking(true);
    setLogMessage("INFO: AI analyzing walls...");

    const prompt = `Analyze the current A-WALL elements: ${wallsDesc}.
We need to generate an AI-suggested interior layout preview.
Find the rectangular boundary of this room and generate realistic furniture layout (a bed, desk, nightstands, wardrobe, table, partition, or chairs) using 'rect' and 'line' elements on 'A-FURN' (color: #4caf50 or green) or 'A-WALL-INT' (color: #8d6e63 or brown) layers.
Ensure all generated shapes fit perfectly interior to the room dimensions and boundary, without overlapping existing walls.
The room interior area can be derived from the bounding box of the walls.
Output ONLY standard CAD commands like:
la A-FURN
rect 1000,1000 2500,3000
line 1000,1500 2500,1500
la A-WALL-INT
rect 3000,1000 3200,2000

Just issue commands. Ensure exact coordinate parameters can be processed by our command input.
Use only RECT and LINE commands.`;

    try {
      const context = getAiContextSummary() + `\nWall Geometry: ${wallsDesc}`;
      const res = await getCommandFromAI(prompt, context);
      
      if (res.commands && res.commands.length > 0) {
        setCommandHistory(prev => [...prev, "AI SUGGESTED INTERIOR LAYOUT PREVIEW:"]);
        
        res.commands.forEach(cmdStr => {
          const trimmed = cmdStr.trim();
          if (!trimmed) return;
          setCommandHistory(prev => [...prev, `AI> ${trimmed.toUpperCase()}`]);
          executeCommand(trimmed);
        });

        setLogMessage("SUCCESS: INTERIOR_PREVIEW_GENERATED");
        setCommandHistory(prev => [...prev, "AI suggest layout applied to A-FURN/A-WALL-INT layers. Press 'U' or Undo to revert."]);
        
        setTimeout(() => {
          commitToHistory();
        }, 100);

      } else {
        setLogMessage("ERR: AI_GENERATION_FAILED");
        setCommandHistory(prev => [...prev, "AI command generation returned empty layout."]);
      }
    } catch (e: any) {
      console.error(e);
      setLogMessage(`ERR: AI_SUGGESTION_FAILED`);
    } finally {
      setIsAiThinking(false);
    }
  };

  const executeAiDrafting = async (args: string) => {
    setIsAiThinking(true);
    setLogMessage("INFO: Invoking 2D Space-Planning Engine...");
    
    try {
      const isCommercialRequest = /office|commercial|storey|20x30|20\s*x\s*30|lift|parking/i.test(args || "");
      const isDuplexRequest = /duplex|10x15|10\s*x\s*15/i.test(args || "");
      const isVillaRequest = /villa|house|mansion|home/i.test(args || "") && !isCommercialRequest && !isDuplexRequest;
      const isKeywordPlan = isCommercialRequest || isDuplexRequest || isVillaRequest || args === 'villa';
      
      if (isKeywordPlan) {
        const draftResult = isCommercialRequest 
          ? draft20x30CommercialOfficePlan() 
          : isDuplexRequest 
            ? draft10x15DuplexPlan() 
            : draft12x18ModernVillaPlan();
        
        // Load standard layers into the editor configuration
        setLayerConfig(prev => ({
          ...prev,
          ...draftResult.layerConfigs
        }));
        
        // Render watertight shapes directly into layers
        setLayers(prev => ({
          ...prev,
          ...draftResult.layers
        }));
        
        if (isCommercialRequest) {
          setCommandHistory(prev => [
            ...prev,
            `AI SPACE PLAN ARCHITECT ENGINE COMPLETED SUCCESSFULLY!`,
            `PLOT SIZE: 20m × 30m | 2-STOREY MULTI-FLOOR COMMERCIAL HEADQUARTERS OFFICE & PARKING`,
            `COMPLYING CAD STANDARDS & LAYERS LOADED:`,
            `  - [A-GRID] 20m x 30m plot boundary, 6m front parking court, North indicator, & road details.`,
            `  - [A-COLS] Structural columns (300mm x 450mm commercial standard RCC, aligned vertically).`,
            `  - [A-BEAMS] Grid beam centerlines connecting load paths (Dotted/Dashed CAD style).`,
            `  - [A-WALL] Solid exterior structural walls (230mm thickness).`,
            `  - [A-WALL-INT] Shared internal partitions & restroom stalls (115mm thickness).`,
            `  - [A-DOOR] Dynamic client-side doors with 90-degree swings & double glass lobby panels.`,
            `  - [A-WINDOW] Side and facade exterior glazing window guidelines (100% natural lighting).`,
            `  - [A-FURN] Comprehensive office layout (50+ computer desks, custom task chairs, conference tables, executive cabins, pantries, secure server racks, wc stalls, and parked cars).`,
            `  - [A-TEXT] Advanced MText annotations specifying rooms, sizes, area statements (m²), & occupancy capacities.`,
            `  - [A-DIM] Linear annotations indicating setbacks, building dims, & grid sections.`
          ]);
          setLogMessage("SUCCESS: PREMIUM TWO-STOREY COMMERCIAL HQ DRAFT GENERATED SUCCESSFULLY");
        } else if (isDuplexRequest) {
          setCommandHistory(prev => [
            ...prev,
            `AI MASTER ARCHITECT ENGINE COMPLETED SUCCESSFULLY!`,
            `PLOT SIZE: 10m × 15m | MODERN DUPLEX RESIDENCE DRAWING PACKAGE`,
            `COMPLYING CAD STANDARDS & LAYERS LOADED:`,
            `  - [A-GRID] Real-time aligned 10m x 15m Plot Boundary, setbacks, & matching Floor Level Datums (Section A-A).`,
            `  - [A-COLS] Structural columns (300mm x 300mm standard RCC, aligned vertically across floors).`,
            `  - [A-BEAMS] Beam centerlines connecting load paths (Dotted/Dashed style).`,
            `  - [A-WALL] Solid exterior masonry walls (230mm thickness equivalent).`,
            `  - [A-WALL-INT] Internal partitions & dividers (115mm thickness equivalent).`,
            `  - [A-DOOR] Dynamic door panel swings with hinged quarter-circle swing paths.`,
            `  - [A-WINDOW] Sliding glass window fixtures with central double-lines.`,
            `  - [A-FURN] Beautiful furniture layouts: sofa arrays, dining table, kitchen hob/sink counters, beds, wardrobes, toilet WC fixture.`,
            `  - [A-TEXT] Clean MText annotations identifying spaces, sizes, and detailed building levels.`,
            `  - [A-DIM] Linear aligned dimensions for clear setbacks, building dimensions, and heights.`,
            `FOUR (4) PROFESSIONAL DRAWINGS GENERATED IN MODEL SPACE:`,
            `  1. GROUND FLOOR PLAN (Local Origin: 0, 0)`,
            `  2. FIRST FLOOR PLAN (Local Origin: 13000, 0)`,
            `  3. BUILDING SECTION A-A (Local Origin: 0, 18000)`,
            `  4. FRONT ELEVATION (Local Origin: 13000, 18000)`
          ]);
          setLogMessage("SUCCESS: PREMIUM DUPLEX RESIDENCE PLANS, SECTION & ELEVATION DRAFTS GENERATED ADHERING TO HIGH-SPEC HUMAN DRAUGHTING STANDARDS");
        } else {
          setCommandHistory(prev => [
            ...prev,
            `AI SPACE PLAN ARCHITECT ENGINE COMPLETED SUCCESSFULLY!`,
            `PLOT SIZE: 12m × 18m | GROUND FLOOR ONLY // 3-BEDROOM VILLA`,
            `COMPLYING CAD STANDARDS & LAYERS LOADED:`,
            `  - [A-GRID] Plot boundary, setback guidelines, & North indicator.`,
            `  - [A-COLS] Structural columns (300mm x 300mm standard RCC, aligned).`,
            `  - [A-BEAMS] Beam centerlines connecting load paths (Dashed/Dotted style).`,
            `  - [A-WALL] External load-bearing walls (230mm thickness).`,
            `  - [A-WALL-INT] Internal partitions (115mm thickness).`,
            `  - [A-DOOR] Dynamic door panel casings with 90° Swing Arcs.`,
            `  - [A-WINDOW] Glazing slider assemblies with central double-lines.`,
            `  - [A-FURN] Complete interior layout (Beds, Dressing, 6-Seater Table, Sofa, Sanitary items, Stair step run & Direction).`,
            `  - [A-TEXT] Rich smart MText labels specifying dimensions & areas (m²).`,
            `  - [A-DIM] Aligned linear dimensions marking setbacks.`
          ]);
          setLogMessage("SUCCESS: PREMIUM DRAFT PLAN GENERATED ADHERING TO HUMAN DRAUGHTING STANDARDS");
        }
        
        setTimeout(() => {
          commitToHistory();
          const allGeneratedShapes = Object.values(draftResult.layers).flat();
          fitToScreen(allGeneratedShapes as any[]);
        }, 100);
      } else {
        // Handle dynamic customized AI drafting queries via generative model
        setLogMessage("INFO: Contacting AI Principal Architect for custom layout synthesis...");
        const ctxSummary = getAiContextSummary();
        const res = await getCommandFromAI(args, ctxSummary);
        
        if (res.commands && res.commands.length > 0) {
          setCommandHistory(prev => [...prev, `AI SYNTHESIZED LAYOUT FOR: "${args.toUpperCase()}"`]);
          
          res.commands.forEach((c: string) => {
            const trimmed = c.trim();
            if (!trimmed) return;
            setCommandHistory(prev => [...prev, `AI> ${trimmed.toUpperCase()}`]);
            executeCommand(trimmed);
          });
          
          setLogMessage(res.text || "SUCCESS: DRAFT_GENERATED");
          
          setTimeout(() => {
            commitToHistory();
            // Read updated layers securely and fit viewport to custom AI drawings
            setLayers(currentLayers => {
              const allShapes = Object.values(currentLayers).flat();
              fitToScreen(allShapes as any[]);
              return currentLayers;
            });
          }, 300);
        } else {
          setLogMessage("WARN: No drawing commands generated by AI model.");
          if (res.text) {
             setLogMessage(`AI: ${res.text}`);
             setCommandHistory(prev => [...prev, `AI> ${res.text}`]);
          }
        }
      }
      
    } catch (err: any) {
      console.error(err);
      setLogMessage(`ERR: AI_DRAFTING_FAILED [${err.message || ""}]`);
    } finally {
      setIsAiThinking(false);
    }
  };

  // Helper to rescales entity coordinates when standard units are changed

  const executeCommand = useCallback((cmdStr: string) => {
    let cleanCmdStr = cmdStr;
    const partsCheck = cmdStr.trim().split(/\s+/);
    const firstWord = partsCheck[0]?.toLowerCase();
    if (firstWord !== 'mt' && firstWord !== 'mtext' && firstWord !== 't' && firstWord !== 'text') {
      const idx = cmdStr.indexOf(';');
      if (idx !== -1) {
        cleanCmdStr = cmdStr.substring(0, idx);
      }
    }
    const trimmed = cleanCmdStr.trim();
    
    // Add length safety check to prevent garbled text rendering
    if (trimmed.length > 1000) {
        setLogMessage("ERR: COMMAND_BUFFER_OVERFLOW");
        return;
    }

    if (isRecordingMacroRef.current && trimmed && trimmed !== "") {
      const up = trimmed.toUpperCase();
      if (!up.includes('RECORDINGMACRO') && !up.includes('MACRO') && up !== 'PLAYMACRO') {
        setRecordedCommands(prev => [...prev, trimmed]);
      }
    }

    if (engineRef.current && lockedMousePoint) {
      engineRef.current.ctx.lastMousePoint = { ...lockedMousePoint };
      setLockedMousePoint(null);
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

    // Block & Editor Commands Redirection
    if (cmdKey === 'b' || cmdKey === 'block') {
         setBlockDefPickedPoint(null);
         setBlockDefTempValues(null);
         setActivePanel('block_definition');
         setLogMessage("OPENING BLOCK DEFINITION DIALOG");
         setCommandInput('');
         return;
    }

    if (cmdKey === 'bedit' || cmdKey === 'be') {
         const blocksList = Object.keys(blocks).join(', ');
         const targetBlock = args.trim();
         const foundBlockKey = Object.keys(blocks).find(k => k.toLowerCase() === targetBlock.toLowerCase());
         if (foundBlockKey) {
             handleAction('enterBlockEditor', { blockName: foundBlockKey });
         } else {
             setPromptDialog({
                 title: "BLOCK EDITOR (BEDIT)",
                 message: blocksList 
                   ? `SELECT BLOCK TO EDIT (DEFINED BLOCKS: ${blocksList}):`
                   : "NO USER BLOCKS TO EDIT. ENTER ANY KNOWN BLOCK NAME:",
                 placeholder: "Enter block name...",
                 defaultValue: targetBlock || "",
                 onConfirm: (val) => {
                     const trimmedVal = val.trim();
                     const k = Object.keys(blocks).find(pk => pk.toLowerCase() === trimmedVal.toLowerCase()) 
                               || Object.keys(PREDEFINED_BLOCKS).find(pk => pk.toLowerCase() === trimmedVal.toLowerCase());
                     if (k) {
                         handleAction('enterBlockEditor', { blockName: k });
                     } else {
                         setLogMessage(`ERR: BLOCK "${trimmedVal}" NOT FOUND`);
                     }
                 }
             });
         }
         setCommandInput('');
         return;
    }

    if (cmdKey === 'bsave') {
         handleAction('saveBlockEditor');
         setCommandInput('');
         return;
    }

    if (cmdKey === 'bclose') {
         handleAction('closeBlockEditor');
         setCommandInput('');
         return;
    }

    if (cmdKey === 'la' || cmdKey === 'layer') {
        const val = args.trim().toUpperCase();
        if (val) {
            const existingLayer = (Object.values(layerConfig) as LayerConfig[]).find(l => l.name.toUpperCase() === val);
            if (existingLayer) {
                setSettings(s => ({ ...s, currentLayer: existingLayer.id }));
                setLayerConfig(prev => ({
                    ...prev,
                    [existingLayer.id]: { ...prev[existingLayer.id], visible: true, frozen: false }
                }));
                setLogMessage(`LAYERSET: ${val}`);
            } else {
                const id = generateId();
                const std = getCadStandardForLayer(val);
                setLayerConfig(prev => ({
                    ...prev,
                    [id]: { 
                        id, 
                        name: val, 
                        visible: true, 
                        locked: false, 
                        frozen: false, 
                        plottable: true, 
                        color: std ? std.color : '#FFFFFF', 
                        thickness: std ? std.thickness : 0.25, 
                        lineType: std ? std.lineType : 'continuous' 
                    }
                }));
                setLayers(prev => ({ ...prev, [id]: [] }));
                setSettings(s => ({ ...s, currentLayer: id }));
                setLogMessage(`LAYER_CREATED_ACTIVE: ${val}`);
            }
        } else {
            setActivePanel(prev => prev === 'layers' ? 'none' : 'layers');
            setLogMessage("LAYER PANEL TOGGLED");
        }
        setCommandInput('');
        return;
    }

    if (cmdKey === 'u' || cmdKey === 'undo') { undo(); setCommandInput(''); return; }
    if (cmdKey === 'redo') { handleAction('redo'); setCommandInput(''); return; }
    if (cmdKey === 'grid' && args.trim().length === 0) {
        setSettings(prev => ({ ...prev, grid: !prev.grid }));
        setCommandInput('');
        return;
    }
    if (cmdKey === 'cancel' || cmdKey === 'esc') { 
        handleAction('cancel'); 
        setCommandInput(''); 
        setShowCircleOptions(false);
        setShowArcOptions(false);
        setShowEllipseOptions(false);
        return; 
    }

    if (cmdKey === 'autodim') {
        executeAutoDim();
        setCommandInput('');
        return;
    }

    if (cmdKey === 'dynmode' || cmdKey === 'hud') {
        const val = args.trim();
        if (val === '0') {
            setSettings(prev => ({ ...prev, showHUD: false }));
            setLogMessage("DYNMODE_OFF (0)");
        } else {
            setSettings(prev => ({ ...prev, showHUD: true }));
            setLogMessage("DYNMODE_ON (3)");
        }
        setCommandInput('');
        return;
    }

    if (cmdKey === 'structgrid' || cmdKey === 'gridbuild' || (cmdKey === 'grid' && args.trim().length > 0)) {
        const colSize = parseFloat(args) || 300;
        executeStructuralGrid(colSize);
        setCommandInput('');
        return;
    }

    if (cmdKey === 'dimstyle' || cmdKey === 'dst') {
        const cmdParts = args.trim().split(/\s+/);
        let styleName = '';
        let scaleFactor = 100;
        
        if (cmdParts[0]?.toLowerCase() === 'create') {
            styleName = cmdParts[1] || '';
            scaleFactor = parseFloat(cmdParts[2]) || 100;
        } else if (cmdParts[0] && !isNaN(parseFloat(cmdParts[0]))) {
            scaleFactor = parseFloat(cmdParts[0]);
            styleName = `scale_1_${scaleFactor}`;
        } else if (cmdParts[0]) {
            styleName = cmdParts[0];
            scaleFactor = parseFloat(cmdParts[1]) || 100;
        }

        if (!styleName) {
            setActivePanel('dimstyle');
            setLogMessage("INFO: DIMSTYLE_PANEL_OPENED. Type 'dimstyle create <name> <scale>' to create.");
            setCommandInput('');
            return;
        }

        const id = styleName.toLowerCase().replace(/\s+/g, '_');
        
        const baseArrow = 3.0;
        const baseText = 3.5;
        const baseOffset = 1.25;
        const baseExtend = 1.75;
        const baseOffsetL = 1.25;

        const newStyle = {
            id: id,
            name: styleName.toUpperCase(),
            arrowSize: baseArrow * scaleFactor,
            textSize: baseText * scaleFactor,
            textOffset: baseOffset * scaleFactor,
            extendLine: baseExtend * scaleFactor,
            offsetLine: baseOffsetL * scaleFactor,
            precision: 1,
            textPlacement: 'above' as const,
            arrowType: 'closed' as const,
            arrowScale: 1.0,
        };

        setSettings(prev => ({
            ...prev,
            dimStyles: {
                ...prev.dimStyles,
                [id]: newStyle
            },
            activeDimStyle: id
        }));

        setLogMessage(`SUCCESS: DIMSTYLE_${styleName.toUpperCase()}_CREATED`);
        setCommandHistory(prev => [
            ...prev,
            `DIMSTYLE: Selected/Created "${styleName.toUpperCase()}" with Scale factor ${scaleFactor}`,
            `  > Arrow size: ${newStyle.arrowSize}`,
            `  > Text height: ${newStyle.textSize}`,
            `  > Lines extend: ${newStyle.extendLine}, offset: ${newStyle.offsetLine}`
        ]);
        setCommandInput('');
        return;
    }

    if (cmdKey === 'aisuggest' || cmdKey === 'ai_suggest_interior' || cmdKey === 'suggestlayout') {
        executeAiSuggestLayout();
        setCommandInput('');
        return;
    }

    if (cmdKey === 'ai_drafting' || cmdKey === 'aidrafting' || cmdKey === 'aidraft' || cmdKey === 'ai_draft') {
        executeAiDrafting(args);
        setCommandInput('');
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
      'rec': RectCommand, 'rect': RectCommand, 'rectangle': RectCommand, 'c': CircleCommand, 'circle': CircleCommand,
      'pl': PolyCommand, 'pline': PolyCommand, 'arc': ArcCommand, 'a': ArcCommand, 'spl': SplineCommand, 'spline': SplineCommand,
      'mt': MTextCommand, 'mtext': MTextCommand, 'm': MoveCommand, 'move': MoveCommand, 
      'e': EraseCommand, 'erase': EraseCommand, 'clean': CleanCommand, 'cl': CleanCommand, 'dist': DistanceCommand, 'di': DistanceCommand, 
      'area': AreaCommand, 'did': AreaCommand, 'aa': AreaCommand,
      'dim': DimensionCommand, 'dimlinear': DimensionCommand, 'aligned': DimensionCommand,
      'dimradius': DimensionCommand, 'dimdiam': DimensionCommand, 'dimord': DimensionCommand,
      'angular': DimensionCommand, 'dimarc': DimensionCommand,
      't': TextCommand, 'text': TextCommand, 
      'z': ZoomCommand, 'zoom': ZoomCommand, 'tr': TrimCommand, 'trim': TrimCommand,
      'za': ZoomCommand, 'ze': ZoomCommand, 'zw': ZoomCommand, 'zi': ZoomCommand, 'zo': ZoomCommand,
      'zr': ZoomRealTimeCommand,
      'h': HatchCommand, 'hatch': HatchCommand, 
      'lea': LeaderCommand, 'leader': LeaderCommand, 'le': LeaderCommand,
      'lea:closed': LeaderCommand, 'lea:open': LeaderCommand, 'lea:tick': LeaderCommand, 'lea:dot': LeaderCommand,
      'ma': MatchPropertiesCommand, 'match': MatchPropertiesCommand, 'matchprop': MatchPropertiesCommand,
      'p': PanCommand, 'pan': PanCommand, 'o': OffsetCommand, 'offset': OffsetCommand,
      's': StretchCommand, 'stretch': StretchCommand,
      'el': EllipseCommand, 'ellipse': EllipseCommand, 'pol': PolygonCommand, 'polygon': PolygonCommand,
      'sk': SketchCommand, 'sketch': SketchCommand,
      'don': DonutCommand, 'donut': DonutCommand, 'do': DonutCommand, 'po': PointCommand, 'point': PointCommand,
      'sel': SelectCommand, 'select': SelectCommand,
      'all': SelectAllCommand, 'sa': SelectAllCommand, 'selall': SelectAllCommand, 'cut': CutClipCommand, 'copyclip': CopyClipCommand, 'paste': PasteClipCommand,
      'cc': CopyClipCommand, 'cv': PasteClipCommand, 'pasteclip': PasteClipCommand,
      'ro': RotateCommand, 'rotate': RotateCommand, 'sc': ScaleCommand, 'scale': ScaleCommand,
      'mi': MirrorCommand, 'mirror': MirrorCommand, 'co': CopyCommand, 'copy': CopyCommand, 'cp': CopyCommand,
      'ex': ExtendCommand, 'extend': ExtendCommand, 'x': ExplodeCommand, 'explode': ExplodeCommand,
      'j': JoinCommand, 'join': JoinCommand, 'br': BreakCommand, 'break': BreakCommand,
      'brp': BreakAtPointCommand, 'breakatpoint': BreakAtPointCommand,
      'f': FilletCommand, 'fillet': FilletCommand,
      'cha': ChamferCommand, 'chamfer': ChamferCommand,
      'ray': RayCommand, 'xl': XLineCommand, 'xline': XLineCommand,
      'ar': ArrayCommand, 'array': ArrayCommand,
      'ap': PathArrayCommand, 'arraypath': PathArrayCommand,
      'b': BlockCommand, 'block': BlockCommand,
      'i': InsertCommand, 'insert': InsertCommand,
      'fi': FilterCommand, 'filter': FilterCommand,
      'find': FindCommand, 'vports': ViewportCommand, 'viewport': ViewportCommand, 'vp': ViewportCommand, 'layout': LayoutCommand, 'lo': LayoutCommand,
      'import': ImportCommand, 'import_blocks': ImportCommand,
      'table': TableCommand, 'tb': TableCommand,
      'autodim': AutoDimensionCommand, 'sec': SectionLineCommand, 'section': SectionLineCommand, 'sectionline': SectionLineCommand,
      'revcloud': RevCloudCommand, 'revc': RevCloudCommand, 'cloud': RevCloudCommand,
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
            'rec': 'RECTANGLE', 'rect': 'RECTANGLE', 'rectangle': 'RECTANGLE',
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
            'revcloud': 'REVCLOUD', 'revc': 'REVCLOUD', 'cloud': 'REVCLOUD',
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
      if (cmdKey === 'purge') {
          handleAction('purge');
          setIsCommandActive(false);
          setActiveCommandName(undefined);
          return;
      }
      if (cmdKey === 'zp' || cmdKey === 'zoomp' || cmdKey === 'zoomprevious' || cmdKey === 'zoomprev') {
          handleAction('zoomPrevious');
          setIsCommandActive(false);
          setActiveCommandName(undefined);
          setCommandInput('');
          return;
      }
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
          // Programmatic / Scripting invocation finalizer:
          // If a multi-argument command is left active in writing/drawing state, 
          // we simulate an Enter key (empty string input) to finalize and commit it!
          if (engineRef.current && engineRef.current.active) {
              engineRef.current.input("");
          }
      }
    } else {
        setLogMessage(`ERR: CMD NOT FOUND [${cmdKey}]`);
        setIsCommandActive(false);
        setShowCircleOptions(false);
        setActiveCommandName(undefined);
    }
    setCommandInput('');
  }, [undo, commitToHistory, showCircleOptions, handleAction, lockedMousePoint, lastCommandName, activeCommandName, executeAutoDim, executeAiSuggestLayout, executeStructuralGrid]);

  // Global Keyboard Shortcuts (Moved below executeCommand to resolve block-scope lookup)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const active = document.activeElement;
        const isNavigating = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true');
        
        if (e.ctrlKey || e.metaKey) {
            if (isNavigating) {
                // Let native edits occur within typing boxes, except page save (Ctrl+S)
                if (e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    if (e.shiftKey) handleAction('saveAs');
                    else handleAction('save');
                }
                return;
            }

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
                case 'c':
                    // Map Ctrl+C explicitly to CAD selection clipboard
                    e.preventDefault();
                    executeCommand('copyclip');
                    break;
                case 'v':
                    // Map Ctrl+V explicitly to CAD selection clipboard
                    e.preventDefault();
                    executeCommand('paste');
                    break;
                case 'x':
                    // Map Ctrl+X explicitly to CAD selection clipboard
                    e.preventDefault();
                    executeCommand('cut');
                    break;
            }
        } else {
            if (isNavigating) return;

            switch(e.key) {
                case 'F3':
                    e.preventDefault();
                    setSettings(prev => {
                      const newSnap = !prev.snap;
                      setLogMessage(newSnap ? "OSNAP_ON" : "OSNAP_OFF");
                      return { ...prev, snap: newSnap };
                    });
                    break;
                case 'F7':
                    e.preventDefault();
                    setSettings(prev => {
                      const newGrid = !prev.grid;
                      setLogMessage(newGrid ? "GRID_ON" : "GRID_OFF");
                      return { ...prev, grid: newGrid };
                    });
                    break;
                case 'F8':
                    e.preventDefault();
                    setSettings(prev => {
                      const newOrtho = !prev.ortho;
                      setLogMessage(newOrtho ? "ORTHO_ON" : "ORTHO_OFF");
                      return { ...prev, ortho: newOrtho };
                    });
                    break;
                case 'F9':
                    e.preventDefault();
                    setSettings(prev => {
                      const newGridSnap = !prev.gridSnap;
                      setLogMessage(newGridSnap ? "SNAP_ON" : "SNAP_OFF");
                      return { ...prev, gridSnap: newGridSnap };
                    });
                    break;
                case 'F10':
                    e.preventDefault();
                    setSettings(prev => {
                      const newPolar = !prev.polarTrackingEnabled;
                      setLogMessage(newPolar ? "POLAR_ON" : "POLAR_OFF");
                      return { ...prev, polarTrackingEnabled: newPolar };
                    });
                    break;
                case 'F11':
                    e.preventDefault();
                    setLogMessage("OTRACK_TOGGLED");
                    break;
                case 'F12':
                    e.preventDefault();
                    setSettings(prev => {
                      const newShowHUD = !prev.showHUD;
                      setLogMessage(newShowHUD ? "DYNMODE_ON" : "DYNMODE_OFF");
                      return { ...prev, showHUD: newShowHUD };
                    });
                    break;
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFileName, handleAction, executeCommand]);

  // Viewport Control & Auxiliary Input Observer (Moved below executeCommand)
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
      } else if (e.key === 'Tab') {
        if (engineRef.current?.active && !isNavigatingInput()) {
            e.preventDefault();
            if (commandInput && !commandInput.includes(',') && !commandInput.includes('<')) {
                setCommandInput(commandInput + ',');
            }
        }
      } else if (e.key === 'Delete' || (e.key === 'Backspace' && !isNavigatingInput())) {
        if (!engineRef.current?.active && selectedIds.length > 0) {
            handleAction('erase');
        }
      } else if ((e.key === 'Enter' || e.key === ' ') && !isNavigatingInput()) {
        e.preventDefault();
        if (engineRef.current?.active) {
          engineRef.current.input(''); 
        } else if (lastCommandName) {
          setLogMessage(`REPEATING: ${lastCommandName.toUpperCase()}`);
          executeCommand(lastCommandName);
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
          setCommandInput(prev => prev + e.key);
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
  }, [mtextEditor, activePanel, selectedIds, handleAction, lastCommandName, executeCommand, commandInput]);

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
        setPreview: (shapes) => {
          (window as any).__activePreviewShapes = shapes;
          if (!(window as any).__previewTimer) {
            (window as any).__previewTimer = requestAnimationFrame(() => {
              setPreviewShapes((window as any).__activePreviewShapes);
              (window as any).__previewTimer = null;
            });
          }
        },
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
          (window as any).__activePreviewShapes = null;
          if ((window as any).__previewTimer) {
            cancelAnimationFrame((window as any).__previewTimer);
            (window as any).__previewTimer = null;
          }
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
    if (isPickingBlockBasePoint) {
      setBlockDefPickedPoint({ x, y });
      setIsPickingBlockBasePoint(false);
      setActivePanel('block_definition');
      setLogMessage(`BASEPOINT_PICKED: ${x.toFixed(1)}, ${y.toFixed(1)}`);
      return;
    }

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
        // Halt any existing voice processing/recognition runs
        if (liveSessionRef.current) { 
          try { (await liveSessionRef.current).close(); } catch(err) {}
          liveSessionRef.current = null; 
        }
        if (recognitionRef.current) {
          const recog = recognitionRef.current;
          recognitionRef.current = null; // Mark inactive to block restart
          try { recog.stop(); } catch(err) {}
        }
        try { window.speechSynthesis.cancel(); } catch(err) {}
        setIsLiveActive(false); 
        setLogMessage("ARCHITECT_LIVE_OFFLINE");
    } else {
        setLogMessage("AWAKENING_ARCHITECT_CORE...");
        
        const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionClass) {
          setLogMessage("ERR: SPEECH_RECOGNITION_NOT_SUPPORTED");
          return;
        }

        try {
          const recog = new SpeechRecognitionClass();
          recog.continuous = false; // Simple discrete pause-triggered command drafting is extremely clean
          recog.interimResults = true;
          recog.lang = 'en-US';

          let finalTranscriptsHandled = new Set<number>();

          recog.onstart = () => {
            setIsLiveActive(true);
            setLogMessage("VOICE DRAFTING ACTIVE // SPEAK NOW...");
          };

          recog.onerror = (event: any) => {
            console.error("Speech Recognition Error:", event);
            if (event.error !== 'no-speech') {
              setLogMessage(`ERR: VOICE_INPUT_${event.error.toUpperCase()}`);
            }
          };

          recog.onend = () => {
            // Continuously listen if user hasn't toggled off yet
            if (recognitionRef.current === recog) {
              try { recog.start(); } catch(err) { console.error("Error restarting voice:", err); }
            }
          };

          recog.onresult = async (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const transcriptText = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                if (!finalTranscriptsHandled.has(i)) {
                  finalTranscriptsHandled.add(i);
                  finalTranscript = transcriptText;
                }
              } else {
                interimTranscript += transcriptText;
              }
            }

            if (interimTranscript) {
              setLogMessage(`HEARING: "${interimTranscript.toUpperCase()}"`);
            }

            if (finalTranscript && finalTranscript.trim()) {
              const query = finalTranscript.trim();
              setLogMessage(`YOU: "${query.toUpperCase()}"`);
              
              setCommandHistory(prev => [...prev.slice(-50), "VOICE> " + query.toUpperCase()]);
              setLogMessage(`AI ARCHITECT IS DRAFTING...`);
              setIsAiThinking(true);
              
              try {
                const ctxSummary = getAiContextSummary();
                const response = await getCommandFromAI(query, ctxSummary);
                
                setIsAiThinking(false);
                
                if (response.text) {
                  setLogMessage(`AI: ${response.text}`);
                  setCommandHistory(prev => [...prev.slice(-50), "AI> " + response.text.toUpperCase()]);
                  
                  // Text-to-Speech audio feedback
                  try {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(response.text);
                    utterance.rate = 1.0;
                    utterance.pitch = 1.0;
                    const voices = window.speechSynthesis.getVoices();
                    const enVoice = voices.find(v => v.lang.startsWith('en'));
                    if (enVoice) utterance.voice = enVoice;
                    
                    window.speechSynthesis.speak(utterance);
                  } catch (speechErr) {
                    console.error("Vocal response synthesis failed:", speechErr);
                  }
                }

                if (response.commands && response.commands.length > 0) {
                  response.commands.forEach((c: string) => {
                    executeCommand(c);
                  });
                } else if (!response.text) {
                  setLogMessage("INFO: NO_DRAFT_COMMAND_INTERPRETED");
                }
              } catch (aiErr: any) {
                setIsAiThinking(false);
                setLogMessage(`ERR: ${aiErr.message || "VOICE_DRAFT_FAILED"}`);
              }
            }
          };

          recognitionRef.current = recog;
          recog.start();

        } catch (initializationErr: any) {
          console.error("Speech setup failed:", initializationErr);
          setLogMessage(`ERR: SPEECH_INIT_FAILED`);
        }
    }
  }, [isLiveActive, executeCommand, getAiContextSummary]);

  const sidebarButtons = [
    { id: 'ai_drafting', icon: Sparkles, action: 'toggleAiDrafting', activeOn: 'ai_drafting' },
    { id: 'section_generator', icon: Scissors, action: 'toggleSectionGenerator', activeOn: 'section_generator' },
    { id: 'drafting', icon: Target, action: 'toggleDraftingSettings', activeOn: 'drafting' },
    { id: 'layers', icon: Layers, action: 'toggleLayers', activeOn: 'layers' },
    { id: 'views', icon: Camera, action: 'toggleViews', activeOn: 'views' },
    { id: 'drawing_props', icon: FileText, action: 'toggleDrawingProps', activeOn: 'drawing_props' },
    { id: 'properties', icon: Sliders, action: 'toggleProperties', activeOn: 'properties' },
    { id: 'blocks', icon: Box, action: 'toggleBlocks', activeOn: 'blocks' },
    { id: 'calculator', icon: Calculator, action: 'toggleCalculator', activeOn: 'calculator' },
    { id: 'dashboard', icon: LayoutDashboard, action: 'toggleDashboard', activeOn: 'dashboard' }
  ];

  const createBlockDef = (name: string, basePoint: Point, selectedShapes: Shape[], action: 'retain' | 'convert' | 'delete') => {
    if (!name.trim()) {
      setLogMessage("ERR: Block name cannot be empty");
      return false;
    }
    
    const copiedShapes = selectedShapes.map(s => {
      const ns = JSON.parse(JSON.stringify(s));
      ns.id = Math.random().toString(36).substr(2, 9);
      if (ns.type === 'line') {
        ns.x1 -= basePoint.x; ns.x2 -= basePoint.x;
        ns.y1 -= basePoint.y; ns.y2 -= basePoint.y;
      } else if ('x' in ns && 'y' in ns) {
        ns.x -= basePoint.x;
        ns.y -= basePoint.y;
      }
      return ns;
    });

    const blockDef: BlockDefinition = {
      id: Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      basePoint: { x: basePoint.x, y: basePoint.y },
      shapes: copiedShapes
    };

    setBlocks(prev => {
      const next = { ...prev, [name.trim()]: blockDef };
      blocksRef.current = next;
      return next;
    });

    const styleLayer = settingsRef.current.currentLayer || '0';

    setLayers(prev => {
      const next = { ...prev };
      const selectedIdsToMatch = selectedShapes.map(s => s.id);
      
      if (action === 'convert' || action === 'delete') {
        Object.keys(next).forEach(l => {
          next[l] = next[l].filter(s => !selectedIdsToMatch.includes(s.id));
        });
      }

      if (action === 'convert') {
        const instance: Shape = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'block',
          blockId: name.trim(),
          x: basePoint.x,
          y: basePoint.y,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          layer: styleLayer,
          color: 'BYLAYER'
        } as any;
        next[styleLayer] = [...(next[styleLayer] || []), instance];
      }

      layersRef.current = next;
      return next;
    });

    setSelectedIds([]);
    setLogMessage(`BLOCK_CREATED: ${name.trim()}`);
    commitToHistory();
    return true;
  };

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

      {editingBlockName && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-4 bg-[#0a2f1d]/95 border border-emerald-500/30 backdrop-blur-md px-6 py-3 rounded-full shadow-[0_15px_35px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">BLOCK EDITOR MODE</span>
          </div>
          <div className="h-4 w-[1px] bg-white/10" />
          <span className="text-[10px] font-mono text-neutral-300 font-bold uppercase">EDITING: {editingBlockName}</span>
          <div className="h-4 w-[1px] bg-white/10" />
          <button 
            onClick={() => handleAction('saveBlockEditor')}
            className="bg-emerald-500 hover:bg-emerald-400 text-black text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg active:scale-95 transition-all outline-none cursor-pointer"
          >
            Save Block
          </button>
          <button 
            onClick={() => {
              setPromptDialog({
                title: "CLOSE BLOCK EDITOR",
                message: "DO YOU WANT TO SAVE CHANGES TO THIS BLOCK DEFINITION BEFORE CLOSING?",
                placeholder: "Type 'yes' or 'y' to save, or 'no' to discard:",
                defaultValue: "yes",
                onConfirm: (val) => {
                  if (val.trim().toLowerCase().startsWith('y')) {
                    handleAction('saveBlockEditor');
                  }
                  handleAction('closeBlockEditor');
                }
              });
            }}
            className="bg-neutral-800 hover:bg-neutral-700 hover:text-white text-neutral-300 text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg active:scale-95 transition-all outline-none cursor-pointer"
          >
            Close Editor
          </button>
        </div>
      )}

      <header className="h-[calc(2.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] flex items-center justify-between px-4 shrink-0 bg-black border-b border-white/5 z-[110]">
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
            onClick={(e) => { 
              e.preventDefault();
              e.stopPropagation();
              if (navigator.vibrate) navigator.vibrate(5); 
              toggleFileNameMenu(); 
            }}
            className={`text-[10px] font-mono tracking-tight transition-colors no-tap font-bold cursor-pointer ${fileNameMenuOpen ? 'text-cyan-400' : 'text-neutral-500 hover:text-cyan-400'}`}
          >
            {currentFileName || "drawing.vox"}
          </button>
      </div>

      <div className="h-9 bg-black border-b border-white/5 flex items-center px-4 z-[99] shrink-0 gap-0 overflow-x-auto no-scrollbar scroll-smooth">
          {['FILE', 'EDIT', 'VIEW', 'DRAW', 'MODIFY', 'ANNO', 'TOOLS', 'MACROS'].map((item, index) => {
            const isSelected = 
              (item === 'FILE' && (activePanel === 'drawing_props' || activePanel === 'file')) ||
              (item === 'TOOLS' && activeCategory === 'Tools') || 
              (item === 'EDIT' && activeCategory === 'Edit') || 
              (item === 'ANNO' && activeCategory === 'Anno') || 
              (item === 'MACROS' && activeCategory === 'Macros') || 
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
                  else if (item === 'MACROS') setActiveCategory('Macros'); 
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
            editingBlockName={editingBlockName}
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
            onMouseMove={(x,y,s,shift) => { 
              if (engineRef.current && !commandContextMenu) {
                const active = document.activeElement;
                const isNavigating = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true');
                if (!isNavigating) {
                  engineRef.current.move({x,y}, s, shift);
                }
              }
            }} 
            onAction={handleAction}
            isContextMenuOpen={!!commandContextMenu}
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
            commandInput={commandInput}
            aiRecommendation={aiRecommendation}
            collaborators={collaborators}
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
                  selectedCount={selectedIds.length}
                  onLoadLayersTemplate={(newLayers) => {
                    setLayerConfig(prev => {
                      const merged = { ...prev };
                      Object.keys(newLayers).forEach(key => {
                        merged[key] = newLayers[key];
                      });
                      setLayers(shapesPrev => {
                        const next = { ...shapesPrev };
                        Object.keys(newLayers).forEach(key => {
                          if (!next[key]) {
                            next[key] = [];
                          }
                        });
                        return next;
                      });
                      return merged;
                    });
                    setLogMessage("LAYER_TEMPLATE_LOADED");
                  }}
                  onMoveSelectedToLayer={(targetId) => {
                    if (selectedIds.length === 0) return;
                    setLayers(prev => {
                      const next = { ...prev };
                      if (!next[targetId]) {
                        next[targetId] = [];
                      }
                      const movedShapes: Shape[] = [];
                      Object.keys(next).forEach(lId => {
                        const toMove = next[lId].filter(s => selectedIds.includes(s.id));
                        if (toMove.length > 0) {
                          next[lId] = next[lId].filter(s => !selectedIds.includes(s.id));
                          toMove.forEach(s => {
                            movedShapes.push({
                              ...s,
                              layer: targetId
                            });
                          });
                        }
                      });
                      next[targetId] = [...next[targetId], ...movedShapes];
                      return next;
                    });
                    setLogMessage(`MOVED_${selectedIds.length}_SHAPES_TO_${layerConfig[targetId]?.name || targetId}`);
                    setTimeout(commitToHistory, 100);
                  }}
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
                  onPurgeEmpty={() => {
                    const activeLayers = new Set<string>();
                    (Object.values(layers) as any[]).forEach(shapesList => {
                      if (Array.isArray(shapesList)) {
                        shapesList.forEach(s => {
                          if (s?.layer) activeLayers.add(s.layer);
                        });
                      }
                    });
                    activeLayers.add('0');
                    activeLayers.add('defpoints');
                    activeLayers.add(settings.currentLayer);

                    const layersToPurge: string[] = [];
                    const purgedNames: string[] = [];

                    Object.keys(layerConfig).forEach(layerId => {
                      if (!activeLayers.has(layerId)) {
                        layersToPurge.push(layerId);
                        purgedNames.push(layerConfig[layerId]?.name || layerId);
                      }
                    });

                    if (layersToPurge.length === 0) {
                      setLogMessage("PURGE: NO UNUSED LAYERS FOUND");
                      return;
                    }

                    setPromptDialog({
                      title: 'Purge Empty Layers',
                      message: `Are you sure you want to purge ${layersToPurge.length} empty and inactive layer(s)? (${purgedNames.join(', ')})`,
                      type: 'confirm',
                      initialValue: '',
                      onConfirm: () => {
                        setLayerConfig(prev => {
                          const n = { ...prev };
                          layersToPurge.forEach(layerId => delete n[layerId]);
                          return n;
                        });
                        setLayers(prev => {
                          const n = { ...prev };
                          layersToPurge.forEach(layerId => delete n[layerId]);
                          return n;
                        });
                        setLogMessage(`PURGED ${layersToPurge.length} EMPTY LAYERS: ${purgedNames.join(', ')}`);
                        setTimeout(() => commitToHistory(), 50);
                      }
                    });
                  }}
                />
              </motion.div>
            </motion.div>
          )}

          {activePanel === 'views' && (
              <motion.div 
                key="panel-views-overlay"
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
                    <ViewManager 
                      settings={settings}
                      activeTab={activeTab}
                      currentView={view}
                      onRecallView={(v) => handleAction('recallView', v)}
                      onSaveView={(name) => handleAction('saveView', name)}
                      onDeleteView={(id) => handleAction('deleteView', id)}
                      onClose={() => setActivePanel('none')}
                    />
                  </motion.div>
              </motion.div>
          )}

          {activePanel === 'qselect' && (
             <motion.div 
               key="panel-qselect-overlay"
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
                  <QuickSelectPanel 
                    layers={layers}
                    layerConfig={layerConfig}
                    selectedIds={selectedIds}
                    onSelectAll={(ids) => setSelectedIds(ids)}
                    onClose={() => setActivePanel('none')} 
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
                    modelShapes={Object.values(layers).flat() as Shape[]}
                    blocks={blocks}
                  />
                </motion.div>
             </motion.div>
          )}

          {activePanel === 'dashboard' && (
             <motion.div 
               key="panel-dashboard-overlay"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-[1000] flex items-center justify-center sm:p-4 bg-black/40 backdrop-blur-[2px] pointer-events-none"
             >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="pointer-events-auto w-full h-full sm:h-auto sm:w-[380px] flex flex-col sm:max-h-[85vh] sm:rounded-3xl shadow-[0_50px_120px_rgba(0,0,0,0.95)] border border-white/10 overflow-hidden"
                >
                  <ProjectDashboardPanel 
                    layers={layers}
                    settings={settings}
                    onClose={() => setActivePanel('none')} 
                  />
                </motion.div>
             </motion.div>
          )}

          {activePanel === 'blocks' && (
             <motion.div 
               key="panel-blocks-overlay"
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
                  <BlockLibraryPanel 
                    blocks={blocks}
                    selectedCount={selectedIds.length}
                    onClose={() => setActivePanel('none')}
                    onEditBlock={(blockId) => {
                      handleAction('enterBlockEditor', { blockName: blockId });
                      setActivePanel('none');
                    }}
                    onInsertBlock={(blockId) => {
                      if (!blocksRef.current[blockId] && PREDEFINED_BLOCKS[blockId]) {
                        const pb = PREDEFINED_BLOCKS[blockId];
                        setBlocks(prev => ({ ...prev, [blockId]: pb }));
                        blocksRef.current[blockId] = pb;
                      }
                      setActivePanel('none');
                      executeCommand("insert " + blockId);
                    }}
                    onDeleteBlock={(blockId) => {
                      setBlocks(prev => {
                        const next = { ...prev };
                        delete next[blockId];
                        blocksRef.current = next;
                        return next;
                      });
                      setLogMessage(`BLOCK_DELETED: ${blockId}`);
                    }}
                    onCreateBlockFromSelection={(name) => {
                      const selectedShapes = (Object.values(layersRef.current).flat() as Shape[]).filter(s => selectedIds.includes(s.id));
                      if (selectedShapes.length === 0) {
                        setLogMessage("ERR: NO_SHAPES_SELECTED");
                        return;
                      }
                      
                      // Calculate center bounding box automatically
                      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                      selectedShapes.forEach(s => {
                        if (s.type === 'line') {
                          minX = Math.min(minX, s.x1, s.x2);
                          maxX = Math.max(maxX, s.x1, s.x2);
                          minY = Math.min(minY, s.y1, s.y2);
                          maxY = Math.max(maxY, s.y1, s.y2);
                        } else if ('x' in s && 'y' in s) {
                          const x = (s as any).x;
                          const y = (s as any).y;
                          const r = (s as any).radius || (s as any).width || 10;
                          minX = Math.min(minX, x - r);
                          maxX = Math.max(maxX, x + r);
                          minY = Math.min(minY, y - r);
                          maxY = Math.max(maxY, y + r);
                        }
                      });
                      
                      const basePoint = (minX !== Infinity) ? { x: (minX + maxX)/2, y: (minY + maxY)/2 } : { x: 0, y: 0 };
                      
                      // Helper call to perform proper block registration and conversion
                      createBlockDef(name, basePoint, selectedShapes, 'convert');
                    }}
                  />
                </motion.div>
             </motion.div>
          )}

          {activePanel === 'block_definition' && (
             <motion.div 
               key="panel-block-def-overlay"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-[1000] flex items-center justify-center sm:p-4 bg-black/40 backdrop-blur-[2px]"
             >
                <div className="pointer-events-auto">
                   <BlockDefinitionDialog 
                     selectedShapesCount={selectedIds.length}
                     pickedPoint={blockDefPickedPoint}
                     initialTempValues={blockDefTempValues || undefined}
                     onPickPointOnScreen={(tempName, tempAction) => {
                       setBlockDefTempValues({ name: tempName, action: tempAction });
                       setIsPickingBlockBasePoint(true);
                       setActivePanel('none');
                       setLogMessage("PICK_BASEPOINT: Click anywhere on model space canvas.");
                     }}
                     onConfirm={(name, basePoint, action) => {
                       const selectedShapes = (Object.values(layersRef.current).flat() as Shape[]).filter(s => selectedIds.includes(s.id));
                       const success = createBlockDef(name, basePoint, selectedShapes, action);
                       if (success) {
                         setBlockDefPickedPoint(null);
                         setBlockDefTempValues(null);
                         setActivePanel('none');
                       }
                     }}
                     onClose={() => {
                       setBlockDefPickedPoint(null);
                       setBlockDefTempValues(null);
                       setActivePanel('none');
                     }}
                   />
                </div>
             </motion.div>
          )}

          {activePanel === 'wall_align' && (
             <motion.div 
               key="panel-wall-align-overlay"
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
                  <WallAlignmentPanel 
                    layers={layers}
                    onClose={() => setActivePanel('none')}
                    onUpdateWallShapes={(newShapes) => {
                      setLayers(prev => {
                        const next = { ...prev, 'A-WALL': newShapes };
                        layersRef.current = next;
                        return next;
                      });
                      setLogMessage("WALL: ALIGNMENT RECORRECTED AND ALIGNED");
                      setTimeout(() => commitToHistory(), 50);
                    }}
                    settings={settings}
                    setSettings={setSettings}
                    selectedIds={selectedIds}
                    onUpdateAllLayers={(updatedLayers) => {
                      setLayers(updatedLayers);
                      layersRef.current = updatedLayers;
                      setLogMessage("WALL: BATCH ALIGNED SELECTION");
                      setTimeout(() => commitToHistory(), 50);
                    }}
                  />
                </motion.div>
             </motion.div>
          )}

          {activePanel === 'section_generator' && (
             <motion.div 
               key="panel-section-generator-overlay"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-[1000] flex items-center justify-center sm:p-4 bg-black/40 backdrop-blur-[2px] pointer-events-none"
             >
                <div className="pointer-events-auto">
                  <SectionGeneratorPanel 
                    layers={layers}
                    onClose={() => setActivePanel('none')}
                    onUpdateAllLayers={(updatedLayers) => {
                      setLayers(updatedLayers);
                      layersRef.current = updatedLayers;
                      setLogMessage("SECTION: CROSS-SECTION GENERATED IN MODEL");
                      setTimeout(() => commitToHistory(), 50);
                    }}
                  />
                </div>
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

          {activePanel === 'ai_drafting' && (
            <motion.div 
              key="panel-ai-drafting-overlay"
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
                <AiDraftingPanel 
                  onClose={() => setActivePanel('none')}
                  onCommand={executeCommand}
                  getCommandFromAI={getCommandFromAIWithState}
                  getAiContextSummary={getAiContextSummary}
                  undo={undo}
                  setLogMessage={setLogMessage}
                  onCaptureCanvas={() => canvasHandleRef.current?.captureImage()}
                />
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
                <FileManager currentName={currentFileName} recentFiles={recentFiles} onAction={handleAction} onClose={() => setActivePanel('none')} layouts={layouts} />
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
                  projectStats={calculateVoxProjectStats({
                    entities: Object.values(layers).flat() as Shape[],
                    layers: layerConfig
                  })}
                  layersConfigList={layerConfig}
                  onPurgeLayers={() => {
                    const activeLayers = new Set<string>();
                    (Object.values(layers) as any[]).forEach(shapesList => {
                      if (Array.isArray(shapesList)) {
                        shapesList.forEach(s => {
                          if (s?.layer) activeLayers.add(s.layer);
                        });
                      }
                    });
                    activeLayers.add('0');
                    activeLayers.add('defpoints');
                    activeLayers.add(settings.currentLayer);

                    const newLayerConfig = { ...layerConfig };
                    let purgedCount = 0;
                    Object.keys(newLayerConfig).forEach(layerId => {
                      if (!activeLayers.has(layerId)) {
                        delete newLayerConfig[layerId];
                        purgedCount++;
                      }
                    });

                    if (purgedCount > 0) {
                      setLayerConfig(newLayerConfig);
                      setLogMessage(`PURGED ${purgedCount} UNUSED LAYERS`);
                      setTimeout(() => commitToHistory(), 50);
                    } else {
                      setLogMessage("PURGE: NO UNUSED LAYERS FOUND");
                    }
                  }}
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

      {commandContextMenu && (
        <>
          <div className="fixed inset-0 z-[1050]" onClick={() => { setCommandContextMenu(null); setLockedMousePoint(null); setContextDistanceInput(''); }} />
          <div 
            className="fixed bg-[#0a0a0c]/98 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 flex flex-col gap-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[1100] animate-in zoom-in-95 fade-in slide-in-from-top-4 duration-200 min-w-[210px]"
            style={{ 
              left: Math.max(10, Math.min(commandContextMenu.x, window.innerWidth - 220)), 
              top: Math.max(10, Math.min(commandContextMenu.y, window.innerHeight - 450))
            }}
          >
            <div className="px-3 py-1.5 border-b border-white/5 mb-1 flex items-center justify-between">
              <div className="text-[8px] font-black uppercase text-cyan-500 tracking-widest">Command Context</div>
              <div className="text-[7px] text-neutral-500 font-mono italic">{activeCommandName}</div>
            </div>

            {/* Direct Distance Input inside the Right-Click Context Menu */}
            <div className="px-1.5 py-1 mb-1 border-b border-white/5">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (contextDistanceInput.trim()) {
                    if (engineRef.current && lockedMousePoint) {
                      engineRef.current.ctx.lastMousePoint = { ...lockedMousePoint };
                    }
                    executeCommand(contextDistanceInput);
                    setContextDistanceInput('');
                    setCommandContextMenu(null);
                    setLockedMousePoint(null);
                  }
                }}
                className="flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <input 
                  type="text"
                  autoFocus
                  placeholder={`Distance (${settings.units}/${settings.unitSubtype || 'mm'})...`}
                  value={contextDistanceInput}
                  onChange={(e) => setContextDistanceInput(e.target.value)}
                  className="flex-1 w-full bg-[#121216]/90 border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50 font-mono"
                />
                <button 
                  type="submit"
                  className="px-2.5 py-1.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl hover:bg-cyan-500/30 transition-all text-[10px] font-black uppercase active:scale-95"
                >
                  Draw
                </button>
              </form>
            </div>
            
            <button 
              onClick={() => {
                setPromptDialog({
                  title: 'Direct Distance Entry',
                  message: `Enter distance/length in current units (${settings.units}/${settings.unitSubtype || 'mm'}):`,
                  initialValue: '',
                  type: 'prompt',
                  onConfirm: (val) => {
                    if (val) executeCommand(val);
                  }
                });
                setCommandContextMenu(null);
              }}
              className="w-full text-left px-3 py-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-[10px] font-black uppercase flex items-center gap-3 active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:bg-cyan-500/20 transition-all mb-1"
            >
              <Target size={14} /> Enter Distance
            </button>

            {/* Context-Specific Actions based on active command */}
            {activeCommandName === 'LINE' && (
              <>
                <button 
                  onClick={() => {
                    executeCommand('C');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-cyan-500" /> Close Shape (C)
                </button>
                <button 
                  onClick={() => {
                    executeCommand('U');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <History size={14} className="text-amber-500" /> Undo Segment (U)
                </button>
              </>
            )}

            {activeCommandName === 'DLINE' && (
              <>
                <button 
                  onClick={() => {
                    setPromptDialog({
                      title: 'Double Line Thickness',
                      message: 'Enter wall thickness value:',
                      initialValue: '230',
                      type: 'prompt',
                      onConfirm: (val) => {
                        if (val) executeCommand(val);
                      }
                    });
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Weight size={14} className="text-cyan-500" /> Set Thickness (T)
                </button>
                <button 
                  onClick={() => {
                    executeCommand('j zero');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-neutral-500" /> Align: Zero (Center)
                </button>
                <button 
                  onClick={() => {
                    executeCommand('j top');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-neutral-500" /> Align: Top
                </button>
                <button 
                  onClick={() => {
                    executeCommand('j bottom');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-neutral-500" /> Align: Bottom
                </button>
                <button 
                  onClick={() => {
                    executeCommand('C');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-emerald-500" /> Close DLine (C)
                </button>
                <button 
                  onClick={() => {
                    executeCommand('U');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <History size={14} className="text-amber-500" /> Undo Segment (U)
                </button>
              </>
            )}

            {activeCommandName === 'POLYLINE' && (
              <>
                <button 
                  onClick={() => {
                    executeCommand('A');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-cyan-500" /> Switch to Arc (A)
                </button>
                <button 
                  onClick={() => {
                    executeCommand('L');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-cyan-500" /> Switch to Line (L)
                </button>
                <button 
                  onClick={() => {
                    executeCommand('C');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-emerald-500" /> Close Polyline (C)
                </button>
                <button 
                  onClick={() => {
                    executeCommand('U');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <History size={14} className="text-amber-500" /> Undo Point (U)
                </button>
              </>
            )}

            {activeCommandName === 'CIRCLE' && (
              <>
                <button 
                  onClick={() => {
                    setPromptDialog({
                      title: 'Circle Radius',
                      message: 'Enter circle radius:',
                      initialValue: '',
                      type: 'prompt',
                      onConfirm: (val) => {
                        if (val) {
                          executeCommand('R');
                          executeCommand(val);
                        }
                      }
                    });
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Target size={14} className="text-cyan-500" /> Enter Radius (R)
                </button>
                <button 
                  onClick={() => {
                    setPromptDialog({
                      title: 'Circle Diameter',
                      message: 'Enter circle diameter:',
                      initialValue: '',
                      type: 'prompt',
                      onConfirm: (val) => {
                        if (val) {
                          executeCommand('D');
                          executeCommand(val);
                        }
                      }
                    });
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Target size={14} className="text-cyan-400" /> Enter Diameter (D)
                </button>
                <button 
                  onClick={() => {
                    executeCommand('2P');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-neutral-500" /> 2-Point Mode (2P)
                </button>
                <button 
                  onClick={() => {
                    executeCommand('3P');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-neutral-500" /> 3-Point Mode (3P)
                </button>
                <button 
                  onClick={() => {
                    executeCommand('TTR');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-neutral-500" /> Tangent-Tangent-Radius
                </button>
              </>
            )}

            {activeCommandName === 'RECTANGLE' && (
              <>
                <button 
                  onClick={() => {
                    setPromptDialog({
                      title: 'Rectangle Width',
                      message: 'Enter rectangle width:',
                      initialValue: '',
                      type: 'prompt',
                      onConfirm: (w) => {
                        if (w) {
                          executeCommand('D');
                          executeCommand(w);
                          setPromptDialog({
                            title: 'Rectangle Height',
                            message: 'Enter rectangle height:',
                            initialValue: '',
                            type: 'prompt',
                            onConfirm: (h) => {
                              if (h) executeCommand(h);
                            }
                          });
                        }
                      }
                    });
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Sliders size={14} className="text-cyan-500" /> Set Dimensions (D)
                </button>
                <button 
                  onClick={() => {
                    setPromptDialog({
                      title: 'Rectangle Rotation',
                      message: 'Enter rotation angle (degrees):',
                      initialValue: '0',
                      type: 'prompt',
                      onConfirm: (rot) => {
                        if (rot) {
                          executeCommand('R');
                          executeCommand(rot);
                        }
                      }
                    });
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <RotateCw size={14} className="text-amber-500" /> Set Rotation (R)
                </button>
              </>
            )}

            {activeCommandName === 'ARC' && (
              <>
                <button 
                  onClick={() => {
                    executeCommand('3P');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-neutral-500" /> 3-Point Arc
                </button>
                <button 
                  onClick={() => {
                    executeCommand('CENTER');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-neutral-500" /> Center-Start-End
                </button>
                <button 
                  onClick={() => {
                    executeCommand('2P');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-neutral-500" /> 2-Point Arc
                </button>
                <button 
                  onClick={() => {
                    setPromptDialog({
                      title: 'Arc Radius (SER)',
                      message: 'Enter arc radius:',
                      initialValue: '',
                      type: 'prompt',
                      onConfirm: (rad) => {
                        if (rad) {
                          executeCommand('SER');
                          executeCommand(rad);
                        }
                      }
                    });
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Target size={14} className="text-cyan-500" /> Start-End-Radius
                </button>
              </>
            )}

            {activeCommandName === 'POLYGON' && (
              <>
                <button 
                  onClick={() => {
                    setPromptDialog({
                      title: 'Polygon Sides',
                      message: 'Enter number of sides (>= 3):',
                      initialValue: '4',
                      type: 'prompt',
                      onConfirm: (sides) => {
                        if (sides) executeCommand(sides);
                      }
                    });
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Grid3X3 size={14} className="text-cyan-500" /> See/Set Sides
                </button>
                <button 
                  onClick={() => {
                    executeCommand('I');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-neutral-500" /> Inscribed in Circle (I)
                </button>
                <button 
                  onClick={() => {
                    executeCommand('C');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-neutral-500" /> Circumscribed (C)
                </button>
              </>
            )}

            {activeCommandName === 'ELLIPSE' && (
              <>
                <button 
                  onClick={() => {
                    executeCommand('CENTER');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-neutral-500" /> Center Mode
                </button>
                <button 
                  onClick={() => {
                    executeCommand('2P');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-neutral-500" /> Axis Endpoint Mode (2P)
                </button>
                <button 
                  onClick={() => {
                    executeCommand('3P');
                    setCommandContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-300 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95"
                >
                  <Check size={14} className="text-neutral-500" /> Axis Endpoint Mode (3P)
                </button>
              </>
            )}

            <div className="h-px bg-white/5 my-1" />

            <button onClick={() => { executeCommand(''); setCommandContextMenu(null); }} className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
              <Check className="text-emerald-500" size={14} /> Enter (Finish)
            </button>
            <button onClick={() => { handleAction('cancel'); setCommandContextMenu(null); }} className="w-full text-left px-3 py-2 rounded-xl text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-all font-bold uppercase flex items-center gap-3 active:scale-95">
              <X className="text-red-500" size={14} /> Cancel (Esc)
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

      <div className="h-7 bg-[#0a0a0c] border-t border-white/5 flex items-center shrink-0 cursor-default select-none relative z-[150] will-change-transform">
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
        <div className="flex-1 flex items-center h-full overflow-x-auto scrollbar-none gap-px touch-pan-x overscroll-x-contain will-change-transform">
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

      <footer className="bg-black shrink-0 pb-[env(safe-area-inset-bottom)] relative z-[160]">
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
            savedMacros={savedMacros}
            isRecordingMacro={isRecordingMacro}
            recordedCommandsCount={recordedCommands.length}
        />
        <CommandBar 
          onCommand={executeCommand} 
          onAiQuery={async (q, sketch) => { 
            setIsAiThinking(true);
            setCommandHistory(prev => [...prev, "> AI: " + q]);
            setLogMessage("CONSULTING PRINCIPAL ARCHITECT..."); 
            
            const context = getAiContextSummary();

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
          onAction={handleAction}
          prompt={commandPrompt} 
          history={commandHistory}
          value={commandInput} 
          onChange={setCommandInput} 
        />
        <div id="status-bar" className="bg-zinc-900 border-t border-zinc-700 px-4 py-1 text-xs text-gray-400 flex justify-between select-none font-mono shrink-0">
          <div>
            Entities: <span className="text-cyan-400">{(Object.values(layers).flat() as Shape[]).length}</span> 
            {(Object.values(layers).flat() as Shape[]).length > 15000 && <span className="text-yellow-400"> (showing first 15000)</span>}
          </div>
          <div>Scale: {view?.scale?.toFixed(2)}x</div>
          <div>2D Mode</div>
        </div>
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
          layers={importSummary.layers}
          blocks={importSummary.blocks}
        />
      )}

      {showConflictDialog && conflictData && (
        <SyncConflictDialog
          fileName={conflictData.fileName}
          localTime={conflictData.localState.timestamp}
          onResolve={resolveSyncConflict}
          onCancel={() => {
            setShowConflictDialog(false);
            setConflictData(null);
          }}
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

      {showPurgeDialog && purgeInfo && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" id="purge-modal-overlay">
           <div className="fixed inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowPurgeDialog(false)} id="purge-modal-backdrop" />
           <div className="relative w-full max-w-sm bg-[#0a0a0c] border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200" id="purge-modal-container">
              <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                <Trash2 className="text-red-500" size={14} /> Purge drawing
              </h3>
              <p className="text-neutral-500 text-[10px] uppercase tracking-wider mb-6 leading-relaxed">
                The drawing optimizer has identified unused elements that can be permanently deleted to trim project file size:
              </p>
              
              <div className="space-y-2 mb-6" id="purge-stats-breakdown">
                <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between" id="purge-layers-row">
                  <div>
                    <div className="text-white text-[10px] font-black tracking-wide uppercase">UNUSED LAYERS</div>
                    <div className="text-neutral-500 text-[8px] uppercase tracking-wider mt-0.5 font-semibold max-w-[180px] truncate">
                      {purgeInfo.layers.length > 0 ? purgeInfo.layers.join(', ') : 'None'}
                    </div>
                  </div>
                  <div className="text-cyan-400 font-mono text-xs font-black bg-cyan-500/10 px-2 py-0.5 rounded-lg">
                    -{purgeInfo.layers.length}
                  </div>
                </div>

                <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between" id="purge-blocks-row">
                  <div>
                    <div className="text-white text-[10px] font-black tracking-wide uppercase">UNUSED BLOCKS</div>
                    <div className="text-neutral-500 text-[8px] uppercase tracking-wider mt-0.5 font-semibold max-w-[180px] truncate">
                      {purgeInfo.blocks.length > 0 ? purgeInfo.blocks.join(', ') : 'None'}
                    </div>
                  </div>
                  <div className="text-emerald-400 font-mono text-xs font-black bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                    -{purgeInfo.blocks.length}
                  </div>
                </div>

                <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between" id="purge-styles-row">
                  <div>
                    <div className="text-white text-[10px] font-black tracking-wide uppercase">UNUSED STYLES</div>
                    <div className="text-neutral-500 text-[8px] uppercase tracking-wider mt-0.5 font-semibold max-w-[180px] truncate">
                      {purgeInfo.dimStyles.length > 0 ? purgeInfo.dimStyles.join(', ') : 'None'}
                    </div>
                  </div>
                  <div className="text-amber-400 font-mono text-xs font-black bg-amber-500/10 px-2 py-0.5 rounded-lg">
                    -{purgeInfo.dimStyles.length}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                 <button 
                   onClick={() => setShowPurgeDialog(false)} 
                   className="flex-1 py-3 rounded-xl bg-white/5 text-neutral-400 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
                   id="purge-cancel-btn"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={executePurge} 
                   className="flex-1 py-3 rounded-xl bg-red-500 text-white hover:bg-red-400 text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                   id="purge-confirm-btn"
                 >
                   <Trash2 size={10} /> Purge Now
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
