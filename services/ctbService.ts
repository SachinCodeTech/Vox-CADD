import { CtbFile, CtbPlotStyle, LineType } from '../types';

export const createDefaultCtb = (): CtbFile => {
  const styles: Record<number, CtbPlotStyle> = {};
  
  // Standard monochrome.ctb behavior: all colors plot black, but keep object lineweights
  for (let i = 1; i <= 255; i++) {
    styles[i] = {
      color: i,
      plotColor: '#000000',
      lineweight: 'useObjectLineweight',
      lineStyle: 'useObjectLineStyle',
      screening: 100
    };
  }
  
  return {
    id: 'monochrome',
    name: 'monochrome.ctb',
    description: 'Plots all colors as black',
    styles
  };
};

export const createAcadCtb = (): CtbFile => {
  const styles: Record<number, CtbPlotStyle> = {};
  
  // Standard acad.ctb behavior: use object values
  for (let i = 1; i <= 255; i++) {
    styles[i] = {
      color: i,
      plotColor: 'useObjectColor',
      lineweight: 'useObjectLineweight',
      lineStyle: 'useObjectLineStyle',
      screening: 100
    };
  }
  
  return {
    id: 'acad',
    name: 'acad.ctb',
    description: 'Use object colors and lineweights',
    styles
  };
};

export const getDefaultLineweights = (): number[] => [
    0.0, 0.05, 0.09, 0.13, 0.15, 0.18, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50, 0.53, 0.60, 0.70, 0.80, 0.90, 1.00, 1.06, 1.20, 1.40, 1.58, 2.00, 2.11
];
