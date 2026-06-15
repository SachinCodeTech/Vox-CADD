import { Shape, LayerConfig, BlockDefinition, LineType, CtbFile, ViewState } from '../types';
import { aciToHex, hexToACI } from './colorUtils';

export interface ResolvedProperties {
    color: string;
    lineweight: number; // mm
    lineType: LineType;
    opacity: number;
}

export const resolveColor = (
    shape: Shape,
    layerConf: LayerConfig,
    activeTab: string = 'model',
    blockContext?: { color: string, thickness: number, lineType: LineType }
): string => {
    let rawColor: any = shape.color || 'bylayer';
    let color = 'bylayer';
    if (typeof rawColor === 'number') {
        if (rawColor >= 0 && rawColor < 256) {
            const hex = aciToHex(rawColor);
            color = hex === 'bylayer' ? 'bylayer' : hex;
        } else {
            color = `#${rawColor.toString(16).padStart(6, '0')}`;
        }
    } else if (typeof rawColor === 'string') {
        const trimmed = rawColor.trim();
        if (/^\d+$/.test(trimmed)) {
            const num = parseInt(trimmed, 10);
            if (num >= 0 && num < 256) {
                const hex = aciToHex(num);
                color = hex === 'bylayer' ? 'bylayer' : hex;
            } else {
                color = `#${num.toString(16).padStart(6, '0')}`;
            }
        } else {
            color = trimmed;
        }
    }

    if (color.toLowerCase() === 'bylayer') {
        const layerColor: any = layerConf?.color || '#FFFFFF';
        if (typeof layerColor === 'number') {
            if (layerColor >= 0 && layerColor < 256) {
                const hex = aciToHex(layerColor);
                color = hex === 'bylayer' ? '#FFFFFF' : hex;
            } else {
                color = `#${layerColor.toString(16).padStart(6, '0')}`;
            }
        } else if (typeof layerColor === 'string') {
            const trimmed = layerColor.trim();
            if (/^\d+$/.test(trimmed)) {
                const num = parseInt(trimmed, 10);
                if (num >= 0 && num < 256) {
                    const hex = aciToHex(num);
                    color = hex === 'bylayer' ? '#FFFFFF' : hex;
                } else {
                    color = `#${num.toString(16).padStart(6, '0')}`;
                }
            } else {
                color = trimmed;
            }
        } else {
            color = '#FFFFFF';
        }
    } else if (color.toLowerCase() === 'byblock' && blockContext) {
        color = blockContext.color;
    }
    
    if (color.toLowerCase() === 'bylayer') color = '#FFFFFF';
    if (color.toLowerCase() === 'byblock') color = '#FFFFFF';

    if (activeTab !== 'model' && (color.toUpperCase() === '#FFFFFF' || color.toUpperCase() === '#FFF' || color.toLowerCase() === 'white')) {
        return '#111111';
    }
    return color;
};

export const resolveLineWeight = (
    shape: Shape,
    layerConf: LayerConfig,
    blockContext?: { color: string, thickness: number, lineType: LineType }
): number => {
    let weight: number | string = shape.thickness !== undefined ? shape.thickness : 'bylayer';
    if (typeof weight === 'number' && weight > 5) {
        weight = 'bylayer';
    }
    if (typeof weight === 'string') {
        const wStr = weight.toLowerCase();
        if (wStr === 'bylayer') {
            weight = layerConf?.thickness || 0.25;
        } else if (wStr === 'byblock' && blockContext) {
            weight = blockContext.thickness;
        } else {
            weight = 0.25;
        }
    }
    return weight as number;
};

export const resolveLineType = (
    shape: Shape,
    layerConf: LayerConfig,
    blockContext?: { color: string, thickness: number, lineType: LineType }
): LineType => {
    let lt = shape.lineType || 'bylayer';
    if (lt === 'bylayer') {
        lt = layerConf?.lineType || 'continuous';
    } else if (lt === 'byblock' && blockContext) {
        lt = blockContext.lineType;
    }
    if (lt === 'bylayer' || lt === 'byblock') return 'continuous';
    return lt as LineType;
};

export const resolveShapeProperties = (
    shape: Shape,
    layerConfig: Record<string, LayerConfig>,
    blocks: Record<string, BlockDefinition>,
    activeCtb?: CtbFile,
    isPlotting: boolean = false,
    blockContext?: { color: string, thickness: number, lineType: LineType },
    activeTab: string = 'model'
): ResolvedProperties => {
    let rawColor: any = shape.color || 'bylayer';
    let color = 'bylayer';
    if (typeof rawColor === 'number') {
        if (rawColor >= 0 && rawColor < 256) {
            const hex = aciToHex(rawColor);
            color = hex === 'bylayer' ? 'bylayer' : hex;
        } else {
            color = `#${rawColor.toString(16).padStart(6, '0')}`;
        }
    } else if (typeof rawColor === 'string') {
        const trimmed = rawColor.trim();
        if (/^\d+$/.test(trimmed)) {
            const num = parseInt(trimmed, 10);
            if (num >= 0 && num < 256) {
                const hex = aciToHex(num);
                color = hex === 'bylayer' ? 'bylayer' : hex;
            } else {
                color = `#${num.toString(16).padStart(6, '0')}`;
            }
        } else {
            color = trimmed;
        }
    }
    
    if (color.toLowerCase() === 'bylayer') {
        const layerColor: any = layerConfig[shape.layer]?.color || '#FFFFFF';
        if (typeof layerColor === 'number') {
            if (layerColor >= 0 && layerColor < 256) {
                const hex = aciToHex(layerColor);
                color = hex === 'bylayer' ? '#FFFFFF' : hex;
            } else {
                color = `#${layerColor.toString(16).padStart(6, '0')}`;
            }
        } else if (typeof layerColor === 'string') {
            const trimmed = layerColor.trim();
            if (/^\d+$/.test(trimmed)) {
                const num = parseInt(trimmed, 10);
                if (num >= 0 && num < 256) {
                    const hex = aciToHex(num);
                    color = hex === 'bylayer' ? '#FFFFFF' : hex;
                } else {
                    color = `#${num.toString(16).padStart(6, '0')}`;
                }
            } else {
                color = trimmed;
            }
        } else {
            color = '#FFFFFF';
        }
    } else if (color.toLowerCase() === 'byblock' && blockContext) {
        color = blockContext.color;
    }
    
    // If it's still ByLayer/ByBlock string (e.g. from block reference), resolve it
    if (color.toLowerCase() === 'bylayer') color = '#FFFFFF';
    if (color.toLowerCase() === 'byblock') color = '#FFFFFF';

    // 2. Resolve LineWeight
    let weight: any = shape.thickness !== undefined ? shape.thickness : 'bylayer';
    if (typeof weight === 'number' && weight > 5) {
        weight = 'bylayer';
    }
    if (typeof weight === 'string') {
        const wStr = weight.toLowerCase();
        if (wStr === 'bylayer') {
            weight = layerConfig[shape.layer]?.thickness || 0.25;
        } else if (wStr === 'byblock' && blockContext) {
            weight = blockContext.thickness;
        } else {
            weight = 0.25;
        }
    }
    
    // Final safety check: if it's still a string (e.g. 'DEFAULT' from layer config)
    if (typeof weight === 'string') {
        const wStr = weight.toLowerCase();
        if (wStr === 'default') weight = 0.25;
        else if (wStr.includes('lightweight')) weight = 0.05;
        else {
            const parsed = parseFloat(wStr);
            weight = isNaN(parsed) ? 0.25 : parsed;
        }
    }
    const lineweight = weight as number;

    // 3. Resolve LineType
    let lt = shape.lineType || 'bylayer';
    if (lt === 'bylayer') {
        lt = layerConfig[shape.layer]?.lineType || 'continuous';
    } else if (lt === 'byblock' && blockContext) {
        lt = blockContext.lineType;
    }
    if (lt === 'bylayer' || lt === 'byblock') lt = 'continuous';

    // 4. Apply CTB if plotting or requested
    let finalColor = color;
    let finalLineweight = lineweight;
    let finalLT = lt;

    if (activeCtb) {
        // Find ACI for the RESOLVED color (CTB is color dependent)
        const aci = hexToACI(color);
        const style = activeCtb.styles[aci];
        
        if (style) {
            if (style.plotColor !== 'useObjectColor') {
                finalColor = style.plotColor;
            }
            if (style.lineweight !== 'useObjectLineweight') {
                finalLineweight = style.lineweight as number;
            }
            if (style.lineStyle !== 'useObjectLineStyle') {
                finalLT = style.lineStyle as any;
            }
        }
    }

    // Adjust for paper space if white
    if (activeTab !== 'model' && (finalColor.toUpperCase() === '#FFFFFF' || finalColor.toUpperCase() === '#FFF' || finalColor.toLowerCase() === 'white')) {
        finalColor = '#111111'; // Plot black on white paper
    } else if (activeTab === 'model' && (finalColor === '#000000' || finalColor.toLowerCase() === 'black')) {
        finalColor = '#FFFFFF'; // Show black as white in model space for visibility
    }

    return {
        color: finalColor,
        lineweight: finalLineweight,
        lineType: finalLT as LineType,
        opacity: shape.opacity ?? 1.0
    };
};
