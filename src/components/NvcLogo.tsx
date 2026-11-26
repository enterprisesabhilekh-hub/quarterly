import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, FileEdit, RotateCcw, Eye, Send, XCircle } from 'lucide-react';
import { SubmissionStatus } from '../types/index.ts';

export function NvcLogo({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="National Vigilance Center Emblem"
      className="shrink-0"
    >
      <circle cx="32" cy="32" r="30" fill="#0F294D" stroke="#DC143C" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="25" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" />
      {/* Himalayan Crest */}
      <path d="M14 40L24 24L31 33L39 20L50 40H14Z" fill="#FFFFFF" fillOpacity="0.92" />
      <path d="M24 24L27.5 29L24 31L20.5 29L24 24Z" fill="#0F294D" />
      <path d="M39 20L43.5 27.5L39 30L34.5 27.5L39 20Z" fill="#0F294D" />
      {/* Vigilance Eye / Balance Arch */}
      <path d="M18 45H46" stroke="#DC143C" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="14" r="3" fill="#F59E0B" />
    </svg>
  );
}

const STATUS_META: Record<
  SubmissionStatus,
  { np: string; en: string; cls: string; Icon: React.FC<{ className?: string }> }
> = {
  'Not Started': {
    np: 'सुरु नभएको',
    en: 'Not Started',
    cls: 'text-slate-600 bg-slate-100 border-slate-200',
    Icon: Clock,
  },
  Draft: {
    np: 'मस्यौदा (Draft)',
    en: 'Draft',
    cls: 'text-slate-700 bg-slate-100 border-slate-300',
    Icon: FileEdit,
  },
  Submitted: {
    np: 'पेश भएको',
    en: 'Submitted',
    cls: 'text-blue-800 bg-blue-50 border-blue-200',
    Icon: Send,
  },
  'Under Review': {
    np: 'समीक्षाधीन',
    en: 'Under Review',
    cls: 'text-indigo-800 bg-indigo-50 border-indigo-200',
    Icon: Eye,
  },
  'Returned for Correction': {
    np: 'सुधारका लागि फिर्ता',
    en: 'Returned',
    cls: 'text-amber-800 bg-amber-50 border-amber-200',
    Icon: RotateCcw,
  },
  Resubmitted: {
    np: 'पुनः पेश भएको',
    en: 'Resubmitted',
    cls: 'text-cyan-800 bg-cyan-50 border-cyan-200',
    Icon: Send,
  },
  Reviewed: {
    np: 'समीक्षा सम्पन्न',
    en: 'Reviewed',
    cls: 'text-teal-800 bg-teal-50 border-teal-200',
    Icon: CheckCircle2,
  },
  Accepted: {
    np: 'स्वीकृत',
    en: 'Accepted',
    cls: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    Icon: CheckCircle2,
  },
  Overdue: {
    np: 'म्याद नाघेको',
    en: 'Overdue',
    cls: 'text-red-800 bg-red-50 border-red-200',
    Icon: AlertTriangle,
  },
};

export function StatusTag({ status, lang }: { status: SubmissionStatus; lang: 'ne' | 'en' }) {
  const meta = STATUS_META[status] || STATUS_META.Draft;
  const Icon = meta.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap ${meta.cls}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{lang === 'ne' ? meta.np : meta.en}</span>
    </span>
  );
}

export function IndicatorStateTag({ status }: { status: string }) {
  if (status === 'पूर्ण') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border text-emerald-800 bg-emerald-50 border-emerald-200 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5" />
        पूर्ण
      </span>
    );
  }
  if (status === 'आंशिक') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border text-amber-800 bg-amber-50 border-amber-200 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5" />
        आंशिक
      </span>
    );
  }
  if (status === 'छैन') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border text-red-800 bg-red-50 border-red-200 whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5" />
        छैन
      </span>
    );
  }
  return <span className="text-xs text-slate-400">—</span>;
}
