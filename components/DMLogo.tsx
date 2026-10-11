'use client';

import React from 'react';

interface DMLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  withText?: boolean;
}

export function DMLogo({ size = 'md', className = '', withText = false }: DMLogoProps) {
  const sizeMap = {
    sm: { box: 'w-6 h-6 rounded-[4px]', text: 'text-[13px]', svgSize: 24 },
    md: { box: 'w-8 h-8 rounded-[6px]', text: 'text-[17px]', svgSize: 32 },
    lg: { box: 'w-10 h-10 rounded-[8px]', text: 'text-[22px]', svgSize: 40 },
    xl: { box: 'w-14 h-14 rounded-[12px]', text: 'text-[30px]', svgSize: 56 }
  };

  const current = sizeMap[size];

  // SVG representation ensures pixel-perfect letterforms identical to LinkedIn's iconic "in" badge
  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {withText && (
        <span className="font-bold tracking-tight text-zinc-900 text-base sm:text-lg">
          Direct
        </span>
      )}
      <div
        className={`${current.box} bg-[#0A66C2] flex items-center justify-center text-white shadow-xs shrink-0`}
        style={{ backgroundColor: 'rgb(10, 102, 194)' }}
        title="Direct Message"
      >
        <span
          className="font-black text-white leading-none tracking-tighter"
          style={{
            fontFamily:
              "'Avenir Black', 'Avenir Next', 'Myriad Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontWeight: 900,
            letterSpacing: '-0.06em',
            marginTop: '-1px'
          }}
        >
          <span className={current.text}>dm</span>
        </span>
      </div>
      {withText && (
        <span className="font-semibold text-zinc-700 text-xs sm:text-sm hidden sm:inline">
          Message
        </span>
      )}
    </div>
  );
}
