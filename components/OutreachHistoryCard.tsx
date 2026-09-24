'use client';

import React, { useState } from 'react';
import { OutreachLogEntry, OutreachStatus } from '@/types';
import { Building2, Calendar, User, ExternalLink, ChevronDown } from 'lucide-react';

interface OutreachHistoryCardProps {
  entry: OutreachLogEntry;
  onStatusChange: (entry: OutreachLogEntry, newStatus: OutreachStatus) => void;
}

export function OutreachHistoryCard({ entry, onStatusChange }: OutreachHistoryCardProps) {
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const statusOptions: OutreachStatus[] = [
    'Contacted',
    'Replied',
    'Interested',
    'Interview',
    'Follow-up due',
    'No response',
    'Rejected',
    'Closed'
  ];

  const statusColorMap: Record<string, string> = {
    'Contacted': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    'Replied': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    'Interested': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'Interview': 'bg-pink-500/10 text-pink-400 border-pink-500/30',
    'Follow-up due': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    'No response': 'bg-slate-700/30 text-slate-400 border-slate-700',
    'Rejected': 'bg-red-500/10 text-red-400 border-red-500/30',
    'Closed': 'bg-slate-800 text-slate-500 border-slate-700'
  };

  const currentBadgeClass = statusColorMap[entry.status] || 'bg-slate-800 text-slate-300 border-slate-700';

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight">{entry.name}</h4>
            <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span className="font-semibold text-slate-200">{entry.company}</span>
            </p>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
            <Calendar className="w-3 h-3 text-slate-500" />
            <span>{entry.date}</span>
          </div>
        </div>

        {/* Role & Position */}
        <div className="mt-2.5 space-y-1 text-xs">
          <div className="text-slate-300">
            <span className="text-slate-500 text-[11px]">Role: </span>
            <span className="font-medium text-slate-200">{entry.role}</span>
          </div>
          <div className="text-slate-400 text-[11px] flex items-center gap-2">
            <span>{entry.relationshipType}</span>
            <span>·</span>
            <span className="truncate">{entry.personPosition}</span>
          </div>
        </div>
      </div>

      {/* Footer: Status Picker & External Link */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
        {/* Status Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsChangingStatus(!isChangingStatus)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors ${currentBadgeClass}`}
          >
            <span>{entry.status}</span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>

          {isChangingStatus && (
            <div className="absolute left-0 bottom-full mb-1 z-30 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 w-36 overflow-hidden">
              {statusOptions.map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    onStatusChange(entry, st);
                    setIsChangingStatus(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 transition-colors ${
                    entry.status === st ? 'text-indigo-400 font-bold bg-slate-800/50' : 'text-slate-300'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          )}
        </div>

        {entry.linkedinUrl && (
          <a
            href={entry.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            <span>LinkedIn</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
