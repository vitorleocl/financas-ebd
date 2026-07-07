/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface LogoEBDProps {
  className?: string;
  iconOnly?: boolean;
}

export default function LogoEBD({ className = "w-12 h-12", iconOnly = false }: LogoEBDProps) {
  return (
    <svg 
      viewBox={iconOnly ? "60 0 280 260" : "0 0 400 300"} 
      className={className}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Flame gradients */}
        <linearGradient id="flame-grad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="50%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#eab308" />
        </linearGradient>
        <linearGradient id="inner-flame-grad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ea580c" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#fef08a" />
        </linearGradient>
        
        {/* Page gradients for a realistic 3D open book feel */}
        <linearGradient id="page-left-grad" x1="100%" y1="50%" x2="0%" y2="50%">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="15%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id="page-right-grad" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="15%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>

      {/* Outer green shadows of pages */}
      <path 
        d="M 78 110 C 78 180, 120 230, 200 250 L 200 242 C 125 222, 86 175, 86 110 Z" 
        fill="#15803d" 
      />
      <path 
        d="M 322 110 C 322 180, 280 230, 200 250 L 200 242 C 275 222, 314 175, 314 110 Z" 
        fill="#15803d" 
      />

      {/* Pages of the book */}
      <path 
        d="M 86 110 C 86 175, 125 222, 200 242 L 200 122 C 155 100, 110 95, 86 110 Z" 
        fill="url(#page-left-grad)" 
      />
      <path 
        d="M 314 110 C 314 175, 275 222, 200 242 L 200 122 C 245 100, 290 95, 314 110 Z" 
        fill="url(#page-right-grad)" 
      />

      {/* Beautiful gradient flame rising from the center fold */}
      {/* Outer flame */}
      <path 
        d="M200 125 C170 115, 155 70, 195 10 C200 40, 230 50, 235 90 C238 115, 220 130, 200 125 Z" 
        fill="url(#flame-grad)" 
      />
      {/* Inner bright yellow glow */}
      <path 
        d="M200 115 C185 110, 180 85, 200 45 C202 65, 220 75, 220 95 C220 110, 210 118, 200 115 Z" 
        fill="url(#inner-flame-grad)" 
      />

      {/* Logo Text (only if not iconOnly) */}
      {!iconOnly && (
        <text 
          x="200" 
          y="285" 
          textAnchor="middle" 
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontWeight="800" 
          fontSize="24" 
          fill="#0f172a" 
          letterSpacing="-0.5"
        >
          Escola Bíblica Dominical
        </text>
      )}
    </svg>
  );
}
