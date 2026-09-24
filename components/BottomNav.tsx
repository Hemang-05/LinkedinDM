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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0e1424]/90 backdrop-blur-md border-t border-slate-800/80 safe-pb max-w-xl mx-auto">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center flex-1 py-1.5 transition-colors ${
                isActive
                  ? 'text-indigo-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200 active:text-indigo-300'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4px]' : 'stroke-[1.8px]'}`} />
                {tab.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 text-[10px] font-bold bg-indigo-500 text-white rounded-full min-w-4 text-center leading-4 shadow-sm">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight">{tab.label}</span>
              {isActive && (
                <div className="absolute top-0 w-8 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
