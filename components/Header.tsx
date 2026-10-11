'use client';

import React from 'react';
import { Home, Users, Send, Settings, ExternalLink } from 'lucide-react';
import { NavTab } from './BottomNav';
import { DMLogo } from './DMLogo';

interface HeaderProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onBackToLanding?: () => void;
}

export function Header({
  currentTab,
  onTabChange,
  onBackToLanding
}: HeaderProps) {
  const handleHomeClick = () => {
    if (onBackToLanding) {
      onBackToLanding();
    }
    onTabChange('home');
  };

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'prospects', label: 'Prospects', icon: Users },
    { id: 'outreach', label: 'Outreach Log', icon: Send },
    { id: 'settings', label: 'Profile', icon: Settings }
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E0DFDC] px-4 sm:px-6 lg:px-8 w-full transition-all shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="max-w-6xl mx-auto flex items-center justify-between h-14">
        {/* Left: LinkedIn-styled dm Logo & Brand */}
        <div 
          className="flex items-center gap-2 cursor-pointer group select-none"
          onClick={handleHomeClick}
        >
          <DMLogo size="md" />
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 group-hover:text-[#0A66C2] transition-colors leading-tight">
              Direct Message
            </span>
            <span className="text-[10px] text-zinc-400 font-medium hidden sm:inline -mt-0.5">
              LinkedIn Outreach Assistant
            </span>
          </div>
        </div>

        {/* Right: Desktop Navigation Tabs (LinkedIn Style) */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2 h-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`relative flex flex-col items-center justify-center h-full px-3.5 transition-colors group ${
                  isActive
                    ? 'text-zinc-900 font-bold'
                    : 'text-zinc-500 hover:text-zinc-900 font-medium'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-[#0A66C2] stroke-[2.3px]' : 'text-zinc-500 group-hover:text-zinc-800'}`} />
                <span className="text-[11px] mt-0.5 tracking-tight">{item.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#0A66C2] rounded-t-full" />
                )}
              </button>
            );
          })}

          <div className="h-6 w-px bg-zinc-200 mx-1" />

          {/* Quick LinkedIn link */}
          <a
            href="https://www.linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-[#0A66C2] hover:text-[#004182] font-semibold px-3 py-1.5 rounded-full hover:bg-[#0A66C2]/10 transition-colors"
          >
            <span>Open LinkedIn</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </nav>
      </div>
    </header>
  );
}
