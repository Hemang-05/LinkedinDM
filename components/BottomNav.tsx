'use client';

import React from 'react';
import { Home, Users, Briefcase, Send, Settings, CalendarClock } from 'lucide-react';

export type NavTab = 'home' | 'prospects' | 'jobs' | 'outreach' | 'followups' | 'settings';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  pendingReviewCount?: number;
  contactedCount?: number;
  dueFollowUpsCount?: number;
}

export function BottomNav({
  currentTab,
  onTabChange,
  pendingReviewCount = 0,
  contactedCount = 0,
  dueFollowUpsCount = 0
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
      id: 'followups' as NavTab,
      label: 'Follow-ups',
      icon: CalendarClock,
      badge: dueFollowUpsCount > 0 ? dueFollowUpsCount : undefined
    },
    {
      id: 'outreach' as NavTab,
      label: 'Outreach',
      icon: Send,
      badge: contactedCount > 0 ? contactedCount : undefined
    },
    {
      id: 'settings' as NavTab,
      label: 'Profile',
      icon: Settings
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E0DFDC] safe-pb md:hidden shadow-[0_-2px_6px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-around h-15 px-2 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center flex-1 py-1.5 transition-colors ${
                isActive
                  ? 'text-[#0A66C2] font-bold'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.3px] text-[#0A66C2]' : 'stroke-[1.8px] text-zinc-500'}`} />
                {tab.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 text-[10px] font-bold bg-[#0A66C2] text-white rounded-full min-w-4 text-center leading-4 shadow-xs">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight">{tab.label}</span>
              {isActive && (
                <div className="absolute top-0 w-8 h-[2.5px] bg-[#0A66C2] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
