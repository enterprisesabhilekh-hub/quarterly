import React from 'react';
import { Printer, X } from 'lucide-react';
import { SubmissionFull } from '../types/index.ts';
import { OFFICIAL_INDICATORS } from '../data/nepalMasterData.ts';
import { toDevanagariDigits } from '../utils/nepaliDate.ts';

interface Props {
  submission: SubmissionFull;
  onClose?: () => void;
  embedded?: boolean;
}

function CheckBoxPrint({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 mr-2">
      <span>[{checked ? '✓' : ' '}]</span>
      <span>{label}</span>
    </span>
  );
}

export function OfficialReportPreview({ submission, onClose, embedded = false }: Props) {
  const { summary, indicators, services, monitoring, corrective_actions, certifications } = submission;

  const activeServices = services.length > 0 ? services : [];
  const page2Services = activeServices.slice(0, 6);
  const extraServices = activeServices.slice(6);

  const totalReceived = activeServices.reduce((a, b) => a + (b.received_count || 0), 0);
  const totalDisposed = activeServices.reduce((a, b) => a + (b.disposed_count || 0), 0);
  const totalPending = activeServices.reduce((a, b) => a + (b.pending_count || 0), 0);
  const totalReturned = activeServices.reduce((a, b) => a + (b.returned_count || 0), 0);
  const totalWithin = activeServices.reduce((a, b) => a + (b.within_deadline_count || 0), 0);
  const withinPct = totalDisposed > 0 ? ((totalWithin / totalDisposed) * 100).toFixed(1) : '0';

  const prepCert = certifications.find((c) => c.tier === 'preparer');
  const revCert = certifications.find((c) => c.tier === 'reviewer');
  const headCert = certifications.find((c) => c.tier === 'head');

  const q = submission.quarter_number;

  const content = (
    <div className="print-only-container bg-white text-black text-[11px] leading-[1.35]">
      {/* PAGE 1 */}
      <div className="print-page bg-white p-6 sm:p-8 border border-slate-300 shadow-sm mb-6 print:border-none print:shadow-none print:p-0 print:mb-0">
        <div className="text-center mb-3">
          <p className="text-[11px] font-medium">
            सरकारी कार्यालयमा प्रयोग हुने निवेदनको ढाँचा तथा सोको कार्यान्वयन मार्गदर्शन, २०८३ बमोजिम प्रत्येक कार्यालयले पेश गर्नुपर्ने
          </p>
          <h2 className="text-[15px] font-bold mt-0.5">त्रैमासिक प्रगति प्रतिवेदन को ढाँचा</h2>
          <p className="text-[13px] font-bold text-[#0F294D]">राष्ट्रिय सतर्कता केन्द्र</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-slate-400 py-1.5 px-2 mb-3 text-[11px] font-medium">
          <div>
            आर्थिक वर्ष: <span className="font-bold">{submission.fiscal_year_np}</span>
          </div>
          <div>
            त्रैमासिक:{' '}
            <CheckBoxPrint checked={q === 1} label="पहिलो" />
            <CheckBoxPrint checked={q === 2} label="दोस्रो" />
            <CheckBoxPrint checked={q === 3} label="तेस्रो" />
            <CheckBoxPrint checked={q === 4} label="चौथो" />
          </div>
          <div>
            अवधि: <span className="font-bold">{toDevanagariDigits(submission.start_date_bs)}</span> देखि{' '}
            <span className="font-bold">{toDevanagariDigits(submission.end_date_bs)}</span> सम्म
          </div>
        </div>

        {/* Section 1 */}
        <h3 className="text-[12px] font-bold text-[#0F294D] mb-1.5">१. कार्यालय विवरण तथा प्रगति</h3>
        <table className="w-full border-collapse border border-slate-500 mb-2.5 text-[10.5px]">
          <thead>
            <tr className="bg-[#0F294D] text-white">
              <th className="border border-slate-500 px-2 py-1 text-left w-[18%]">कार्यालय/विवरण</th>
              <th className="border border-slate-500 px-2 py-1 text-left w-[32%]">भर्नुपर्ने जानकारी</th>
              <th className="border border-slate-500 px-2 py-1 text-left w-[20%]">कार्यालय/विवरण</th>
              <th className="border border-slate-500 px-2 py-1 text-left w-[30%]">भर्नुपर्ने जानकारी</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-500 px-2 py-1 font-medium">कार्यालयको नाम</td>
              <td className="border border-slate-500 px-2 py-1">{summary.office_name}</td>
              <td className="border border-slate-500 px-2 py-1 font-medium">तह/सम्बन्धित मन्त्रालय वा निकाय</td>
              <td className="border border-slate-500 px-2 py-1">{summary.level_ministry}</td>
            </tr>
            <tr>
              <td className="border border-slate-500 px-2 py-1 font-medium">ठेगाना</td>
              <td className="border border-slate-500 px-2 py-1">{summary.address}</td>
              <td className="border border-slate-500 px-2 py-1 font-medium" rowSpan={2}>
                कार्यालय प्रमुख (नाम/पद)
              </td>
              <td className="border border-slate-500 px-2 py-1" rowSpan={2}>
                {summary.office_head}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-500 px-2 py-1 font-medium">सम्पर्क नं./इमेल</td>
              <td className="border border-slate-500 px-2 py-1">{summary.contact_info}</td>
            </tr>
          </tbody>
        </table>

        {/* Section 1B 6 numeric columns */}
        <table className="w-full border-collapse border border-slate-500 mb-3 text-[10.5px] text-center">
          <thead>
            <tr className="bg-[#0F294D] text-white">
              <th className="border border-slate-500 px-1.5 py-1.5 w-1/6">कुल सार्वजनिक सेवाको सङ्ख्या</th>
              <th className="border border-slate-500 px-1.5 py-1.5 w-1/6">ढाँचा तयार भएको सङ्ख्या</th>
              <th className="border border-slate-500 px-1.5 py-1.5 w-1/6">स्वीकृत भएको ढाँचाको सङ्ख्या</th>
              <th className="border border-slate-500 px-1.5 py-1.5 w-1/6">प्रयोगमा आएको ढाँचाको सङ्ख्या</th>
              <th className="border border-slate-500 px-1.5 py-1.5 w-1/6">निःशुल्क उपलब्ध ढाँचाको सङ्ख्या</th>
              <th className="border border-slate-500 px-1.5 py-1.5 w-1/6">वेबसाइटमा/डिजिटल Format मा उपलब्ध सङ्ख्या</th>
            </tr>
          </thead>
          <tbody>
            <tr className="font-bold text-[12px] tabular-nums">
              <td className="border border-slate-500 py-1.5">{toDevanagariDigits(summary.total_services)}</td>
              <td className="border border-slate-500 py-1.5">{toDevanagariDigits(summary.prepared_forms)}</td>
              <td className="border border-slate-500 py-1.5">{toDevanagariDigits(summary.approved_forms)}</td>
              <td className="border border-slate-500 py-1.5">{toDevanagariDigits(summary.in_use_forms)}</td>
              <td className="border border-slate-500 py-1.5">{toDevanagariDigits(summary.free_available_forms)}</td>
              <td className="border border-slate-500 py-1.5">{toDevanagariDigits(summary.digital_available_forms)}</td>
            </tr>
          </tbody>
        </table>

        {/* Section 2 */}
        <h3 className="text-[12px] font-bold text-[#0F294D]">२. निर्देशिका कार्यान्वयनको अवस्था</h3>
        <p className="text-[10px] text-slate-700 mb-1.5">
          हरेक विषयमा लागू अवस्था छान्नुहोस्; आंशिक/नभएको अवस्थामा समस्या वा कैफियत लेख्नुहोस्।
        </p>

        <table className="w-full border-collapse border border-slate-500 mb-2.5 text-[10px]">
          <thead>
            <tr className="bg-[#0F294D] text-white">
              <th className="border border-slate-500 px-1.5 py-1 w-[5%]">क्र.सं.</th>
              <th className="border border-slate-500 px-2 py-1 text-left w-[45%]">जाँच गर्नुपर्ने अनिवार्य विषय</th>
              <th className="border border-slate-500 px-1.5 py-1 w-[24%]">अवस्था</th>
              <th className="border border-slate-500 px-2 py-1 text-left w-[26%]">कैफियत/प्रमाण</th>
            </tr>
          </thead>
          <tbody>
            {OFFICIAL_INDICATORS.map((ind) => {
              const resp = indicators.find((r) => r.indicator_no === ind.indicator_no);
              const st = resp?.status || '';
              return (
                <tr key={ind.indicator_no}>
                  <td className="border border-slate-500 px-1.5 py-1 text-center font-medium">
                    {toDevanagariDigits(ind.indicator_no)}
                  </td>
                  <td className="border border-slate-500 px-2 py-1">{ind.title_np}</td>
                  <td className="border border-slate-500 px-1.5 py-1 whitespace-nowrap text-center">
                    <CheckBoxPrint checked={st === 'पूर्ण'} label="पूर्ण" />
                    <CheckBoxPrint checked={st === 'आंशिक'} label="आंशिक" />
                    <CheckBoxPrint checked={st === 'छैन'} label="छैन" />
                  </td>
                  <td className="border border-slate-500 px-2 py-1">
                    {resp?.remarks || ''}
                    {resp?.evidence_details ? ` (${resp.evidence_details})` : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="border border-slate-400 p-2 min-h-[52px]">
          <p className="font-bold text-[10.5px] mb-1">मुख्य उपलब्धि वा बाँकी सुधार (संक्षेपमा):</p>
          <p className="text-[10.5px] whitespace-pre-wrap">{summary.major_achievements || '—'}</p>
        </div>
      </div>

      {/* PAGE 2 */}
      <div className="print-page bg-white p-6 sm:p-8 border border-slate-300 shadow-sm mb-6 print:border-none print:shadow-none print:p-0 print:mb-0">
        <h3 className="text-[12px] font-bold text-[#0F294D]">३. सेवा अनुसार निवेदन ढाँचा तथा निवेदन/सेवा प्रवाहको तथ्याङ्क</h3>
        <p className="text-[10px] text-slate-700 mb-1.5">
          हरेक सेवा छुट्टै पङ्क्तिमा भर्नुहोस्। संख्या कार्यालयको अभिलेखअनुसार; समयसीमा नागरिक बडापत्रअनुसार खुलाउनुहोस्।
        </p>

        <table className="w-full border-collapse border border-slate-500 mb-1.5 text-[10px]">
          <thead>
            <tr className="bg-[#0F294D] text-white">
              <th className="border border-slate-500 px-1 py-1.5 w-[5%]">क्र.सं.</th>
              <th className="border border-slate-500 px-1.5 py-1.5 text-left w-[17%]">सेवाको नाम</th>
              <th className="border border-slate-500 px-1.5 py-1.5 text-left w-[18%]">निवेदन ढाँचाको स्थिति/स्वीकृति मिति</th>
              <th className="border border-slate-500 px-1.5 py-1.5 text-left w-[19%]">उपलब्धता (निःशुल्क/सूचनापाटी/वेबसाइट)</th>
              <th className="border border-slate-500 px-1.5 py-1.5 text-center w-[19%]">निवेदन संख्या (प्राप्त/फर्छ्योट/बाँकी/फिर्ता)</th>
              <th className="border border-slate-500 px-1.5 py-1.5 text-left w-[22%]">समयसीमा तथा कारण/कैफियत</th>
            </tr>
          </thead>
          <tbody>
            {page2Services.map((sv, idx) => (
              <tr key={idx}>
                <td className="border border-slate-500 px-1 py-1 text-center">{toDevanagariDigits(idx + 1)}</td>
                <td className="border border-slate-500 px-1.5 py-1 font-medium">{sv.service_name || '—'}</td>
                <td className="border border-slate-500 px-1.5 py-1">
                  <div>
                    <CheckBoxPrint checked={sv.is_prepared} label="तयार" />
                    <CheckBoxPrint checked={sv.is_approved} label="स्वीकृत" />
                    <CheckBoxPrint checked={sv.is_in_use} label="प्रयोग" />
                  </div>
                  <div className="mt-0.5">मिति: {sv.approval_date ? toDevanagariDigits(sv.approval_date) : '—'}</div>
                </td>
                <td className="border border-slate-500 px-1.5 py-1">
                  <div>
                    <CheckBoxPrint checked={sv.is_free} label="निःशुल्क" />
                    <CheckBoxPrint checked={sv.is_notice_board} label="बोर्ड" />
                  </div>
                  <div className="mt-0.5 truncate max-w-[140px]">
                    वेबसाइट: {sv.is_website ? sv.website_url || 'उपलब्ध' : '—'}
                  </div>
                </td>
                <td className="border border-slate-500 px-1.5 py-1 text-center tabular-nums">
                  <div className="text-[9px] text-slate-600">प्राप्त / फर्छ्योट / बाँकी / फिर्ता</div>
                  <div className="font-bold">
                    {toDevanagariDigits(sv.received_count)} / {toDevanagariDigits(sv.disposed_count)} /{' '}
                    {toDevanagariDigits(sv.pending_count)} / {toDevanagariDigits(sv.returned_count)}
                  </div>
                </td>
                <td className="border border-slate-500 px-1.5 py-1">
                  <div>
                    समयसीमाभित्र फर्छ्योट: <strong>{toDevanagariDigits(sv.within_deadline_count)}</strong>{' '}
                    {sv.prescribed_timeline ? `(${sv.prescribed_timeline})` : ''}
                  </div>
                  <div className="text-[9.5px] text-slate-700">कैफियत/कारण: {sv.remarks || '—'}</div>
                </td>
              </tr>
            ))}
            {extraServices.length === 0 && (
              <tr className="bg-slate-50 font-bold tabular-nums">
                <td className="border border-slate-500 px-2 py-1.5 text-center" colSpan={4}>
                  जम्मा
                </td>
                <td className="border border-slate-500 px-2 py-1.5 text-center">
                  {toDevanagariDigits(totalReceived)} / {toDevanagariDigits(totalDisposed)} / {toDevanagariDigits(totalPending)} /{' '}
                  {toDevanagariDigits(totalReturned)}
                </td>
                <td className="border border-slate-500 px-2 py-1.5">
                  समयभित्र फर्छ्योट: {toDevanagariDigits(totalWithin)} ({toDevanagariDigits(withinPct)}%)
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="text-[9.5px] text-slate-700 mb-3">
          तोकिएको समयसीमा कार्यालयको नागरिक बडापत्र/प्रचलित व्यवस्थाअनुसार लेख्नुहोस्। बाँकी निवेदन र अस्वीकृत/फिर्ताका कारण कैफियतमा खुलाउनुहोस्।
        </p>

        {/* Section 4 */}
        <h3 className="text-[12px] font-bold text-[#0F294D] mb-1.5">४. अनुगमन, सुधारात्मक कार्य र संलग्न प्रमाण</h3>
        <table className="w-full border-collapse border border-slate-500 mb-2.5 text-[10px]">
          <thead>
            <tr className="bg-[#0F294D] text-white">
              <th className="border border-slate-500 px-2 py-1 text-left w-[38%]">अनुगमन/सुधार विवरण</th>
              <th className="border border-slate-500 px-2 py-1 text-left w-[62%]">कैफियत/कार्य, जिम्मेवार व्यक्ति र समयसीमा</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-500 px-2 py-1.5 font-medium">
                यस त्रैमासिकको आन्तरिक समीक्षा/अनुगमन (मिति/निष्कर्ष) तथा अघिल्लो प्रतिवेदन वा केन्द्रको सुझाव/निर्देशनको अवस्था
              </td>
              <td className="border border-slate-500 px-2 py-1.5">
                <div>मिति: {monitoring.monitoring_date ? toDevanagariDigits(monitoring.monitoring_date) : '—'}</div>
                <div>निष्कर्ष: {monitoring.monitoring_conclusion || '—'}</div>
                <div>अघिल्लो प्रतिवेदन/केन्द्रको निर्देशन अवस्था: {monitoring.previous_report_status || ''} {monitoring.center_directive_status}</div>
                <div>गरिएको सुधार: {monitoring.improvements_made || '—'}</div>
              </td>
            </tr>
            <tr>
              <td className="border border-slate-500 px-2 py-1.5 font-medium">
                मुख्य समस्या/कारण; सुधारात्मक कदम, जिम्मेवार व्यक्ति/शाखा, समयसीमा र आवश्यक सहजीकरण
              </td>
              <td className="border border-slate-500 px-2 py-1.5">
                {corrective_actions.map((ca, idx) => (
                  <div key={idx} className={idx > 0 ? 'mt-1 pt-1 border-t border-slate-200' : ''}>
                    समस्या: {ca.main_problem || '—'} | कारण: {ca.root_cause || '—'} | कदम: {ca.corrective_step || '—'} | जिम्मेवार:{' '}
                    {ca.responsible_person || '—'} ({ca.responsible_unit || '—'}) | समयसीमा:{' '}
                    {ca.target_deadline ? toDevanagariDigits(ca.target_deadline) : '—'} | सहजीकरण: {ca.expected_facilitation || '—'}
                  </div>
                ))}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mb-3 text-[10px]">
          <p className="font-medium">
            संलग्न प्रमाणमा उपयुक्तमा चिन्ह लगाउनुहोस्:{' '}
            <CheckBoxPrint checked={monitoring.evidence_approved_sample} label="स्वीकृत ढाँचाको नमुना" />
            <CheckBoxPrint checked={monitoring.evidence_website_notice} label="वेबसाइट/सूचनापाटीको प्रमाण" />
            <CheckBoxPrint checked={monitoring.evidence_service_record} label="सेवा प्रवाहको समष्टिगत अभिलेख" />
            <CheckBoxPrint checked={monitoring.evidence_other} label={`अन्य ${monitoring.evidence_other_text || ''}`} />
          </p>
          <p className="text-[9.5px] font-semibold text-red-800 mt-0.5">
            व्यक्तिगत सेवाग्राहीको संवेदनशील पहिचान खुल्ने कागजात नपठाउनुहोस्।
          </p>
        </div>

        {/* 3-Tier Certification */}
        <table className="w-full border-collapse border border-slate-500 text-[10px]">
          <thead>
            <tr className="bg-[#0F294D] text-white">
              <th className="border border-slate-500 px-2 py-1 w-1/3">प्रतिवेदन तयार गर्ने</th>
              <th className="border border-slate-500 px-2 py-1 w-1/3">जाँच/सिफारिस गर्ने</th>
              <th className="border border-slate-500 px-2 py-1 w-1/3">कार्यालय प्रमुखबाट प्रमाणित</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-500 px-2 py-2 align-top">
                <div>नाम/पद: {prepCert?.name_designation || '—'}</div>
                <div className="mt-1">हस्ताक्षर: {prepCert?.signature_text || '—'}</div>
                <div className="mt-1">मिति: {prepCert?.signed_date ? toDevanagariDigits(prepCert.signed_date) : '—'}</div>
              </td>
              <td className="border border-slate-500 px-2 py-2 align-top">
                <div>नाम/पद: {revCert?.name_designation || '—'}</div>
                <div className="mt-1">हस्ताक्षर: {revCert?.signature_text || '—'}</div>
                <div className="mt-1">मिति: {revCert?.signed_date ? toDevanagariDigits(revCert.signed_date) : '—'}</div>
              </td>
              <td className="border border-slate-500 px-2 py-2 align-top">
                <div>नाम/पद: {headCert?.name_designation || '—'}</div>
                <div className="mt-1">हस्ताक्षर: {headCert?.signature_text || '—'}</div>
                <div className="mt-1">मिति: {headCert?.signed_date ? toDevanagariDigits(headCert.signed_date) : '—'}</div>
                <div className="mt-1">कार्यालयको छाप: {headCert?.office_stamp_confirmed ? 'प्रमाणित (छाप संलग्न)' : '—'}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Continuation Page 3+ if services > 6 */}
      {extraServices.length > 0 && (
        <div className="print-page bg-white p-6 sm:p-8 border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0">
          <h3 className="text-[12px] font-bold text-[#0F294D] mb-2">
            ३. सेवा अनुसार निवेदन ढाँचा तथा सेवा प्रवाहको तथ्याङ्क (निरन्तरता - पृष्ठ ३)
          </h3>
          <table className="w-full border-collapse border border-slate-500 text-[10px]">
            <thead>
              <tr className="bg-[#0F294D] text-white">
                <th className="border border-slate-500 px-1 py-1.5 w-[5%]">क्र.सं.</th>
                <th className="border border-slate-500 px-1.5 py-1.5 text-left w-[17%]">सेवाको नाम</th>
                <th className="border border-slate-500 px-1.5 py-1.5 text-left w-[18%]">निवेदन ढाँचाको स्थिति/स्वीकृति मिति</th>
                <th className="border border-slate-500 px-1.5 py-1.5 text-left w-[19%]">उपलब्धता</th>
                <th className="border border-slate-500 px-1.5 py-1.5 text-center w-[19%]">निवेदन संख्या (प्राप्त/फर्छ्योट/बाँकी/फिर्ता)</th>
                <th className="border border-slate-500 px-1.5 py-1.5 text-left w-[22%]">समयसीमा तथा कारण/कैफियत</th>
              </tr>
            </thead>
            <tbody>
              {extraServices.map((sv, idx) => (
                <tr key={idx}>
                  <td className="border border-slate-500 px-1 py-1 text-center">{toDevanagariDigits(idx + 7)}</td>
                  <td className="border border-slate-500 px-1.5 py-1 font-medium">{sv.service_name}</td>
                  <td className="border border-slate-500 px-1.5 py-1">
                    <CheckBoxPrint checked={sv.is_prepared} label="तयार" />
                    <CheckBoxPrint checked={sv.is_approved} label="स्वीकृत" />
                    <CheckBoxPrint checked={sv.is_in_use} label="प्रयोग" />
                    <div>मिति: {sv.approval_date ? toDevanagariDigits(sv.approval_date) : '—'}</div>
                  </td>
                  <td className="border border-slate-500 px-1.5 py-1">
                    <CheckBoxPrint checked={sv.is_free} label="निःशुल्क" />
                    <CheckBoxPrint checked={sv.is_notice_board} label="बोर्ड" />
                    <div>वेबसाइट: {sv.is_website ? sv.website_url || 'उपलब्ध' : '—'}</div>
                  </td>
                  <td className="border border-slate-500 px-1.5 py-1 text-center tabular-nums">
                    {toDevanagariDigits(sv.received_count)} / {toDevanagariDigits(sv.disposed_count)} /{' '}
                    {toDevanagariDigits(sv.pending_count)} / {toDevanagariDigits(sv.returned_count)}
                  </td>
                  <td className="border border-slate-500 px-1.5 py-1">
                    <div>समयसीमाभित्र: {toDevanagariDigits(sv.within_deadline_count)} ({sv.prescribed_timeline})</div>
                    <div>{sv.remarks}</div>
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold tabular-nums">
                <td className="border border-slate-500 px-2 py-1.5 text-center" colSpan={4}>
                  जम्मा (सबै सेवाको कुल योग)
                </td>
                <td className="border border-slate-500 px-2 py-1.5 text-center">
                  {toDevanagariDigits(totalReceived)} / {toDevanagariDigits(totalDisposed)} / {toDevanagariDigits(totalPending)} /{' '}
                  {toDevanagariDigits(totalReturned)}
                </td>
                <td className="border border-slate-500 px-2 py-1.5">
                  समयभित्र फर्छ्योट: {toDevanagariDigits(totalWithin)} ({toDevanagariDigits(withinPct)}%)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 overflow-y-auto p-4 sm:p-6 print:static print:bg-white print:p-0 print:overflow-visible">
      <div className="max-w-[900px] mx-auto">
        <div className="no-print flex items-center justify-between gap-4 bg-[#0F294D] text-white px-4 py-3 rounded-t-lg">
          <div>
            <h3 className="text-sm font-bold">आधिकारिक २-पृष्ठ त्रैमासिक प्रगति प्रतिवेदन (PDF / Print पूर्वावलोकन)</h3>
            <p className="text-xs text-slate-300">{submission.office.name_np} · {submission.fiscal_year_np} {submission.quarter_name_np}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#0F294D] text-xs font-bold rounded hover:bg-slate-100 whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Download PDF
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded hover:bg-white/10 text-white"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="bg-slate-100 p-4 sm:p-6 rounded-b-lg print:bg-white print:p-0">{content}</div>
      </div>
    </div>
  );
}
