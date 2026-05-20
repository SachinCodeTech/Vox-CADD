import fs from 'fs';
import path from 'path';

// This script generates valid, perfect PNG format binary files with standard custom icons
// using only pure Node.js buffer and file assemblies. Works with zero native dependencies!

function generateCadIcon(size) {
    const width = size;
    const height = size;
    
    // PNG signature
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    
    // CRC-32 Table Generation
    const crcTable = [];
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            if (c & 1) {
                c = 0xedb88320 ^ (c >>> 1);
            } else {
                c = c >>> 1;
            }
        }
        crcTable[n] = c >>> 0;
    }

    function createChunk(type, data) {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length, 0);
        const typeBuf = Buffer.from(type, 'ascii');
        const crcBuf = Buffer.alloc(4);
        
        let crc = 0xffffffff;
        const hashBuf = Buffer.concat([typeBuf, data]);
        for (let i = 0; i < hashBuf.length; i++) {
            crc = crcTable[(crc ^ hashBuf[i]) & 0xff] ^ (crc >>> 8);
        }
        crc = (crc ^ 0xffffffff) >>> 0;
        crcBuf.writeUInt32BE(crc, 0);
        
        return Buffer.concat([len, hashBuf, crcBuf]);
    }
    
    // IHDR block
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData[8] = 8; // Bit depth
    ihdrData[9] = 2; // Color type: RGB
    ihdrData[10] = 0; // Compression
    ihdrData[11] = 0; // Filter
    ihdrData[12] = 0; // Interlace
    
    const ihdrChunk = createChunk('IHDR', ihdrData);
    
    // Grid and Colors
    const r_bg = 11, g_bg = 11, b_bg = 13;
    const r_grid = 30, g_grid = 30, b_grid = 38;
    const r_cyan = 0, g_cyan = 188, b_cyan = 212;
    const r_white = 255, g_white = 255, b_white = 255;
    
    const scanlineLength = width * 3 + 1;
    const idatContent = Buffer.alloc(height * scanlineLength);
    
    for (let y = 0; y < height; y++) {
        let offset = y * scanlineLength;
        idatContent[offset] = 0; // Filter type 0 (None)
        offset++;
        
        for (let x = 0; x < width; x++) {
            const cx = width / 2;
            const cy = height / 2;
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            let r = r_bg, g = g_bg, b = b_bg;
            
            // Grid background pattern
            const gridSize = size / 8;
            if (Math.abs(x % gridSize) < 1.0 || Math.abs(y % gridSize) < 1.0) {
                r = r_grid; g = g_grid; b = b_grid;
            }
            
            // Outer glowing compass ring
            const ringRadius = size * 0.35;
            const ringThick = size < 200 ? 1.5 : 3.5;
            if (Math.abs(dist - ringRadius) < ringThick) {
                r = r_cyan; g = g_cyan; b = b_cyan;
            } else if (Math.abs(dist - ringRadius) < ringThick * 2.5) {
                const alpha = 0.35;
                r = Math.round(r_cyan * alpha + r * (1 - alpha));
                g = Math.round(g_cyan * alpha + g * (1 - alpha));
                b = Math.round(b_cyan * alpha + b * (1 - alpha));
            }
            
            // Central alignment crosshairs
            if (size >= 192) {
                if ((Math.abs(dx) < 1 && Math.abs(dy) < size * 0.3) || (Math.abs(dy) < 1 && Math.abs(dx) < size * 0.3)) {
                    r = r_cyan; g = g_cyan; b = b_cyan;
                }
            }
            
            // Modern CAD Chevron 'V' Icon inside
            if (Math.abs(dy) < size * 0.22) {
                const slope = 1.35;
                const thick = size < 200 ? 2 : 4.5;
                const leftArm = Math.abs(dy - (slope * dx + size * 0.04));
                const rightArm = Math.abs(dy - (-slope * dx + size * 0.04));
                
                if (leftArm < thick && dx < 0 && dy > -size * 0.12) {
                    r = r_white; g = g_white; b = b_white;
                }
                if (rightArm < thick && dx > 0 && dy > -size * 0.12) {
                    r = r_white; g = g_white; b = b_white;
                }
            }
            
            const writeOffset = offset + x * 3;
            idatContent[writeOffset] = r;
            idatContent[writeOffset + 1] = g;
            idatContent[writeOffset + 2] = b;
        }
    }
    
    // RFC 1950 Zlib header stream creation
    const zlibHeader = Buffer.from([0x78, 0x01]);
    const blocksChunks = [];
    let pos = 0;
    while (pos < idatContent.length) {
        const chunkLen = Math.min(65535, idatContent.length - pos);
        const isFinal = (pos + chunkLen >= idatContent.length);
        const header = Buffer.alloc(5);
        header[0] = isFinal ? 1 : 0;
        header.writeUInt16LE(chunkLen, 1);
        header.writeUInt16LE(~chunkLen & 0xffff, 3);
        
        blocksChunks.push(header);
        blocksChunks.push(idatContent.slice(pos, pos + chunkLen));
        pos += chunkLen;
    }
    
    // Adler-32 Checksum
    let s1 = 1;
    let s2 = 0;
    for (let i = 0; i < idatContent.length; i++) {
        s1 = (s1 + idatContent[i]) % 65521;
        s2 = (s2 + s1) % 65521;
    }
    const adlerBuf = Buffer.alloc(4);
    adlerBuf.writeUInt32BE(((s2 << 16) | s1) >>> 0, 0);
    
    const finalZlibStream = Buffer.concat([zlibHeader, ...blocksChunks, adlerBuf]);
    const idatChunk = createChunk('IDAT', finalZlibStream);
    const iendChunk = createChunk('IEND', Buffer.alloc(0));
    
    return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve('./public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

console.log("Generating high-resolution PNG launcher icons dynamically...");
const icon192 = generateCadIcon(192);
const icon512 = generateCadIcon(512);

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);

console.log("Successfully created premium PWA launcher icons:");
console.log(" - /public/icon-192.png (" + icon192.length + " bytes)");
console.log(" - /public/icon-512.png (" + icon512.length + " bytes)");
