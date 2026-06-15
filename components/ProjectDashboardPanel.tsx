import React from 'react';
import { 
  X, 
  LayoutDashboard, 
  Sliders, 
  Home, 
  Box, 
  Palette, 
  Scissors, 
  Layers, 
  CheckCircle, 
  Armchair, 
  BarChart3, 
  Activity, 
  Coins, 
  SlidersHorizontal,
  ChevronDown, 
  ChevronUp, 
  Download, 
  RotateCcw, 
  Info,
  Sparkles,
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  TrendingUp,
  FileText
} from 'lucide-react';
import { Shape, AppSettings } from '../types';
import { calculateArea, calculateShapeLength } from '../services/cadService';
import { calculateVoxProjectStats } from '../services/voxService';
import { jsPDF } from 'jspdf';

interface ProjectDashboardPanelProps {
  layers: Record<string, Shape[]>;
  settings: AppSettings;
  onClose: () => void;
}

// Editable custom milestone interface
interface CustomMilestone {
  id: string;
  title: string;
  phase: string;
  dueDate: string;
  completed: boolean;
}

const ProjectDashboardPanel: React.FC<ProjectDashboardPanelProps> = ({ layers, settings, onClose }) => {
  const allShapes = Object.values(layers).flat().filter(Boolean) as Shape[];
  const isImperial = settings.units === 'imperial';
  const meta = settings.metadata || {
    author: "VoxCADD Designer",
    createdAt: new Date().toISOString().split('T')[0],
    lastModified: new Date().toISOString(),
    revision: "REV-01",
    projectRevision: "V-1.0",
    description: "CAD Drafting Model"
  };

  // Primary Sub-tabs: Analytics, Material Take-off, Timeline & Milestones
  const [activeTab, setActiveTab] = React.useState<'space' | 'mto' | 'timeline'>('space');

  // Dynamic cost configuration hooks
  const [currencySymbol, setCurrencySymbol] = React.useState<string>('$');
  const [wallHeight, setWallHeight] = React.useState<number>(isImperial ? 10 : 3.0);
  const [drywallUnitCost, setDrywallUnitCost] = React.useState<number>(19.50);
  const [drywallPanelArea, setDrywallPanelArea] = React.useState<number>(isImperial ? 32 : 2.97);
  const [paintUnitCost, setPaintUnitCost] = React.useState<number>(48.00);
  const [paintCoverageValue, setPaintCoverageValue] = React.useState<number>(isImperial ? 350 : 35.0);
  const [brickUnitCost, setBrickUnitCost] = React.useState<number>(1.25);
  const [brickCoverageValue, setBrickCoverageValue] = React.useState<number>(isImperial ? 7.0 : 0.08); // Bricks per unit
  const [flooringUnitCost, setFlooringUnitCost] = React.useState<number>(isImperial ? 5.50 : 55.00);
  const [flooringWastePct, setFlooringWastePct] = React.useState<number>(10);
  const [laborMultiplier, setLaborMultiplier] = React.useState<number>(20); // Contingency markup & labor percent

  // Expandable sections for sliders
  const [expandedSection, setExpandedSection] = React.useState<string | null>(null);

  // Dynamic user-customizable milestones state
  const [milestones, setMilestones] = React.useState<CustomMilestone[]>([
    { id: '1', title: 'A-GRID Boundary Site Setup', phase: 'Schematic Design', dueDate: '2026-06-15', completed: true },
    { id: '2', title: 'Assemble Structural Columns Matrix', phase: 'Structural Grid', dueDate: '2026-06-20', completed: false },
    { id: '3', title: 'Structural Load-Bearing Partition Wall Enclosure', phase: 'Design Development', dueDate: '2026-06-28', completed: false },
    { id: '4', title: 'Openings Assemblies (Doors & Windows)', phase: 'Fittings Layout', dueDate: '2026-07-05', completed: false },
    { id: '5', title: 'LEED Compliance Audit & MTO Finalization', phase: 'Quantity Survey', dueDate: '2026-07-12', completed: false }
  ]);

  // Milestone input form state
  const [newTitle, setNewTitle] = React.useState('');
  const [newPhase, setNewPhase] = React.useState('Schematic Design');
  const [newDate, setNewDate] = React.useState(new Date().toISOString().split('T')[0]);

  // Handle adding custom milestones
  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const item: CustomMilestone = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTitle,
      phase: newPhase,
      dueDate: newDate,
      completed: false
    };
    setMilestones(prev => [...prev, item]);
    setNewTitle('');
  };

  // Toggle milestone checkbox status
  const handleToggleMilestone = (id: string) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, completed: !m.completed } : m));
  };

  // Delete milestone
  const handleDeleteMilestone = (id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
  };

  // Base Reset parameters
  const handleResetEstimates = () => {
    setWallHeight(isImperial ? 10 : 3.0);
    setDrywallUnitCost(19.50);
    setDrywallPanelArea(isImperial ? 32 : 2.97);
    setPaintUnitCost(48.00);
    setPaintCoverageValue(isImperial ? 350 : 35.0);
    setBrickUnitCost(1.25);
    setBrickCoverageValue(isImperial ? 7.0 : 0.08);
    setFlooringUnitCost(isImperial ? 5.50 : 55.00);
    setFlooringWastePct(10);
    setLaborMultiplier(20);
  };

  // Sync parameters if unit changes
  React.useEffect(() => {
    handleResetEstimates();
  }, [isImperial]);

  // Standard architectural statistics calculations
  const projectStats = calculateVoxProjectStats({ entities: allShapes, layers: {} });
  const adv = projectStats.advancedStats || { layerCounts: {}, totalWallLength: 0, furnitureBlocksCount: 0, furnitureBlockCounts: {} };

  // Calculate live paths
  let linesLength = 0;
  let plinesLength = 0;
  let dlinesLength = 0;
  let rectsLength = 0;
  let polygonsLength = 0;
  let circularLength = 0;
  let otherLength = 0;

  let totalLinesCount = 0;
  let totalPlinesCount = 0;
  let totalDlinesCount = 0;
  let totalRectsCount = 0;
  let totalPolygonsCount = 0;
  let totalCircularCount = 0;

  let totalBlocksUsed = 0;
  const blockCountsRecord: Record<string, number> = {};

  allShapes.forEach(s => {
    const type = s.type || 'unknown';
    const len = calculateShapeLength(s);

    if (type === 'line' || type === 'section') {
      linesLength += len;
      totalLinesCount++;
    } else if (type === 'pline' || type === 'spline') {
      plinesLength += len;
      totalPlinesCount++;
    } else if (type === 'dline') {
      dlinesLength += len;
      totalDlinesCount++;
    } else if (type === 'rect') {
      rectsLength += len;
      totalRectsCount++;
    } else if (type === 'polygon') {
      polygonsLength += len;
      totalPolygonsCount++;
    } else if (type === 'circle' || type === 'arc' || type === 'ellipse' || type === 'donut') {
      circularLength += len;
      totalCircularCount++;
    } else {
      otherLength += len;
    }

    if (type === 'block') {
      totalBlocksUsed++;
      const blockId = (s as any).blockId || 'Furniture Component';
      blockCountsRecord[blockId] = (blockCountsRecord[blockId] || 0) + 1;
    }
  });

  const totalSegmentLength = linesLength + plinesLength + dlinesLength + rectsLength + polygonsLength + circularLength + otherLength;
  const totalWallLength = adv.totalWallLength;

  // Closed internal area calculations
  let totalAreaRaw = 0; 
  let closedSpacesCount = 0;

  allShapes.forEach(s => {
    const isClosed = s.type === 'rect' || s.type === 'circle' || (s.type === 'pline' && (s as any).closed);
    if (isClosed) {
      try {
        const area = calculateArea(s as any);
        if (typeof area === 'number' && area > 0) {
          totalAreaRaw += area;
          closedSpacesCount++;
        }
      } catch (err) {
        // skip silenty
      }
    }
  });

  // Presentation Conversions
  let totalAreaDisplay = '';
  let wallLengthDisplay = '';
  let wallSurfaceAreaDisplay = '';
  let wallSurfaceAreaVal = 0;
  let floorAreaVal = 0;

  if (isImperial) {
    const totalAreaSqFt = totalAreaRaw / 144;
    floorAreaVal = totalAreaSqFt;
    totalAreaDisplay = `${totalAreaSqFt.toFixed(2)} sq. ft`;

    const totalWallLengthFt = totalWallLength / 12;
    wallLengthDisplay = `${totalWallLengthFt.toFixed(1)} ft`;

    wallSurfaceAreaVal = totalWallLengthFt * wallHeight * 2; // Double-sided
    wallSurfaceAreaDisplay = `${wallSurfaceAreaVal.toFixed(0)} sq. ft`;
  } else {
    const totalAreaM2 = totalAreaRaw / 1000000;
    floorAreaVal = totalAreaM2;
    totalAreaDisplay = `${totalAreaM2.toFixed(2)} m²`;

    const totalWallLengthM = totalWallLength / 1000;
    wallLengthDisplay = `${totalWallLengthM.toFixed(2)} m`;

    wallSurfaceAreaVal = totalWallLengthM * wallHeight * 2; // Double-sided
    wallSurfaceAreaDisplay = `${wallSurfaceAreaVal.toFixed(1)} m²`;
  }

  const formatLength = (valRaw: number): string => {
    if (isImperial) {
      return `${(valRaw / 12).toFixed(1)} ft`;
    } else {
      return `${(valRaw / 1000).toFixed(2)} m`;
    }
  };

  // Spatial Wall-To-Floor Ratio Metric (WFR)
  // Wall-to-floor ratio tells you spatial dividing efficiency.
  const wallToFloorRatio = floorAreaVal > 0 ? (isImperial ? (totalWallLength / 12) : (totalWallLength / 1000)) / floorAreaVal : 0;
  
  // Professional Evaluation Text based on Wall-To-Floor complexity index
  let wallToFloorRating = "Optimal Design";
  let wallToFloorDetail = "Highly spacious, modern open-concept floor system.";
  let wallToFloorColor = "text-cyan-400";

  if (wallToFloorRatio > 0.65) {
    wallToFloorRating = "High Division Density";
    wallToFloorDetail = "Subdivided cell layouts, suitable for partitions.";
    wallToFloorColor = "text-amber-500";
  } else if (wallToFloorRatio > 0.35) {
    wallToFloorRating = "Classic Residential";
    wallToFloorDetail = "Balanced ratio between hallways and open rooms.";
    wallToFloorColor = "text-purple-400";
  } else if (wallToFloorRatio === 0) {
    wallToFloorRating = "Empty Boundary";
    wallToFloorDetail = "No partition layout or footprint boundaries detected.";
    wallToFloorColor = "text-neutral-500";
  }

  // LEED-style CAD Modeling Project Completion score
  // We award completion score points based on layer diversity and entity integration.
  // 1. Grid/Ground layout (20%)
  // 2. RCC Column Matrix & structural lines (20%)
  // 3. Partition Wall Enclosures (20%)
  // 4. Doors & Openings Assemblies (20%)
  // 5. Furniture blocks & Text annotations (20%)
  let completionPoints = 0;
  const activeLayers = Object.keys(adv.layerCounts || {}).map(l => l.toUpperCase());
  
  if (allShapes.length > 0) completionPoints += 15; // Setup draft shapes
  if (activeLayers.some(l => l.includes('GRID') || l.includes('0') || l.includes('REF'))) completionPoints += 20;
  if (activeLayers.some(l => l.includes('COL') || l.includes('STRUCT') || l.includes('RCC'))) completionPoints += 20;
  if (activeLayers.some(l => l.includes('WALL') || l.includes('SECT') || dlinesLength > 0)) completionPoints += 25;
  if (activeLayers.some(l => l.includes('DOOR') || l.includes('WIN') || l.includes('FIT'))) completionPoints += 10;
  if (activeLayers.some(l => l.includes('FURN') || l.includes('DETAIL') || l.includes('BLOCK') || totalBlocksUsed > 0)) completionPoints += 10;
  const projectCompletionPct = Math.min(completionPoints, 100);

  // Dynamic cost projections
  const drywallPanelsNeeded = Math.ceil(wallSurfaceAreaVal / (drywallPanelArea || 1)) || 0;
  const paintGallonsNeeded = Math.ceil(wallSurfaceAreaVal / (paintCoverageValue || 1)) || 0;
  const bricksNeeded = isImperial
    ? Math.ceil(wallSurfaceAreaVal * brickCoverageValue)
    : Math.ceil(wallSurfaceAreaVal / (brickCoverageValue || 0.08)) || 0;
  const flooringAreaWithWaste = floorAreaVal * (1 + flooringWastePct / 100);

  const drywallCost = drywallPanelsNeeded * drywallUnitCost;
  const paintCost = paintGallonsNeeded * paintUnitCost;
  const brickCost = bricksNeeded * brickUnitCost;
  const flooringCost = flooringAreaWithWaste * flooringUnitCost;
  const subtotalMaterialCost = drywallCost + paintCost + brickCost + flooringCost;
  
  // Labor markup & contingency calculation
  const laborContingencyCost = subtotalMaterialCost * (laborMultiplier / 100);
  const totalProjectMaterialBudget = subtotalMaterialCost + laborContingencyCost;

  // Chart definitions
  const shapeCounts = projectStats.counts || {};
  const unsortedChartData = Object.entries(shapeCounts)
    .filter(([_, count]) => (count as number) > 0)
    .map(([type, count]) => {
      let label = type.toUpperCase();
      if (type === 'pline') label = 'POLYLINE';
      if (type === 'dline') label = 'DBL LINE';
      if (type === 'rect') label = 'RECTANGLE';
      return { name: label, count: count as number };
    });

  const chartData = unsortedChartData.sort((a, b) => b.count - a.count);
  const maxShapeCount = Math.max(...chartData.map(d => d.count), 1);
  const SHAPE_COLORS = [
    'from-cyan-500 to-[#00bcd4]', 
    'from-purple-500 to-indigo-500', 
    'from-amber-500 to-yellow-500', 
    'from-emerald-500 to-teal-500', 
    'from-rose-500 to-pink-500', 
    'from-blue-500 to-cyan-400'
  ];

  // Custom PDF Exporter utilizing custom grid grids and official jsPDF formatting
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Background visual grid and watermark setup
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, 210, 297, "F");

      // Set primary title, color palette (Space Blue/Cyan accents)
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.line(10, 10, 200, 10);
      doc.line(10, 287, 200, 287);

      // Report Header Section
      doc.setTextColor(15, 23, 42);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(18);
      doc.text("VOXCADD STUDIO PROFESSIONAL", 12, 22);

      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.text("QUANTITY TAKE-OFF & COST VALUATION SURVEY REPORT", 12, 27);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(0, 188, 212);
      doc.text(`MEASUREMENT STANDARD: ${settings.units.toUpperCase()}`, 155, 22);
      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "normal");
      doc.text(`GENERATED: ${new Date().toLocaleDateString()}`, 155, 27);

      // Section 1: Project Metadata Card
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(12, 35, 186, 32, 3, 3, "FD");

      doc.setTextColor(15, 23, 42);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.text("1. ARCHITECTURAL METADATA METRICS", 16, 42);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`Project Author:  ${meta.author || 'N/A'}`, 16, 48);
      doc.text(`Revision Level:  ${meta.revision || 'REV-01'}`, 16, 53);
      doc.text(`Revision Phase:  ${meta.projectRevision || 'V-1.0'}`, 16, 58);
      doc.text(`Created Timestamp: ${meta.createdAt || 'N/A'}`, 16, 63);

      doc.text(`Description: ${meta.description || 'CAD Drafting Floor System Layout'}`, 105, 48);
      doc.text(`Shapes Count: ${allShapes.length} entities`, 105, 53);
      doc.text(`Layer Slices: ${Object.keys(adv.layerCounts || {}).length} layers active`, 105, 58);
      doc.text(`Blocks library: ${totalBlocksUsed} active components`, 105, 63);

      // Section 2: Spatial Efficiency Analysis Card
      doc.roundedRect(12, 74, 186, 38, 3, 3, "FD");
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("2. SPATIAL EFFICIENCY PERFORMANCE SURVEY", 16, 81);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Net Footprint Floor Area:`, 16, 88); 
      doc.setFont("Helvetica", "bold");
      doc.text(totalAreaDisplay, 70, 88);

      doc.setFont("Helvetica", "normal");
      doc.text(`Cumulative Partition Wall Path:`, 16, 94);
      doc.setFont("Helvetica", "bold");
      doc.text(wallLengthDisplay, 70, 94);

      doc.setFont("Helvetica", "normal");
      doc.text(`Spatial Height Configuration:`, 16, 100);
      doc.setFont("Helvetica", "bold");
      doc.text(`${wallHeight} ${isImperial ? 'ft' : 'm'}`, 70, 100);

      doc.setFont("Helvetica", "normal");
      doc.text(`Double-Faced Wall Surface Area:`, 16, 106);
      doc.setFont("Helvetica", "bold");
      doc.text(wallSurfaceAreaDisplay, 70, 106);

      // Right grid of section 2
      doc.setFont("Helvetica", "normal");
      doc.text(`Wall-to-Floor Spatial Ratio:`, 110, 88);
      doc.setFont("Helvetica", "bold");
      doc.text(`${wallToFloorRatio.toFixed(3)} (Length/Area)`, 160, 88);

      doc.setFont("Helvetica", "normal");
      doc.text(`Architectural Density Assessment:`, 110, 94);
      doc.setFont("Helvetica", "bold");
      doc.text(wallToFloorRating, 160, 94);

      doc.setFont("Helvetica", "normal");
      doc.text(`LEED Completion Rating Score:`, 110, 100);
      doc.setFont("Helvetica", "bold");
      doc.text(`${projectCompletionPct}% Completed`, 160, 100);

      // Section 3: Detailed Material Estimates Table
      doc.roundedRect(12, 119, 186, 98, 3, 3, "FD");
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("3. ESTIMATED CONSTRUCTION MATERIAL SURVEY", 16, 126);

      // Draw table headers
      doc.setFillColor(241, 245, 249);
      doc.rect(16, 132, 178, 8, "F");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text("MATERIAL CLASSIFICATION", 19, 137);
      doc.text("ESTIMATED QUANTITY", 78, 137);
      doc.text("CONFIG. RATE", 125, 137);
      doc.text("ESTIMATED DIRECT COST", 155, 137);

      // Table Row divider line
      doc.setDrawColor(226, 232, 240);
      doc.line(16, 140, 194, 140);

      // Row 1: Drywall
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("Gypsum Drywall Sheets", 19, 146);
      doc.text(`${drywallPanelsNeeded} sheets (Size: ${drywallPanelArea} ${isImperial ? 'sf' : 'm²'})`, 78, 146);
      doc.text(`${currencySymbol}${drywallUnitCost.toFixed(2)}`, 125, 146);
      doc.text(`${currencySymbol}${drywallCost.toFixed(2)}`, 155, 146);
      doc.line(16, 150, 194, 150);

      // Row 2: Paint
      doc.text("Interior Acrylic Wall Paint", 19, 156);
      doc.text(`${paintGallonsNeeded} gallons (Cov: ${paintCoverageValue} ${isImperial ? 'sf' : 'm²'})`, 78, 156);
      doc.text(`${currencySymbol}${paintUnitCost.toFixed(2)}`, 125, 156);
      doc.text(`${currencySymbol}${paintCost.toFixed(2)}`, 155, 156);
      doc.line(16, 160, 194, 160);

      // Row 3: Bricks
      doc.text("Masonry Facing Bricks / Blocks", 19, 166);
      doc.text(`${bricksNeeded} bricks`, 78, 166);
      doc.text(`${currencySymbol}${brickUnitCost.toFixed(2)}`, 125, 166);
      doc.text(`${currencySymbol}${brickCost.toFixed(2)}`, 155, 166);
      doc.line(16, 170, 194, 170);

      // Row 4: Flooring
      doc.text(`Cover Flooring (Waste: ${flooringWastePct}%)`, 19, 176);
      doc.text(`${flooringAreaWithWaste.toFixed(1)} ${isImperial ? 'sqft' : 'm²'}`, 78, 176);
      doc.text(`${currencySymbol}${flooringUnitCost.toFixed(2)}`, 125, 176);
      doc.text(`${currencySymbol}${flooringCost.toFixed(2)}`, 155, 176);
      doc.line(16, 180, 194, 180);

      // Subtotals & Contingency Rows
      doc.setFont("Helvetica", "bold");
      doc.text("Materials Direct Net Subtotal", 19, 188);
      doc.text(`${currencySymbol}${subtotalMaterialCost.toFixed(2)}`, 155, 188);

      doc.setFont("Helvetica", "normal");
      doc.text(`Labor Overhead & Contingency Allowance (${laborMultiplier}%)`, 19, 196);
      doc.text(`${currencySymbol}${laborContingencyCost.toFixed(2)}`, 155, 196);
      doc.line(16, 201, 194, 201);

      // Grand budget total row highlighted in sleek slate fill
      doc.setFillColor(15, 23, 42);
      doc.rect(16, 204, 178, 10, "F");
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("TOTAL PROJECT TAKEOFF DIRECT TARGET BUDGET", 19, 210.5);
      doc.text(`${currencySymbol}${totalProjectMaterialBudget.toFixed(2)}`, 155, 210.5);

      // Section 4: Scheduled Project Milestones & Progress
      doc.roundedRect(12, 224, 186, 52, 3, 3, "FD");
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("4. CURRENT BLUEPRINT REVISIONS & DISPATCH TIMELINE", 16, 231);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);

      let currentY = 239;
      milestones.slice(0, 4).forEach((m, idx) => {
        const marker = m.completed ? "[v] COMPLETED" : "[ ] SCHED.";
        doc.setFont("Helvetica", m.completed ? "bold" : "normal");
        doc.text(`${idx + 1}.  ${m.title}      (${m.phase})`, 16, currentY);
        doc.text(`DATE: ${m.dueDate}  |  STATUS: ${marker}`, 135, currentY);
        currentY += 8;
      });

      // Report Footer Disclaimer
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("Disclaimer: Projections are generated programmatically according to live model drawings and calculations. Re-evaluate physical conditions on-site.", 12, 293);

      doc.save(`VoxCADD_Takeoff_Budget_Report.pdf`);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#08080a]/95 backdrop-blur-2xl text-neutral-200">
      
      {/* Sleek Professional Banner with Neon Cyan Accent Glow */}
      <div className="flex justify-between items-center px-5 py-4 border-b border-white/5 bg-[#0e0e11] shrink-0 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-cyan-500 via-transparent to-purple-500" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-2xl bg-[#00bcd4]/10 border border-[#00bcd4]/20 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,188,212,0.15)]">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] leading-none flex items-center gap-1.5 font-sans">
              VoxCADD Intel <Sparkles size={11} className="text-[#00bcd4]" />
            </h3>
            <p className="text-[8px] font-bold text-cyan-500/80 uppercase tracking-[0.15em] mt-1 font-mono">LIVE BLUEPRINT QUANTITY SURVEYOR</p>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="w-8 h-8 flex items-center justify-center hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-xl text-neutral-400 hover:text-white transition-all duration-300"
        >
          <X size={16} />
        </button>
      </div>

      {/* Primary Sub-Tabs Controller */}
      <div className="flex p-2 bg-[#0c0c0f] border-b border-white/5 shrink-0 gap-1.5">
        <button
          onClick={() => setActiveTab('space')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 border ${
            activeTab === 'space'
              ? 'bg-gradient-to-r from-[#00bcd4]/15 to-[#00bcd4]/5 text-cyan-400 border-[#00bcd4]/30 shadow-[0_0_12px_rgba(0,188,212,0.1)]'
              : 'text-neutral-400 hover:text-white hover:bg-white/5 border-transparent'
          }`}
        >
          <Home size={11} />
          Structural Analytics
        </button>
        <button
          onClick={() => setActiveTab('mto')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 border ${
            activeTab === 'mto'
              ? 'bg-gradient-to-r from-purple-500/15 to-purple-500/5 text-purple-400 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
              : 'text-neutral-400 hover:text-white hover:bg-white/5 border-transparent'
          }`}
        >
          <Coins size={11} />
          MTO Cost survey
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 border ${
            activeTab === 'timeline'
              ? 'bg-gradient-to-r from-amber-500/15 to-amber-500/5 text-amber-400 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.1)]'
              : 'text-neutral-400 hover:text-white hover:bg-white/5 border-transparent'
          }`}
        >
          <Calendar size={11} />
          Milestone Timeline
        </button>
      </div>

      {/* Main Glassmorphic Wrapper Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin select-none relative bg-neutral-950/20">
        
        {/* TAB 1: SPACE & STRUCTURAL PERFORMANCE */}
        {activeTab === 'space' && (
          <div className="space-y-4 animate-fadeIn">
            
            {/* Key Glass Cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Card 1: LEED Progress Completion */}
              <div className="bg-[#121215]/80 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-2xl p-4 flex flex-col justify-between transition-all group">
                <div className="flex items-center gap-1.5 text-neutral-400 mb-1">
                  <div className="w-5 h-5 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/10 text-emerald-400">
                    <CheckCircle size={11} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 group-hover:text-emerald-400 transition-colors">Draft Progress</span>
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-white tracking-tight font-serif select-all leading-tight">
                      {projectCompletionPct}%
                    </span>
                  </div>
                  {/* Outer Bar */}
                  <div className="w-full bg-[#050507] rounded-full h-1.5 overflow-hidden border border-white/5 mt-2">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-[#00bcd4] h-full rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${projectCompletionPct}%` }}
                    />
                  </div>
                  <p className="text-[7.5px] font-bold text-neutral-500 uppercase mt-1.5 tracking-widest font-mono">
                    {projectCompletionPct === 100 ? 'All elements layout loaded' : 'Drafting Phase Active'}
                  </p>
                </div>
              </div>

              {/* Card 2: Cumulative Area Net */}
              <div className="bg-[#121215]/80 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-2xl p-4 flex flex-col justify-between transition-all group">
                <div className="flex items-center gap-1.5 text-neutral-400 mb-1">
                  <div className="w-5 h-5 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/10 text-cyan-400">
                    <Home size={11} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 group-hover:text-cyan-400 transition-colors">Zoned Area</span>
                </div>
                <div>
                  <div className="text-xl font-black text-white tracking-tight font-serif truncate leading-tight select-all">
                    {totalAreaRaw > 0 ? floorAreaVal.toFixed(1) : '0.0'}
                    <span className="text-[11px] font-black font-sans ml-1 text-cyan-500">
                      {isImperial ? 'sq ft' : 'm²'}
                    </span>
                  </div>
                  <p className="text-[7.5px] font-bold text-[#00bcd4] uppercase mt-2 tracking-widest font-mono">
                    {closedSpacesCount} closed zones drawn
                  </p>
                </div>
              </div>
            </div>

            {/* Performance Widget 3: Structural Efficiency Gauge & Wall-to-Floor Ratio */}
            <div className="bg-[#121215]/80 backdrop-blur-md border border-white/5 rounded-2xl p-4 space-y-3.5 relative overflow-hidden group hover:border-[#00bcd4]/20 transition-all duration-300">
              <div className="absolute right-0 top-0 w-20 h-20 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-full pointer-events-none" />
              <div className="flex justify-between items-center border-b border-white/5 pb-2 ml-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#00bcd4] flex items-center gap-1.5">
                  <TrendingUp size={12} /> SPATIAL DIVIDING RATIO (WFR)
                </span>
                <span className="text-[8px] font-mono font-bold text-neutral-500 uppercase">AIA/LEED SCIENTIFIC METRIC</span>
              </div>

              <div className="flex gap-4 items-center">
                <div className="w-14 h-14 rounded-2xl bg-[#050507] border border-white/5 flex items-center justify-center flex-col relative shrink-0">
                  <span className={`text-md font-black font-mono leading-none ${wallToFloorColor}`}>
                    {wallToFloorRatio > 0 ? wallToFloorRatio.toFixed(2) : '0.00'}
                  </span>
                  <span className="text-[6.5px] font-bold text-neutral-500 uppercase mt-1 tracking-wider">INDEX</span>
                </div>
                
                <div className="flex-1 space-y-0.5 min-w-0">
                  <h4 className={`text-[11px] font-black uppercase tracking-wider ${wallToFloorColor}`}>
                    {wallToFloorRating}
                  </h4>
                  <p className="text-[8.5px] font-medium text-neutral-400 uppercase leading-normal tracking-wide">
                    {wallToFloorDetail}
                  </p>
                </div>
              </div>

              <div className="h-1 bg-neutral-900 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="bg-gradient-to-r from-cyan-500 via-purple-500 to-rose-500 h-full rounded-full transition-all duration-700 ease-out" 
                  style={{ width: `${Math.min((wallToFloorRatio / 1.5) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Shape Distribution Profile Chart */}
            {chartData.length > 0 && (
              <div className="bg-[#121215]/80 backdrop-blur-md border border-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                  <BarChart3 size={13} className="text-cyan-400" />
                  <h4 className="text-[9px] font-black text-cyan-400 uppercase tracking-widest leading-none">Draft Complexity Profiles</h4>
                </div>
                <div className="space-y-2.5">
                  {chartData.map((d, index) => {
                    const percentage = (d.count / maxShapeCount) * 100;
                    return (
                      <div key={d.name} className="space-y-1">
                        <div className="flex justify-between items-center text-[8.5px] font-mono font-bold tracking-wider text-neutral-400 uppercase leading-none">
                          <span>{d.name}</span>
                          <span className="text-white font-mono">{d.count} pcs</span>
                        </div>
                        <div className="w-full bg-[#050507] h-1.5 rounded-full overflow-hidden border border-white/5">
                          <div 
                            className={`bg-gradient-to-r ${SHAPE_COLORS[index % SHAPE_COLORS.length]} h-full rounded-full transition-all duration-500 ease-out`} 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Lineal Segment Length List Card */}
            <div className="bg-[#121215]/80 backdrop-blur-md border border-white/5 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                <Sliders size={13} className="text-cyan-400" />
                <h4 className="text-[9px] font-black text-cyan-400 uppercase tracking-widest leading-none">Lineal Paths Quantities</h4>
              </div>
              <div className="divide-y divide-white/5 space-y-2.5 pt-0.5">
                {totalLinesCount > 0 && (
                  <div className="flex justify-between items-center bg-transparent">
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-black text-neutral-200 uppercase tracking-wider">A-WALL Single Lines</div>
                      <div className="text-[7.5px] font-semibold text-neutral-500 uppercase tracking-widest font-mono">Zoning boundary vectors ({totalLinesCount} entities)</div>
                    </div>
                    <span className="text-[10px] font-black text-neutral-300 font-mono select-all">{formatLength(linesLength)}</span>
                  </div>
                )}

                {totalPlinesCount > 0 && (
                  <div className="flex justify-between items-center pt-2.5 bg-transparent">
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-black text-neutral-200 uppercase tracking-wider">Polylines / Contours</div>
                      <div className="text-[7.5px] font-semibold text-neutral-500 uppercase tracking-widest font-mono">Closed envelope zones ({totalPlinesCount} shapes)</div>
                    </div>
                    <span className="text-[10px] font-black text-neutral-300 font-mono select-all">{formatLength(plinesLength)}</span>
                  </div>
                )}

                {totalDlinesCount > 0 && (
                  <div className="flex justify-between items-center pt-2.5 bg-transparent">
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-black text-neutral-200 uppercase tracking-wider">A-WALL Double Lines</div>
                      <div className="text-[7.5px] font-semibold text-neutral-500 uppercase tracking-widest font-mono">Structural wall partition sections ({totalDlinesCount} walls)</div>
                    </div>
                    <span className="text-[10px] font-black text-neutral-300 font-mono select-all">{formatLength(dlinesLength)}</span>
                  </div>
                )}

                {totalRectsCount > 0 && (
                  <div className="flex justify-between items-center pt-2.5 bg-transparent">
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-black text-neutral-200 uppercase tracking-wider">Rectangles / Columns</div>
                      <div className="text-[7.5px] font-semibold text-neutral-500 uppercase tracking-widest font-mono">Quadrilateral profiles ({totalRectsCount} shapes)</div>
                    </div>
                    <span className="text-[10px] font-black text-neutral-300 font-mono select-all">{formatLength(rectsLength)}</span>
                  </div>
                )}

                {totalCircularCount > 0 && (
                  <div className="flex justify-between items-center pt-2.5 bg-transparent">
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-black text-neutral-200 uppercase tracking-wider">Curves & Circular Paths</div>
                      <div className="text-[7.5px] font-semibold text-neutral-500 uppercase tracking-widest font-mono">Arc fittings & circles ({totalCircularCount} shapes)</div>
                    </div>
                    <span className="text-[10px] font-black text-neutral-300 font-mono select-all">{formatLength(circularLength)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t border-cyan-500/20 bg-cyan-950/10 rounded-b-xl px-2">
                  <div className="space-y-0.5">
                    <div className="text-[9px] font-black text-cyan-400 uppercase tracking-wider">Total Cumulative Vector Paths</div>
                    <div className="text-[7.5px] font-black text-neutral-500 uppercase tracking-widest font-mono">Combined model projection line length</div>
                  </div>
                  <span className="text-[11px] font-black text-cyan-400 font-mono select-all">{formatLength(totalSegmentLength)}</span>
                </div>
              </div>
            </div>

            {/* Block Inventory List */}
            {Object.keys(blockCountsRecord).length > 0 && (
              <div className="bg-[#121215]/80 backdrop-blur-md border border-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                  <Armchair size={13} className="text-[#00bcd4]" />
                  <h4 className="text-[9px] font-black text-[#00bcd4] uppercase tracking-widest leading-none">Placed Block Inventory</h4>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1 scrollbar-thin">
                  {Object.entries(blockCountsRecord).map(([blockId, count]) => (
                    <div key={blockId} className="bg-neutral-950/40 border border-white/5 rounded-xl p-2.5 flex justify-between items-center hover:border-white/10 transition-all">
                      <div className="min-w-0 pr-1">
                        <div className="text-[8.5px] font-mono text-neutral-300 font-black uppercase tracking-wider truncate" title={blockId}>
                          {blockId}
                        </div>
                        <div className="text-[7px] text-neutral-500 font-extrabold uppercase mt-0.5 font-mono tracking-wider">Component Block</div>
                      </div>
                      <span className="text-[9px] font-black text-cyan-400 font-mono px-1.5 py-0.5 rounded bg-cyan-500/5 border border-cyan-500/15">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INTERACTIVE COST COCKPIT */}
        {activeTab === 'mto' && (
          <div className="space-y-4 animate-fadeIn">
            
            {/* Global Controls */}
            <div className="bg-[#121215]/80 backdrop-blur-md border border-white/5 rounded-2xl p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-neutral-400">
                  <SlidersHorizontal size={13} className="text-purple-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-neutral-300">Target Currency</span>
                </div>
                {/* Selector */}
                <div className="flex bg-[#050510] border border-white/5 p-0.5 rounded-lg shadow-inner">
                  {['$', '€', '£', '¥', '₹'].map(cur => (
                    <button
                      key={cur}
                      onClick={() => setCurrencySymbol(cur)}
                      className={`w-6.5 h-5.5 flex items-center justify-center text-[9px] font-black rounded-md transition-all ${
                        currencySymbol === cur 
                          ? 'bg-purple-500/20 text-purple-300 font-black border border-purple-500/30' 
                          : 'text-neutral-500 hover:text-white'
                      }`}
                    >
                      {cur}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Wall Height Configurator Slider */}
              <div className="space-y-2 border-t border-white/5 pt-3.5">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1">
                    Partition Wall Height <Info size={9.5} className="text-neutral-500" title="Adjust double-sided drywall/brick surface areas instantly" />
                  </span>
                  <span className="font-mono text-[10px] font-bold text-[#00bcd4]">
                    {wallHeight} {isImperial ? 'ft' : 'm'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={isImperial ? "6" : "2.0"}
                    max={isImperial ? "18" : "6.0"}
                    step="0.5"
                    value={wallHeight}
                    onChange={(e) => setWallHeight(parseFloat(e.target.value))}
                    className="flex-1 accent-purple-500 h-1 bg-[#050507] rounded-lg cursor-pointer"
                  />
                  <input
                    type="number"
                    value={wallHeight}
                    step="0.1"
                    min="1"
                    max="25"
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) setWallHeight(v);
                    }}
                    className="w-13 bg-neutral-950 text-white font-mono text-[9px] text-center border border-white/5 focus:border-purple-500 focus:outline-none rounded-md py-1"
                  />
                </div>
              </div>
            </div>

            {/* Area Matrix Summary Header Widget */}
            <div className="bg-[#121215]/80 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden group hover:border-[#00bcd4]/20 transition-all duration-300">
              <div className="flex justify-between items-center text-[9px] uppercase font-black tracking-widest text-purple-400 border-b border-white/5 pb-2 ml-0.5">
                <span>Wall Enclosure Matrix</span>
                <span className="font-mono text-[#00bcd4]">{wallLengthDisplay} Total Path</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none">Faced Surface Area</span>
                <span className="text-[11px] font-black text-white font-mono select-all">{wallSurfaceAreaDisplay}</span>
              </div>
            </div>

            {/* Interactive Material Breakdown Accordion */}
            <div className="space-y-2">
              
              {/* Material 1: Drywall */}
              <div className="bg-[#121215]/80 backdrop-blur-md border border-white/5 rounded-2xl p-3.5 transition-all">
                <div className="flex items-center justify-between gap-3 select-none">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center text-purple-400 shrink-0">
                      <Sliders size={13} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-neutral-200 uppercase tracking-wider">Gypsum Drywall</div>
                      <div className="text-[7.5px] font-bold text-neutral-500 uppercase tracking-widest font-mono">
                        {drywallPanelsNeeded} sheets estimated
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-neutral-950 border border-white/5 rounded-lg px-2 py-1">
                      <span className="text-[9px] font-mono text-neutral-500 font-bold">{currencySymbol}</span>
                      <input 
                        type="number"
                        min="0"
                        value={drywallUnitCost}
                        onChange={(e) => setDrywallUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-10 bg-transparent text-white font-mono text-[10px] font-black focus:outline-none text-right"
                      />
                      <span className="text-[7.5px] text-neutral-500 font-extrabold uppercase font-mono">/Sh</span>
                    </div>

                    <button 
                      onClick={() => setExpandedSection(expandedSection === 'drywall' ? null : 'drywall')}
                      className="p-1 hover:bg-white/5 rounded text-neutral-400 hover:text-white transition-all"
                    >
                      {expandedSection === 'drywall' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {expandedSection === 'drywall' && (
                  <div className="mt-2.5 pt-2.5 border-t border-white/5 space-y-2 bg-neutral-950/20 p-2.5 rounded-xl animate-fadeIn">
                    <div className="flex justify-between items-center text-[8.5px] font-bold text-neutral-400 uppercase tracking-widest">
                      <span>Standard Panel Area Coverage</span>
                      <span className="font-mono text-cyan-400">{drywallPanelArea} {isImperial ? 'sq.ft' : 'm²'}</span>
                    </div>
                    <input
                      type="range"
                      min={isImperial ? "15" : "1.5"}
                      max={isImperial ? "48" : "5.0"}
                      step="1"
                      value={drywallPanelArea}
                      onChange={(e) => setDrywallPanelArea(parseFloat(e.target.value))}
                      className="w-full accent-cyan-500 h-1 bg-neutral-950 rounded cursor-pointer"
                    />
                    <div className="flex justify-between text-[8.5px] font-black font-mono border-t border-white/5 pt-2 text-neutral-500 uppercase leading-none mt-1">
                      <span>Drywall Materials Subtotal:</span>
                      <span className="text-white select-all">{currencySymbol}{drywallCost.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Material 2: Paint */}
              <div className="bg-[#121215]/80 backdrop-blur-md border border-white/5 rounded-2xl p-3.5 transition-all">
                <div className="flex items-center justify-between gap-3 select-none">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center text-purple-400 shrink-0">
                      <Palette size={13} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-neutral-200 uppercase tracking-wider">Premium Finish Coating</div>
                      <div className="text-[7.5px] font-bold text-neutral-500 uppercase tracking-widest font-mono">
                        {paintGallonsNeeded} {paintGallonsNeeded === 1 ? 'gallon' : 'gallons'} needed
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-neutral-950 border border-white/5 rounded-lg px-2 py-1">
                      <span className="text-[9px] font-mono text-neutral-500 font-bold">{currencySymbol}</span>
                      <input 
                        type="number"
                        min="0"
                        value={paintUnitCost}
                        onChange={(e) => setPaintUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-10 bg-transparent text-white font-mono text-[10px] font-black focus:outline-none text-right"
                      />
                      <span className="text-[7.5px] text-neutral-500 font-extrabold uppercase font-mono">/Gal</span>
                    </div>

                    <button 
                      onClick={() => setExpandedSection(expandedSection === 'paint' ? null : 'paint')}
                      className="p-1 hover:bg-white/5 rounded text-neutral-400 hover:text-white transition-all"
                    >
                      {expandedSection === 'paint' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {expandedSection === 'paint' && (
                  <div className="mt-2.5 pt-2.5 border-t border-white/5 space-y-2 bg-neutral-950/20 p-2.5 rounded-xl animate-fadeIn">
                    <div className="flex justify-between items-center text-[8.5px] font-bold text-neutral-400 uppercase tracking-widest">
                      <span>Rate Of Coverage Per Gallon</span>
                      <span className="font-mono text-cyan-400">{paintCoverageValue} {isImperial ? 'sq.ft' : 'm²'}</span>
                    </div>
                    <input
                      type="range"
                      min={isImperial ? "100" : "10.0"}
                      max={isImperial ? "500" : "50.0"}
                      step="10"
                      value={paintCoverageValue}
                      onChange={(e) => setPaintCoverageValue(parseFloat(e.target.value))}
                      className="w-full accent-cyan-500 h-1 bg-neutral-950 rounded cursor-pointer"
                    />
                    <div className="flex justify-between text-[8.5px] font-black font-mono border-t border-white/5 pt-2 text-neutral-500 uppercase leading-none mt-1">
                      <span>Finish Coatings Subtotal:</span>
                      <span className="text-white select-all">{currencySymbol}{paintCost.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Material 3: Masonry Bricks */}
              <div className="bg-[#121215]/80 backdrop-blur-md border border-white/5 rounded-2xl p-3.5 transition-all">
                <div className="flex items-center justify-between gap-3 select-none">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center text-purple-400 shrink-0">
                      <Box size={13} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-neutral-200 uppercase tracking-wider">Masonry Facing Bricks</div>
                      <div className="text-[7.5px] font-bold text-neutral-500 uppercase tracking-widest font-mono">
                        {bricksNeeded} structural units
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-neutral-950 border border-white/5 rounded-lg px-2 py-1">
                      <span className="text-[9px] font-mono text-neutral-500 font-bold">{currencySymbol}</span>
                      <input 
                        type="number"
                        min="0"
                        step="0.05"
                        value={brickUnitCost}
                        onChange={(e) => setBrickUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-10 bg-transparent text-white font-mono text-[10px] font-black focus:outline-none text-right"
                      />
                      <span className="text-[7.5px] text-neutral-500 font-extrabold uppercase font-mono">/Pcs</span>
                    </div>

                    <button 
                      onClick={() => setExpandedSection(expandedSection === 'brick' ? null : 'brick')}
                      className="p-1 hover:bg-white/5 rounded text-neutral-400 hover:text-white transition-all"
                    >
                      {expandedSection === 'brick' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {expandedSection === 'brick' && (
                  <div className="mt-2.5 pt-2.5 border-t border-white/5 space-y-2 bg-neutral-950/20 p-2.5 rounded-xl animate-fadeIn">
                    <div className="flex justify-between items-center text-[8.5px] font-bold text-neutral-400 uppercase tracking-widest">
                      <span>{isImperial ? 'Bricks per sq. ft of boundary Face' : 'Single Block Enclosure Face Area'}</span>
                      <span className="font-mono text-cyan-400">{brickCoverageValue} {isImperial ? 'pcs/sqft' : 'm²'}</span>
                    </div>
                    <input
                      type="range"
                      min={isImperial ? "1" : "0.02"}
                      max={isImperial ? "15" : "0.20"}
                      step="0.01"
                      value={brickCoverageValue}
                      onChange={(e) => setBrickCoverageValue(parseFloat(e.target.value))}
                      className="w-full accent-cyan-500 h-1 bg-neutral-950 rounded cursor-pointer"
                    />
                    <div className="flex justify-between text-[8.5px] font-black font-mono border-t border-white/5 pt-2 text-neutral-500 uppercase leading-none mt-1">
                      <span>Masonry Block Subtotal:</span>
                      <span className="text-white select-all">{currencySymbol}{brickCost.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Material 4: Flooring */}
              <div className="bg-[#121215]/80 backdrop-blur-md border border-white/5 rounded-2xl p-3.5 transition-all">
                <div className="flex items-center justify-between gap-3 select-none">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center text-purple-400 shrink-0">
                      <Scissors size={13} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-neutral-200 uppercase tracking-wider">Flooring Covers</div>
                      <div className="text-[7.5px] font-bold text-neutral-500 uppercase tracking-widest font-mono">
                        {flooringAreaWithWaste.toFixed(1)} {isImperial ? 'sq.ft' : 'm²'} needed
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-neutral-950 border border-white/5 rounded-lg px-2 py-1">
                      <span className="text-[9px] font-mono text-neutral-500 font-bold">{currencySymbol}</span>
                      <input 
                        type="number"
                        min="0"
                        value={flooringUnitCost}
                        onChange={(e) => setFlooringUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-10 bg-transparent text-white font-mono text-[10px] font-black focus:outline-none text-right"
                      />
                      <span className="text-[7.5px] text-neutral-500 font-extrabold uppercase font-mono">/Un</span>
                    </div>

                    <button 
                      onClick={() => setExpandedSection(expandedSection === 'floor' ? null : 'floor')}
                      className="p-1 hover:bg-white/5 rounded text-neutral-400 hover:text-white transition-all"
                    >
                      {expandedSection === 'floor' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {expandedSection === 'floor' && (
                  <div className="mt-2.5 pt-2.5 border-t border-white/5 space-y-2 bg-neutral-950/20 p-2.5 rounded-xl animate-fadeIn">
                    <div className="flex justify-between items-center text-[8.5px] font-bold text-neutral-400 uppercase tracking-widest">
                      <span>Flooring cutting waste percentage factor</span>
                      <span className="font-mono text-cyan-400">{flooringWastePct}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="1"
                      value={flooringWastePct}
                      onChange={(e) => setFlooringWastePct(parseInt(e.target.value) || 0)}
                      className="w-full accent-cyan-500 h-1 bg-neutral-950 rounded cursor-pointer"
                    />
                    <div className="flex justify-between text-[8.5px] font-black font-mono border-t border-white/5 pt-2 text-neutral-500 uppercase leading-none mt-1">
                      <span>Flooring Layers Subtotal:</span>
                      <span className="text-white select-all">{currencySymbol}{flooringCost.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Financial Valuation Card */}
            {subtotalMaterialCost > 0 ? (
              <div className="bg-[#121215] border border-purple-500/20 rounded-2xl p-4 space-y-3.5 relative overflow-hidden bg-gradient-to-tr from-[#121215] to-[#121215]/80">
                <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-purple-500/5 to-transparent rounded-full pointer-events-none" />
                <div className="flex justify-between items-center border-b border-white/5 pb-2.5 ml-0.5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
                    ESTIMATED DETAILED BUDGET COCKPIT
                  </span>
                  <Coins size={14} className="text-purple-400" />
                </div>

                {/* Vertical cost visualizers */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold text-neutral-400 leading-none">
                    <span>Direct Material Cost</span>
                    <span className="font-mono text-white">{currencySymbol}{subtotalMaterialCost.toFixed(2)}</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] uppercase font-bold text-neutral-400 leading-none">
                      <span>Contingency & Custom Markup</span>
                      <span className="font-mono text-[#00bcd4]">{laborMultiplier}% ({currencySymbol}{laborContingencyCost.toFixed(2)})</span>
                    </div>
                    {/* Contingency slider bar */}
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="1"
                      value={laborMultiplier}
                      onChange={(e) => setLaborMultiplier(parseInt(e.target.value) || 5)}
                      className="w-full accent-purple-500 h-1 bg-neutral-950 rounded cursor-pointer mt-1"
                    />
                  </div>

                  <div className="flex justify-between items-center bg-black/40 border border-white/5 p-3 rounded-xl mt-2.5">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-purple-400 font-sans">Project Budget Target</span>
                      <p className="text-[7px] font-bold text-neutral-500 uppercase tracking-wider font-mono">Includes overhead markups</p>
                    </div>
                    <span className="text-md sm:text-lg font-black text-white font-mono select-all ml-2">
                      {currencySymbol}{totalProjectMaterialBudget.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-neutral-600 bg-[#121215]/40 border border-white/5 rounded-2xl uppercase text-[9px] font-black tracking-widest font-mono">
                Draw rooms and partitions to project financial budgets
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DYNAMIC TIMELINE & MILESTONES */}
        {activeTab === 'timeline' && (
          <div className="space-y-4 animate-fadeIn">
            
            {/* Real-time Revision Card */}
            <div className="bg-[#121215]/80 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex flex-col gap-1.5 bg-gradient-to-br from-[#121215] to-[#121215]/70">
              <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-[#00bcd4] border-b border-white/5 pb-2 ml-0.5">
                <span className="flex items-center gap-1.5"><Clock size={11} /> CURRENT DISPATCH STATS</span>
                <span>METADATA TRACKING</span>
              </div>
              <div className="grid grid-cols-2 gap-3.5 pt-1 text-[9.5px]">
                <div className="space-y-0.5">
                  <span className="text-neutral-500 font-bold uppercase tracking-widest font-mono leading-none">Drawing Revision</span>
                  <div className="font-mono text-white uppercase text-xs font-black">{meta.revision || 'REV-01'}</div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-neutral-500 font-bold uppercase tracking-widest font-mono leading-none">Blueprint Phase</span>
                  <div className="font-mono text-[#00bcd4] uppercase text-xs font-black">{meta.projectRevision || 'V-1.0'}</div>
                </div>
              </div>
            </div>

            {/* Editable Timeline Milestones list */}
            <div className="bg-[#121215]/80 backdrop-blur-md border border-white/5 rounded-2xl p-4 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-2.5 ml-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#00bcd4] flex items-center gap-1.5">
                  <Plus size={11} /> ARCHITECTURAL TARGET ROADMAP
                </span>
                <span className="text-[8px] font-mono font-bold text-neutral-500 uppercase tracking-widest">CHECK AND ADJUST</span>
              </div>

              {/* Milestones scroll wrap */}
              <div className="space-y-3.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {milestones.map((m) => (
                  <div 
                    key={m.id} 
                    className={`flex items-start justify-between gap-3 p-3 rounded-xl border transition-all duration-300 relative group overflow-hidden ${
                      m.completed 
                        ? 'bg-[#040909]/40 border-cyan-500/15 hover:border-cyan-500/25' 
                        : 'bg-[#121215]/60 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <button 
                      onClick={() => handleToggleMilestone(m.id)}
                      className="mt-0.5 text-neutral-500 hover:text-cyan-400 transition-all shrink-0"
                    >
                      {m.completed ? (
                        <CheckSquare size={15} className="text-cyan-400" />
                      ) : (
                        <Square size={15} className="text-neutral-600" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className={`text-[10.5px] uppercase font-black tracking-wider truncate leading-tight ${m.completed ? 'line-through text-neutral-500' : 'text-neutral-200'}`}>
                        {m.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-[7px] font-extrabold uppercase tracking-widest text-neutral-500 font-mono">
                        <span className="text-cyan-500">{m.phase}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5"><Calendar size={8} /> DUE {m.dueDate}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteMilestone(m.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-500/10 rounded text-neutral-500 hover:text-rose-400 transition-all shrink-0"
                    >
                      <Trash2 size={12.5} />
                    </button>
                  </div>
                ))}

                {milestones.length === 0 && (
                  <div className="text-center py-6 text-[9px] font-black uppercase tracking-widest font-mono text-neutral-600">
                    No custom target milestones defined
                  </div>
                )}
              </div>

              {/* Add Milestone Inline Form */}
              <form onSubmit={handleAddMilestone} className="border-t border-white/5 pt-3.5 space-y-2.5">
                <div className="text-[8px] font-black uppercase text-cyan-400 tracking-wider">Inject Custom Planning Milestone</div>
                
                <input 
                  type="text"
                  placeholder="Task title (e.g. Structural layout revision)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-neutral-950 font-sans text-[10px] font-bold text-neutral-200 border border-white/5 focus:border-cyan-500 focus:outline-none rounded-xl px-3 py-2.5 placeholder-neutral-600"
                />

                <div className="grid grid-cols-2 gap-2">
                  <select 
                    value={newPhase}
                    onChange={(e) => setNewPhase(e.target.value)}
                    className="bg-neutral-950 text-[9px] font-black uppercase text-neutral-400 border border-white/5 focus:border-cyan-500 focus:outline-none rounded-xl px-2.5 py-2.5"
                  >
                    <option value="Schematic Design">Schematic Design</option>
                    <option value="Structural Grid">Structural Grid</option>
                    <option value="Design Development">Development</option>
                    <option value="Fittings Layout">Fittings Layout</option>
                    <option value="Quantity Survey">Quantity Survey</option>
                    <option value="Construction Doc">Construction Doc</option>
                  </select>

                  <input 
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="bg-neutral-950 text-[9.5px] font-mono text-neutral-400 border border-white/5 focus:border-cyan-500 focus:outline-none rounded-xl px-2.5 py-2"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-cyan-500 text-[#08080a] hover:bg-cyan-400 text-[10px] font-black uppercase tracking-widest rounded-xl py-2.5 transition-all flex items-center justify-center gap-1.5 font-sans"
                >
                  <Plus size={12} />
                  Add Custom Milestone
                </button>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* Dynamic Report Actions footer holding vector PDF generator */}
      <div className="p-4 bg-[#0a0a0d] border-t border-white/5 shrink-0 flex items-center gap-2.5 select-none">
        
        {/* Reset settings button */}
        <button 
          onClick={handleResetEstimates}
          title="Reset surveying values to drafting standards"
          className="w-10 h-10 flex items-center justify-center bg-transparent border border-white/5 hover:bg-white/5 rounded-xl text-neutral-400 hover:text-white transition-all text-[10px] font-black uppercase shrink-0"
        >
          <RotateCcw size={15} />
        </button>

        {/* Export high-resolution Vector report directly */}
        <button
          onClick={handleExportPDF}
          className="flex-1 bg-gradient-to-r from-cyan-500 to-[#00bcd4] hover:from-cyan-400 hover:to-[#00acc1] text-[#08080a] text-[10px] font-black uppercase tracking-[0.16em] rounded-xl h-10 transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,188,212,0.12)] cursor-pointer"
        >
          <FileText size={14} className="shrink-0" />
          Download PDF Report
        </button>
      </div>

    </div>
  );
};

export default ProjectDashboardPanel;
