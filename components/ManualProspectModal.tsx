'use client';

import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { Prospect } from '@/types';

interface ManualProspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProspectAdded: (newProspect: Prospect) => void;
}

export function ManualProspectModal({ isOpen, onClose, onProspectAdded }: ManualProspectModalProps) {
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [location, setLocation] = useState('Remote India');
  const [notes, setNotes] = useState('');
  const [jobTitleOpening, setJobTitleOpening] = useState('Full Stack AI Engineer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !company.trim()) {
      setError('Name and Company are required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const { getSupabaseAccessToken } = await import('@/lib/supabaseClient');
      const token = await getSupabaseAccessToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/prospects', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: name.trim(),
          jobTitle: jobTitle.trim() || 'Founder',
          company: company.trim(),
          linkedinUrl: linkedinUrl.trim() || `https://linkedin.com/search/results/all/?keywords=${encodeURIComponent(name + ' ' + company)}`,
          location: location.trim(),
          notes: notes.trim(),
          jobTitleOpening: jobTitleOpening.trim() || undefined,
          remoteStatus: 'Remote India'
        })
      });

      const data = await res.json();
      if (data.success) {
        onProspectAdded(data.prospect);
        onClose();
        // Reset form
        setName('');
        setJobTitle('');
        setCompany('');
        setLinkedinUrl('');
        setNotes('');
      } else {
        setError(data.error || 'Failed to save prospect');
      }
    } catch (err) {
      console.error('Error adding prospect:', err);
      setError('Network error while saving prospect');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-[#E0DFDC] rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#E0DFDC]">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#0A66C2]" />
            <h2 className="text-sm font-bold text-zinc-900">Add Prospect / Opportunity</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-[#F4F2EE] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto safe-pb text-xs">
          {error && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-zinc-600 block mb-1">
              Contact Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-zinc-600 block mb-1">
                Company *
              </label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. ABC AI"
                className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-zinc-600 block mb-1">
                Position / Title
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Founder & CEO"
                className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-600 block mb-1">
              LinkedIn Profile URL
            </label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/username"
              className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-600 block mb-1">
              Role Being Hired For
            </label>
            <input
              type="text"
              value={jobTitleOpening}
              onChange={(e) => setJobTitleOpening(e.target.value)}
              placeholder="e.g. Full Stack AI Engineer"
              className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-600 block mb-1">
              Location & Remote Status
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Remote India"
              className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-600 block mb-1">
              Notes / Hiring Signals
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Posted 'We are hiring Full Stack Engineers with Next.js & Python'"
              className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-full bg-[#0A66C2] hover:bg-[#004182] active:scale-[0.98] text-white text-xs font-semibold shadow-xs transition-all"
            >
              {isSubmitting ? 'Analyzing & Scoring...' : 'Save Prospect & Generate DM'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
