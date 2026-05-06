
export const aciColors: string[] = [
    '#000000', // 0 - unused
    '#FF0000', // 1 - Red
    '#FFFF00', // 2 - Yellow
    '#00FF00', // 3 - Green
    '#00FFFF', // 4 - Cyan
    '#0000FF', // 5 - Blue
    '#FF00FF', // 6 - Magenta
    '#FFFFFF', // 7 - White/Black
    '#808080', // 8 - Dark Gray
    '#C0C0C0', // 9 - Light Gray
    '#FF0000', '#FF7F7F', '#A20000', '#A25151', '#510000', '#512828', // 10-15
    '#FF3F00', '#FF9F7F', '#A22800', '#A26551', '#511400', '#513228', // 16-21
    '#FF7F00', '#FFBF7F', '#A25100', '#A27951', '#512800', '#513D28', // 22-27
    '#FFBF00', '#FFDF7F', '#A27900', '#A28E51', '#513D00', '#514728', // 28-33
    '#FFFF00', '#FFFF7F', '#A2A200', '#A2A251', '#515100', '#515128', // 34-39
];

// Fill out more colors if needed (AutoCAD has 256)
// For now, let's just make it return a reasonable fallback for higher indexes
export const aciToHex = (aci: number | undefined, trueColor?: number): string => {
    if (trueColor !== undefined && trueColor !== -1) {
        // LibreDWG/DXF TrueColor is often 24-bit. Some formats use 32-bit with alpha.
        const r = (trueColor >> 16) & 0xFF;
        const g = (trueColor >> 8) & 0xFF;
        const b = trueColor & 0xFF;
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    }

    if (aci === undefined || aci === 256) return 'bylayer';
    if (aci === 0) return 'byblock';
    if (aci < 0) return '#FFFFFF';
    if (aci < aciColors.length) return aciColors[aci];
    
    // Heuristic for the rest of 256 colors
    return '#E0E0E0'; 
};

/**
 * Standard AutoCAD Lineweight mapping (hundredths of mm)
 * 0-211
 */
export const mapLineweight = (lw: number | undefined): number => {
    if (lw === undefined || lw < 0) return 0.25; // Default/ByLayer
    if (lw === 0) return 0.001; // Thinest
    return lw / 100; // e.g., 50 -> 0.5mm
};

export const hexToACI = (hex: string | undefined): number => {
    if (!hex) return 256;
    const h = hex.toUpperCase();
    if (h === 'BYLAYER') return 256;
    if (h === 'BYBLOCK') return 0;
    if (h === '#FF0000' || h === 'RED') return 1;
    if (h === '#FFFF00' || h === 'YELLOW') return 2;
    if (h === '#00FF00' || h === 'GREEN') return 3;
    if (h === '#00FFFF' || h === 'CYAN') return 4;
    if (h === '#0000FF' || h === 'BLUE') return 5;
    if (h === '#FF00FF' || h === 'MAGENTA') return 6;
    if (h === '#FFFFFF' || h === 'WHITE') return 7;
    if (h === '#000000' || h === 'BLACK') return 7;
    return 7;
};
