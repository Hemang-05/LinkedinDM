'use client';

import React from 'react';
import { X, FileSpreadsheet, ExternalLink, ArrowRight, CheckCircle2, Download, ShieldCheck } from 'lucide-react';

interface LinkedInCsvGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LinkedInCsvGuideModal({ isOpen, onClose }: LinkedInCsvGuideModalProps) {
  if (!isOpen) return null;

  const steps = [
    {
      step: '01',
      title: 'Open LinkedIn & Go to Settings',
      description: 'Click on your profile avatar ("Me") at the top right of LinkedIn and select "Settings & Privacy".',
      badge: 'Step 1'
    },
    {
      step: '02',
      title: 'Navigate to Data Privacy',
      description: 'In the left sidebar, click on "Data Privacy". Under the "How LinkedIn uses your data" section, click "Get a copy of your data".',
      badge: 'Step 2'
    },
    {
      step: '03',
      title: 'Select "Connections" Data',
      description: 'Choose "Want something specific? Select the data files you\'re most interested in", check the box for "Connections", and click "Request archive".',
      badge: 'Step 3'
    },
    {
      step: '04',
      title: 'Download & Upload CSV',
      description: 'LinkedIn will generate your file in 5–10 minutes. Download the CSV file and drag it into Direct Message!',
      badge: 'Step 4'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white border border-zinc-200 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">How to Export LinkedIn Connections CSV</h2>
              <p className="text-xs text-zinc-500">Quick 4-step guide to downloading your data directly from LinkedIn</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-800 leading-relaxed">
              <strong>Privacy Guaranteed:</strong> Your CSV data is processed locally in your browser. We never store or share your connections data with third parties.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {steps.map((s, idx) => (
              <div key={idx} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 hover:border-zinc-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{s.badge}</span>
                  <span className="text-xs font-extrabold text-zinc-300">{s.step}</span>
                </div>
                <h3 className="text-xs font-bold text-zinc-900">{s.title}</h3>
                <p className="text-[11px] text-zinc-600 leading-normal">{s.description}</p>
              </div>
            ))}
          </div>

          {/* Quick Direct Link to LinkedIn Settings */}
          <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <a
              href="https://www.linkedin.com/mypreferences/d/download-my-data"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <span>Go to LinkedIn Data Download Page</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            
            <button
              onClick={onClose}
              className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 py-2 px-3"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
