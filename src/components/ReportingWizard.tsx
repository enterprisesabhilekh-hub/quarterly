import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  FileText,
  Plus,
  Printer,
  Save,
  Send,
  ShieldAlert,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useI18n } from '../context/I18nContext.tsx';
import { OFFICIAL_INDICATORS } from '../data/nepalMasterData.ts';
import {
  CertificationTier,
  CorrectiveAction,
  IndicatorResponse,
  IndicatorStatus,
  MonitoringDetail,
  OfficeProgressSummary,
  ServiceDetail,
  SubmissionFull,
} from '../types/index.ts';
import { getCurrentBsDate, toDevanagariDigits } from '../utils/nepaliDate.ts';
import { OfficialReportPreview } from './OfficialReportPreview.tsx';
import { StatusTag } from './NvcLogo.tsx';

interface Props {
  submissionId: number;
  onBack: () => void;
  onSubmitted?: (sub: SubmissionFull) => void;
}

const STEPS = [
  { step: 1, np: '१. कार्यालय विवरण तथा प्रगति', en: '1. Office & Progress' },
  { step: 2, np: '२. निर्देशिका कार्यान्वयन', en: '2. 9 Indicators' },
  { step: 3, np: '३. सेवागत तथ्याङ्क', en: '3. Service Table' },
  { step: 4, np: '४. अनुगमन तथा प्रमाण', en: '4. Monitoring & Proof' },
  { step: 5, np: '५. प्रमाणीकरण र पूर्वावलोकन', en: '5. Certify & Preview' },
  { step: 6, np: '६. अन्तिम पेश', en: '6. Final Submit' },
];

export function ReportingWizard({ submissionId, onBack, onSubmitted }: Props) {
  const { user, apiFetch } = useAuth();
  const { lang, t } = useI18n();

  const [submission, setSubmission] = useState<SubmissionFull | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [showFullPreviewModal, setShowFullPreviewModal] = useState(false);

  // Editable state slices
  const [summary, setSummary] = useState<OfficeProgressSummary | null>(null);
  const [indicators, setIndicators] = useState<IndicatorResponse[]>([]);
  const [services, setServices] = useState<ServiceDetail[]>([]);
  const [monitoring, setMonitoring] = useState<MonitoringDetail | null>(null);
  const [correctiveActions, setCorrectiveActions] = useState<CorrectiveAction[]>([]);
  const [certifications, setCertifications] = useState<CertificationTier[]>([]);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCategory, setUploadCategory] = useState('approved_sample');
  const [uploadIndicatorNo, setUploadIndicatorNo] = useState<number | null>(null);
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<{ url: string; mime: string; name: string } | null>(null);
  const dirtyRef = useRef(false);

  const loadSubmission = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ submission: SubmissionFull }>(`/api/submissions/${submissionId}`);
      const sub = data.submission;
      setSubmission(sub);
      setSummary(sub.summary);
      setIndicators(sub.indicators);
      setServices(
        sub.services.length > 0
          ? sub.services
          : Array.from({ length: 6 }, (_, i) => ({
              serial_no: i + 1,
              service_name: '',
              is_prepared: false,
              is_approved: false,
              is_in_use: false,
              approval_date: '',
              is_free: false,
              is_notice_board: false,
              is_website: false,
              website_url: '',
              received_count: 0,
              disposed_count: 0,
              pending_count: 0,
              returned_count: 0,
              within_deadline_count: 0,
              prescribed_timeline: '',
              remarks: '',
            }))
      );
      setMonitoring(sub.monitoring);
      setCorrectiveActions(
        sub.corrective_actions.length > 0
          ? sub.corrective_actions
          : [
              {
                main_problem: '',
                root_cause: '',
                corrective_step: '',
                responsible_person: '',
                responsible_unit: '',
                target_deadline: '',
                expected_facilitation: '',
                remarks: '',
              },
            ]
      );
      const defaultTiers: Array<'preparer' | 'reviewer' | 'head'> = ['preparer', 'reviewer', 'head'];
      setCertifications(
        defaultTiers.map((tier) => {
          const found = sub.certifications.find((c) => c.tier === tier);
          return (
            found || {
              tier,
              name_designation: '',
              signature_text: '',
              signed_date: getCurrentBsDate(false),
              office_stamp_confirmed: false,
              digital_pin_verified: false,
              signed_doc_attachment_id: null,
            }
          );
        })
      );
      dirtyRef.current = false;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  const isEditable =
    submission &&
    (user?.role === 'super_admin' ||
      user?.role === 'nvc_admin' ||
      (user?.role === 'office_user' && ['Not Started', 'Draft', 'Returned for Correction', 'Overdue'].includes(submission.status)));

  const handleSaveDraft = async (silent = false) => {
    if (!submission || !summary || !monitoring || !isEditable) return;
    if (!silent) {
      setSaving(true);
      setError('');
    }
    try {
      const res = await apiFetch<{ submission: SubmissionFull }>(`/api/submissions/${submission.id}/draft`, {
        method: 'PUT',
        body: JSON.stringify({
          summary,
          indicators,
          services,
          monitoring,
          corrective_actions: correctiveActions,
          certifications,
        }),
      });
      setSubmission(res.submission);
      dirtyRef.current = false;
      setSaveMessage(
        `${t('मस्यौदा सुरक्षित गरियो', 'Draft saved')} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})`
      );
    } catch (err: unknown) {
      if (!silent) setError(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      if (!silent) setSaving(false);
    }
  };

  // Auto-save every 20 seconds if dirty
  useEffect(() => {
    const timer = setInterval(() => {
      if (dirtyRef.current && isEditable) {
        handleSaveDraft(true);
      }
    }, 20000);
    return () => clearInterval(timer);
  });

  // Section 1B Validations
  const sec1Validation = useMemo(() => {
    if (!summary) return { errors: [], warnings: [] };
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!summary.exception_approved) {
      if (summary.prepared_forms > summary.total_services) {
        errors.push(t('तयार भएका ढाँचा कुल सार्वजनिक सेवाको संख्याभन्दा बढी हुनु हुँदैन।', 'Prepared forms cannot exceed total services.'));
      }
      if (summary.approved_forms > summary.prepared_forms) {
        errors.push(t('स्वीकृत संख्या तयार भएको संख्याभन्दा बढी हुनु हुँदैन।', 'Approved forms cannot exceed prepared forms.'));
      }
      if (summary.in_use_forms > summary.approved_forms) {
        errors.push(t('प्रयोगमा आएको संख्या स्वीकृत संख्याभन्दा बढी हुनु हुँदैन।', 'In-use forms cannot exceed approved forms.'));
      }
    }
    if (summary.free_available_forms > summary.prepared_forms) {
      warnings.push(
        t(
          'चेतावनी: निःशुल्क उपलब्ध ढाँचाको संख्या तयार भएको कुल ढाँचाभन्दा बढी देखिएको छ।',
          'Warning: Free available forms exceed prepared forms.'
        )
      );
    }
    if (summary.digital_available_forms > summary.prepared_forms) {
      warnings.push(
        t(
          'चेतावनी: वेबसाइट/डिजिटल Format मा उपलब्ध संख्या तयार भएको कुल ढाँचाभन्दा बढी देखिएको छ।',
          'Warning: Digital available forms exceed prepared forms.'
        )
      );
    }
    return { errors, warnings };
  }, [summary, lang]);

  // Section 3 Totals & Math Validation
  const serviceTotals = useMemo(() => {
    const active = services.filter((s) => s.service_name.trim().length > 0);
    const received = active.reduce((a, b) => a + (Number(b.received_count) || 0), 0);
    const disposed = active.reduce((a, b) => a + (Number(b.disposed_count) || 0), 0);
    const pending = active.reduce((a, b) => a + (Number(b.pending_count) || 0), 0);
    const returned = active.reduce((a, b) => a + (Number(b.returned_count) || 0), 0);
    const within = active.reduce((a, b) => a + (Number(b.within_deadline_count) || 0), 0);
    const withinPct = disposed > 0 ? (within / disposed) * 100 : 0;

    const rowErrors: string[] = [];
    active.forEach((sv, idx) => {
      const sum = (sv.disposed_count || 0) + (sv.pending_count || 0) + (sv.returned_count || 0);
      if ((sv.received_count || 0) !== sum) {
        rowErrors.push(
          t(
            `पङ्क्ति ${idx + 1} (${sv.service_name}): प्राप्त (${sv.received_count}) र फर्छ्योट+बाँकी+फिर्ता (${sum}) बराबर छैन।`,
            `Row ${idx + 1} (${sv.service_name}): Received (${sv.received_count}) != Disposed+Pending+Returned (${sum}).`
          )
        );
      }
      if ((sv.within_deadline_count || 0) > (sv.disposed_count || 0)) {
        rowErrors.push(
          t(
            `पङ्क्ति ${idx + 1} (${sv.service_name}): समयसीमाभित्र फर्छ्योट संख्या कुल फर्छ्योट संख्याभन्दा बढी छ।`,
            `Row ${idx + 1} (${sv.service_name}): Within-deadline count exceeds disposed count.`
          )
        );
      }
    });

    return { activeCount: active.length, received, disposed, pending, returned, within, withinPct, rowErrors };
  }, [services, lang]);

  // Overall Submit Readiness
  const readiness = useMemo(() => {
    const issues: string[] = [...sec1Validation.errors, ...serviceTotals.rowErrors];
    const incompleteIndicators = indicators.filter((i) => !i.status).length;
    if (incompleteIndicators > 0) {
      issues.push(t(`खण्ड २ मा ${incompleteIndicators} वटा सूचकको अवस्था छानिएको छैन।`, `${incompleteIndicators} indicator(s) in Section 2 have no status selected.`));
    }
    if (serviceTotals.activeCount === 0) {
      issues.push(t('खण्ड ३ मा कम्तीमा एक सेवाको विवरण भर्नुहोस्।', 'Enter at least one service row in Section 3.'));
    }
    const headCert = certifications.find((c) => c.tier === 'head');
    if (!headCert || !headCert.name_designation.trim() || !headCert.signed_date.trim() || !headCert.digital_pin_verified) {
      issues.push(t('खण्ड ५ मा कार्यालय प्रमुखबाट अन्तिम प्रमाणीकरण पूरा भएको छैन।', 'Office Head certification in Step 5 is incomplete.'));
    }
    return issues;
  }, [sec1Validation, serviceTotals, indicators, certifications, lang]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, indNo: number | null = null, cat = uploadCategory) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !submission) return;
    setError('');
    setUploading(true);
    setUploadProgress(15);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(t(`फाइल "${file.name}" ५ MB भन्दा ठूलो छ।`, `File "${file.name}" exceeds 5 MB limit.`));
        }
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('File read failed'));
          reader.readAsDataURL(file);
        });
        setUploadProgress(Math.round(((i + 0.6) / files.length) * 100));
        const res = await apiFetch<{ submission: SubmissionFull }>(`/api/submissions/${submission.id}/attachments`, {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            base64Data,
            category: cat,
            indicatorNo: indNo,
          }),
        });
        setSubmission(res.submission);
      }
      setUploadProgress(100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 400);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attId: number) => {
    if (!submission) return;
    try {
      const res = await apiFetch<{ submission: SubmissionFull }>(`/api/attachments/${attId}`, { method: 'DELETE' });
      setSubmission(res.submission);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete attachment');
    }
  };

  const openAttachmentPreview = async (attId: number, fileName: string, mime: string) => {
    try {
      const res = await fetch(`/api/attachments/${attId}/file`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('never') || ''}` },
      });
      void res;
    } catch {
      // handled via auth context below
    }
  };

  const { token } = useAuth();
  const handleViewAttachment = async (attId: number, fileName: string, mime: string) => {
    try {
      const res = await fetch(`/api/attachments/${attId}/file`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load attachment');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewAttachmentUrl({ url, mime, name: fileName });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    }
  };

  const handleFinalSubmit = async () => {
    if (!submission || !summary || !monitoring) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await apiFetch<{ submission: SubmissionFull }>(`/api/submissions/${submission.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          summary,
          indicators,
          services,
          monitoring,
          corrective_actions: correctiveActions,
          certifications,
        }),
      });
      setSubmission(res.submission);
      dirtyRef.current = false;
      if (onSubmitted) onSubmitted(res.submission);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !submission || !summary || !monitoring) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
        {t('प्रतिवेदन विवरण लोड हुँदैछ...', 'Loading quarterly report...')}
      </div>
    );
  }

  // Merge live edits into submission object for Step 5 live 2-page PDF preview
  const livePreviewSubmission: SubmissionFull = {
    ...submission,
    summary,
    indicators,
    services,
    monitoring,
    corrective_actions: correctiveActions,
    certifications,
  };

  return (
    <div className="space-y-5">
      {/* Top Action Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-[#0F294D] truncate">
                {submission.office.name_np}
              </h2>
              <StatusTag status={submission.status} lang={lang} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('आर्थिक वर्ष:', 'Fiscal Year:')} {submission.fiscal_year_np} · {submission.quarter_name_np} ·{' '}
              {t('अन्तिम मिति:', 'Deadline:')} {toDevanagariDigits(submission.deadline_bs)}
              {saveMessage && <span className="ml-3 text-emerald-700 font-medium">· {saveMessage}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowFullPreviewModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            {t('२-पृष्ठ PDF पूर्वावलोकन', '2-Page PDF Preview')}
          </button>
          {isEditable && (
            <button
              type="button"
              onClick={() => handleSaveDraft(false)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#0F294D] hover:bg-[#173a6b] text-white rounded-md whitespace-nowrap disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? t('सुरक्षित हुँदैछ...', 'Saving...') : t('मस्यौदा सुरक्षित', 'Save Draft')}
            </button>
          )}
        </div>
      </div>

      {/* Returned for correction alert banner */}
      {submission.status === 'Returned for Correction' && submission.feedbacks.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-900">
                {t('केन्द्रबाट सुधारका लागि फिर्ता पठाइएको प्रतिवेदन', 'Returned by NVC Center for Correction')}
              </h4>
              <p className="text-xs text-amber-800 mt-1">
                {t(
                  `केन्द्रबाट ${submission.feedbacks.length} वटा टिप्पणी प्राप्त भएका छन्। कृपया आवश्यक सुधार गरी पुनः प्रमाणित गरेर पेश गर्नुहोस्।`,
                  `${submission.feedbacks.length} feedback comment(s) received. Please revise and resubmit.`
                )}
              </p>
              <div className="mt-2 space-y-1.5">
                {submission.feedbacks.map((fb) => (
                  <div key={fb.id} className="text-xs bg-white/80 border border-amber-200 rounded p-2 text-slate-800">
                    <span className="font-semibold text-[#0F294D]">{fb.author_name_np}:</span> {fb.message}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-step Wizard Stepper */}
      <div className="bg-white border border-slate-200 rounded-lg p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {STEPS.map((st) => {
            const active = step === st.step;
            const passed = step > st.step;
            return (
              <button
                key={st.step}
                type="button"
                onClick={() => setStep(st.step)}
                className={`px-3 py-2.5 rounded-md text-left border transition-colors ${
                  active
                    ? 'bg-[#0F294D] text-white border-[#0F294D]'
                    : passed
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="text-xs font-bold truncate">{lang === 'ne' ? st.np : st.en}</div>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-lg p-3.5 text-xs font-medium">
          {error}
        </div>
      )}

      {/* STEP 1: Section 1 */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-[#0F294D]">
              १. कार्यालय विवरण तथा प्रगति (Section 1)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('कार्यालय प्रोफाइलबाट स्वतः भरिएका विवरण आवश्यक परे सम्पादन गर्न सकिन्छ।', 'Auto-filled from Office Profile; editable if needed.')}
            </p>
          </div>

          {/* 1A */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">१. कार्यालयको नाम *</label>
              <input
                type="text"
                disabled={!isEditable}
                value={summary.office_name}
                onChange={(e) => {
                  dirtyRef.current = true;
                  setSummary({ ...summary, office_name: e.target.value });
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">२. तह/सम्बन्धित मन्त्रालय वा निकाय *</label>
              <input
                type="text"
                disabled={!isEditable}
                value={summary.level_ministry}
                onChange={(e) => {
                  dirtyRef.current = true;
                  setSummary({ ...summary, level_ministry: e.target.value });
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">३. ठेगाना *</label>
              <input
                type="text"
                disabled={!isEditable}
                value={summary.address}
                onChange={(e) => {
                  dirtyRef.current = true;
                  setSummary({ ...summary, address: e.target.value });
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">४. सम्पर्क नं./इमेल *</label>
              <input
                type="text"
                disabled={!isEditable}
                value={summary.contact_info}
                onChange={(e) => {
                  dirtyRef.current = true;
                  setSummary({ ...summary, contact_info: e.target.value });
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md disabled:bg-slate-50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">५. कार्यालय प्रमुख (नाम/पद) *</label>
              <input
                type="text"
                disabled={!isEditable}
                value={summary.office_head}
                onChange={(e) => {
                  dirtyRef.current = true;
                  setSummary({ ...summary, office_head: e.target.value });
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md disabled:bg-slate-50"
              />
            </div>
          </div>

          {/* 1B */}
          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-sm font-bold text-[#0F294D] mb-3">
              B. कार्यालयको सार्वजनिक सेवा तथा निवेदन ढाँचाको समष्टिगत तथ्याङ्क
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(
                [
                  ['total_services', '१. कुल सार्वजनिक सेवाको सङ्ख्या'],
                  ['prepared_forms', '२. ढाँचा तयार भएको सङ्ख्या'],
                  ['approved_forms', '३. स्वीकृत भएको ढाँचाको सङ्ख्या'],
                  ['in_use_forms', '४. प्रयोगमा आएको ढाँचाको सङ्ख्या'],
                  ['free_available_forms', '५. निःशुल्क उपलब्ध ढाँचाको सङ्ख्या'],
                  ['digital_available_forms', '६. वेबसाइटमा/डिजिटल Format मा उपलब्ध सङ्ख्या'],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    disabled={!isEditable}
                    value={summary[field]}
                    onChange={(e) => {
                      dirtyRef.current = true;
                      const val = Math.max(0, Math.floor(Number(e.target.value) || 0));
                      setSummary({ ...summary, [field]: val });
                    }}
                    className="w-full px-3 py-2 text-base font-mono font-bold text-[#0F294D] bg-white border border-slate-300 rounded-md tabular-nums disabled:bg-slate-100"
                  />
                </div>
              ))}
            </div>

            {sec1Validation.errors.length > 0 && (
              <div className="mt-4 p-3 rounded border border-red-200 bg-red-50 space-y-1">
                {sec1Validation.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-800 font-medium">
                    • {err}
                  </p>
                ))}
              </div>
            )}
            {sec1Validation.warnings.length > 0 && (
              <div className="mt-3 p-3 rounded border border-amber-200 bg-amber-50 space-y-1">
                {sec1Validation.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-800 font-medium">
                    • {w}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: Section 2 (9 Mandatory Indicators) */}
      {step === 2 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 space-y-5">
          <div>
            <h3 className="text-base font-bold text-[#0F294D]">२. निर्देशिका कार्यान्वयनको अवस्था (९ अनिवार्य सूचक)</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              हरेक विषयमा लागू अवस्था छान्नुहोस्; आंशिक/नभएको अवस्थामा समस्या वा कैफियत लेख्नुहोस्।
            </p>
          </div>

          <div className="space-y-4">
            {OFFICIAL_INDICATORS.map((ind) => {
              const resp = indicators.find((r) => r.indicator_no === ind.indicator_no) || {
                indicator_id: ind.id,
                indicator_no: ind.indicator_no,
                status: '' as IndicatorStatus | '',
                remarks: '',
                evidence_details: '',
              };

              const updateInd = (patch: Partial<IndicatorResponse>) => {
                dirtyRef.current = true;
                setIndicators((prev) =>
                  prev.map((item) => (item.indicator_no === ind.indicator_no ? { ...item, ...patch } : item))
                );
              };

              const indAttachments = submission.attachments.filter((a) => a.indicator_no === ind.indicator_no);

              return (
                <div key={ind.indicator_no} className="border border-slate-200 rounded-lg p-4 bg-slate-50/40">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-2.5">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#0F294D] text-white text-xs font-bold shrink-0 mt-0.5">
                          {toDevanagariDigits(ind.indicator_no)}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{ind.title_np}</p>
                          {lang === 'en' && <p className="text-xs text-slate-500 mt-0.5">{ind.title_en}</p>}
                        </div>
                      </div>
                    </div>

                    {/* 3 Status Options */}
                    <div className="flex items-center gap-2 shrink-0">
                      {(['पूर्ण', 'आंशिक', 'छैन'] as IndicatorStatus[]).map((opt) => {
                        const selected = resp.status === opt;
                        const activeCls =
                          opt === 'पूर्ण'
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : opt === 'आंशिक'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-red-700 text-white border-red-700';
                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={!isEditable}
                            onClick={() => updateInd({ status: opt })}
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded border transition-colors whitespace-nowrap ${
                              selected ? activeCls : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            } disabled:opacity-70`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200/80">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        कैफियत {resp.status === 'आंशिक' || resp.status === 'छैन' ? '(समस्या/कारण अनिवार्य खुलाउनुहोस्)' : ''}
                      </label>
                      <textarea
                        rows={2}
                        disabled={!isEditable}
                        value={resp.remarks}
                        onChange={(e) => updateInd({ remarks: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white disabled:bg-slate-50"
                        placeholder="कार्यान्वयन अवस्था वा समस्या/कारण..."
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">प्रमाणको विवरण / लिङ्क</label>
                      <textarea
                        rows={2}
                        disabled={!isEditable}
                        value={resp.evidence_details}
                        onChange={(e) => updateInd({ evidence_details: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white disabled:bg-slate-50"
                        placeholder="अभिलेख नं., वेबसाइट लिङ्क वा प्रमाणको विवरण..."
                      />
                    </div>
                  </div>

                  {/* Optional indicator evidence upload */}
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {indAttachments.map((att) => (
                        <span key={att.id} className="inline-flex items-center gap-1.5 text-xs bg-white border border-slate-200 px-2 py-1 rounded">
                          <FileText className="w-3.5 h-3.5 text-[#0F294D]" />
                          <button
                            type="button"
                            onClick={() => handleViewAttachment(att.id, att.file_name, att.mime_type)}
                            className="hover:underline font-medium text-slate-700"
                          >
                            {att.file_name}
                          </button>
                          {isEditable && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="text-red-600 hover:text-red-800 ml-1"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                    {isEditable && (
                      <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium border border-slate-300 rounded bg-white hover:bg-slate-50 cursor-pointer text-slate-700">
                        <Upload className="w-3 h-3" />
                        <span>{t('सूचक प्रमाण Upload', 'Upload Indicator Proof')}</span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, ind.indicator_no, `indicator_${ind.indicator_no}`)}
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2">
            <label className="block text-sm font-bold text-[#0F294D] mb-1.5">
              मुख्य उपलब्धि वा बाँकी सुधार (संक्षेपमा)
            </label>
            <textarea
              rows={4}
              disabled={!isEditable}
              value={summary.major_achievements}
              onChange={(e) => {
                dirtyRef.current = true;
                setSummary({ ...summary, major_achievements: e.target.value });
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md disabled:bg-slate-50"
              placeholder="यस त्रैमासिकका मुख्य उपलब्धिहरू तथा सुधार गर्न बाँकी विषयहरू संक्षेपमा उल्लेख गर्नुहोस्..."
            />
          </div>
        </div>
      )}

      {/* STEP 3: Section 3 (Dynamic Services Table) */}
      {step === 3 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#0F294D]">
                ३. सेवा अनुसार निवेदन ढाँचा तथा निवेदन/सेवा प्रवाहको तथ्याङ्क
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                हरेक सेवा छुट्टै पङ्क्तिमा भर्नुहोस्। संख्या कार्यालयको अभिलेखअनुसार; समयसीमा नागरिक बडापत्रअनुसार खुलाउनुहोस्।
              </p>
            </div>
            {isEditable && (
              <button
                type="button"
                onClick={() => {
                  dirtyRef.current = true;
                  setServices((prev) => [
                    ...prev,
                    {
                      serial_no: prev.length + 1,
                      service_name: '',
                      is_prepared: false,
                      is_approved: false,
                      is_in_use: false,
                      approval_date: '',
                      is_free: false,
                      is_notice_board: false,
                      is_website: false,
                      website_url: '',
                      received_count: 0,
                      disposed_count: 0,
                      pending_count: 0,
                      returned_count: 0,
                      within_deadline_count: 0,
                      prescribed_timeline: '',
                      remarks: '',
                    },
                  ]);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F294D] hover:bg-[#173a6b] text-white text-xs font-semibold rounded-md whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                {t('सेवा थप्नुहोस् (Add Service)', 'Add Service Row')}
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-md">
            <table className="w-full text-xs border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-[#0F294D] text-white">
                  <th className="p-2 border-r border-white/15 w-12 text-center">क्र.सं.</th>
                  <th className="p-2 border-r border-white/15 text-left w-48">सेवाको नाम</th>
                  <th className="p-2 border-r border-white/15 text-left w-48">निवेदन ढाँचाको स्थिति / स्वीकृति मिति</th>
                  <th className="p-2 border-r border-white/15 text-left w-48">उपलब्धता (निःशुल्क/सूचनापाटी/वेबसाइट)</th>
                  <th className="p-2 border-r border-white/15 text-center w-64">निवेदन संख्या (प्राप्त / फर्छ्योट / बाँकी / फिर्ता)</th>
                  <th className="p-2 border-r border-white/15 text-left w-64">समयसीमा तथा कारण/कैफियत</th>
                  {isEditable && <th className="p-2 w-12 text-center">कार्य</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {services.map((sv, idx) => {
                  const updateSvc = (patch: Partial<ServiceDetail>) => {
                    dirtyRef.current = true;
                    setServices((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
                  };
                  const mathSum = (sv.disposed_count || 0) + (sv.pending_count || 0) + (sv.returned_count || 0);
                  const mathMismatch = sv.service_name.trim() && (sv.received_count || 0) !== mathSum;
                  const withinError = sv.service_name.trim() && (sv.within_deadline_count || 0) > (sv.disposed_count || 0);

                  return (
                    <tr key={idx} className={mathMismatch || withinError ? 'bg-red-50/40' : 'hover:bg-slate-50/60'}>
                      <td className="p-2 text-center font-bold text-slate-700 align-top">
                        {toDevanagariDigits(idx + 1)}
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="text"
                          disabled={!isEditable}
                          value={sv.service_name}
                          onChange={(e) => updateSvc({ service_name: e.target.value })}
                          placeholder="सेवाको नाम..."
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                        />
                      </td>
                      <td className="p-2 align-top space-y-1.5">
                        <div className="flex flex-wrap gap-2">
                          {(
                            [
                              ['is_prepared', 'तयार'],
                              ['is_approved', 'स्वीकृत'],
                              ['is_in_use', 'प्रयोग'],
                            ] as const
                          ).map(([k, lbl]) => (
                            <label key={k} className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                disabled={!isEditable}
                                checked={sv[k]}
                                onChange={(e) => updateSvc({ [k]: e.target.checked })}
                              />
                              <span>{lbl}</span>
                            </label>
                          ))}
                        </div>
                        <input
                          type="text"
                          disabled={!isEditable}
                          value={sv.approval_date}
                          onChange={(e) => updateSvc({ approval_date: e.target.value })}
                          placeholder="स्वीकृति मिति (२०८३/०५/१०)"
                          className="w-full px-2 py-1 border border-slate-300 rounded text-[11px]"
                        />
                      </td>
                      <td className="p-2 align-top space-y-1.5">
                        <div className="flex flex-wrap gap-2">
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              disabled={!isEditable}
                              checked={sv.is_free}
                              onChange={(e) => updateSvc({ is_free: e.target.checked })}
                            />
                            <span>निःशुल्क</span>
                          </label>
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              disabled={!isEditable}
                              checked={sv.is_notice_board}
                              onChange={(e) => updateSvc({ is_notice_board: e.target.checked })}
                            />
                            <span>बोर्ड</span>
                          </label>
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              disabled={!isEditable}
                              checked={sv.is_website}
                              onChange={(e) => updateSvc({ is_website: e.target.checked })}
                            />
                            <span>वेबसाइट</span>
                          </label>
                        </div>
                        <input
                          type="text"
                          disabled={!isEditable}
                          value={sv.website_url}
                          onChange={(e) => updateSvc({ website_url: e.target.value })}
                          placeholder="वेबसाइट URL (ऐच्छिक)"
                          className="w-full px-2 py-1 border border-slate-300 rounded text-[11px]"
                        />
                      </td>
                      <td className="p-2 align-top">
                        <div className="grid grid-cols-4 gap-1">
                          {(
                            [
                              ['received_count', 'प्राप्त'],
                              ['disposed_count', 'फर्छ्योट'],
                              ['pending_count', 'बाँकी'],
                              ['returned_count', 'फिर्ता'],
                            ] as const
                          ).map(([k, lbl]) => (
                            <div key={k}>
                              <span className="block text-[10px] text-slate-500 text-center mb-0.5">{lbl}</span>
                              <input
                                type="number"
                                min={0}
                                disabled={!isEditable}
                                value={sv[k]}
                                onChange={(e) =>
                                  updateSvc({ [k]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                                }
                                className="w-full px-1.5 py-1 border border-slate-300 rounded text-center font-mono tabular-nums"
                              />
                            </div>
                          ))}
                        </div>
                        {mathMismatch && (
                          <p className="text-[10px] text-red-700 font-semibold mt-1">
                            प्राप्त ({sv.received_count}) ≠ योग ({mathSum})
                          </p>
                        )}
                      </td>
                      <td className="p-2 align-top space-y-1.5">
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <span className="block text-[10px] text-slate-500">समयसीमाभित्र फर्छ्योट</span>
                            <input
                              type="number"
                              min={0}
                              disabled={!isEditable}
                              value={sv.within_deadline_count}
                              onChange={(e) =>
                                updateSvc({
                                  within_deadline_count: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                                })
                              }
                              className="w-full px-2 py-1 border border-slate-300 rounded font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-500">तोकिएको समयसीमा</span>
                            <input
                              type="text"
                              disabled={!isEditable}
                              value={sv.prescribed_timeline}
                              onChange={(e) => updateSvc({ prescribed_timeline: e.target.value })}
                              placeholder="उदा: सोही दिन / ३ दिन"
                              className="w-full px-2 py-1 border border-slate-300 rounded text-[11px]"
                            />
                          </div>
                        </div>
                        <input
                          type="text"
                          disabled={!isEditable}
                          value={sv.remarks}
                          onChange={(e) => updateSvc({ remarks: e.target.value })}
                          placeholder="बाँकी/फिर्ताको कारण तथा कैफियत..."
                          className="w-full px-2 py-1 border border-slate-300 rounded text-[11px]"
                        />
                        {withinError && (
                          <p className="text-[10px] text-red-700 font-semibold">
                            समयसीमाभित्र फर्छ्योट कुल फर्छ्योटभन्दा बढी छ!
                          </p>
                        )}
                      </td>
                      {isEditable && (
                        <td className="p-2 text-center align-top">
                          <button
                            type="button"
                            onClick={() => {
                              dirtyRef.current = true;
                              setServices((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            disabled={services.length <= 1}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-30"
                            title="Remove row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {/* Automatic Total Row */}
                <tr className="bg-slate-100 font-bold text-[#0F294D] tabular-nums">
                  <td colSpan={4} className="p-2.5 text-right border-t-2 border-slate-300">
                    जम्मा (स्वतः गणना):
                  </td>
                  <td className="p-2.5 text-center border-t-2 border-slate-300">
                    {toDevanagariDigits(serviceTotals.received)} / {toDevanagariDigits(serviceTotals.disposed)} /{' '}
                    {toDevanagariDigits(serviceTotals.pending)} / {toDevanagariDigits(serviceTotals.returned)}
                  </td>
                  <td colSpan={isEditable ? 2 : 1} className="p-2.5 border-t-2 border-slate-300">
                    समयसीमाभित्र फर्छ्योट: {toDevanagariDigits(serviceTotals.within)} (
                    {serviceTotals.disposed > 0
                      ? `${toDevanagariDigits(serviceTotals.withinPct.toFixed(1))}%`
                      : '०% — कुल फर्छ्योट शून्य भएकाले दर गणना गर्न नसकिने'}
                    )
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {serviceTotals.rowErrors.length > 0 && (
            <div className="p-3 rounded border border-red-200 bg-red-50 space-y-1">
              {serviceTotals.rowErrors.map((err, i) => (
                <p key={i} className="text-xs text-red-800 font-medium">
                  • {err}
                </p>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-600">
            तोकिएको समयसीमा कार्यालयको नागरिक बडापत्र/प्रचलित व्यवस्थाअनुसार लेख्नुहोस्। बाँकी निवेदन र अस्वीकृत/फिर्ताका कारण कैफियतमा खुलाउनुहोस्।
          </p>
        </div>
      )}

      {/* STEP 4: Section 4A & 4B */}
      {step === 4 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 space-y-6">
          <h3 className="text-base font-bold text-[#0F294D]">४. अनुगमन, सुधारात्मक कार्य र संलग्न प्रमाण</h3>

          {/* 4A Part 1 */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-4">
            <h4 className="text-sm font-bold text-[#0F294D]">
              A.१ यस त्रैमासिकको आन्तरिक समीक्षा/अनुगमन (मिति/निष्कर्ष) तथा अघिल्लो प्रतिवेदन वा केन्द्रको सुझाव/निर्देशनको अवस्था
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">अनुगमन मिति (वि.सं.)</label>
                <input
                  type="text"
                  disabled={!isEditable}
                  value={monitoring.monitoring_date}
                  onChange={(e) => {
                    dirtyRef.current = true;
                    setMonitoring({ ...monitoring, monitoring_date: e.target.value });
                  }}
                  placeholder="२०८३/०७/२२"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">अघिल्लो प्रतिवेदनको अवस्था</label>
                <input
                  type="text"
                  disabled={!isEditable}
                  value={monitoring.previous_report_status}
                  onChange={(e) => {
                    dirtyRef.current = true;
                    setMonitoring({ ...monitoring, previous_report_status: e.target.value });
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">अनुगमनको निष्कर्ष</label>
                <textarea
                  rows={2}
                  disabled={!isEditable}
                  value={monitoring.monitoring_conclusion}
                  onChange={(e) => {
                    dirtyRef.current = true;
                    setMonitoring({ ...monitoring, monitoring_conclusion: e.target.value });
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">केन्द्रको सुझाव/निर्देशनको अवस्था</label>
                <textarea
                  rows={2}
                  disabled={!isEditable}
                  value={monitoring.center_directive_status}
                  onChange={(e) => {
                    dirtyRef.current = true;
                    setMonitoring({ ...monitoring, center_directive_status: e.target.value });
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">गरिएको सुधारको विवरण</label>
                <textarea
                  rows={2}
                  disabled={!isEditable}
                  value={monitoring.improvements_made}
                  onChange={(e) => {
                    dirtyRef.current = true;
                    setMonitoring({ ...monitoring, improvements_made: e.target.value });
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
            </div>
          </div>

          {/* 4A Part 2: Corrective Actions */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-[#0F294D]">
                A.२ मुख्य समस्या/कारण; सुधारात्मक कदम, जिम्मेवार व्यक्ति/शाखा, समयसीमा र आवश्यक सहजीकरण
              </h4>
              {isEditable && (
                <button
                  type="button"
                  onClick={() => {
                    dirtyRef.current = true;
                    setCorrectiveActions((prev) => [
                      ...prev,
                      {
                        main_problem: '',
                        root_cause: '',
                        corrective_step: '',
                        responsible_person: '',
                        responsible_unit: '',
                        target_deadline: '',
                        expected_facilitation: '',
                        remarks: '',
                      },
                    ]);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded hover:bg-slate-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('थप सुधारात्मक कार्य', 'Add Action')}
                </button>
              )}
            </div>

            {correctiveActions.map((ca, idx) => {
              const updCA = (patch: Partial<CorrectiveAction>) => {
                dirtyRef.current = true;
                setCorrectiveActions((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
              };
              return (
                <div key={idx} className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-md grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">मुख्य समस्या</label>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={ca.main_problem}
                      onChange={(e) => updCA({ main_problem: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">समस्या उत्पन्न हुनुको कारण</label>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={ca.root_cause}
                      onChange={(e) => updCA({ root_cause: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">सुधारात्मक कदम</label>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={ca.corrective_step}
                      onChange={(e) => updCA({ corrective_step: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">जिम्मेवार व्यक्ति</label>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={ca.responsible_person}
                      onChange={(e) => updCA({ responsible_person: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">जिम्मेवार शाखा</label>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={ca.responsible_unit}
                      onChange={(e) => updCA({ responsible_unit: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">सुधार सम्पन्न गर्ने समयसीमा</label>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={ca.target_deadline}
                      onChange={(e) => updCA({ target_deadline: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">केन्द्रबाट अपेक्षित सहजीकरण</label>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={ca.expected_facilitation}
                      onChange={(e) => updCA({ expected_facilitation: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">कैफियत</label>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={ca.remarks}
                      onChange={(e) => updCA({ remarks: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 4B Attachments & Privacy Notice */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-4">
            <h4 className="text-sm font-bold text-[#0F294D]">B. संलग्न प्रमाण</h4>
            <div className="flex flex-wrap gap-4 text-xs">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isEditable}
                  checked={monitoring.evidence_approved_sample}
                  onChange={(e) => {
                    dirtyRef.current = true;
                    setMonitoring({ ...monitoring, evidence_approved_sample: e.target.checked });
                  }}
                />
                <span>१. स्वीकृत ढाँचाको नमुना</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isEditable}
                  checked={monitoring.evidence_website_notice}
                  onChange={(e) => {
                    dirtyRef.current = true;
                    setMonitoring({ ...monitoring, evidence_website_notice: e.target.checked });
                  }}
                />
                <span>२. वेबसाइट/सूचनापाटीको प्रमाण</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isEditable}
                  checked={monitoring.evidence_service_record}
                  onChange={(e) => {
                    dirtyRef.current = true;
                    setMonitoring({ ...monitoring, evidence_service_record: e.target.checked });
                  }}
                />
                <span>३. सेवा प्रवाहको समष्टिगत अभिलेख</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isEditable}
                  checked={monitoring.evidence_other}
                  onChange={(e) => {
                    dirtyRef.current = true;
                    setMonitoring({ ...monitoring, evidence_other: e.target.checked });
                  }}
                />
                <span>४. अन्य</span>
              </label>
            </div>

            {monitoring.evidence_other && (
              <input
                type="text"
                disabled={!isEditable}
                value={monitoring.evidence_other_text}
                onChange={(e) => {
                  dirtyRef.current = true;
                  setMonitoring({ ...monitoring, evidence_other_text: e.target.value });
                }}
                placeholder="अन्य प्रमाणको विवरण लेख्नुहोस्..."
                className="w-full max-w-md px-3 py-1.5 text-xs border border-slate-300 rounded"
              />
            )}

            {/* Mandatory Privacy Notice */}
            <div className="p-3.5 rounded-md border border-red-300 bg-red-50 flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
              <div className="text-xs text-red-900">
                <p className="font-bold">व्यक्तिगत सेवाग्राहीको संवेदनशील पहिचान खुल्ने कागजात नपठाउनुहोस्।</p>
                <p className="mt-0.5 text-red-800">
                  नागरिकता, राहदानी, वा व्यक्तिगत निवेदकको गोप्य विवरण अपलोड गर्न निषेध छ। केवल समष्टिगत अभिलेख, स्वीकृत ढाँचाको नमुना वा सूचनापाटीको प्रमाण (PDF, JPG, JPEG, PNG — अधिकतम ५ MB) मात्र संलग्न गर्नुहोस्।
                </p>
              </div>
            </div>

            {isEditable && (
              <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-md">
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                >
                  <option value="approved_sample">स्वीकृत ढाँचाको नमुना</option>
                  <option value="website_notice">वेबसाइट/सूचनापाटी प्रमाण</option>
                  <option value="service_record">सेवा प्रवाहको समष्टिगत अभिलेख</option>
                  <option value="signed_copy">हस्ताक्षरित/छाप लागेको प्रतिवेदन</option>
                  <option value="other">अन्य</option>
                </select>
                <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0F294D] text-white text-xs font-semibold rounded cursor-pointer hover:bg-[#173a6b]">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t('फाइल छान्नुहोस् (PDF/JPG/PNG)', 'Choose Files (PDF/JPG/PNG)')}</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, uploadIndicatorNo, uploadCategory)}
                  />
                </label>
                {uploading && (
                  <div className="flex items-center gap-2 text-xs text-[#0F294D] font-medium">
                    <div className="w-28 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0F294D]" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <span>{uploadProgress}%</span>
                  </div>
                )}
              </div>
            )}

            {/* Uploaded Attachments List */}
            {submission.attachments.length > 0 && (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                {submission.attachments.map((att) => (
                  <div key={att.id} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-[#0F294D] shrink-0" />
                      <span className="font-medium text-slate-800 truncate">{att.file_name}</span>
                      <span className="text-slate-400 shrink-0">· {(att.file_size / 1024).toFixed(1)} KB</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleViewAttachment(att.id, att.file_name, att.mime_type)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {t('हेर्नुहोस्', 'Preview')}
                      </button>
                      {isEditable && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 5: Certification & Full 2-Page Preview */}
      {step === 5 && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-bold text-[#0F294D]">C. प्रतिवेदन प्रमाणीकरण (तीन तहको प्रमाणीकरण)</h3>
            <p className="text-xs text-slate-600">
              कार्यालय प्रमुख वा अधिकारप्राप्त अधिकारीबाट अन्तिम प्रमाणीकरण नभएसम्म प्रतिवेदन Final Submit हुन सक्दैन।
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {(
                [
                  { tier: 'preparer', title: '१. प्रतिवेदन तयार गर्ने' },
                  { tier: 'reviewer', title: '२. जाँच/सिफारिस गर्ने' },
                  { tier: 'head', title: '३. कार्यालय प्रमुखबाट प्रमाणित *' },
                ] as const
              ).map(({ tier, title }) => {
                const cert = certifications.find((c) => c.tier === tier)!;
                const updCert = (patch: Partial<CertificationTier>) => {
                  dirtyRef.current = true;
                  setCertifications((prev) => prev.map((c) => (c.tier === tier ? { ...c, ...patch } : c)));
                };
                return (
                  <div key={tier} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
                    <h4 className="text-xs font-bold text-[#0F294D]">{title}</h4>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">नाम / पद</label>
                      <input
                        type="text"
                        disabled={!isEditable}
                        value={cert.name_designation}
                        onChange={(e) => updCert({ name_designation: e.target.value })}
                        placeholder="नाम र पद..."
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">हस्ताक्षर / डिजिटल स्वीकृति विवरण</label>
                      <input
                        type="text"
                        disabled={!isEditable}
                        value={cert.signature_text}
                        onChange={(e) => updCert({ signature_text: e.target.value })}
                        placeholder="डिजिटल हस्ताक्षर / नाम..."
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">मिति (वि.सं.)</label>
                      <input
                        type="text"
                        disabled={!isEditable}
                        value={cert.signed_date}
                        onChange={(e) => updCert({ signed_date: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                      />
                    </div>
                    {tier === 'head' && (
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!isEditable}
                          checked={cert.office_stamp_confirmed}
                          onChange={(e) => updCert({ office_stamp_confirmed: e.target.checked })}
                        />
                        <span>कार्यालयको छाप प्रमाणित</span>
                      </label>
                    )}
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#0F294D] cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!isEditable}
                        checked={cert.digital_pin_verified}
                        onChange={(e) => updCert({ digital_pin_verified: e.target.checked })}
                      />
                      <span>Electronic Approval / Digital Signature प्रमाणित</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-sm font-bold text-[#0F294D]">पूर्ण प्रतिवेदन पूर्वावलोकन (मूल २-पृष्ठ ढाँचा)</h3>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F294D] text-white text-xs font-semibold rounded hover:bg-[#173a6b]"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Download PDF
              </button>
            </div>
            <OfficialReportPreview submission={livePreviewSubmission} embedded />
          </div>
        </div>
      )}

      {/* STEP 6: Final Submit */}
      {step === 6 && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <div>
            <h3 className="text-lg font-bold text-[#0F294D]">{t('६. अन्तिम प्रतिवेदन पेश (Final Submission)', '6. Final Report Submission')}</h3>
            <p className="text-xs text-slate-600 mt-1">
              {t(
                'अन्तिम पेश गर्नुअघि सबै खण्डको Validation तथा कार्यालय प्रमुखको प्रमाणीकरण जाँच गर्नुहोस्।',
                'Verify all section validations and Office Head certification before final submission.'
              )}
            </p>
          </div>

          {readiness.length === 0 ? (
            <div className="p-4 rounded-md border border-emerald-300 bg-emerald-50 flex items-center gap-3 text-emerald-900 text-sm font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>
                {t(
                  'सबै अनिवार्य विवरण, गणितीय तालमेल तथा कार्यालय प्रमुखको प्रमाणीकरण पूरा भएको छ। प्रतिवेदन पेश गर्न तयार छ।',
                  'All mandatory fields, mathematical checks, and Office Head certification are complete. Ready to submit.'
                )}
              </span>
            </div>
          ) : (
            <div className="p-4 rounded-md border border-red-200 bg-red-50 space-y-1.5">
              <p className="text-xs font-bold text-red-900">
                {t('अन्तिम पेश गर्नुअघि निम्न त्रुटिहरू सच्याउनुहोस्:', 'Resolve these issues before final submission:')}
              </p>
              {readiness.map((issue, idx) => (
                <p key={idx} className="text-xs text-red-800">
                  • {issue}
                </p>
              ))}
            </div>
          )}

          {isEditable && (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleSaveDraft(false)}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Save className="w-4 h-4" />
                {t('मस्यौदा सुरक्षित गर्नुहोस्', 'Save Draft')}
              </button>
              <button
                type="button"
                disabled={readiness.length > 0 || submitting}
                onClick={handleFinalSubmit}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F294D] hover:bg-[#173a6b] text-white rounded-md text-sm font-bold disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {submitting
                  ? t('पेश हुँदैछ...', 'Submitting...')
                  : submission.status === 'Returned for Correction'
                  ? t('सुधार गरी पुनः पेश गर्नुहोस् (Resubmit)', 'Resubmit Revised Report')
                  : t('अन्तिम प्रतिवेदन पेश गर्नुहोस् (Final Submit)', 'Final Submit Report')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Wizard Footer Prev / Next */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 bg-white rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t('अघिल्लो खण्ड', 'Previous')}
        </button>
        <button
          type="button"
          disabled={step === 6}
          onClick={() => {
            if (dirtyRef.current && isEditable) handleSaveDraft(true);
            setStep((s) => Math.min(6, s + 1));
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F294D] text-white rounded-md text-xs font-semibold hover:bg-[#173a6b] disabled:opacity-40"
        >
          {t('अर्को खण्ड', 'Next')}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Modals */}
      {showFullPreviewModal && (
        <OfficialReportPreview submission={livePreviewSubmission} onClose={() => setShowFullPreviewModal(false)} />
      )}
      {previewAttachmentUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-[#0F294D] text-white flex items-center justify-between text-xs font-bold">
              <span>{previewAttachmentUrl.name}</span>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(previewAttachmentUrl.url);
                  setPreviewAttachmentUrl(null);
                }}
                className="px-2 py-1 bg-white/10 rounded hover:bg-white/20"
              >
                {t('बन्द गर्नुहोस्', 'Close')}
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-100 flex items-center justify-center">
              {previewAttachmentUrl.mime.includes('pdf') ? (
                <iframe src={previewAttachmentUrl.url} className="w-full h-[65vh] border-0 bg-white" title="Attachment Preview" />
              ) : (
                <img src={previewAttachmentUrl.url} alt={previewAttachmentUrl.name} className="max-h-[65vh] object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
