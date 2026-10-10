'use client';

import React from 'react';
import { Send } from 'lucide-react';
import { NavTab } from './BottomNav';

interface HeaderProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onBackToLanding?: () => void;
}

export function Header({
  onTabChange,
  onBackToLanding
}: HeaderProps) {
  const handleHomeClick = () => {
    if (onBackToLanding) {
      onBackToLanding();
    }
    onTabChange('home');
  };

  return (
    <header className="sticky top-0 z-40 bg-zinc-50/95 backdrop-blur-md border-b border-zinc-200/90 px-4 sm:px-6 lg:px-8 py-3.5 w-full transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Top Left: Logo & Company Name */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer group"
          onClick={handleHomeClick}
        >
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white font-bold shadow-sm group-hover:bg-zinc-800 transition-colors">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-900">
              Direct Message
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
