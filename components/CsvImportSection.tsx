'use client';

import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, Download } from 'lucide-react';
import { Prospect } from '@/types';

interface CsvImportSectionProps {
  onImportComplete: (imported: Prospect[]) => void;
}

export function CsvImportSection({ onImportComplete }: CsvImportSectionProps) {
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
      // Reset input
      e.target.value = '';
    }
  };

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>CSV Batch Ingestion</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Import legitimate LinkedIn connections or exported prospect lists.
          </p>
        </div>

        <button
          onClick={handleDownloadSample}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Sample CSV</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {successCount !== null && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Successfully imported and scored {successCount} prospects!</span>
        </div>
      )}

      <label className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-900/40">
        <FileText className="w-8 h-8 text-indigo-400 mb-2" />
        <span className="text-xs font-semibold text-slate-200">
          {isUploading ? 'Importing and scoring...' : 'Tap to choose CSV file'}
        </span>
        <span className="text-[10px] text-slate-500 mt-1">
          Compatible with standard LinkedIn export columns
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
  );
}
