
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
    '#FF0000', // 10
    '#FF7F7F', // 11
    '#A20000', // 12
    '#A25151', // 13
    '#510000', // 14
    '#512828', // 15
];

// Fill out more colors if needed (AutoCAD has 256)
// For now, let's just make it return a reasonable fallback for higher indexes
export const aciToHex = (aci: number | undefined): string => {
    if (aci === undefined || aci === 256) return 'bylayer';
    if (aci === 0) return 'byblock';
    if (aci < 0) return '#FFFFFF';
    if (aci < aciColors.length) return aciColors[aci];
    
    // Simple heuristic for extended ACI colors
    // In a real app we'd have the full 256 color table
    return '#E0E0E0'; 
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
