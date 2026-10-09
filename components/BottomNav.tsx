'use client';

import React from 'react';
import { Home, Users, Briefcase, Send, Settings } from 'lucide-react';

export type NavTab = 'home' | 'prospects' | 'jobs' | 'outreach' | 'settings';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  pendingReviewCount?: number;
  contactedCount?: number;
}

export function BottomNav({
  currentTab,
  onTabChange,
  pendingReviewCount = 0,
  contactedCount = 0
}: BottomNavProps) {
  const tabs = [
    {
      id: 'home' as NavTab,
      label: 'Home',
      icon: Home,
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined
    },
    {
      id: 'prospects' as NavTab,
      label: 'Prospects',
      icon: Users
    },
    {
      id: 'jobs' as NavTab,
      label: 'Jobs',
      icon: Briefcase
    },
    {
      id: 'outreach' as NavTab,
      label: 'Outreach',
      icon: Send,
      badge: contactedCount > 0 ? contactedCount : undefined
    },
    {
      id: 'settings' as NavTab,
      label: 'Settings',
      icon: Settings
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-50/95 backdrop-blur-md border-t border-zinc-200 safe-pb md:hidden">
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center flex-1 py-1.5 transition-colors ${
                isActive
                  ? 'text-zinc-900 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-700'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2px]' : 'stroke-[1.8px]'}`} />
                {tab.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 text-[10px] font-bold bg-zinc-900 text-white rounded-full min-w-4 text-center leading-4 shadow-sm">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight">{tab.label}</span>
              {isActive && (
                <div className="absolute top-0 w-8 h-0.5 bg-zinc-900 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
