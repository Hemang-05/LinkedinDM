'use client';

import React from 'react';
import { Home, Users, Send, Settings, ExternalLink, Download, Upload } from 'lucide-react';
import { NavTab } from './BottomNav';
import { DMLogo } from './DMLogo';

interface HeaderProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  activeWorkflow?: string | null;
  onChangeGoal?: () => void;
  onBackToLanding?: () => void;
  onDataImported?: () => void;
}

export function Header({
  currentTab,
  onTabChange,
  activeWorkflow,
  onChangeGoal,
  onBackToLanding,
  onDataImported
}: HeaderProps) {
  const [lastExport, setLastExport] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('directmessage_last_exported_at');
      if (stored) setLastExport(stored);
    } catch {}
  }, []);

  const handleHomeClick = () => {
    onTabChange('home');
  };

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'prospects', label: 'Prospects', icon: Users },
    { id: 'outreach', label: 'Outreach Log', icon: Send },
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

          {/* Export JSON Backup */}
          <button
            onClick={async () => {
              try {
                const { exportUserDataJson, recordExportDate } = await import('@/lib/clientDb');
                const json = await exportUserDataJson();
                const nowIso = recordExportDate();
                setLastExport(nowIso);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `directmessage_backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch (err) {
                console.error('Export error:', err);
                alert('Failed to export data');
              }
            }}
            title={lastExport ? `Last exported: ${new Date(lastExport).toLocaleString()}` : 'Never exported. Click to back up your data.'}
            className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-900 font-medium px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <div className="flex flex-col items-start leading-tight">
              <span>Export JSON</span>
              <span className="text-[9px] text-zinc-400 font-normal">
                {lastExport ? `Backup: ${new Date(lastExport).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}` : 'No backup'}
              </span>
            </div>
          </button>

          {/* Import JSON Backup */}
          <label
            title="Import and restore prospects, logs, and profile from JSON backup"
            className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-900 font-medium px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import JSON</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  const { importUserDataJson } = await import('@/lib/clientDb');
                  const { prospectsCount, logsCount } = await importUserDataJson(text);
                  alert(`Restored ${prospectsCount} prospects and ${logsCount} logs successfully!`);
                  if (onDataImported) onDataImported();
                  else window.location.reload();
                } catch (err: any) {
                  console.error('Import error:', err);
                  alert(`Import failed: ${err.message || 'Invalid JSON file'}`);
                }
              }}
            />
          </label>

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
