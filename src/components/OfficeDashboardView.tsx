import React, { useEffect, useState } from 'react';
import { Building2, Calendar, Edit3, Eye, FilePlus2, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useI18n } from '../context/I18nContext.tsx';
import { SubmissionFull, SubmissionListItem } from '../types/index.ts';
import { formatNum, formatPct, toDevanagariDigits } from '../utils/nepaliDate.ts';
import { StatusTag } from './NvcLogo.tsx';

interface Props {
  onOpenWizard: (submissionId: number) => void;
  onViewDetail: (submissionId: number) => void;
}

export function OfficeDashboardView({ onOpenWizard, onViewDetail }: Props) {
  const { user, master, apiFetch } = useAuth();
  const { lang, t } = useI18n();

  const [selectedOfficeId, setSelectedOfficeId] = useState<number>(user?.offices[0]?.office_id || 0);
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPeriodId, setBusyPeriodId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const activeOffice = master?.offices.find((o) => o.id === selectedOfficeId);

  const loadSubmissions = async () => {
    if (!selectedOfficeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ submissions: SubmissionListItem[] }>(`/api/submissions?officeId=${selectedOfficeId}`);
      setSubmissions(data.submissions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load office submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [selectedOfficeId]);

  const handleStartOrResume = async (periodId: number) => {
    if (!selectedOfficeId) return;
    setBusyPeriodId(periodId);
    setError('');
    try {
      const res = await apiFetch<{ submission: SubmissionFull }>('/api/submissions/init', {
        method: 'POST',
        body: JSON.stringify({ office_id: selectedOfficeId, reporting_period_id: periodId }),
      });
      onOpenWizard(res.submission.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to open report');
    } finally {
      setBusyPeriodId(null);
    }
  };

  const openPeriods = master?.reporting_periods.filter((p) => p.status === 'open') || [];

  return (
    <div className="space-y-6">
      {/* Office Profile Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-[#0F294D] text-white flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0F294D]">
                {activeOffice ? (lang === 'ne' ? activeOffice.name_np : activeOffice.name_en) : t('कार्यालय ड्यासबोर्ड', 'Office Dashboard')}
              </h2>
              {activeOffice && (
                <p className="text-xs text-slate-600 mt-1">
                  {activeOffice.office_code} · {activeOffice.province_name_np} · {activeOffice.district_name_np} · {activeOffice.address_np}
                </p>
              )}
              {activeOffice && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('कार्यालय प्रमुख:', 'Office Head:')} {activeOffice.office_head_name} · {activeOffice.contact_phone} · {activeOffice.email}
                </p>
              )}
            </div>
          </div>

          {user && user.offices.length > 1 && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">{t('कार्यालय छनोट गर्नुहोस्', 'Select Linked Office')}</label>
              <select
                value={selectedOfficeId}
                onChange={(e) => setSelectedOfficeId(Number(e.target.value))}
                className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-md bg-white"
              >
                {user.offices.map((o) => (
                  <option key={o.office_id} value={o.office_id}>
                    {lang === 'ne' ? o.office_name_np : o.office_name_en} ({o.office_code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded">{error}</div>}

      {/* Open Reporting Periods */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-[#0F294D]" />
          <h3 className="text-base font-bold text-[#0F294D]">
            {t('खुला त्रैमासिक प्रतिवेदन अवधि (प्रतिवेदन भर्नुहोस् / सम्पादन गर्नुहोस्)', 'Open Reporting Periods')}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {openPeriods.map((per) => {
            const existing = submissions.find((s) => s.reporting_period_id === per.id);
            const canEdit = !existing || ['Not Started', 'Draft', 'Returned for Correction', 'Overdue'].includes(existing.status);
            return (
              <div key={per.id} className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-4 bg-slate-50/50">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#0F294D]">
                      {t('आ.व.', 'FY')} {lang === 'ne' ? per.fiscal_year_np : per.fiscal_year_code} ·{' '}
                      {lang === 'ne' ? per.quarter_name_np : per.quarter_name_en}
                    </span>
                    {existing && <StatusTag status={existing.status} lang={lang} />}
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5">
                    {t('अवधि:', 'Period:')} {toDevanagariDigits(per.start_date_bs)} – {toDevanagariDigits(per.end_date_bs)} ·{' '}
                    <strong className="text-[#B91C1C]">{t('अन्तिम मिति:', 'Deadline:')} {toDevanagariDigits(per.deadline_bs)}</strong>
                  </p>
                  {existing && existing.feedback_count > 0 && (
                    <p className="text-xs text-amber-800 font-medium mt-1.5 inline-flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {t(`केन्द्रबाट ${existing.feedback_count} टिप्पणी प्राप्त`, `${existing.feedback_count} center feedback(s) received`)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {canEdit ? (
                    <button
                      type="button"
                      disabled={busyPeriodId === per.id}
                      onClick={() => handleStartOrResume(per.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F294D] hover:bg-[#173a6b] text-white text-xs font-semibold rounded-md"
                    >
                      {existing ? <Edit3 className="w-3.5 h-3.5" /> : <FilePlus2 className="w-3.5 h-3.5" />}
                      {busyPeriodId === per.id
                        ? t('खुल्दैछ...', 'Opening...')
                        : existing?.status === 'Returned for Correction'
                        ? t('सुधार गरी पुनः पेश गर्नुहोस्', 'Revise & Resubmit')
                        : existing
                        ? t('प्रतिवेदन निरन्तर भर्नुहोस्', 'Resume Draft')
                        : t('नयाँ प्रतिवेदन सुरु गर्नुहोस्', 'Start Quarterly Report')}
                    </button>
                  ) : null}
                  {existing && (
                    <button
                      type="button"
                      onClick={() => onViewDetail(existing.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold rounded-md"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {t('विवरण / Feedback हेर्नुहोस्', 'View Details & Feedback')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historical & All Submissions Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h3 className="text-base font-bold text-[#0F294D] mb-4">
          {t('विगत तथा हालका त्रैमासिक प्रतिवेदनहरूको अभिलेख', 'Quarterly Submissions History')}
        </h3>
        {loading ? (
          <p className="text-xs text-slate-500">{t('लोड हुँदैछ...', 'Loading...')}</p>
        ) : submissions.length === 0 ? (
          <p className="text-xs text-slate-500">{t('कुनै प्रतिवेदन भेटिएन।', 'No submissions yet.')}</p>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-2.5 text-left">{t('आर्थिक वर्ष / त्रैमासिक', 'FY / Quarter')}</th>
                  <th className="p-2.5 text-left">{t('अवस्था', 'Status')}</th>
                  <th className="p-2.5 text-right">{t('संस्करण', 'Version')}</th>
                  <th className="p-2.5 text-right">{t('कार्यान्वयन %', 'Score %')}</th>
                  <th className="p-2.5 text-right">{t('प्राप्त / फर्छ्योट', 'Received / Disposed')}</th>
                  <th className="p-2.5 text-right">{t('कार्य', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 tabular-nums">
                {submissions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-semibold">{s.fiscal_year_np} · {s.quarter_name_np}</td>
                    <td className="p-2.5"><StatusTag status={s.status} lang={lang} /></td>
                    <td className="p-2.5 text-right">v{formatNum(s.version_no, lang)}</td>
                    <td className="p-2.5 text-right font-bold">{formatPct(s.implementation_score, lang)}</td>
                    <td className="p-2.5 text-right">{formatNum(s.total_received, lang)} / {formatNum(s.total_disposed, lang)}</td>
                    <td className="p-2.5 text-right space-x-3">
                      {['Draft', 'Not Started', 'Returned for Correction', 'Overdue'].includes(s.status) && (
                        <button
                          type="button"
                          onClick={() => onOpenWizard(s.id)}
                          className="font-semibold text-[#0F294D] hover:underline"
                        >
                          {t('सम्पादन', 'Edit')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onViewDetail(s.id)}
                        className="font-semibold text-slate-700 hover:underline"
                      >
                        {t('हेर्नुहोस् / PDF', 'View / PDF')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
