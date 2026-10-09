'use client';

import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, Download, HelpCircle, ArrowRight } from 'lucide-react';
import { Prospect } from '@/types';

interface CsvImportSectionProps {
  onImportComplete: (imported: Prospect[]) => void;
  onOpenGuideModal: () => void;
}

export function CsvImportSection({ onImportComplete, onOpenGuideModal }: CsvImportSectionProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const sampleCsvContent = `First Name,Last Name,Company,Title,URL,Location,Notes
Rahul,Sharma,XYZ AI,Founder & CEO,https://linkedin.com/in/rahul-sharma,Remote India,"We're hiring Full Stack AI Engineers with React, Python, FastAPI"
Priya,Singh,ABC Technologies,Technical Recruiter,https://linkedin.com/in/priya-singh,Remote India,"Looking for AI Engineer with Next.js and PostgreSQL"
Vikram,Mehta,Nexus Scale,CTO,https://linkedin.com/in/vikram-mehta,Remote India,"Building founding team #3, Next.js & FastAPI"`;

  const handleDownloadSample = () => {
    const blob = new Blob([sampleCsvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'linkedin_prospects_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg('');
    setSuccessCount(null);

    try {
      const text = await file.text();
      const res = await fetch('/api/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: text })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessCount(data.count);
        onImportComplete(data.prospects);
      } else {
        setErrorMsg(data.error || 'Failed to process CSV file');
      }
    } catch (err) {
      console.error('CSV upload error:', err);
      setErrorMsg('Failed to read or upload file');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div id="csv-upload-section" className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm space-y-4 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <Upload className="w-4 h-4 text-zinc-700" />
            <span>Upload LinkedIn Connections CSV</span>
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Drag and drop your LinkedIn CSV file to instantly generate targeted, high-converting messages.
          </p>
        </div>

        <button
          onClick={handleDownloadSample}
          className="self-start sm:self-auto text-xs text-zinc-700 hover:text-zinc-900 font-medium flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 px-3 py-1.5 rounded-xl transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-zinc-600" />
          <span>Sample CSV</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {successCount !== null && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Successfully imported and scored {successCount} prospects!</span>
        </div>
      )}

      {/* iLovePDF-Style Dropzone */}
      <div className="relative">
        <label className="border-2 border-dashed border-zinc-300 hover:border-zinc-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-zinc-50/50 hover:bg-zinc-100/50 group">
          <div className="w-12 h-12 rounded-full bg-zinc-200/80 group-hover:bg-zinc-300/80 flex items-center justify-center text-zinc-700 mb-3 transition-colors">
            <FileText className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold text-zinc-900">
            {isUploading ? 'Ingesting & Scoring Connections...' : 'Select LinkedIn CSV file or drag here'}
          </span>
          <span className="text-[11px] text-zinc-500 mt-1">
            Accepts standard Connections.csv export from LinkedIn
          </span>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Helper text on bottom-left / bottom-right with link */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 px-1">
        <button
          onClick={onOpenGuideModal}
          className="text-xs italic text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 transition-colors group"
        >
          <HelpCircle className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700" />
          <span>How to retrieve your LinkedIn Connections CSV file?</span>
          <ArrowRight className="w-3 h-3 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
        </button>
        <span className="text-[11px] text-zinc-400">100% Client-Side Privacy</span>
      </div>
    </div>
  );
}
