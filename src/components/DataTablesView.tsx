import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Download, Printer, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useI18n } from '../context/I18nContext.tsx';
import { DashboardAnalytics } from '../types/index.ts';
import { formatNum, formatPct } from '../utils/nepaliDate.ts';
import { StatusTag } from './NvcLogo.tsx';

interface Props {
  onOpenSubmission: (submissionId: number) => void;
}

type TableId =
  | 'office_status'
  | 'province_progress'
  | 'ministry_progress'
  | 'district_progress'
  | 'indicator_status'
  | 'template_availability'
  | 'service_stats'
  | 'application_disposal'
  | 'timely_disposal'
  | 'needs_improvement'
  | 'not_submitted'
  | 'feedback_received';

const TABLE_TABS: Array<{ id: TableId; np: string; en: string }> = [
  { id: 'office_status', np: '१. कार्यालयगत प्रतिवेदन स्थिति', en: '1. Office Status' },
  { id: 'province_progress', np: '२. प्रदेशगत प्रगति', en: '2. Province Progress' },
  { id: 'ministry_progress', np: '३. मन्त्रालयगत प्रगति', en: '3. Ministry Progress' },
  { id: 'district_progress', np: '४. जिल्लागत प्रगति', en: '4. District Progress' },
  { id: 'indicator_status', np: '५. नौवटा सूचक अवस्था', en: '5. 9 Indicators' },
  { id: 'template_availability', np: '६. निवेदन ढाँचा उपलब्धता', en: '6. Template Availability' },
  { id: 'service_stats', np: '७. सेवा प्रवाहको तथ्याङ्क', en: '7. Service Flow Stats' },
  { id: 'application_disposal', np: '८. निवेदन फर्छ्योट अवस्था', en: '8. Application Disposal' },
  { id: 'timely_disposal', np: '९. समयसीमाभित्र फर्छ्योट', en: '9. Timely Disposal' },
  { id: 'needs_improvement', np: '१०. सुधार गर्नुपर्ने कार्यालय', en: '10. Needs Improvement' },
  { id: 'not_submitted', np: '११. पेश नगरेका कार्यालय', en: '11. Not Submitted' },
  { id: 'feedback_received', np: '१२. Feedback प्राप्त कार्यालय', en: '12. Feedback Received' },
];

export function DataTablesView({ onOpenSubmission }: Props) {
  const { apiFetch, apiDownload } = useAuth();
  const { lang, t } = useI18n();

  const [activeTable, setActiveTable] = useState<TableId>('office_status');
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    apiFetch<DashboardAnalytics>('/api/analytics/dashboard?fiscalYearIds=2&quarterNumbers=1').then(setAnalytics);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeTable, search]);

  const rows = useMemo(() => {
    if (!analytics) return [];
    const q = search.trim().toLowerCase();
    const filterTxt = (txt: string) => !q || txt.toLowerCase().includes(q);

    if (activeTable === 'province_progress') {
      return analytics.provinceStats.filter((r) => filterTxt(r.province_name_np + ' ' + r.province_name_en));
    }
    if (activeTable === 'ministry_progress') {
      return analytics.ministryStats.filter((r) => filterTxt(r.ministry_name_np + ' ' + r.ministry_name_en));
    }
    if (activeTable === 'district_progress') {
      return analytics.districtStats.filter((r) => r.total_offices > 0 && filterTxt(r.district_name_np + ' ' + r.district_name_en));
    }
    if (activeTable === 'indicator_status') {
      return analytics.indicatorStats.filter((r) => filterTxt(r.title_np + ' ' + r.title_en));
    }
    if (activeTable === 'service_stats') {
      return analytics.serviceAnalytics.top_services.filter((r) => filterTxt(r.service_name));
    }

    let list = analytics.submissions;
    if (activeTable === 'needs_improvement') list = list.filter((s) => s.implementation_score < 75);
    else if (activeTable === 'not_submitted') list = analytics.officeListsByKpi.notSubmitted;
    else if (activeTable === 'feedback_received') list = list.filter((s) => s.feedback_count > 0);

    const filtered = list.filter((s) =>
      filterTxt(`${s.office_name_np} ${s.office_name_en} ${s.office_code} ${s.district_name_np} ${s.province_name_np} ${s.ministry_name_np || ''}`)
    );

    return [...filtered].sort((a, b) =>
      sortDir === 'desc' ? b.implementation_score - a.implementation_score : a.implementation_score - b.implementation_score
    );
  }, [analytics, activeTable, search, sortDir]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pagedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#0F294D]">
              {t('एकीकृत प्रतिवेदन तालिका तथा निर्यात (१२ विश्लेषणात्मक प्रतिवेदन)', 'Analytical Data Tables & Export (12 Reports)')}
            </h2>
            <p className="text-xs text-slate-500">
              {t('खोजी, क्रमबद्ध, Excel (.xlsx) र Print/PDF निर्यात सुविधासहित', 'Search, sort, paginate, and export to Excel (.xlsx) or Print/PDF')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => apiDownload(`/api/export/excel?type=${activeTable}`, `nvc_${activeTable}.xlsx`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#0F294D] text-white text-xs font-semibold rounded-md hover:bg-[#173a6b]"
            >
              <Download className="w-3.5 h-3.5" />
              {t('Excel (.xlsx)', 'Export Excel')}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-xs font-semibold rounded-md hover:bg-slate-50"
            >
              <Printer className="w-3.5 h-3.5" />
              {t('Print / PDF', 'Print / PDF')}
            </button>
          </div>
        </div>

        {/* 12 Table Tabs */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {TABLE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTable(tab.id)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded border whitespace-nowrap transition-colors ${
                activeTable === tab.id
                  ? 'bg-[#0F294D] text-white border-[#0F294D]'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {lang === 'ne' ? tab.np : tab.en}
            </button>
          ))}
        </div>

        {/* Search & Sort Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('कार्यालय, जिल्ला, प्रदेश वा सेवाको नाम खोज्नुहोस्...', 'Search office, district, province, or service...')}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-md"
            />
          </div>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortDir === 'desc' ? t('उच्चदेखि न्यून', 'High to Low') : t('न्यूनदेखि उच्च', 'Low to High')}
          </button>
        </div>

        {/* Dynamic Table Content */}
        <div className="overflow-x-auto border border-slate-200 rounded-md">
          {activeTable === 'province_progress' && (
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-2.5 text-left">{t('प्रदेश', 'Province')}</th>
                  <th className="p-2.5 text-right">{t('कुल कार्यालय', 'Offices')}</th>
                  <th className="p-2.5 text-right">{t('पेश गरेका', 'Submitted')}</th>
                  <th className="p-2.5 text-right">{t('पेश नगरेका', 'Pending')}</th>
                  <th className="p-2.5 text-right">{t('कार्यान्वयन %', 'Compliance %')}</th>
                  <th className="p-2.5 text-right">{t('प्राप्त निवेदन', 'Received')}</th>
                  <th className="p-2.5 text-right">{t('फर्छ्योट', 'Disposed')}</th>
                  <th className="p-2.5 text-right">{t('समयसीमाभित्र %', 'Timely %')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 tabular-nums">
                {(pagedRows as DashboardAnalytics['provinceStats']).map((r) => (
                  <tr key={r.province_id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-semibold">{lang === 'ne' ? r.province_name_np : r.province_name_en}</td>
                    <td className="p-2.5 text-right">{formatNum(r.total_offices, lang)}</td>
                    <td className="p-2.5 text-right text-emerald-700 font-semibold">{formatNum(r.submitted_offices, lang)}</td>
                    <td className="p-2.5 text-right text-red-700">{formatNum(r.not_submitted_offices, lang)}</td>
                    <td className="p-2.5 text-right font-bold">{formatPct(r.avg_impl_pct, lang)}</td>
                    <td className="p-2.5 text-right">{formatNum(r.total_received, lang)}</td>
                    <td className="p-2.5 text-right">{formatNum(r.total_disposed, lang)}</td>
                    <td className="p-2.5 text-right font-semibold">{formatPct(r.timely_disposal_pct, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTable === 'ministry_progress' && (
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-2.5 text-center">Rank</th>
                  <th className="p-2.5 text-left">{t('मन्त्रालय', 'Ministry')}</th>
                  <th className="p-2.5 text-right">{t('कुल कार्यालय', 'Offices')}</th>
                  <th className="p-2.5 text-right">{t('पेश गरेका', 'Submitted')}</th>
                  <th className="p-2.5 text-right">{t('पेश नगरेका', 'Not Submitted')}</th>
                  <th className="p-2.5 text-right">{t('कार्यान्वयन %', 'Compliance %')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 tabular-nums">
                {(pagedRows as DashboardAnalytics['ministryStats']).map((r) => (
                  <tr key={r.ministry_id} className="hover:bg-slate-50">
                    <td className="p-2.5 text-center font-bold">#{formatNum(r.rank, lang)}</td>
                    <td className="p-2.5 font-semibold">{lang === 'ne' ? r.ministry_name_np : r.ministry_name_en}</td>
                    <td className="p-2.5 text-right">{formatNum(r.total_offices, lang)}</td>
                    <td className="p-2.5 text-right">{formatNum(r.submitted_offices, lang)}</td>
                    <td className="p-2.5 text-right">{formatNum(r.not_submitted_offices, lang)}</td>
                    <td className="p-2.5 text-right font-bold">{formatPct(r.avg_impl_pct, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTable === 'district_progress' && (
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-2.5 text-left">{t('जिल्ला', 'District')}</th>
                  <th className="p-2.5 text-right">{t('कार्यालय', 'Offices')}</th>
                  <th className="p-2.5 text-right">{t('पेश गरेका', 'Submitted')}</th>
                  <th className="p-2.5 text-right">{t('कार्यान्वयन %', 'Compliance %')}</th>
                  <th className="p-2.5 text-right">{t('प्राप्त निवेदन', 'Received')}</th>
                  <th className="p-2.5 text-right">{t('फर्छ्योट', 'Disposed')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 tabular-nums">
                {(pagedRows as DashboardAnalytics['districtStats']).map((r) => (
                  <tr key={r.district_id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-semibold">{lang === 'ne' ? r.district_name_np : r.district_name_en}</td>
                    <td className="p-2.5 text-right">{formatNum(r.total_offices, lang)}</td>
                    <td className="p-2.5 text-right">{formatNum(r.submitted_offices, lang)}</td>
                    <td className="p-2.5 text-right font-bold">{formatPct(r.avg_impl_pct, lang)}</td>
                    <td className="p-2.5 text-right">{formatNum(r.total_received, lang)}</td>
                    <td className="p-2.5 text-right">{formatNum(r.total_disposed, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTable === 'indicator_status' && (
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-2.5 text-center">{t('क्र.सं.', 'No.')}</th>
                  <th className="p-2.5 text-left">{t('अनिवार्य सूचक विवरण', 'Indicator')}</th>
                  <th className="p-2.5 text-right">{t('पूर्ण', 'Full')}</th>
                  <th className="p-2.5 text-right">{t('आंशिक', 'Partial')}</th>
                  <th className="p-2.5 text-right">{t('छैन', 'None')}</th>
                  <th className="p-2.5 text-right">{t('कार्यान्वयन %', 'Compliance %')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 tabular-nums">
                {(pagedRows as DashboardAnalytics['indicatorStats']).map((r) => (
                  <tr key={r.indicator_no} className="hover:bg-slate-50">
                    <td className="p-2.5 text-center font-bold">{formatNum(r.indicator_no, lang)}</td>
                    <td className="p-2.5 font-medium">{lang === 'ne' ? r.title_np : r.title_en}</td>
                    <td className="p-2.5 text-right text-emerald-700 font-semibold">{formatNum(r.full_count, lang)}</td>
                    <td className="p-2.5 text-right text-amber-700 font-semibold">{formatNum(r.partial_count, lang)}</td>
                    <td className="p-2.5 text-right text-red-700 font-semibold">{formatNum(r.none_count, lang)}</td>
                    <td className="p-2.5 text-right font-bold">{formatPct(r.compliance_pct, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTable === 'service_stats' && (
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-2.5 text-left">{t('सेवाको नाम', 'Service Name')}</th>
                  <th className="p-2.5 text-right">{t('कार्यालय', 'Offices')}</th>
                  <th className="p-2.5 text-right">{t('प्राप्त', 'Received')}</th>
                  <th className="p-2.5 text-right">{t('फर्छ्योट', 'Disposed')}</th>
                  <th className="p-2.5 text-right">{t('बाँकी', 'Pending')}</th>
                  <th className="p-2.5 text-right">{t('फिर्ता', 'Returned')}</th>
                  <th className="p-2.5 text-right">{t('समयसीमाभित्र %', 'Timely %')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 tabular-nums">
                {(pagedRows as DashboardAnalytics['serviceAnalytics']['top_services']).map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-2.5 font-semibold">{r.service_name}</td>
                    <td className="p-2.5 text-right">{formatNum(r.office_count, lang)}</td>
                    <td className="p-2.5 text-right">{formatNum(r.received, lang)}</td>
                    <td className="p-2.5 text-right text-emerald-700 font-semibold">{formatNum(r.disposed, lang)}</td>
                    <td className="p-2.5 text-right">{formatNum(r.pending, lang)}</td>
                    <td className="p-2.5 text-right">{formatNum(r.returned, lang)}</td>
                    <td className="p-2.5 text-right font-bold">{formatPct(r.within_deadline_pct, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!['province_progress', 'ministry_progress', 'district_progress', 'indicator_status', 'service_stats'].includes(activeTable) && (
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-2.5 text-left">{t('कार्यालय', 'Office')}</th>
                  <th className="p-2.5 text-left">{t('प्रदेश / जिल्ला', 'Province / District')}</th>
                  <th className="p-2.5 text-left">{t('अवस्था', 'Status')}</th>
                  <th className="p-2.5 text-right">{t('कार्यान्वयन %', 'Score %')}</th>
                  <th className="p-2.5 text-right">{t('सेवा / प्रयोगमा ढाँचा', 'Services / In-Use')}</th>
                  <th className="p-2.5 text-right">{t('प्राप्त / फर्छ्योट', 'Received / Disposed')}</th>
                  <th className="p-2.5 text-right">{t('कार्य', 'Action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 tabular-nums">
                {(pagedRows as DashboardAnalytics['submissions']).map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-2.5">
                      <div className="font-semibold text-slate-900">{lang === 'ne' ? s.office_name_np : s.office_name_en}</div>
                      <div className="text-[11px] text-slate-500">{s.office_code}</div>
                    </td>
                    <td className="p-2.5 text-slate-600">{s.province_name_np} · {s.district_name_np}</td>
                    <td className="p-2.5"><StatusTag status={s.status} lang={lang} /></td>
                    <td className="p-2.5 text-right font-bold">{formatPct(s.implementation_score, lang)}</td>
                    <td className="p-2.5 text-right">{formatNum(s.total_services, lang)} / {formatNum(s.in_use_forms, lang)}</td>
                    <td className="p-2.5 text-right">{formatNum(s.total_received, lang)} / {formatNum(s.total_disposed, lang)}</td>
                    <td className="p-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenSubmission(s.id)}
                        className="text-xs font-semibold text-[#0F294D] hover:underline"
                      >
                        {t('हेर्नुहोस्', 'View')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between pt-3 text-xs text-slate-600">
          <span>
            {t('जम्मा नतिजा:', 'Total rows:')} {formatNum(rows.length, lang)} · {t('पृष्ठ', 'Page')} {formatNum(page, lang)}/{formatNum(totalPages, lang)}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 border border-slate-300 rounded disabled:opacity-40"
            >
              {t('अघिल्लो', 'Prev')}
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 border border-slate-300 rounded disabled:opacity-40"
            >
              {t('अर्को', 'Next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
