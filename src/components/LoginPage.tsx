import React, { useEffect, useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useI18n } from '../context/I18nContext.tsx';
import emblem from '../../emblem.webp';
import nepalFlag from '../../nepal.gif';
import NepaliDate from 'nepali-date-converter';

export function LoginPage() {
  const { login, changePassword, loading, user } = useAuth();
  const { t } = useI18n();

  const [mode, setMode] = useState<'login' | 'forgot' | 'reset' | 'signup' | 'change'>(
    user?.must_change_password ? 'change' : 'login'
  );
  const [identifier, setIdentifier] = useState('admin@nvc.gov.np');
  const [password, setPassword] = useState('Nvc@2083');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Reset password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signup, setSignup] = useState({
    username: '',
    email: '',
    full_name_np: '',
    phone: '',
    office_id: '',
  });
  const [offices, setOffices] = useState<Array<{ id: number; office_code: string; name_np: string }>>([]);
  const [signupLoading, setSignupLoading] = useState(false);

  const currentNepaliDate = new NepaliDate(new Date());
  const nepaliDateLabel = `वि.सं. ${currentNepaliDate.format('YYYY MMMM DD', 'np')}, ${currentNepaliDate.format('ddd', 'np')}`;

  useEffect(() => {
    if (user?.must_change_password) {
      setMode('change');
      setError('');
      setInfoMsg('');
    }
  }, [user?.must_change_password]);

  useEffect(() => {
    if (mode !== 'signup' || offices.length > 0) return;
    fetch('/api/public/offices')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'कार्यालय सूची लोड गर्न सकिएन।');
        setOffices(data.offices);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'कार्यालय सूची लोड गर्न सकिएन।'));
  }, [mode, offices.length]);

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setSignupLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...signup, office_id: Number(signup.office_id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'दर्ता अनुरोध पठाउन सकिएन।');
      setInfoMsg(data.message);
      setSignup({ username: '', email: '', full_name_np: '', phone: '', office_id: '' });
      setMode('login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'दर्ता अनुरोध पठाउन सकिएन।');
    } finally {
      setSignupLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    if (newPassword !== confirmPassword) {
      setError(t('नयाँ पासवर्डहरू मेल खाएनन्।', 'The new passwords do not match.'));
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'पासवर्ड परिवर्तन गर्न सकिएन।');
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <img src={emblem} alt="National Vigilance Center Emblem" className="h-[42px] w-[42px] shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="text-xs text-slate-300 leading-tight truncate">
                {t('नेपाल सरकार', 'Government of Nepal')}
              </p>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                {t('राष्ट्रिय सतर्कता केन्द्र', 'National Vigilance Center')}
              </h1>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 text-xs sm:text-sm text-white">
            <span className="whitespace-nowrap">{nepaliDateLabel}</span>
            <img src={nepalFlag} alt="नेपालको झण्डा" className="h-7 w-7 shrink-0 object-contain" />
          </div>
          {/* <button
            type="button"
            onClick={toggleLang}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 rounded border border-white/20 text-white whitespace-nowrap shrink-0 transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === 'ne' ? 'English' : 'नेपाली'}
          </button> */}
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
                    : mode === 'signup'
                    ? t('नयाँ खाता दर्ता', 'Create an Account')
                    : mode === 'change'
                    ? t('अस्थायी पासवर्ड परिवर्तन गर्नुहोस्', 'Change Temporary Password')
                    : mode === 'forgot'
                    ? t('पासवर्ड बिर्सनुभयो?', 'Forgot Password')
                    : t('नयाँ पासवर्ड सेट गर्नुहोस्', 'Reset Password')}
                </h3>
                <p className="text-xs text-slate-500">
                  {mode === 'change'
                    ? t('पहिलो प्रवेशअघि नयाँ पासवर्ड राख्नुहोस्।', 'Set a new password before continuing.')
                    : mode === 'signup'
                    ? t('प्रशासकको स्वीकृतिपछि अस्थायी पासवर्ड इमेलमा पठाइनेछ।', 'An administrator will review your request and email a temporary password.')
                    : t('आधिकारिक प्रयोगकर्ता नाम वा इमेल प्रयोग गर्नुहोस्', 'Use your official username or email')}
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
                <p className="text-center text-xs text-slate-600">
                  {t('खाता छैन?', "Don't have an account?")}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setError('');
                      setInfoMsg('');
                    }}
                    className="font-semibold text-[#0F294D] hover:underline"
                  >
                    {t('दर्ता गर्नुहोस्', 'Sign up')}
                  </button>
                </p>
              </form>
            )}

            {mode === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('प्रयोगकर्ता नाम', 'Username')}</label>
                  <input
                    value={signup.username}
                    onChange={(e) => setSignup({ ...signup, username: e.target.value })}
                    required
                    minLength={3}
                    maxLength={32}
                    pattern="[A-Za-z0-9._-]+"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-md"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('इमेल', 'Email')}</label>
                  <input
                    type="email"
                    value={signup.email}
                    onChange={(e) => setSignup({ ...signup, email: e.target.value })}
                    required
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-md"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('पूरा नाम', 'Full name')}</label>
                  <input
                    value={signup.full_name_np}
                    onChange={(e) => setSignup({ ...signup, full_name_np: e.target.value })}
                    required
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-md"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('सम्बन्धित सरकारी कार्यालय', 'Government office')}</label>
                  <select
                    value={signup.office_id}
                    onChange={(e) => setSignup({ ...signup, office_id: e.target.value })}
                    required
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="">{t('कार्यालय छान्नुहोस्', 'Select an office')}</option>
                    {offices.map((office) => (
                      <option key={office.id} value={office.id}>
                        {office.name_np}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('फोन (ऐच्छिक)', 'Phone (optional)')}</label>
                  <input
                    type="tel"
                    value={signup.phone}
                    onChange={(e) => setSignup({ ...signup, phone: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-md"
                    autoComplete="tel"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError('');
                      setInfoMsg('');
                    }}
                    className="px-4 py-2 text-xs font-medium border border-slate-300 rounded-md hover:bg-slate-50"
                  >
                    {t('फिर्ता', 'Back')}
                  </button>
                  <button
                    type="submit"
                    disabled={signupLoading || offices.length === 0}
                    className="flex-1 py-2.5 px-4 bg-[#0F294D] text-white text-sm font-semibold rounded-md hover:bg-[#173a6b] disabled:opacity-60"
                  >
                    {signupLoading ? t('पठाउँदैछ...', 'Submitting...') : t('स्वीकृतिका लागि पठाउनुहोस्', 'Request approval')}
                  </button>
                </div>
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

            {mode === 'change' && (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('हालको/अस्थायी पासवर्ड', 'Current / temporary password')}</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('नयाँ पासवर्ड (कम्तीमा ६ अक्षर)', 'New password (at least 6 characters)')}</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('नयाँ पासवर्ड पुनः लेख्नुहोस्', 'Confirm new password')}</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-[#0F294D] text-white text-sm font-semibold rounded-md hover:bg-[#173a6b]"
                >
                  {t('पासवर्ड परिवर्तन गरी जारी राख्नुहोस्', 'Change password and continue')}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
