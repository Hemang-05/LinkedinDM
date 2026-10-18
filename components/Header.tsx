'use client';

import React, { useState, useEffect } from 'react';
import { Home, Users, Send, Settings, ExternalLink, Download, Upload, CalendarClock, User, LogOut, Cloud } from 'lucide-react';
import { NavTab } from './BottomNav';
import { DMLogo } from './DMLogo';
import { AuthModal } from './AuthModal';
import { getCurrentSupabaseUser, getSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';

import { UserProfile } from '@/types';

interface HeaderProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  activeWorkflow?: string | null;
  onChangeGoal?: () => void;
  onBackToLanding?: () => void;
  onDataImported?: () => void;
  dueFollowUpsCount?: number;
  contactedCount?: number;
  userProfile?: UserProfile | null;
  authUser?: any | null;
  onSignOut?: () => void;
}

export function Header({
  currentTab,
  onTabChange,
  activeWorkflow,
  onChangeGoal,
  onBackToLanding,
  onDataImported,
  dueFollowUpsCount = 0,
  contactedCount = 0,
  userProfile,
  authUser: propAuthUser,
  onSignOut
}: HeaderProps) {
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<any | null>(propAuthUser || null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (propAuthUser !== undefined) {
      setAuthUser(propAuthUser);
    }
  }, [propAuthUser]);

  const checkAuth = async () => {
    const user = await getCurrentSupabaseUser();
    setAuthUser(user);
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem('directmessage_last_exported_at');
      if (stored) setLastExport(stored);
    } catch {}

    checkAuth();

    const client = getSupabaseClient();
    if (client) {
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        setAuthUser(session?.user || null);
      });
      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  const handleSignOut = async () => {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    const { setActiveStorageUser } = await import('@/lib/clientStorage');
    setActiveStorageUser(null);
    setAuthUser(null);
    if (onSignOut) {
      onSignOut();
    } else if (onDataImported) {
      onDataImported();
    } else {
      window.location.reload();
    }
  };

  const handleHomeClick = () => {
    onTabChange('home');
  };

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'prospects', label: 'Prospects', icon: Users },
    { id: 'followups', label: 'Follow-ups', icon: CalendarClock, badge: dueFollowUpsCount > 0 ? dueFollowUpsCount : undefined },
    { id: 'outreach', label: 'Outreach Log', icon: Send, badge: contactedCount > 0 ? contactedCount : undefined },
    { id: 'settings', label: 'Profile', icon: Settings }
  ];

  const getWorkflowBadgeLabel = (wf?: string | null) => {
    switch (wf) {
      case 'job-hunt': return 'Job Hunt';
      case 'agency-leads': return 'Agency Leads';
      case 'hire': return 'Hiring';
      case 'freelancers': return 'Freelancers';
      default: return wf ? wf.replace('-', ' ') : null;
    }
  };

  const badgeLabel = getWorkflowBadgeLabel(activeWorkflow);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E0DFDC] px-4 sm:px-6 lg:px-8 w-full transition-all shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14">
          {/* Left: LinkedIn-styled dm Logo & Brand */}
          <div className="flex items-center gap-3">
            <div 
              className="flex items-center gap-2 cursor-pointer group select-none"
              onClick={handleHomeClick}
              title="Go to Home"
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

            {badgeLabel && (
              <div className="hidden lg:flex items-center gap-1.5 text-xs bg-[#EBF3FB] border border-[#0A66C2]/20 px-2.5 py-0.5 rounded-full text-[#0A66C2] font-semibold">
                <span>{badgeLabel}</span>
                {onChangeGoal && (
                  <button
                    onClick={onChangeGoal}
                    className="text-[10px] text-zinc-500 hover:text-zinc-800 underline ml-1 cursor-pointer"
                    title="Switch to another outreach goal or start a new campaign"
                  >
                    Change Goal
                  </button>
                )}
              </div>
            )}
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
                  className={`relative flex flex-col items-center justify-center h-full px-3.5 transition-colors group cursor-pointer ${
                    isActive
                      ? 'text-zinc-900 font-bold'
                      : 'text-zinc-500 hover:text-zinc-900 font-medium'
                  }`}
                >
                  <div className="relative">
                    <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-[#0A66C2] stroke-[2.3px]' : 'text-zinc-500 group-hover:text-zinc-800'}`} />
                    {item.badge !== undefined && (
                      <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 text-[9px] font-bold bg-[#0A66C2] text-white rounded-full min-w-3.5 text-center leading-3.5 shadow-xs">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] mt-0.5 tracking-tight">{item.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#0A66C2] rounded-t-full" />
                  )}
                </button>
              );
            })}

            <div className="h-6 w-px bg-zinc-200 mx-1" />

            {/* Supabase Auth / User Pill (Requirement 11) */}
            {authUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-zinc-200">
                <div
                  className="flex items-center gap-2 text-xs bg-[#F4F2EE] border border-[#E0DFDC] px-2.5 py-1 rounded-full shadow-2xs select-none"
                  title={`Signed in as ${userProfile?.name || authUser.email} (${authUser.email})`}
                >
                  <div className="w-5 h-5 rounded-full bg-[#0A66C2] text-white flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                    {((userProfile?.name || authUser.user_metadata?.name || authUser.email || 'U')[0]).toUpperCase()}
                  </div>
                  <div className="flex flex-col text-left leading-tight hidden lg:flex">
                    <span className="font-semibold text-zinc-900 text-xs max-w-[120px] truncate">
                      {userProfile?.name || authUser.user_metadata?.name || authUser.email?.split('@')[0]}
                    </span>
                    <span className="text-[10px] text-zinc-500 max-w-[120px] truncate">
                      {authUser.email}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-red-600 hover:bg-red-50 border border-zinc-200 hover:border-red-200 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#0A66C2] hover:text-white bg-[#0A66C2]/10 hover:bg-[#0A66C2] border border-[#0A66C2]/30 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            <div className="h-6 w-px bg-zinc-200 mx-1" />

            {/* Quick LinkedIn link */}
            <a
              href="https://www.linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#0A66C2] hover:text-[#004182] font-semibold px-2.5 py-1.5 rounded-full hover:bg-[#0A66C2]/10 transition-colors"
            >
              <span>Open LinkedIn</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </nav>
        </div>
      </header>

      {/* Supabase Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={() => {
          checkAuth();
          if (onDataImported) onDataImported();
        }}
      />
    </>
  );
}
