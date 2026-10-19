'use client';

import React, { useState } from 'react';
import { OutreachLogEntry, OutreachStatus } from '@/types';
import { Building2, Calendar, User, ExternalLink, ChevronDown, Trash2 } from 'lucide-react';

interface OutreachHistoryCardProps {
  entry: OutreachLogEntry;
  onStatusChange: (entry: OutreachLogEntry, newStatus: OutreachStatus) => void;
  onDelete?: (entry: OutreachLogEntry) => void;
}

export function OutreachHistoryCard({ entry, onStatusChange, onDelete }: OutreachHistoryCardProps) {
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
    'Contacted': 'bg-[#EBF3FB] text-[#0A66C2] border-[#C2E0F9]',
    'Replied': 'bg-[#EDE7F6] text-[#5E35B1] border-[#D1C4E9]',
    'Interested': 'bg-[#057642]/10 text-[#057642] border-[#057642]/20',
    'Interview': 'bg-pink-50 text-pink-700 border-pink-200',
    'Follow-up due': 'bg-amber-50 text-amber-700 border-amber-200',
    'No response': 'bg-zinc-100 text-zinc-600 border-[#E0DFDC]',
    'Rejected': 'bg-red-50 text-red-600 border-red-200',
    'Closed': 'bg-zinc-100 text-zinc-500 border-[#E0DFDC]'
  };

  const currentBadgeClass = statusColorMap[entry.status] || 'bg-zinc-100 text-zinc-600 border-[#E0DFDC]';

  return (
    <div className="bg-white border border-[#E0DFDC] rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-zinc-900 tracking-tight">{entry.name}</h4>
            <p className="text-xs text-zinc-600 flex items-center gap-1.5 mt-0.5">
              <Building2 className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
              <span className="font-semibold text-zinc-700">{entry.company}</span>
            </p>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-zinc-500 bg-[#F4F2EE] px-2.5 py-0.5 rounded-full border border-[#E0DFDC]">
            <Calendar className="w-3 h-3 text-zinc-400" />
            <span>{entry.date}</span>
          </div>
        </div>

        {/* Role & Position */}
        <div className="mt-2.5 space-y-1 text-xs">
          <div className="text-zinc-600">
            <span className="text-zinc-400 text-[11px]">Role: </span>
            <span className="font-medium text-zinc-800">{entry.role}</span>
          </div>
          <div className="text-zinc-500 text-[11px] flex items-center gap-2">
            <span>{entry.relationshipType}</span>
            <span>·</span>
            <span className="truncate">{entry.personPosition}</span>
          </div>
        </div>
      </div>

      {/* Footer: Status Picker & External Link */}
      <div className="pt-3 border-t border-[#E0DFDC] flex items-center justify-between gap-2">
        {/* Status Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsChangingStatus(!isChangingStatus)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-colors ${currentBadgeClass}`}
          >
            <span>{entry.status}</span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>

          {isChangingStatus && (
            <div className="absolute left-0 bottom-full mb-1 z-30 bg-white border border-[#E0DFDC] rounded-xl shadow-xl py-1 w-36 overflow-hidden">
              {statusOptions.map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    onStatusChange(entry, st);
                    setIsChangingStatus(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#F4F2EE] transition-colors ${
                    entry.status === st ? 'text-[#0A66C2] font-bold bg-[#EBF3FB]' : 'text-zinc-700'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {entry.linkedinUrl && (
            <a
              href={entry.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#0A66C2] hover:underline font-semibold flex items-center gap-1"
            >
              <span>LinkedIn</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {onDelete && (
            <button
              onClick={() => onDelete(entry)}
              title="Delete outreach log entry"
              className="text-zinc-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
