import React from 'react';
import { X, LayoutDashboard, Sliders, Home, Box, Palette, Scissors, Layers, CheckCircle, Armchair, BarChart3, Activity } from 'lucide-react';
import { Shape, AppSettings } from '../types';
import { calculateArea, distance, calculateShapeLength } from '../services/cadService';
import { calculateVoxProjectStats } from '../services/voxService';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface ProjectDashboardPanelProps {
  layers: Record<string, Shape[]>;
  settings: AppSettings;
  onClose: () => void;
}

const ProjectDashboardPanel: React.FC<ProjectDashboardPanelProps> = ({ layers, settings, onClose }) => {
  const allShapes = Object.values(layers).flat().filter(Boolean) as Shape[];

  // 1. Calculate Real-Time Segment Lengths and counts by Line/Polyline Type
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
      const blockId = (s as any).blockId || 'Unnamed Block';
      blockCountsRecord[blockId] = (blockCountsRecord[blockId] || 0) + 1;
    }
  });

  const totalSegmentLength = linesLength + plinesLength + dlinesLength + rectsLength + polygonsLength + circularLength + otherLength;

  // Use the central calculateVoxProjectStats from voxService for single source of truth analytics
  const projectStats = calculateVoxProjectStats({ entities: allShapes, layers: {} });
  const adv = projectStats.advancedStats || { layerCounts: {}, totalWallLength: 0, furnitureBlocksCount: 0, furnitureBlockCounts: {} };

  // 2. Calculate Walls Metrics
  let doubleLineWallCount = 0;
  let singleLineWallCount = 0;
  const totalWallLength = adv.totalWallLength;

  allShapes.forEach(s => {
    const isWallLayer = s.layer && (s.layer.toUpperCase().includes('WALL') || s.layer.toUpperCase().includes('SECT'));
    if (s.type === 'dline') {
      doubleLineWallCount++;
    } else if (s.type === 'line' && isWallLayer) {
      singleLineWallCount++;
    }
  });

  const totalWallCount = doubleLineWallCount + singleLineWallCount;

  // 3. Calculate Closed Areas (Rooms / Interiors)
  let totalAreaRaw = 0; 
  let closedShapesCount = 0;

  allShapes.forEach(s => {
    const isClosed = s.type === 'rect' || s.type === 'circle' || (s.type === 'pline' && (s as any).closed);
    if (isClosed) {
      try {
        const area = calculateArea(s as any);
        if (typeof area === 'number' && area > 0) {
          totalAreaRaw += area;
          closedShapesCount++;
        }
      } catch (err) {
        // Safe skip
      }
    }
  });

  // Convert drawing units to real world values
  const isImperial = settings.units === 'imperial';
  let totalAreaDisplay = '';
  let wallLengthDisplay = '';
  let wallSurfaceAreaDisplay = '';

  // Standard wall height in mm (3000) or inches (120)
  const WALL_HEIGHT = isImperial ? 120 : 3000; 

  let wallSurfaceAreaM2 = 0;
  let flooringM2 = 0;

  if (isImperial) {
    const totalAreaSqFt = totalAreaRaw / 144;
    flooringM2 = totalAreaRaw * 0.00064516;
    totalAreaDisplay = `${totalAreaSqFt.toFixed(2)} sq. ft (${flooringM2.toFixed(2)} m²)`;

    const totalWallLengthFt = totalWallLength / 12;
    wallLengthDisplay = `${totalWallLengthFt.toFixed(1)} ft`;

    const surfaceAreaSqFt = (totalWallLength * WALL_HEIGHT * 2) / 144;
    wallSurfaceAreaM2 = surfaceAreaSqFt * 0.092903;
    wallSurfaceAreaDisplay = `${surfaceAreaSqFt.toFixed(0)} sq. ft`;
  } else {
    const totalAreaM2 = totalAreaRaw / 1000000;
    flooringM2 = totalAreaM2;
    totalAreaDisplay = `${totalAreaM2.toFixed(2)} m²`;

    const totalWallLengthM = totalWallLength / 1000;
    wallLengthDisplay = `${totalWallLengthM.toFixed(2)} m`;

    const surfaceAreaM2 = (totalWallLength * WALL_HEIGHT * 2) / 1000000;
    wallSurfaceAreaM2 = surfaceAreaM2;
    wallSurfaceAreaDisplay = `${surfaceAreaM2.toFixed(1)} m²`;
  }

  // Length formatting helper based on units
  const formatLength = (valRaw: number): string => {
    if (isImperial) {
      const feet = valRaw / 12;
      return `${feet.toFixed(1)} ft`;
    } else {
      const meters = valRaw / 1000;
      return `${meters.toFixed(2)} m`;
    }
  };

  // 4. Material Estimates
  const drywallStandardPanelArea = 2.97; // m2
  const drywallPanelsNeeded = Math.ceil(wallSurfaceAreaM2 / drywallStandardPanelArea) || 0;

  const brickFaceArea = 0.08; 
  const bricksNeeded = Math.ceil((totalWallLength * WALL_HEIGHT) / 1000000 / brickFaceArea) || 0;

  const paintCoveragePerGallon = 35.0; // m2
  const paintGallonsNeeded = Math.ceil(wallSurfaceAreaM2 / paintCoveragePerGallon) || 0;

  const rawFlooringDisplay = isImperial 
    ? `${(totalAreaRaw / 144).toFixed(1)} sq. ft` 
    : `${(totalAreaRaw / 1000000).toFixed(1)} m²`;

  const totalFlooringWithWaste = isImperial 
    ? `${((totalAreaRaw / 144) * 1.1).toFixed(1)} sq. ft`
    : `${(flooringM2 * 1.1).toFixed(1)} m²`;

  // 5. Complexity Breakdown for Recharts
  const shapeCounts = projectStats.counts || {};
  const chartData = Object.entries(shapeCounts)
    .filter(([_, count]) => (count as number) > 0)
    .map(([type, count]) => {
      let label = type.toUpperCase();
      if (type === 'pline') label = 'POLYLINE';
      if (type === 'dline') label = 'DBL LINE';
      if (type === 'rect') label = 'RECTANGLE';
      return {
        name: label,
        count: count as number,
      };
    })
    .sort((a, b) => b.count - a.count);

  const CHART_COLORS = ['#00bcd4', '#a855f7', '#f59e0b', '#10b981', '#f43f5e', '#3b82f6', '#ec4899', '#8b5cf6'];

  return (
    <div className="flex flex-col h-full bg-[#0d0d0f] text-neutral-200">
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-[#17171a] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <LayoutDashboard size={16} />
          </div>
          <div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.25em]">Project Dashboard</h3>
            <p className="text-[7.5px] font-bold text-neutral-500 uppercase tracking-wider">Live Model Quantities & Estimations</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-full text-neutral-400 hover:text-white transition-all">
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-none">
        {/* Bento Grid Analytics */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-[#121214] border border-white/5 rounded-2xl p-3 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-neutral-500 mb-1.5">
              <Home size={12} className="text-cyan-400" />
              <span className="text-[7.5px] font-black uppercase tracking-wider">Total Area</span>
            </div>
            <div>
              <div className="text-[11px] font-black text-white tracking-tight truncate">
                {totalAreaRaw > 0 ? totalAreaDisplay.split(' (')[0] : '0.00'}
              </div>
              <div className="text-[7px] font-bold text-neutral-500 uppercase mt-0.5">
                {closedShapesCount} spaces
              </div>
            </div>
          </div>

          <div className="bg-[#121214] border border-white/5 rounded-2xl p-3 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-neutral-500 mb-1.5">
              <Activity size={12} className="text-purple-400" />
              <span className="text-[7.5px] font-black uppercase tracking-wider">Total Path</span>
            </div>
            <div>
              <div className="text-[11px] font-black text-white tracking-tight truncate">
                {formatLength(totalSegmentLength)}
              </div>
              <div className="text-[7px] font-bold text-neutral-500 uppercase mt-0.5">
                {allShapes.length} Entities
              </div>
            </div>
          </div>

          <div className="bg-[#121214] border border-white/5 rounded-2xl p-3 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-neutral-500 mb-1.5">
              <Box size={12} className="text-amber-500" />
              <span className="text-[7.5px] font-black uppercase tracking-wider">Blocks Used</span>
            </div>
            <div>
              <div className="text-[11px] font-black text-white tracking-tight truncate">
                {totalBlocksUsed} blocks
              </div>
              <div className="text-[7px] font-bold text-[#00bcd4] uppercase mt-0.5">
                {adv.furnitureBlocksCount} is furniture
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Project Complexity Chart */}
        {chartData.length > 0 && (
          <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <BarChart3 size={13} className="text-cyan-400" />
              <h4 className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">Project Complexity Profile</h4>
            </div>
            <div className="h-44 w-full pr-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} stroke="#a3a3a3" fontSize={7.5} width={80} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }} 
                    contentStyle={{ backgroundColor: '#0d0d0f', borderColor: '#27272a', borderRadius: '8px', fontSize: '9px', color: '#fff' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={8}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Real-time Segment Length Breakdown */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <Sliders size={13} className="text-[#00bcd4]" />
            <h4 className="text-[8px] font-black text-[#00bcd4] uppercase tracking-widest">Segment Lengths Breakdown</h4>
          </div>
          <div className="divide-y divide-white/5 space-y-2.5">
            {totalLinesCount > 0 && (
              <div className="flex justify-between items-center pt-2.5 first:pt-0">
                <div>
                  <div className="text-[9px] font-black text-neutral-300 uppercase tracking-wide">Lines & Sections</div>
                  <div className="text-[8px] font-bold text-neutral-500 uppercase mt-0.5">Simple point-to-point lines ({totalLinesCount} entities)</div>
                </div>
                <span className="text-xs font-black text-white font-mono">{formatLength(linesLength)}</span>
              </div>
            )}

            {totalPlinesCount > 0 && (
              <div className="flex justify-between items-center pt-2.5">
                <div>
                  <div className="text-[9px] font-black text-neutral-300 uppercase tracking-wide">Polylines & Splines</div>
                  <div className="text-[8px] font-bold text-neutral-500 uppercase mt-0.5">Complex path strings ({totalPlinesCount} entities)</div>
                </div>
                <span className="text-xs font-black text-white font-mono">{formatLength(plinesLength)}</span>
              </div>
            )}

            {totalDlinesCount > 0 && (
              <div className="flex justify-between items-center pt-2.5">
                <div>
                  <div className="text-[9px] font-black text-neutral-300 uppercase tracking-wide">Double Lines (Walls)</div>
                  <div className="text-[8px] font-bold text-neutral-500 uppercase mt-0.5">Wall partition layouts ({totalDlinesCount} entities)</div>
                </div>
                <span className="text-xs font-black text-white font-mono">{formatLength(dlinesLength)}</span>
              </div>
            )}

            {totalRectsCount > 0 && (
              <div className="flex justify-between items-center pt-2.5">
                <div>
                  <div className="text-[9px] font-black text-neutral-300 uppercase tracking-wide">Rectangles</div>
                  <div className="text-[8px] font-bold text-neutral-500 uppercase mt-0.5">Fixed quadrilateral borders ({totalRectsCount} entities)</div>
                </div>
                <span className="text-xs font-black text-white font-mono">{formatLength(rectsLength)}</span>
              </div>
            )}

            {totalPolygonsCount > 0 && (
              <div className="flex justify-between items-center pt-2.5">
                <div>
                  <div className="text-[9px] font-black text-neutral-300 uppercase tracking-wide">Polygons</div>
                  <div className="text-[8px] font-bold text-neutral-500 uppercase mt-0.5">Multi-sided closed envelopes ({totalPolygonsCount} entities)</div>
                </div>
                <span className="text-xs font-black text-white font-mono">{formatLength(polygonsLength)}</span>
              </div>
            )}

            {totalCircularCount > 0 && (
              <div className="flex justify-between items-center pt-2.5">
                <div>
                  <div className="text-[9px] font-black text-neutral-300 uppercase tracking-wide">Curves & Circles</div>
                  <div className="text-[8px] font-bold text-neutral-500 uppercase mt-0.5">Arcs, circles, and ellipse paths ({totalCircularCount} entities)</div>
                </div>
                <span className="text-xs font-black text-white font-mono">{formatLength(circularLength)}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-cyan-500/20">
              <div>
                <div className="text-[9px] font-black text-cyan-400 uppercase tracking-wide">Total Cumulative Path</div>
                <div className="text-[8px] font-bold text-neutral-500 uppercase mt-0.5">Combined drawing path length</div>
              </div>
              <span className="text-sm font-black text-cyan-400 font-mono">{formatLength(totalSegmentLength)}</span>
            </div>
          </div>
        </div>

        {/* Structural Wall Quantities */}
        {totalWallLength > 0 && (
          <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 space-y-4">
            <h4 className="text-[8px] font-black text-purple-400 uppercase tracking-widest border-b border-white/5 pb-2">Wall Material Area Estimates</h4>
            <div className="grid grid-cols-1 gap-3.5">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-[9px] font-black text-neutral-300 uppercase tracking-wide">Wall Partition Length</div>
                  <div className="text-[8px] font-bold text-neutral-500 uppercase mt-0.5">Sum of architectural wall system paths</div>
                </div>
                <span className="text-xs font-black text-white">{wallLengthDisplay}</span>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <div className="text-[9px] font-black text-neutral-300 uppercase tracking-wide">Wall Surface Area</div>
                  <div className="text-[8px] font-bold text-neutral-500 uppercase mt-0.5">Double-sided partition faces ({isImperial ? "10ft" : "3m"} height)</div>
                </div>
                <span className="text-xs font-black text-white">{wallSurfaceAreaDisplay}</span>
              </div>
            </div>
          </div>
        )}

        {/* Construction Material Take-off Estimates */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 space-y-4">
          <h4 className="text-[8px] font-black text-emerald-400 uppercase tracking-widest border-b border-white/5 pb-2">Material Take-off (MTO) Estimates</h4>
          <div className="space-y-4">
            {/* Drywall Sheets */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <Sliders size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="text-[9px] font-black text-neutral-200 uppercase tracking-wide">Gypsum Drywall</span>
                  <span className="text-xs font-black text-white">{drywallPanelsNeeded} sheets</span>
                </div>
                <div className="text-[8px] font-bold text-neutral-500 uppercase mt-0.5">Estimated on 4'x8' standard panels (incl. trim offsets)</div>
              </div>
            </div>

            {/* Paint Buckets */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <Palette size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="text-[9px] font-black text-neutral-200 uppercase tracking-wide">Interior Wall Paint</span>
                  <span className="text-xs font-black text-white">{paintGallonsNeeded} {paintGallonsNeeded === 1 ? 'gallon' : 'gallons'}</span>
                </div>
                <div className="text-[8px] font-bold text-neutral-500 uppercase mt-0.5">Premium grade acrylic paint (two coats coverage standard)</div>
              </div>
            </div>

            {/* Bricks/Concrete */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <Box size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="text-[9px] font-black text-neutral-200 uppercase tracking-wide">Masonry Bricks</span>
                  <span className="text-xs font-black text-white">{bricksNeeded} units</span>
                </div>
                <div className="text-[8px] font-bold text-neutral-500 uppercase mt-0.5">Standard 200x200x400 block count for brick walls</div>
              </div>
            </div>

            {/* Carpet/Tile flooring */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <Scissors size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="text-[9px] font-black text-neutral-200 uppercase tracking-wide">Flooring Cover</span>
                  <span className="text-xs font-black text-white">{totalAreaRaw > 0 ? totalFlooringWithWaste : '0.0'}</span>
                </div>
                <div className="text-[8px] font-bold text-neutral-500 uppercase mt-0.5">Net: {rawFlooringDisplay} + 10% scrap cut alignment waste</div>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Entity Distribution Per Active Layer */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <Layers size={14} className="text-purple-400" />
            <h4 className="text-[8px] font-black text-purple-400 uppercase tracking-widest">Active Layers Entity Distribution</h4>
          </div>
          <div className="space-y-3 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
            {Object.entries((adv.layerCounts || {}) as Record<string, number>)
              .filter(([_, count]) => count > 0)
              .sort((a, b) => b[1] - a[1]) // Sort descending
              .map(([layerId, count]) => {
                const pct = allShapes.length > 0 ? (count / allShapes.length) * 100 : 0;
                return (
                  <div key={layerId} className="space-y-1">
                    <div className="flex justify-between items-center text-[8.5px] font-mono">
                      <span className="font-black text-neutral-300 uppercase tracking-wide">{layerId}</span>
                      <span className="text-cyan-400 font-bold">{count} shapes ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-neutral-950/85 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-cyan-500 to-[#00bcd4] h-full rounded-full" 
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            {Object.keys(adv.layerCounts).length === 0 && (
              <div className="text-center py-4 text-neutral-600 text-[8px] font-bold uppercase tracking-widest">
                No active entities on any layer
              </div>
            )}
          </div>
        </div>

        {/* Block Library Inventory Breakdown */}
        {Object.keys(blockCountsRecord).length > 0 && (
          <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Armchair size={13} className="text-amber-500" />
              <h4 className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Blocks Inventory Breakdown</h4>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
              {Object.entries(blockCountsRecord).map(([blockId, count]) => (
                <div key={blockId} className="bg-black/40 border border-white/5 rounded-xl p-2.5 flex justify-between items-center">
                  <div className="min-w-0 pr-2">
                    <div className="text-[8px] font-mono text-neutral-400 font-bold uppercase tracking-wider truncate" title={blockId}>
                      {blockId}
                    </div>
                    <div className="text-[7px] text-neutral-600 font-bold uppercase mt-0.5">Component Reference</div>
                  </div>
                  <span className="text-xs font-black text-[#00bcd4] font-mono px-2 py-0.5 rounded bg-[#00bcd4]/5 border border-[#00bcd4]/10">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Design compliance metrics */}
        <div className="bg-[#121214]/60 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle size={16} className="text-[#00bcd4] shrink-0" />
          <div className="text-[7.5px] font-bold text-neutral-400 uppercase leading-normal">
            Quantities are calculated relative to model scale and are completely live. Redraw rooms or modify wall lengths to see estimates adjust instantaneously.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDashboardPanel;
