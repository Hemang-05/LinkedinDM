'use client';

import React from 'react';
import { Prospect } from '@/types';
import { Building2, MapPin, Send, ExternalLink, Sparkles } from 'lucide-react';

interface ProspectCardProps {
  prospect: Prospect;
  onSelect: (prospect: Prospect) => void;
}

export function ProspectCard({ prospect, onSelect }: ProspectCardProps) {
  const matchScore = prospect.score?.totalScore || 70;
  const isContacted = prospect.status === 'Contacted';

  const statusColors: Record<string, string> = {
    'Not contacted': 'bg-slate-800 text-slate-300 border-slate-700',
    'Message drafted': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    'Approved': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    'Contacted': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'Replied': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    'Interested': 'bg-green-500/10 text-green-300 border-green-500/30',
    'Interview': 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  };

  const statusClass = statusColors[prospect.status] || 'bg-slate-800 text-slate-400 border-slate-700';

  return (
    <div
      onClick={() => onSelect(prospect)}
      className="touch-card bg-[#111827] border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-sm cursor-pointer flex flex-col justify-between"
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white tracking-tight">{prospect.name}</h4>
              <span className="text-[10px] font-medium px-2 py-0.2 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                {prospect.classification}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3 text-slate-500 flex-shrink-0" />
              <span>{prospect.company}</span>
              <span>·</span>
              <span className="truncate">{prospect.jobTitle}</span>
            </p>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
              {matchScore}%
            </span>
          </div>
        </div>

        {/* Location & Remote */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2.5">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-slate-500" />
            <span className="truncate">{prospect.location}</span>
          </span>
        </div>

        {/* Hiring summary if exists */}
        {prospect.jobOpportunity && (
          <div className="text-[11px] bg-slate-900/60 rounded-lg p-2 border border-slate-800/60 mb-2.5 text-slate-300">
            <span className="text-indigo-400 font-semibold">Role: </span>
            {prospect.jobOpportunity.title}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-1">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${statusClass}`}>
          {prospect.status}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(prospect);
          }}
          className="text-xs text-indigo-400 font-semibold flex items-center gap-1 hover:text-indigo-300"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isContacted ? 'View Outreach' : 'Generate / Review DM'}</span>
        </button>
      </div>
    </div>
  );
}
