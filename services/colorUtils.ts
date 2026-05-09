
export const aciColors: string[] = [
    '#000000', // 0 - unused (ByBlock)
    '#FF0000', // 1 - Red
    '#FFFF00', // 2 - Yellow
    '#00FF00', // 3 - Green
    '#00FFFF', // 4 - Cyan
    '#0000FF', // 5 - Blue
    '#FF00FF', // 6 - Magenta
    '#FFFFFF', // 7 - White/Black
    '#808080', // 8 - Gray (Dark)
    '#C0C0C0', // 9 - Gray (Light)
    // Red shades
    '#FF0000', '#FF7F7F', '#A20000', '#A25151', '#510000', '#512828',
    '#FF3F00', '#FF9F7F', '#A22800', '#A26551', '#511400', '#513228',
    '#FF7F00', '#FFBF7F', '#A25100', '#A27951', '#512800', '#513D28',
    '#FFBF00', '#FFDF7F', '#A27900', '#A28E51', '#513D00', '#514728',
    '#FFFF00', '#FFFF7F', '#A2A200', '#A2A251', '#515100', '#515128',
    '#BFFF00', '#DFFF7F', '#79A200', '#8EA251', '#3D5100', '#475128',
    '#7FFF00', '#BFFF7F', '#51A200', '#79A251', '#285100', '#3D5128',
    '#3FFF00', '#9FFF7F', '#28A200', '#65A251', '#145100', '#325128',
    '#00FF00', '#7FFF7F', '#00A200', '#51A251', '#005100', '#285128',
    '#00FF3F', '#7FFF9F', '#00A228', '#51A265', '#005114', '#285132',
    '#00FF7F', '#7FFFBF', '#00A251', '#51A279', '#005128', '#28513D',
    '#00FFBF', '#7FFFDF', '#00A279', '#51A28E', '#00513D', '#285147',
    '#00FFFF', '#7FFFFF', '#00A2A2', '#51A2A2', '#005151', '#285151',
    '#00BFFF', '#7FDFFF', '#0079A2', '#518EA2', '#003D51', '#284751',
    '#007FFF', '#7FBFFF', '#0051A2', '#5179A2', '#002851', '#283D51',
    '#003FFF', '#7F9FFF', '#0028A2', '#5165A2', '#001451', '#283251',
    '#0000FF', '#7F7FFF', '#0000A2', '#5151A2', '#000051', '#282851',
    '#3F00FF', '#9F7FFF', '#2800A2', '#6551A2', '#140051', '#322851',
    '#7F00FF', '#BF7FFF', '#5100A2', '#7951A2', '#280051', '#3D2851',
    '#BF00FF', '#DF7FFF', '#7900A2', '#8E51A2', '#3D0051', '#472851',
    '#FF00FF', '#FF7FFF', '#A200A2', '#A251A2', '#510051', '#512851',
    '#FF00BF', '#FF7FDF', '#A20079', '#A2518E', '#51003D', '#512847',
    '#FF007F', '#FF7FBF', '#A20051', '#A25179', '#510028', '#51283D',
    '#FF003F', '#FF7F9F', '#A20028', '#A25165', '#510014', '#512832'
];

// Re-initialize to ensure full coverage
const initializeAciColors = () => {
    // Standard ACI 10-249 loop is Hue/Saturation/Value blocks
    // AutoCAD has a specific pattern for 10-249: 
    // Hues: 0 (Red), 1 (Orange-ish), ..., 23 (Red-Purple)
    // For each Hue, there are 10 Saturation/Value variations
    const hues = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345];
    const sats = [1, 0.8, 0.6, 0.4, 0.2];
    const vals = [1, 0.8, 0.6, 0.4, 0.2];
    
    let colorIdx = 10;
    for (let h = 0; h < 24; h++) {
        for (let sv = 0; sv < 5; sv++) {
            // Level 1: Fully saturated/bright
            // AutoCAD pattern is a bit complex, but let's approximate
            const hue = hues[h];
            const s = 1.0;
            const v = (1 - (sv * 0.2));
            aciColors[colorIdx] = hsvToHex(hue, s, v);
            colorIdx++;
        }
        for (let sv = 0; sv < 5; sv++) {
            // Level 2: Less saturated
            const hue = hues[h];
            const s = 0.5;
            const v = (1 - (sv * 0.2));
            aciColors[colorIdx] = hsvToHex(hue, s, v);
            colorIdx++;
        }
    }
    
    // 250-255 are Grays
    const grayscale = ['#333333', '#555555', '#777777', '#999999', '#BBBBBB', '#DDDDDD'];
    for (let i = 0; i < grayscale.length; i++) {
        aciColors[250 + i] = grayscale[i];
    }
};

const hsvToHex = (h: number, s: number, v: number): string => {
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
    else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
    else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
    else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
    else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    
    const toHexVal = (val: number) => {
        const hex = Math.round((val + m) * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHexVal(r)}${toHexVal(g)}${toHexVal(b)}`.toUpperCase();
};
initializeAciColors();

/**
 * Converts ACI or TrueColor to Hex string
 */
export const aciToHex = (aci: number | undefined, trueColor?: number): string => {
    if (trueColor !== undefined && trueColor !== -1 && trueColor !== 0) {
        const r = (trueColor >> 16) & 0xFF;
        const g = (trueColor >> 8) & 0xFF;
        const b = trueColor & 0xFF;
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    }

    if (aci === undefined || aci === 256) return 'bylayer';
    if (aci === 0) return 'byblock';
    
    const absAci = Math.abs(aci);
    if (absAci < aciColors.length) return aciColors[absAci];
    return '#E0E0E0'; 
};

/**
 * Standard AutoCAD Lineweight mapping (hundredths of mm)
 * Returns undefined for ByLayer (-1) or Default (-3)
 */
export const mapLineweight = (lw: number | undefined): number | undefined => {
    if (lw === undefined || lw < 0) return undefined; // ByLayer or Default
    if (lw === 0) return 0.05; // Thinest
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

export const hexToRgbStr = (hex: string): string => {
    if (!hex || !hex.startsWith('#') || hex.length < 7) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
    return `${r}, ${g}, ${b}`;
};
