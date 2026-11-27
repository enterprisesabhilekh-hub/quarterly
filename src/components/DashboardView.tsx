import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Filter, RotateCcw, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useI18n } from '../context/I18nContext.tsx';
import { DashboardAnalytics, DashboardFilters, GovtLevel, SubmissionListItem, SubmissionStatus } from '../types/index.ts';
import { formatNum, formatPct, toDevanagariDigits } from '../utils/nepaliDate.ts';
import { NepalMap } from './NepalMap.tsx';
import { StatusTag } from './NvcLogo.tsx';

interface Props {
  onOpenSubmission: (submissionId: number) => void;
}

const DEFAULT_FILTERS: DashboardFilters = {
  fiscalYearIds: [2],
  quarterNumbers: [1],
  dateFrom: '',
  dateTo: '',
  govtLevels: [],
  ministryIds: [],
  departmentIds: [],
  provinceIds: [],
  districtIds: [],
  localLevelIds: [],
  officeTypes: [],
  officeIds: [],
  statuses: [],
  implState: '',
  indicatorNo: null,
};

export function DashboardView({ onOpenSubmission }: Props) {
  const { master, apiFetch, apiDownload } = useAuth();
  const { lang, t } = useI18n();

  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kpiDrawer, setKpiDrawer] = useState<{ title: string; list: SubmissionListItem[] } | null>(null);
  const [activeSectionTab, setActiveSectionTab] = useState<'overview' | 'ministry' | 'indicators' | 'services' | 'trends'>('overview');

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.fiscalYearIds.length) p.set('fiscalYearIds', filters.fiscalYearIds.join(','));
    if (filters.quarterNumbers.length) p.set('quarterNumbers', filters.quarterNumbers.join(','));
    if (filters.dateFrom) p.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) p.set('dateTo', filters.dateTo);
    if (filters.govtLevels.length) p.set('govtLevels', filters.govtLevels.join(','));
    if (filters.ministryIds.length) p.set('ministryIds', filters.ministryIds.join(','));
    if (filters.departmentIds.length) p.set('departmentIds', filters.departmentIds.join(','));
    if (filters.provinceIds.length) p.set('provinceIds', filters.provinceIds.join(','));
    if (filters.districtIds.length) p.set('districtIds', filters.districtIds.join(','));
    if (filters.localLevelIds.length) p.set('localLevelIds', filters.localLevelIds.join(','));
    if (filters.officeTypes.length) p.set('officeTypes', filters.officeTypes.join(','));
    if (filters.officeIds.length) p.set('officeIds', filters.officeIds.join(','));
    if (filters.statuses.length) p.set('statuses', filters.statuses.join(','));
    if (filters.implState) p.set('implState', filters.implState);
    if (filters.indicatorNo) p.set('indicatorNo', String(filters.indicatorNo));
    return p.toString();
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch<DashboardAnalytics>(`/api/analytics/dashboard?${queryString}`)
      .then((data) => {
        if (!cancelled) {
          setAnalytics(data);
          setError('');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load analytics');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const toggleArr = <T,>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const officeTypesUnique = useMemo(() => {
    if (!master) return [];
    return Array.from(new Set(master.offices.map((o) => o.office_type_np)));
  }, [master]);

  const kpiCards = useMemo(() => {
    if (!analytics) return [];
    const k = analytics.kpis;
    const lists = analytics.officeListsByKpi;
    return [
      { key: 'total', np: 'प्रणालीमा आबद्ध कुल कार्यालय', en: 'Total Registered Offices', val: formatNum(k.totalOffices, lang), list: lists.all },
      { key: 'req', np: 'प्रतिवेदन पेश गर्नुपर्ने कार्यालय', en: 'Required Reporting Offices', val: formatNum(k.requiredReportingOffices, lang), list: lists.all },
      { key: 'sub', np: 'प्रतिवेदन पेश गरेका कार्यालय', en: 'Submitted Offices', val: formatNum(k.submittedOffices, lang), list: lists.submitted, accent: 'text-emerald-700' },
      { key: 'nosub', np: 'प्रतिवेदन पेश नगरेका कार्यालय', en: 'Not Submitted Offices', val: formatNum(k.notSubmittedOffices, lang), list: lists.notSubmitted, accent: 'text-red-700' },
      { key: 'pend', np: 'समीक्षा हुन बाँकी प्रतिवेदन', en: 'Pending Review Reports', val: formatNum(k.pendingReviewCount, lang), list: lists.pendingReview, accent: 'text-indigo-700' },
      { key: 'rev', np: 'समीक्षा सम्पन्न प्रतिवेदन', en: 'Reviewed / Accepted Reports', val: formatNum(k.reviewedCompletedCount, lang), list: lists.reviewedCompleted, accent: 'text-teal-700' },
      { key: 'ret', np: 'सुधारका लागि फिर्ता भएका', en: 'Returned for Correction', val: formatNum(k.returnedForCorrectionCount, lang), list: lists.returned, accent: 'text-amber-700' },
      { key: 'timely', np: 'समयसीमाभित्र पेश गरेका', en: 'Submitted On Time', val: formatNum(k.timelySubmittedCount, lang), list: lists.timely },
      { key: 'late', np: 'ढिलाइ गरी पेश गरेका', en: 'Late Submissions', val: formatNum(k.lateSubmittedCount, lang), list: lists.late, accent: 'text-red-700' },
      { key: 'avg', np: 'औसत कार्यान्वयन प्रतिशत', en: 'Avg Implementation %', val: formatPct(k.avgImplementationPct, lang), list: lists.submitted, accent: 'text-[#0F294D]' },
    ];
  }, [analytics, lang]);

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Fiscal Year Multi-toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
              {master?.fiscal_years.map((fy) => {
                const active = filters.fiscalYearIds.includes(fy.id);
                return (
                  <button
                    key={fy.id}
                    type="button"
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        fiscalYearIds: f.fiscalYearIds.includes(fy.id) && f.fiscalYearIds.length > 1
                          ? f.fiscalYearIds.filter((id) => id !== fy.id)
                          : toggleArr(f.fiscalYearIds, fy.id),
                      }))
                    }
                    className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap transition-colors ${
                      active ? 'bg-white text-[#0F294D] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t('आ.व.', 'FY')} {lang === 'ne' ? fy.name_np : fy.code}
                  </button>
                );
              })}
            </div>

            {/* Quarter Multi-toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
              {[
                { q: 1, np: 'पहिलो त्रैमासिक', en: 'Q1' },
                { q: 2, np: 'दोस्रो', en: 'Q2' },
                { q: 3, np: 'तेस्रो', en: 'Q3' },
                { q: 4, np: 'चौथो', en: 'Q4' },
              ].map((item) => {
                const active = filters.quarterNumbers.includes(item.q);
                return (
                  <button
                    key={item.q}
                    type="button"
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        quarterNumbers:
                          f.quarterNumbers.includes(item.q) && f.quarterNumbers.length > 1
                            ? f.quarterNumbers.filter((x) => x !== item.q)
                            : toggleArr(f.quarterNumbers, item.q),
                      }))
                    }
                    className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap transition-colors ${
                      active ? 'bg-white text-[#0F294D] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lang === 'ne' ? item.np : item.en}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((s) => !s)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
            >
              <Filter className="w-3.5 h-3.5" />
              {showAdvancedFilters ? t('फिल्टर लुकाउनुहोस्', 'Hide Filters') : t('उन्नत फिल्टर (१४ सूचक)', 'Advanced Filters')}
            </button>
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('रिसेट', 'Reset')}
            </button>
            <button
              type="button"
              onClick={() => apiDownload(`/api/export/excel?type=office_status&${queryString}`, 'nvc_national_report.xlsx')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0F294D] text-white rounded-md hover:bg-[#173a6b] whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              {t('Excel निर्यात', 'Export Excel')}
            </button>
          </div>
        </div>

        {/* Advanced 14-Field Multi-Filter Grid */}
        {showAdvancedFilters && master && (
          <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">{t('सरकारको तह', 'Government Level')}</label>
              <select
                value={filters.govtLevels[0] || ''}
                onChange={(e) => setFilters((f) => ({ ...f, govtLevels: e.target.value ? [e.target.value as GovtLevel] : [] }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="">{t('सबै तह', 'All Levels')}</option>
                <option value="federal">{t('संघीय तह', 'Federal')}</option>
                <option value="provincial">{t('प्रदेश तह', 'Provincial')}</option>
                <option value="local">{t('स्थानीय तह', 'Local')}</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">{t('मन्त्रालय', 'Ministry')}</label>
              <select
                value={filters.ministryIds[0] || ''}
                onChange={(e) => setFilters((f) => ({ ...f, ministryIds: e.target.value ? [Number(e.target.value)] : [], departmentIds: [] }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="">{t('सबै मन्त्रालय', 'All Ministries')}</option>
                {master.ministries.map((m) => (
                  <option key={m.id} value={m.id}>{lang === 'ne' ? m.name_np : m.name_en}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">{t('विभाग / निकाय', 'Department')}</label>
              <select
                value={filters.departmentIds[0] || ''}
                onChange={(e) => setFilters((f) => ({ ...f, departmentIds: e.target.value ? [Number(e.target.value)] : [] }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="">{t('सबै विभाग', 'All Departments')}</option>
                {master.departments
                  .filter((d) => !filters.ministryIds.length || filters.ministryIds.includes(d.ministry_id))
                  .map((d) => (
                    <option key={d.id} value={d.id}>{lang === 'ne' ? d.name_np : d.name_en}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">{t('प्रदेश', 'Province')}</label>
              <select
                value={filters.provinceIds[0] || ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    provinceIds: e.target.value ? [Number(e.target.value)] : [],
                    districtIds: [],
                    localLevelIds: [],
                  }))
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="">{t('सातै प्रदेश', 'All 7 Provinces')}</option>
                {master.provinces.map((p) => (
                  <option key={p.id} value={p.id}>{lang === 'ne' ? p.name_np : p.name_en}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">{t('जिल्ला (७७)', 'District (77)')}</label>
              <select
                value={filters.districtIds[0] || ''}
                onChange={(e) => setFilters((f) => ({ ...f, districtIds: e.target.value ? [Number(e.target.value)] : [], localLevelIds: [] }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="">{t('सबै जिल्ला', 'All Districts')}</option>
                {master.districts
                  .filter((d) => !filters.provinceIds.length || filters.provinceIds.includes(d.province_id))
                  .map((d) => (
                    <option key={d.id} value={d.id}>{lang === 'ne' ? d.name_np : d.name_en}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">{t('स्थानीय तह', 'Local Level')}</label>
              <select
                value={filters.localLevelIds[0] || ''}
                onChange={(e) => setFilters((f) => ({ ...f, localLevelIds: e.target.value ? [Number(e.target.value)] : [] }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="">{t('सबै स्थानीय तह', 'All Local Levels')}</option>
                {master.local_levels
                  .filter((l) => !filters.districtIds.length || filters.districtIds.includes(l.district_id))
                  .map((l) => (
                    <option key={l.id} value={l.id}>{l.name_np}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">{t('कार्यालयको प्रकार', 'Office Type')}</label>
              <select
                value={filters.officeTypes[0] || ''}
                onChange={(e) => setFilters((f) => ({ ...f, officeTypes: e.target.value ? [e.target.value] : [] }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="">{t('सबै प्रकार', 'All Types')}</option>
                {officeTypesUnique.map((ot) => (
                  <option key={ot} value={ot}>{ot}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">{t('कार्यालयको नाम', 'Office Name')}</label>
              <select
                value={filters.officeIds[0] || ''}
                onChange={(e) => setFilters((f) => ({ ...f, officeIds: e.target.value ? [Number(e.target.value)] : [] }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="">{t('सबै कार्यालय', 'All Offices')}</option>
                {master.offices.map((o) => (
                  <option key={o.id} value={o.id}>{lang === 'ne' ? o.name_np : o.name_en}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">{t('प्रतिवेदन Status', 'Submission Status')}</label>
              <select
                value={filters.statuses[0] || ''}
                onChange={(e) => setFilters((f) => ({ ...f, statuses: e.target.value ? [e.target.value as SubmissionStatus] : [] }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="">{t('सबै अवस्था', 'All Statuses')}</option>
                {['Accepted', 'Reviewed', 'Under Review', 'Submitted', 'Resubmitted', 'Returned for Correction', 'Draft', 'Not Started', 'Overdue'].map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">{t('कार्यान्वयन अवस्था', 'Implementation Tier')}</label>
              <select
                value={filters.implState}
                onChange={(e) => setFilters((f) => ({ ...f, implState: e.target.value as DashboardFilters['implState'] }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="">{t('सबै स्तर', 'All Tiers')}</option>
                <option value="high">{t('उच्च (८०%+)', 'High (80%+)')}</option>
                <option value="medium">{t('मध्यम (५०–७९%)', 'Medium (50–79%)')}</option>
                <option value="low">{t('न्यून (<५०%)', 'Low (<50%)')}</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">{t('सूचक नम्बर (१–९)', 'Indicator No.')}</label>
              <select
                value={filters.indicatorNo || ''}
                onChange={(e) => setFilters((f) => ({ ...f, indicatorNo: e.target.value ? Number(e.target.value) : null }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="">{t('सबै ९ सूचक', 'All 9 Indicators')}</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <option key={n} value={n}>{t(`सूचक नं. ${toDevanagariDigits(n)}`, `Indicator #${n}`)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">{t('मिति देखि (AD)', 'Date From')}</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">{t('मिति सम्म (AD)', 'Date To')}</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
            </div>
          </div>
        )}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded">{error}</div>}

      {/* 10 Interactive KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {loading && !analytics
          ? Array.from({ length: 10 }).map((_, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-lg p-4 h-24 animate-pulse" />
            ))
          : kpiCards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => setKpiDrawer({ title: lang === 'ne' ? card.np : card.en, list: card.list })}
                className="text-left bg-white border border-slate-200 hover:border-[#0F294D] rounded-lg p-4 transition-colors"
              >
                <p className="text-xs text-slate-500 line-clamp-1">{lang === 'ne' ? card.np : card.en}</p>
                <p className={`text-2xl font-bold tabular-nums mt-1.5 ${card.accent || 'text-slate-900'}`}>
                  {card.val}
                </p>
                <p className="text-[11px] text-[#0F294D] mt-1">{t('कार्यालय सूची हेर्नुहोस् →', 'View offices →')}</p>
              </button>
            ))}
      </div>

      {/* Sub-Section Segmented Navigation */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg w-fit">
        {(
          [
            ['overview', 'भौगोलिक नक्सा र तहगत तुलना', 'National Map & Tiers'],
            ['ministry', 'मन्त्रालयगत विश्लेषण', 'Ministry Ranking'],
            ['indicators', '९ सूचक विश्लेषण', '9 Indicators'],
            ['services', 'सेवागत तथा निवेदन तथ्याङ्क', 'Service Analytics'],
            ['trends', 'त्रैमासिक Trend विश्लेषण', 'Quarterly Trends'],
          ] as const
        ).map(([id, np, en]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveSectionTab(id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
              activeSectionTab === id ? 'bg-[#0F294D] text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {lang === 'ne' ? np : en}
          </button>
        ))}
      </div>

      {analytics && activeSectionTab === 'overview' && (
        <div className="space-y-6">
          <NepalMap
            districtStats={analytics.districtStats}
            provinceStats={analytics.provinceStats}
            selectedProvinceIds={filters.provinceIds}
            selectedDistrictIds={filters.districtIds}
            onSelectProvince={(pid) =>
              setFilters((f) => ({
                ...f,
                provinceIds: toggleArr(f.provinceIds, pid),
              }))
            }
            onSelectDistrict={(did) =>
              setFilters((f) => ({
                ...f,
                districtIds: toggleArr(f.districtIds, did),
              }))
            }
            lang={lang}
          />

          {/* Federal / Provincial / Local Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="text-sm font-bold text-[#0F294D] mb-4">
                {t('संघीय / प्रदेश / स्थानीय तहगत तुलना', 'Federal / Provincial / Local Comparison')}
              </h3>
              <div className="space-y-3">
                {analytics.govtLevelStats.map((g) => (
                  <div key={g.govt_level} className="p-3 border border-slate-200 rounded-md">
                    <div className="flex justify-between text-xs font-bold text-[#0F294D]">
                      <span>{lang === 'ne' ? g.label_np : g.label_en}</span>
                      <span className="tabular-nums">{formatPct(g.avg_impl_pct, lang)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                      {t('पेश गरेका कार्यालय:', 'Submitted:')} {formatNum(g.submitted_offices, lang)} / {formatNum(g.total_offices, lang)}
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-[#0F294D]" style={{ width: `${Math.min(100, g.avg_impl_pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="text-sm font-bold text-[#0F294D] mb-4">
                {t('प्रदेशगत औसत कार्यान्वयन तथा समयसीमाभित्र फर्छ्योट दर (%)', 'Province Compliance & Timely Disposal (%)')}
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.provinceStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey={lang === 'ne' ? 'province_name_np' : 'province_name_en'} tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="avg_impl_pct" name={t('कार्यान्वयन %', 'Implementation %')} fill="#0F294D" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="timely_disposal_pct" name={t('समयसीमाभित्र फर्छ्योट %', 'Timely Disposal %')} fill="#15803D" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {analytics && activeSectionTab === 'ministry' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          <h3 className="text-base font-bold text-[#0F294D]">
            {t('मन्त्रालयगत प्रगति विश्लेषण तथा श्रेणीक्रम (Ranking)', 'Ministry-Wise Performance & Ranking')}
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.ministryStats} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey={lang === 'ne' ? 'ministry_name_np' : 'ministry_name_en'} width={230} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="avg_impl_pct" name={t('औसत कार्यान्वयन %', 'Avg Implementation %')} fill="#0F294D" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-2.5 text-center">Rank</th>
                  <th className="p-2.5 text-left">{t('मन्त्रालय / निकाय', 'Ministry')}</th>
                  <th className="p-2.5 text-right">{t('कुल कार्यालय', 'Total')}</th>
                  <th className="p-2.5 text-right">{t('पेश गरेका', 'Submitted')}</th>
                  <th className="p-2.5 text-right">{t('बाँकी', 'Pending')}</th>
                  <th className="p-2.5 text-right">{t('औसत कार्यान्वयन %', 'Avg Compliance %')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 tabular-nums">
                {analytics.ministryStats.map((m) => (
                  <tr key={m.ministry_id} className="hover:bg-slate-50">
                    <td className="p-2.5 text-center font-bold text-[#0F294D]">#{formatNum(m.rank, lang)}</td>
                    <td className="p-2.5 font-medium">{lang === 'ne' ? m.ministry_name_np : m.ministry_name_en}</td>
                    <td className="p-2.5 text-right">{formatNum(m.total_offices, lang)}</td>
                    <td className="p-2.5 text-right text-emerald-700 font-semibold">{formatNum(m.submitted_offices, lang)}</td>
                    <td className="p-2.5 text-right text-red-700">{formatNum(m.not_submitted_offices, lang)}</td>
                    <td className="p-2.5 text-right font-bold">{formatPct(m.avg_impl_pct, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {analytics && activeSectionTab === 'indicators' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          <div>
            <h3 className="text-base font-bold text-[#0F294D]">
              {t('खण्ड २ का नौवटा अनिवार्य सूचकहरूको राष्ट्रिय विश्लेषण', 'National Analysis of 9 Mandatory Implementation Indicators')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('प्रत्येक सूचकमा पूर्ण, आंशिक र छैन अवस्था भएका कार्यालयहरूको संख्या तथा प्रतिशत', 'Full, Partial, and None office counts and compliance % per indicator')}
            </p>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics.indicatorStats.map((i) => ({
                  ...i,
                  label: `${t('सूचक', 'Ind')} ${i.indicator_no}`,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="full_count" stackId="a" name={t('पूर्ण', 'Full')} fill="#15803D" />
                <Bar dataKey="partial_count" stackId="a" name={t('आंशिक', 'Partial')} fill="#D97706" />
                <Bar dataKey="none_count" stackId="a" name={t('छैन', 'None')} fill="#DC2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
            {analytics.indicatorStats.map((ind) => (
              <div key={ind.indicator_no} className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="flex-1">
                  <span className="font-bold text-[#0F294D] mr-1.5">{formatNum(ind.indicator_no, lang)}.</span>
                  <span className="font-medium text-slate-800">{lang === 'ne' ? ind.title_np : ind.title_en}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0 tabular-nums">
                  <span className="text-emerald-700 font-semibold">{t('पूर्ण:', 'Full:')} {formatNum(ind.full_count, lang)}</span>
                  <span className="text-amber-700 font-semibold">{t('आंशिक:', 'Partial:')} {formatNum(ind.partial_count, lang)}</span>
                  <span className="text-red-700 font-semibold">{t('छैन:', 'None:')} {formatNum(ind.none_count, lang)}</span>
                  <span className="font-bold text-[#0F294D] w-16 text-right">{formatPct(ind.compliance_pct, lang)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {analytics && activeSectionTab === 'services' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              ['कुल सार्वजनिक सेवा', 'Total Services', analytics.serviceAnalytics.total_services],
              ['तयार ढाँचा', 'Prepared Forms', analytics.serviceAnalytics.prepared_forms],
              ['स्वीकृत ढाँचा', 'Approved Forms', analytics.serviceAnalytics.approved_forms],
              ['प्रयोगमा आएका', 'In-Use Forms', analytics.serviceAnalytics.in_use_forms],
              ['निःशुल्क उपलब्ध', 'Free Forms', analytics.serviceAnalytics.free_available_forms],
              ['डिजिटल/वेबसाइट', 'Digital Forms', analytics.serviceAnalytics.digital_available_forms],
              ['कुल प्राप्त निवेदन', 'Total Received', analytics.serviceAnalytics.total_received],
              ['कुल फर्छ्योट', 'Total Disposed', analytics.serviceAnalytics.total_disposed],
              ['कुल बाँकी', 'Total Pending', analytics.serviceAnalytics.total_pending],
              ['कुल फिर्ता', 'Total Returned', analytics.serviceAnalytics.total_returned],
              ['समयसीमाभित्र फर्छ्योट', 'Within Deadline', analytics.serviceAnalytics.total_within_deadline],
              ['समयसीमाभित्र %', 'Timely Disposal %', `${analytics.serviceAnalytics.within_deadline_pct.toFixed(1)}%`],
            ].map(([np, en, val]) => (
              <div key={String(en)} className="bg-white border border-slate-200 rounded-lg p-3.5">
                <p className="text-[11px] text-slate-500">{lang === 'ne' ? np : en}</p>
                <p className="text-xl font-bold text-[#0F294D] tabular-nums mt-1">
                  {typeof val === 'number' ? formatNum(val, lang) : lang === 'ne' ? toDevanagariDigits(val) : val}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-bold text-[#0F294D] mb-4">
              {t('प्रमुख सेवाअनुसार निवेदन प्राप्त तथा फर्छ्योट तथ्याङ्क', 'Top Public Services: Received vs Disposed')}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="p-2.5 text-left">{t('सेवाको नाम', 'Service Name')}</th>
                    <th className="p-2.5 text-right">{t('कार्यालय संख्या', 'Offices')}</th>
                    <th className="p-2.5 text-right">{t('प्राप्त', 'Received')}</th>
                    <th className="p-2.5 text-right">{t('फर्छ्योट', 'Disposed')}</th>
                    <th className="p-2.5 text-right">{t('बाँकी', 'Pending')}</th>
                    <th className="p-2.5 text-right">{t('फिर्ता', 'Returned')}</th>
                    <th className="p-2.5 text-right">{t('समयसीमाभित्र %', 'Timely %')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 tabular-nums">
                  {analytics.serviceAnalytics.top_services.map((sv, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2.5 font-medium">{sv.service_name}</td>
                      <td className="p-2.5 text-right">{formatNum(sv.office_count, lang)}</td>
                      <td className="p-2.5 text-right">{formatNum(sv.received, lang)}</td>
                      <td className="p-2.5 text-right text-emerald-700 font-semibold">{formatNum(sv.disposed, lang)}</td>
                      <td className="p-2.5 text-right text-amber-700">{formatNum(sv.pending, lang)}</td>
                      <td className="p-2.5 text-right text-red-700">{formatNum(sv.returned, lang)}</td>
                      <td className="p-2.5 text-right font-bold">{formatPct(sv.within_deadline_pct, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {analytics && activeSectionTab === 'trends' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          <div>
            <h3 className="text-base font-bold text-[#0F294D]">
              {t('त्रैमासिक प्रगति Trend विश्लेषण (आ.व. २०८२/८३ – २०८३/८४)', 'Quarterly Progress Trend Analysis')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('प्रथमदेखि चौथो त्रैमासिकसम्मको कार्यान्वयन, निवेदन ढाँचा प्रयोग तथा फर्छ्योट दरको तुलना', 'Comparison of compliance, template usage, and disposal rates across quarters')}
            </p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.quarterlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey={lang === 'ne' ? 'period_label_np' : 'period_label_en'} tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="avg_impl_pct" name={t('औसत कार्यान्वयन %', 'Avg Implementation %')} stroke="#0F294D" strokeWidth={2.5} />
                <Line type="monotone" dataKey="prepared_rate_pct" name={t('ढाँचा तयार दर %', 'Prepared Forms %')} stroke="#2563EB" strokeWidth={2} />
                <Line type="monotone" dataKey="in_use_rate_pct" name={t('ढाँचा प्रयोग दर %', 'In-Use Forms %')} stroke="#15803D" strokeWidth={2} />
                <Line type="monotone" dataKey="disposal_rate_pct" name={t('निवेदन फर्छ्योट दर %', 'Disposal Rate %')} stroke="#D97706" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* KPI Drill-down Modal */}
      {kpiDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-5 py-3.5 bg-[#0F294D] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">{kpiDrawer.title}</h3>
                <p className="text-xs text-slate-300">{t('जम्मा:', 'Count:')} {formatNum(kpiDrawer.list.length, lang)}</p>
              </div>
              <button type="button" onClick={() => setKpiDrawer(null)} className="p-1 hover:bg-white/10 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {kpiDrawer.list.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">{t('कुनै कार्यालय फेला परेन।', 'No matching offices found.')}</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="p-2 text-left">{t('कार्यालयको नाम', 'Office Name')}</th>
                      <th className="p-2 text-left">{t('प्रदेश / जिल्ला', 'Province / District')}</th>
                      <th className="p-2 text-left">{t('अवस्था', 'Status')}</th>
                      <th className="p-2 text-right">{t('कार्यान्वयन %', 'Score %')}</th>
                      <th className="p-2 text-right">{t('कार्य', 'Action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {kpiDrawer.list.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="p-2 font-medium text-slate-900">{lang === 'ne' ? s.office_name_np : s.office_name_en}</td>
                        <td className="p-2 text-slate-600">{s.province_name_np} · {s.district_name_np}</td>
                        <td className="p-2">
                          <StatusTag
                            status={s.status}
                            lang={lang}
                            labelOverride={s.status === 'Under Review' && lang === 'ne' ? 'विचाराधीन' : undefined}
                          />
                        </td>
                        <td className="p-2 text-right font-bold tabular-nums">{formatPct(s.implementation_score, lang)}</td>
                        <td className="p-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setKpiDrawer(null);
                              onOpenSubmission(s.id);
                            }}
                            className="text-xs font-semibold text-[#0F294D] hover:underline"
                          >
                            {t('प्रतिवेदन हेर्नुहोस्', 'View Report')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
