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
      {/* Main Square Body with Rounded Corners */}
      <rect 
        x="10" 
        y="10" 
        width="80" 
        height="80" 
        rx="20" 
        fill="#00bcd4" 
      />
      
      {/* Subtle Gradient Overlay for Depth */}
      <rect 
        x="10" 
        y="10" 
        width="80" 
        height="80" 
        rx="20" 
        fill="url(#voxGradient)" 
        fillOpacity="0.2"
      />

      {/* The "V" Character */}
      <path 
        d="M30 35L50 70L70 35" 
        stroke="black" 
        strokeWidth="12" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />

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
