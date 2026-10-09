'use client';

import React from 'react';
import { Send, Search, X, MessageSquare, Briefcase, Users, Target } from 'lucide-react';
import { NavTab } from './BottomNav';

interface HeaderProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenQuickAdd: () => void;
  onSelectCategoryNav?: (cat: string) => void;
  pendingReviewCount?: number;
  contactedCount?: number;
}

export function Header({
  currentTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  onOpenQuickAdd,
  onSelectCategoryNav,
  pendingReviewCount = 0,
  contactedCount = 0
}: HeaderProps) {
  const navItems = [
    { label: 'DM to Recruiters', key: 'recruiters' },
    { label: 'DM to Founders', key: 'founders' },
    { label: 'DM for Leads', key: 'leads' }
  ];

  const handleNavClick = (key: string) => {
    if (onSelectCategoryNav) {
      onSelectCategoryNav(key);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-zinc-50/95 backdrop-blur-md border-b border-zinc-200/90 px-4 sm:px-6 lg:px-8 py-3 w-full transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Top Left: Logo & Company Name */}
        <div className="flex items-center gap-6">
          <div 
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={() => onTabChange('home')}
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

          {/* Top Fixed Navbar Items (iLovePDF Style) */}
          <nav className="hidden md:flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => handleNavClick(item.key)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 hover:text-zinc-900 hover:bg-white transition-all shadow-none hover:shadow-sm"
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Search Bar & Quick Action */}
        <div className="flex items-center gap-3">
          <div className="relative w-44 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search leads, roles..."
              className="w-full bg-white text-xs text-zinc-900 placeholder:text-zinc-400 rounded-xl pl-9 pr-8 py-1.5 border border-zinc-200 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
