import React from 'react';

interface VoxIconProps {
  size?: number;
  className?: string;
}

const VoxIcon: React.FC<VoxIconProps> = ({ size = 24, className = "" }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`drop-shadow-2xl ${className}`}
    >
      <defs>
        <filter id="shadow">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.5"/>
        </filter>
        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.1"/>
        </pattern>
      </defs>

      {/* Outer rounded container - Dark with Cyan border */}
      <rect x="5" y="5" width="90" height="90" rx="20" fill="#0D1117" stroke="#00BCD4" strokeWidth="1.5"/>
      
      {/* Grid Pattern Overlay */}
      <rect x="5" y="5" width="90" height="90" rx="20" fill="url(#grid)" />

      {/* Primary Logo Square - Bright Cyan */}
      <rect x="25" y="25" width="50" height="50" rx="14" fill="#00BCD4" filter="url(#shadow)" />

      {/* Stylized 'V' / Drafting Tool - ENLARGED */}
      <path 
        d="M36 44 L50 64 L64 44" 
        stroke="white" 
        strokeWidth="7" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      
      {/* Top Drafting Line */}
      <path 
        d="M38 44 L62 44" 
        stroke="white" 
        strokeWidth="1.8" 
        strokeDasharray="2 2"
        strokeOpacity="0.9"
      />
      
      {/* Pivot Point */}
      <circle cx="50" cy="64" r="2" fill="#00BCD4" />
    </svg>
  );
};

export default VoxIcon;
