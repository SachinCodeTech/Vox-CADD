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
      className={`drop-shadow-md ${className}`}
    >
      {/* Main Square Body with Precise Corners */}
      <rect 
        x="5" 
        y="5" 
        width="90" 
        height="90" 
        rx="12" 
        fill="#00bcd4" 
      />
      
      {/* Grid Pattern Overlay */}
      <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" opacity="0.3"/>
      </pattern>
      <rect x="5" y="5" width="90" height="90" rx="12" fill="url(#grid)" />

      {/* The "V" as a drafting divider/caliper style */}
      <path 
        d="M25 30L50 75L75 30" 
        stroke="black" 
        strokeWidth="14" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <circle cx="50" cy="75" r="5" fill="black" />

      <defs>
        <linearGradient id="voxGradient" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="black" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default VoxIcon;
