import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Edit3,
  FileText,
  History,
  MessageSquare,
  Printer,
  RotateCcw,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useI18n } from '../context/I18nContext.tsx';
import { OFFICIAL_INDICATORS } from '../data/nepalMasterData.ts';
import { SubmissionFull, SubmissionStatus } from '../types/index.ts';
import { formatBsDateDisplay, formatNum, formatPct, toDevanagariDigits } from '../utils/nepaliDate.ts';
import { IndicatorStateTag, StatusTag } from './NvcLogo.tsx';
import { OfficialReportPreview } from './OfficialReportPreview.tsx';

interface Props {
  submissionId: number;
  onBack: () => void;
  onEditForm?: (submissionId: number) => void;
}

export function SubmissionDetailView({ submissionId, onBack, onEditForm }: Props) {
  const { user, token, apiFetch } = useAuth();
  const { lang, t } = useI18n();

  const [submission, setSubmission] = useState<SubmissionFull | null>(null);
  const [prevQuarter, setPrevQuarter] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPdf, setShowPdf] = useState(false);

  // Two-way feedback composer
  const [fbScopeType, setFbScopeType] = useState<'overall' | 'section' | 'indicator' | 'service' | 'directive'>('overall');
  const [fbScopeRef, setFbScopeRef] = useState('');
  const [fbMessage, setFbMessage] = useState('');
  const [fbIsDirective, setFbIsDirective] = useState(false);
  const [fbRequiresEvidence, setFbRequiresEvidence] = useState(false);
  const [replyTexts, setReplyTexts] = useState<Record<number, string>>({});

  // Review decision
  const [reviewNote, setReviewNote] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ submission: SubmissionFull; previousQuarter: Record<string, unknown> | null }>(
        `/api/submissions/${submissionId}`
      );
      setSubmission(data.submission);
      setPrevQuarter(data.previousQuarter);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [submissionId]);

  const canReview = user?.role === 'super_admin' || user?.role === 'nvc_admin' || user?.role === 'review_officer';
  const canGiveFeedback = canReview || user?.role === 'ministry_user';
  const canEditOwn =
    user?.role === 'office_user' &&
    submission &&
    ['Draft', 'Not Started', 'Returned for Correction', 'Overdue'].includes(submission.status);

  const handleStatusChange = async (status: SubmissionStatus) => {
    if (!submission) return;
    setActionBusy(true);
    try {
      const res = await apiFetch<{ submission: SubmissionFull }>(`/api/submissions/${submission.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, note: reviewNote }),
      });
      setSubmission(res.submission);
      setReviewNote('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setActionBusy(false);
    }
  };

  const handleAddFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submission || !fbMessage.trim()) return;
    setActionBusy(true);
    try {
      const res = await apiFetch<{ submission: SubmissionFull }>(`/api/submissions/${submission.id}/feedbacks`, {
        method: 'POST',
        body: JSON.stringify({
          scope_type: fbScopeType,
          scope_ref: fbScopeRef,
          message: fbMessage,
          is_directive: fbIsDirective,
          requires_evidence: fbRequiresEvidence,
        }),
      });
      setSubmission(res.submission);
      setFbMessage('');
      setFbScopeRef('');
      setFbIsDirective(false);
      setFbRequiresEvidence(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send feedback');
    } finally {
      setActionBusy(false);
    }
  };

  const handleReplyFeedback = async (feedbackId: number) => {
    const msg = replyTexts[feedbackId]?.trim();
    if (!msg) return;
    setActionBusy(true);
    try {
      const res = await apiFetch<{ submission: SubmissionFull }>(`/api/feedbacks/${feedbackId}/replies`, {
        method: 'POST',
        body: JSON.stringify({ message: msg }),
      });
      setSubmission(res.submission);
      setReplyTexts((prev) => ({ ...prev, [feedbackId]: '' }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setActionBusy(false);
    }
  };

  const handleToggleException = async () => {
    if (!submission) return;
    setActionBusy(true);
    try {
      const res = await apiFetch<{ submission: SubmissionFull }>(`/api/submissions/${submission.id}/exception`, {
        method: 'POST',
        body: JSON.stringify({
          exception_approved: !submission.summary.exception_approved,
          exception_reason: exceptionReason || 'Administrator approved exception',
        }),
      });
      setSubmission(res.submission);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActionBusy(false);
    }
  };

  const openFile = async (attId: number) => {
    const res = await fetch(`/api/attachments/${attId}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.click();
  };

  if (loading || !submission) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
        {t('विस्तृत प्रतिवेदन लोड हुँदैछ...', 'Loading detailed report...')}
      </div>
    );
  }

  const totalRec = submission.services.reduce((a, b) => a + b.received_count, 0);
  const totalDisp = submission.services.reduce((a, b) => a + b.disposed_count, 0);
  const totalWithin = submission.services.reduce((a, b) => a + b.within_deadline_count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-[#0F294D] truncate">{submission.office.name_np}</h2>
              <StatusTag status={submission.status} lang={lang} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {submission.office.office_code} · {submission.office.province_name_np} · {submission.office.district_name_np} ·{' '}
              {submission.fiscal_year_np} ({submission.quarter_name_np}) · {t('संस्करण', 'Version')} {formatNum(submission.version_no, lang)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {(canEditOwn || user?.role === 'super_admin' || user?.role === 'nvc_admin') && onEditForm && (
            <button
              type="button"
              onClick={() => onEditForm(submission.id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {t('प्रतिवेदन सम्पादन', 'Edit Report')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowPdf(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F294D] text-white text-xs font-semibold rounded-md hover:bg-[#173a6b]"
          >
            <Printer className="w-3.5 h-3.5" />
            {t('२-पृष्ठ PDF / Print', '2-Page PDF / Print')}
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded bg-red-50 border border-red-200 text-xs text-red-800">{error}</div>}

      {/* Comparison with Previous Quarter + Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">{t('कार्यान्वयन स्कोर', 'Implementation Score')}</p>
          <p className="text-2xl font-bold text-[#0F294D] tabular-nums mt-1">{formatPct(submission.implementation_score, lang)}</p>
          {prevQuarter && (
            <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
              {t('अघिल्लो त्रैमासिक:', 'Prev Quarter:')} {formatPct(Number(prevQuarter.implementation_score || 0), lang)}
            </p>
          )}
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">{t('निवेदन ढाँचा प्रगति', 'Template Progress')}</p>
          <p className="text-2xl font-bold text-[#0F294D] tabular-nums mt-1">
            {formatNum(submission.summary.in_use_forms, lang)} / {formatNum(submission.summary.total_services, lang)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">{t('प्रयोगमा आएका / कुल सेवा', 'In Use / Total Services')}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">{t('निवेदन फर्छ्योट', 'Application Disposal')}</p>
          <p className="text-2xl font-bold text-[#0F294D] tabular-nums mt-1">
            {formatNum(totalDisp, lang)} / {formatNum(totalRec, lang)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {t('समयसीमाभित्र:', 'Within Deadline:')} {totalDisp > 0 ? formatPct((totalWithin / totalDisp) * 100, lang) : '0%'}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">{t('संलग्न प्रमाण तथा टिप्पणी', 'Evidence & Feedback')}</p>
          <p className="text-2xl font-bold text-[#0F294D] tabular-nums mt-1">
            {formatNum(submission.attachments.length, lang)} · {formatNum(submission.feedbacks.length, lang)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">{t('फाइल · केन्द्र टिप्पणी', 'Files · Feedbacks')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 8 cols: Full Report Sections */}
        <div className="xl:col-span-8 space-y-6">
          {/* Office Profile & Section 1 */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-bold text-[#0F294D] mb-3">१. कार्यालय विवरण तथा समष्टिगत तथ्याङ्क</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
              <div><span className="text-slate-500">कार्यालय:</span> <strong>{submission.summary.office_name}</strong></div>
              <div><span className="text-slate-500">मन्त्रालय/तह:</span> <strong>{submission.summary.level_ministry}</strong></div>
              <div><span className="text-slate-500">ठेगाना:</span> <strong>{submission.summary.address}</strong></div>
              <div><span className="text-slate-500">कार्यालय प्रमुख:</span> <strong>{submission.summary.office_head}</strong></div>
              <div><span className="text-slate-500">सम्पर्क:</span> <strong>{submission.summary.contact_info}</strong></div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              {[
                ['कुल सेवा', submission.summary.total_services],
                ['तयार ढाँचा', submission.summary.prepared_forms],
                ['स्वीकृत', submission.summary.approved_forms],
                ['प्रयोगमा', submission.summary.in_use_forms],
                ['निःशुल्क', submission.summary.free_available_forms],
                ['डिजिटल', submission.summary.digital_available_forms],
              ].map(([lbl, val]) => (
                <div key={String(lbl)} className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <div className="text-[11px] text-slate-500">{lbl}</div>
                  <div className="text-base font-bold text-[#0F294D] tabular-nums">{formatNum(Number(val), lang)}</div>
                </div>
              ))}
            </div>

            {(user?.role === 'super_admin' || user?.role === 'nvc_admin') && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="text"
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  placeholder="अपवाद कारण (लागू नहुने विषय भए)..."
                  className="flex-1 min-w-[200px] px-2.5 py-1.5 border border-slate-300 rounded"
                />
                <button
                  type="button"
                  onClick={handleToggleException}
                  className="px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 font-medium"
                >
                  {submission.summary.exception_approved ? 'अपवाद हटाउनुहोस्' : 'प्रशासकीय अपवाद स्वीकृत गर्नुहोस्'}
                </button>
              </div>
            )}
          </div>

          {/* Section 2: 9 Indicators */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-bold text-[#0F294D] mb-3">२. निर्देशिका कार्यान्वयनको अवस्था (९ सूचक)</h3>
            <div className="divide-y divide-slate-200">
              {OFFICIAL_INDICATORS.map((ind) => {
                const resp = submission.indicators.find((r) => r.indicator_no === ind.indicator_no);
                return (
                  <div key={ind.indicator_no} className="py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-2 text-xs">
                    <div className="flex-1">
                      <span className="font-bold text-[#0F294D] mr-1.5">{toDevanagariDigits(ind.indicator_no)}.</span>
                      <span className="font-medium text-slate-800">{ind.title_np}</span>
                      {(resp?.remarks || resp?.evidence_details) && (
                        <p className="text-slate-500 mt-1">
                          कैफियत: {resp.remarks || '—'} · प्रमाण: {resp.evidence_details || '—'}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      <IndicatorStateTag status={resp?.status || ''} />
                    </div>
                  </div>
                );
              })}
            </div>
            {submission.summary.major_achievements && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded text-xs">
                <span className="font-bold text-[#0F294D]">मुख्य उपलब्धि वा बाँकी सुधार: </span>
                {submission.summary.major_achievements}
              </div>
            )}
          </div>

          {/* Section 3: Services */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-bold text-[#0F294D] mb-3">३. सेवा अनुसार निवेदन ढाँचा तथा सेवा प्रवाहको तथ्याङ्क</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="p-2 text-left border-b border-slate-200">क्र.सं.</th>
                    <th className="p-2 text-left border-b border-slate-200">सेवाको नाम</th>
                    <th className="p-2 text-center border-b border-slate-200">ढाँचा स्थिति</th>
                    <th className="p-2 text-right border-b border-slate-200">प्राप्त</th>
                    <th className="p-2 text-right border-b border-slate-200">फर्छ्योट</th>
                    <th className="p-2 text-right border-b border-slate-200">बाँकी</th>
                    <th className="p-2 text-right border-b border-slate-200">फिर्ता</th>
                    <th className="p-2 text-right border-b border-slate-200">समयभित्र</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {submission.services.map((sv, i) => (
                    <tr key={i}>
                      <td className="p-2">{formatNum(i + 1, lang)}</td>
                      <td className="p-2 font-medium">{sv.service_name || '—'}</td>
                      <td className="p-2 text-center">
                        {sv.is_prepared ? 'तयार' : '—'} / {sv.is_approved ? 'स्वीकृत' : '—'} / {sv.is_in_use ? 'प्रयोग' : '—'}
                      </td>
                      <td className="p-2 text-right">{formatNum(sv.received_count, lang)}</td>
                      <td className="p-2 text-right">{formatNum(sv.disposed_count, lang)}</td>
                      <td className="p-2 text-right">{formatNum(sv.pending_count, lang)}</td>
                      <td className="p-2 text-right">{formatNum(sv.returned_count, lang)}</td>
                      <td className="p-2 text-right">{formatNum(sv.within_deadline_count, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attachments */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-bold text-[#0F294D] mb-2">संलग्न प्रमाण तथा कागजात</h3>
            {submission.attachments.length === 0 ? (
              <p className="text-xs text-slate-500">कुनै फाइल संलग्न छैन।</p>
            ) : (
              <div className="space-y-2">
                {submission.attachments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-2 border border-slate-200 rounded text-xs">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#0F294D]" />
                      <span className="font-medium">{a.file_name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openFile(a.id)}
                      className="text-xs font-semibold text-[#0F294D] hover:underline"
                    >
                      {t('खोल्नुहोस्', 'Open')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 4 cols: Review Panel, Two-Way Feedback & History */}
        <div className="xl:col-span-4 space-y-6">
          {/* Review Decision Box */}
          {canReview && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#0F294D]">{t('केन्द्र समीक्षा निर्णय', 'NVC Review Decision')}</h3>
              <textarea
                rows={3}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={t('समीक्षा टिप्पणी वा सुधारका विषय लेख्नुहोस्...', 'Enter review remarks or revision instructions...')}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleStatusChange('Under Review')}
                  className="px-3 py-2 text-xs font-semibold border border-indigo-200 bg-indigo-50 text-indigo-800 rounded hover:bg-indigo-100"
                >
                  {t('समीक्षाधीन', 'Under Review')}
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleStatusChange('Returned for Correction')}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold border border-amber-300 bg-amber-50 text-amber-900 rounded hover:bg-amber-100"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t('सुधारका लागि फिर्ता', 'Return')}
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleStatusChange('Reviewed')}
                  className="px-3 py-2 text-xs font-semibold border border-teal-200 bg-teal-50 text-teal-800 rounded hover:bg-teal-100"
                >
                  {t('समीक्षा सम्पन्न', 'Mark Reviewed')}
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleStatusChange('Accepted')}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold bg-emerald-700 text-white rounded hover:bg-emerald-800"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('स्वीकृत गर्नुहोस्', 'Accept Report')}
                </button>
              </div>
            </div>
          )}

          {/* Two-Way Feedback System */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#0F294D]" />
              <h3 className="text-sm font-bold text-[#0F294D]">{t('दुईतर्फी Feedback तथा निर्देशन', 'Two-Way Feedback & Directives')}</h3>
            </div>

            {canGiveFeedback && (
              <form onSubmit={handleAddFeedback} className="space-y-2.5 p-3 bg-slate-50 border border-slate-200 rounded-md">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={fbScopeType}
                    onChange={(e) => setFbScopeType(e.target.value as typeof fbScopeType)}
                    className="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                  >
                    <option value="overall">सम्पूर्ण प्रतिवेदन</option>
                    <option value="section">खण्ड (Section १–४)</option>
                    <option value="indicator">सूचक नं. (१–९)</option>
                    <option value="service">सेवा विवरण</option>
                    <option value="directive">सुधार निर्देशन</option>
                  </select>
                  <input
                    type="text"
                    value={fbScopeRef}
                    onChange={(e) => setFbScopeRef(e.target.value)}
                    placeholder="सन्दर्भ (उदा: सूचक ८)"
                    className="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                  />
                </div>
                <textarea
                  rows={2}
                  required
                  value={fbMessage}
                  onChange={(e) => setFbMessage(e.target.value)}
                  placeholder="टिप्पणी वा निर्देशन लेख्नुहोस्..."
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                />
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-700">
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={fbIsDirective} onChange={(e) => setFbIsDirective(e.target.checked)} />
                    <span>निर्देशन</span>
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={fbRequiresEvidence} onChange={(e) => setFbRequiresEvidence(e.target.checked)} />
                    <span>प्रमाण माग</span>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 bg-[#0F294D] text-white text-xs font-semibold rounded hover:bg-[#173a6b]"
                >
                  <Send className="w-3.5 h-3.5" />
                  {t('Feedback पठाउनुहोस्', 'Send Feedback')}
                </button>
              </form>
            )}

            <div className="space-y-3 max-h-[420px] overflow-y-auto">
              {submission.feedbacks.length === 0 ? (
                <p className="text-xs text-slate-500">{t('कुनै टिप्पणी दर्ता भएको छैन।', 'No feedback recorded yet.')}</p>
              ) : (
                submission.feedbacks.map((fb) => (
                  <div key={fb.id} className="border border-slate-200 rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-[#0F294D]">{fb.author_name_np}</span>
                      <span className="text-slate-400">{fb.created_at.slice(0, 16)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {fb.scope_type} {fb.scope_ref && `(${fb.scope_ref})`}
                      {fb.is_directive && <span className="ml-2 text-red-700 font-semibold">· निर्देशन</span>}
                      {fb.requires_evidence && <span className="ml-2 text-amber-700 font-semibold">· प्रमाण आवश्यक</span>}
                    </div>
                    <p className="text-xs text-slate-800">{fb.message}</p>

                    {fb.replies.length > 0 && (
                      <div className="pl-3 border-l border-slate-300 space-y-1.5 mt-2">
                        {fb.replies.map((rp) => (
                          <div key={rp.id} className="bg-slate-50 p-2 rounded text-xs">
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <strong className="text-slate-700">{rp.user_name_np}</strong>
                              <span>{rp.created_at.slice(0, 16)}</span>
                            </div>
                            <p className="text-slate-800 mt-0.5">{rp.message}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {user?.role !== 'viewer_auditor' && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="text"
                          value={replyTexts[fb.id] || ''}
                          onChange={(e) => setReplyTexts((prev) => ({ ...prev, [fb.id]: e.target.value }))}
                          placeholder={t('जवाफ लेख्नुहोस्...', 'Write a reply...')}
                          className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded"
                        />
                        <button
                          type="button"
                          onClick={() => handleReplyFeedback(fb.id)}
                          className="px-2.5 py-1 bg-[#0F294D] text-white text-xs font-medium rounded hover:bg-[#173a6b]"
                        >
                          {t('पठाउनुहोस्', 'Reply')}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Status & Version History */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#0F294D]" />
              <h3 className="text-sm font-bold text-[#0F294D]">{t('अवस्था तथा संस्करण इतिहास', 'Status & Version History')}</h3>
            </div>
            <div className="space-y-2 text-xs">
              {submission.status_history.map((h) => (
                <div key={h.id} className="p-2 bg-slate-50 rounded border border-slate-100">
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>{h.to_status}</span>
                    <span className="text-[10px] text-slate-400">{h.created_at.slice(0, 16)}</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {h.changed_by_name} {h.note ? `— ${h.note}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showPdf && <OfficialReportPreview submission={submission} onClose={() => setShowPdf(false)} />}
    </div>
  );
}
