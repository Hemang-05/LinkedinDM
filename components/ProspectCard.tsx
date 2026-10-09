'use client';

import React from 'react';
import { Prospect } from '@/types';
import { Building2, MapPin, Sparkles } from 'lucide-react';

interface ProspectCardProps {
  prospect: Prospect;
  onSelect: (prospect: Prospect) => void;
}

export function ProspectCard({ prospect, onSelect }: ProspectCardProps) {
  const matchScore = prospect.score?.totalScore || 70;
  const isContacted = prospect.status === 'Contacted';

  const statusColors: Record<string, string> = {
    'Not contacted': 'bg-zinc-100 text-zinc-600 border-zinc-200',
    'Message drafted': 'bg-blue-50 text-blue-700 border-blue-200',
    'Approved': 'bg-amber-50 text-amber-700 border-amber-200',
    'Contacted': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Replied': 'bg-purple-50 text-purple-700 border-purple-200',
    'Interested': 'bg-green-50 text-green-700 border-green-200',
    'Interview': 'bg-pink-50 text-pink-700 border-pink-200',
  };

  const statusClass = statusColors[prospect.status] || 'bg-zinc-100 text-zinc-600 border-zinc-200';

  return (
    <div
      onClick={() => onSelect(prospect)}
      className="touch-card bg-white border border-zinc-200/90 hover:border-zinc-300 rounded-2xl p-4 shadow-sm cursor-pointer flex flex-col justify-between transition-all"
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-zinc-900 tracking-tight">{prospect.name}</h4>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
                {prospect.classification}
              </span>
            </div>
            <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
              <Building2 className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
              <span>{prospect.company}</span>
              <span>·</span>
              <span className="truncate">{prospect.jobTitle}</span>
            </p>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
              {matchScore}%
            </span>
          </div>
        </div>

        {/* Location & Remote */}
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 mb-2.5">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-zinc-400" />
            <span className="truncate">{prospect.location}</span>
          </span>
        </div>

        {/* Hiring summary if exists */}
        {prospect.jobOpportunity && (
          <div className="text-[11px] bg-zinc-50 rounded-lg p-2 border border-zinc-200/80 mb-2.5 text-zinc-700">
            <span className="text-zinc-900 font-bold">Target Role: </span>
            {prospect.jobOpportunity.title}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2.5 border-t border-zinc-100 mt-1">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${statusClass}`}>
          {prospect.status}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(prospect);
          }}
          className="text-xs text-zinc-900 font-semibold flex items-center gap-1 hover:text-zinc-700"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isContacted ? 'View Outreach' : 'Generate DM'}</span>
        </button>
      </div>
    </div>
  );
}
