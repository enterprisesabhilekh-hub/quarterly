import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ArrowRight, KeyRound, ShieldCheck, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useI18n } from '../context/I18nContext.tsx';
import { NvcLogo } from './NvcLogo.tsx';

const ROLE_ACCOUNTS = [
  {
    roleNp: 'सुपर एडमिनिस्ट्रेटर',
    roleEn: 'Super Administrator',
    email: 'superadmin@nvc.gov.np',
    descNp: 'प्रणाली, प्रयोगकर्ता, मास्टर डाटा र अवधि व्यवस्थापन',
    descEn: 'System config, users, master data & period setup',
  },
  {
    roleNp: 'केन्द्र प्रशासक (NVC Admin)',
    roleEn: 'NVC Administrator',
    email: 'admin@nvc.gov.np',
    descNp: 'राष्ट्रिय ड्यासबोर्ड, नक्सा, समीक्षा तथा Excel/PDF निर्यात',
    descEn: 'National dashboard, map, reviews & Excel/PDF exports',
  },
  {
    roleNp: 'केन्द्र समीक्षा अधिकृत',
    roleEn: 'Center Review Officer',
    email: 'reviewer@nvc.gov.np',
    descNp: 'सूचकगत समीक्षा, टिप्पणी तथा निर्देशन प्रेषण',
    descEn: 'Indicator review, feedback & directives',
  },
  {
    roleNp: 'मन्त्रालय प्रयोगकर्ता (गृह)',
    roleEn: 'Ministry User (MoHA)',
    email: 'ministry@moha.gov.np',
    descNp: 'मन्त्रालयअन्तर्गतका कार्यालयहरूको अनुगमन',
    descEn: 'Monitor subordinate ministry offices',
  },
  {
    roleNp: 'सरकारी कार्यालय (जि.प्र.का. काठमाडौं)',
    roleEn: 'Office User (DAO Kathmandu)',
    email: 'office.dao.ktm@gov.np',
    descNp: 'प्रतिवेदन भर्ने, फिर्ता टिप्पणीको जवाफ दिने र पुनः पेश गर्ने',
    descEn: 'Fill report, reply to feedback & resubmit',
  },
  {
    roleNp: 'सरकारी कार्यालय (जि.प्र.का. दार्चुला)',
    roleEn: 'Office User (DAO Darchula)',
    email: 'office.darchula@gov.np',
    descNp: 'मस्यौदा प्रतिवेदन सम्पादन, प्रमाण अपलोड र प्रमाणीकरण',
    descEn: 'Edit draft report, upload evidence & certify',
  },
  {
    roleNp: 'अवलोकनकर्ता / लेखापरीक्षक',
    roleEn: 'Viewer / Auditor',
    email: 'auditor@nvc.gov.np',
    descNp: 'पढ्ने मात्र (Read-Only) अनुगमन र विश्लेषण पहुँच',
    descEn: 'Read-only monitoring & analytics access',
  },
];

export function LoginPage() {
  const { login, loading } = useAuth();
  const { lang, toggleLang, t } = useI18n();

  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [identifier, setIdentifier] = useState('admin@nvc.gov.np');
  const [password, setPassword] = useState('Nvc@2083');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Reset password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [previewCode, setPreviewCode] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    try {
      await login(identifier, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setInfoMsg(data.message);
      if (data.previewResetCode) setPreviewCode(data.previewResetCode);
      setMode('reset');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, code: resetCode, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setInfoMsg(data.message);
      setMode('login');
      setIdentifier(resetEmail);
      setPassword(newPassword);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col">
      {/* Official Government Top Strip */}
      <div className="bg-[#0F294D] text-white border-b-4 border-[#B91C1C]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <NvcLogo size={42} />
            <div className="min-w-0">
              <p className="text-xs text-slate-300 leading-tight truncate">
                {t('नेपाल सरकार · प्रधानमन्त्री तथा मन्त्रिपरिषद्को कार्यालय मातहत', 'Government of Nepal · Under Office of the Prime Minister and Council of Ministers')}
              </p>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                {t('राष्ट्रिय सतर्कता केन्द्र', 'National Vigilance Center')}
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleLang}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 rounded border border-white/20 text-white whitespace-nowrap shrink-0 transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === 'ne' ? 'English' : 'नेपाली'}
          </button>
        </div>
      </div>

      {/* Main Content Split */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Official Directive Context & Quick Role Accounts */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8">
            <p className="text-xs font-semibold text-[#B91C1C] tracking-wide mb-2">
              {t('निर्णय मिति: २०८३/०४/२१ · एकीकृत डिजिटल अनुगमन पोर्टल', 'Decision Date: 2083/04/21 BS · Unified Digital Monitoring Portal')}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0F294D] leading-snug mb-3">
              {t(
                'सरकारी कार्यालयमा प्रयोग हुने निवेदनको ढाँचा तथा सोको कार्यान्वयन मार्गदर्शन, २०८३',
                'Application Format and Implementation Directive for Government Offices, 2083'
              )}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-6">
              {t(
                'नेपालभरका संघीय, प्रदेश र स्थानीय तहका सरकारी कार्यालयहरूले त्रैमासिक प्रगति प्रतिवेदन अनलाइन भर्न, प्रमाण संलग्न गरी प्रमाणीकरण गर्न तथा राष्ट्रिय सतर्कता केन्द्रले देशभरको कार्यान्वयन अवस्था अनुगमन एवं विश्लेषण गर्न तयार गरिएको आधिकारिक प्रणाली।',
                'Official national monitoring platform enabling federal, provincial, and local government offices across Nepal to submit standardized quarterly progress reports with evidence and enabling the National Vigilance Center to review and analyze national compliance.'
              )}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-500">{t('भौगोलिक दायरा', 'Coverage')}</p>
                <p className="text-lg font-bold text-[#0F294D] tabular-nums">{t('७ प्रदेश · ७७ जिल्ला', '7 Provinces · 77 Districts')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('प्रतिवेदन ढाँचा', 'Report Structure')}</p>
                <p className="text-lg font-bold text-[#0F294D] tabular-nums">{t('४ खण्ड · ९ अनिवार्य सूचक', '4 Sections · 9 Indicators')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('त्रैमासिक चक्र', 'Reporting Cycle')}</p>
                <p className="text-lg font-bold text-[#0F294D] tabular-nums">{t('श्रावण – असार (वि.सं.)', 'Shrawan – Ashadh (BS)')}</p>
              </div>
            </div>
          </div>

          {/* Role Test Accounts Selector */}
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#0F294D]">
                  {t('प्रणाली परीक्षणका लागि भूमिकागत खाता (पासवर्ड: Nvc@2083)', 'Role-Based Portal Accounts (Password: Nvc@2083)')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t('कुनै पनि भूमिका छनोट गरी विवरण स्वतः भर्नुहोस् र लगइन गर्नुहोस्', 'Click any role below to fill credentials and test role-based access')}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ROLE_ACCOUNTS.map((acc) => {
                const isSelected = identifier === acc.email;
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setIdentifier(acc.email);
                      setPassword('Nvc@2083');
                      setError('');
                    }}
                    className={`text-left p-3 rounded-md border transition-colors ${
                      isSelected
                        ? 'bg-[#0F294D]/5 border-[#0F294D] ring-1 ring-[#0F294D]'
                        : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#0F294D] truncate">
                        {lang === 'ne' ? acc.roleNp : acc.roleEn}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0">{acc.email}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-1">
                      {lang === 'ne' ? acc.descNp : acc.descEn}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Login / Forgot / Reset Card */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-slate-100">
              <div className="w-9 h-9 rounded-md bg-[#0F294D] text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0F294D]">
                  {mode === 'login'
                    ? t('प्रणाली प्रवेश (Login)', 'Portal Sign In')
                    : mode === 'forgot'
                    ? t('पासवर्ड बिर्सनुभयो?', 'Forgot Password')
                    : t('नयाँ पासवर्ड सेट गर्नुहोस्', 'Reset Password')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t('आधिकारिक प्रयोगकर्ता नाम वा इमेल प्रयोग गर्नुहोस्', 'Use your official username or email')}
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-xs text-red-800">
                {error}
              </div>
            )}
            {infoMsg && (
              <div className="mb-4 p-3 rounded border border-emerald-200 bg-emerald-50 text-xs text-emerald-800">
                {infoMsg}
                {previewCode && (
                  <div className="mt-1 font-mono font-bold">
                    {t('प्रमाणीकरण कोड:', 'Verification Code:')} {previewCode}
                  </div>
                )}
              </div>
            )}

            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('प्रयोगकर्ता नाम वा इमेल', 'Username or Email')}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0F294D] focus:border-[#0F294D]"
                      placeholder="username or email@gov.np"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('पासवर्ड', 'Password')}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0F294D] focus:border-[#0F294D]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      aria-label="Toggle password visibility"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setResetEmail(identifier.includes('@') ? identifier : '');
                      setError('');
                      setInfoMsg('');
                    }}
                    className="text-xs font-medium text-[#0F294D] hover:underline"
                  >
                    {t('पासवर्ड बिर्सनुभयो?', 'Forgot password?')}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-[#0F294D] hover:bg-[#173a6b] text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-60"
                >
                  <span>{loading ? t('प्रवेश हुँदैछ...', 'Signing in...') : t('प्रणालीमा प्रवेश गर्नुहोस्', 'Sign In to Portal')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {mode === 'forgot' && (
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('दर्ता गरिएको इमेल ठेगाना', 'Registered Email Address')}
                  </label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0F294D]"
                    placeholder="name@gov.np"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="px-4 py-2 text-xs font-medium border border-slate-300 rounded-md hover:bg-slate-50"
                  >
                    {t('फिर्ता', 'Back')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-[#0F294D] text-white text-sm font-semibold rounded-md hover:bg-[#173a6b]"
                  >
                    <KeyRound className="w-4 h-4" />
                    {t('प्रमाणीकरण कोड पठाउनुहोस्', 'Send Verification Code')}
                  </button>
                </div>
              </form>
            )}

            {mode === 'reset' && (
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('इमेल', 'Email')}</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('६ अंकको कोड', '6-Digit Code')}</label>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('नयाँ पासवर्ड (कम्तीमा ६ अक्षर)', 'New Password (min 6 chars)')}</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="px-4 py-2 text-xs font-medium border border-slate-300 rounded-md hover:bg-slate-50"
                  >
                    {t('रद्द गर्नुहोस्', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 bg-[#0F294D] text-white text-sm font-semibold rounded-md hover:bg-[#173a6b]"
                  >
                    {t('पासवर्ड अपडेट गर्नुहोस्', 'Update Password')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
