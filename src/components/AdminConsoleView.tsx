import React, { useEffect, useState } from 'react';
import { Database, Download, Plus, Shield, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useI18n } from '../context/I18nContext.tsx';
import { GovtLevel } from '../types/index.ts';

interface AdminUserRow {
  id: number;
  username: string;
  email: string;
  full_name_np: string;
  role_code: string;
  role_name_np: string;
  ministry_name_np: string | null;
  is_active: boolean;
  offices: Array<{ office_id: number; office_name_np: string }>;
}

interface AuditLogRow {
  id: number;
  username: string | null;
  full_name_np: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details_json: string;
  created_at: string;
}

export function AdminConsoleView() {
  const { user, master, refreshMaster, apiFetch, apiDownload } = useAuth();
  const { lang, t } = useI18n();

  const [tab, setTab] = useState<'periods' | 'offices' | 'users' | 'audit'>('periods');
  const [usersList, setUsersList] = useState<AdminUserRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // New office form
  const [newOff, setNewOff] = useState({
    office_code: '',
    name_np: '',
    name_en: '',
    office_type_np: 'सरकारी कार्यालय',
    govt_level: 'federal' as GovtLevel,
    ministry_id: 2,
    province_id: 3,
    district_id: 27,
    address_np: '',
    office_head_name: '',
    contact_phone: '',
    email: '',
  });

  // New user form
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    full_name_np: '',
    designation_np: '',
    role_code: 'office_user',
    ministry_id: '',
    office_id: '',
  });

  const isSuper = user?.role === 'super_admin';

  const loadAdminData = async () => {
    try {
      const uRes = await apiFetch<{ users: AdminUserRow[] }>('/api/admin/users');
      setUsersList(uRes.users);
      const aRes = await apiFetch<{ logs: AuditLogRow[] }>('/api/admin/audit-logs');
      setAuditLogs(aRes.logs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data');
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const togglePeriod = async (periodId: number, currentStatus: 'open' | 'closed', deadlineBs: string, deadlineAd: string) => {
    setError('');
    setMsg('');
    try {
      await apiFetch(`/api/admin/periods/${periodId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: currentStatus === 'open' ? 'closed' : 'open',
          deadline_bs: deadlineBs,
          deadline_ad: deadlineAd,
        }),
      });
      await refreshMaster();
      setMsg(t('प्रतिवेदन अवधि अद्यावधिक गरियो।', 'Reporting period updated.'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleCreateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await apiFetch('/api/admin/offices', {
        method: 'POST',
        body: JSON.stringify(newOff),
      });
      await refreshMaster();
      setMsg(t('नयाँ सरकारी कार्यालय दर्ता गरियो।', 'New office registered.'));
      setNewOff({ ...newOff, office_code: '', name_np: '', name_en: '', address_np: '', office_head_name: '', contact_phone: '', email: '' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          ...newUser,
          ministry_id: newUser.ministry_id ? Number(newUser.ministry_id) : null,
          office_id: newUser.office_id ? Number(newUser.office_id) : null,
        }),
      });
      await loadAdminData();
      setMsg(t('नयाँ प्रयोगकर्ता सिर्जना गरियो।', 'New user created.'));
      setNewUser({ username: '', email: '', password: '', full_name_np: '', designation_np: '', role_code: 'office_user', ministry_id: '', office_id: '' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#0F294D]">{t('प्रणाली प्रशासन तथा मास्टर डाटा व्यवस्थापन', 'System Administration & Master Data')}</h2>
          <p className="text-xs text-slate-500">
            {t('प्रतिवेदन अवधि, कार्यालय दर्ता, प्रयोगकर्ता भूमिका र अडिट लग व्यवस्थापन', 'Manage reporting periods, offices, user roles, and audit logs')}
          </p>
        </div>
        {isSuper && (
          <button
            type="button"
            onClick={() => apiDownload('/api/admin/backup', 'nvc_monitoring_backup.db')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F294D] text-white text-xs font-semibold rounded-md hover:bg-[#173a6b]"
          >
            <Download className="w-3.5 h-3.5" />
            {t('Database Backup (.db)', 'Database Backup')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-white border border-slate-200 rounded-lg p-1.5 w-fit">
        {(
          [
            ['periods', 'प्रतिवेदन अवधि र म्याद', 'Reporting Periods'],
            ['offices', 'सरकारी कार्यालयहरू', 'Government Offices'],
            ['users', 'प्रयोगकर्ता र भूमिका', 'Users & Roles'],
            ['audit', 'अडिट लग (Audit Log)', 'Audit Logs'],
          ] as const
        ).map(([id, np, en]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === id ? 'bg-[#0F294D] text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {lang === 'ne' ? np : en}
          </button>
        ))}
      </div>

      {error && <div className="p-3 rounded bg-red-50 border border-red-200 text-xs text-red-800">{error}</div>}
      {msg && <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{msg}</div>}

      {/* Reporting Periods */}
      {tab === 'periods' && master && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-bold text-[#0F294D] mb-4">{t('त्रैमासिक प्रतिवेदन अवधि र अन्तिम मिति व्यवस्थापन', 'Reporting Periods & Deadlines')}</h3>
          <div className="overflow-x-auto border border-slate-200 rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-2.5 text-left">{t('आर्थिक वर्ष', 'Fiscal Year')}</th>
                  <th className="p-2.5 text-left">{t('त्रैमासिक', 'Quarter')}</th>
                  <th className="p-2.5 text-left">{t('अवधि (वि.सं.)', 'Period (BS)')}</th>
                  <th className="p-2.5 text-left">{t('अन्तिम मिति (वि.सं.)', 'Deadline (BS)')}</th>
                  <th className="p-2.5 text-center">{t('अवस्था', 'Status')}</th>
                  <th className="p-2.5 text-right">{t('कार्य', 'Action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {master.reporting_periods.map((p) => (
                  <tr key={p.id}>
                    <td className="p-2.5 font-bold">{p.fiscal_year_np}</td>
                    <td className="p-2.5">{lang === 'ne' ? p.quarter_name_np : p.quarter_name_en}</td>
                    <td className="p-2.5">{p.start_date_bs} – {p.end_date_bs}</td>
                    <td className="p-2.5 font-mono">{p.deadline_bs}</td>
                    <td className="p-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${p.status === 'open' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {p.status === 'open' ? t('खुला (Open)', 'Open') : t('बन्द (Closed)', 'Closed')}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => togglePeriod(p.id, p.status, p.deadline_bs, p.deadline_ad)}
                        className="px-3 py-1 text-xs font-semibold border border-slate-300 rounded hover:bg-slate-50"
                      >
                        {p.status === 'open' ? t('बन्द गर्नुहोस्', 'Close') : t('खुला गर्नुहोस्', 'Open')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Offices */}
      {tab === 'offices' && master && (
        <div className="space-y-5">
          {isSuper && (
            <form onSubmit={handleCreateOffice} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#0F294D] flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                {t('नयाँ सरकारी कार्यालय दर्ता गर्नुहोस्', 'Register New Government Office')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <input required placeholder="Office Code (उदा: NVC-FED-099)" value={newOff.office_code} onChange={(e) => setNewOff({ ...newOff, office_code: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded" />
                <input required placeholder="कार्यालयको नाम (नेपाली)" value={newOff.name_np} onChange={(e) => setNewOff({ ...newOff, name_np: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded" />
                <input placeholder="Office Name (English)" value={newOff.name_en} onChange={(e) => setNewOff({ ...newOff, name_en: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded" />
                <select value={newOff.govt_level} onChange={(e) => setNewOff({ ...newOff, govt_level: e.target.value as GovtLevel })} className="px-2.5 py-2 border border-slate-300 rounded bg-white">
                  <option value="federal">संघीय तह</option>
                  <option value="provincial">प्रदेश तह</option>
                  <option value="local">स्थानीय तह</option>
                </select>
                <select value={newOff.ministry_id} onChange={(e) => setNewOff({ ...newOff, ministry_id: Number(e.target.value) })} className="px-2.5 py-2 border border-slate-300 rounded bg-white">
                  {master.ministries.map((m) => <option key={m.id} value={m.id}>{m.name_np}</option>)}
                </select>
                <select value={newOff.province_id} onChange={(e) => setNewOff({ ...newOff, province_id: Number(e.target.value) })} className="px-2.5 py-2 border border-slate-300 rounded bg-white">
                  {master.provinces.map((p) => <option key={p.id} value={p.id}>{p.name_np}</option>)}
                </select>
                <select value={newOff.district_id} onChange={(e) => setNewOff({ ...newOff, district_id: Number(e.target.value) })} className="px-2.5 py-2 border border-slate-300 rounded bg-white">
                  {master.districts.filter((d) => d.province_id === newOff.province_id).map((d) => <option key={d.id} value={d.id}>{d.name_np}</option>)}
                </select>
                <input placeholder="ठेगाना" value={newOff.address_np} onChange={(e) => setNewOff({ ...newOff, address_np: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded" />
                <input placeholder="कार्यालय प्रमुख" value={newOff.office_head_name} onChange={(e) => setNewOff({ ...newOff, office_head_name: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded" />
                <input placeholder="सम्पर्क फोन" value={newOff.contact_phone} onChange={(e) => setNewOff({ ...newOff, contact_phone: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded" />
                <input placeholder="Email" value={newOff.email} onChange={(e) => setNewOff({ ...newOff, email: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded" />
                <button type="submit" className="px-4 py-2 bg-[#0F294D] text-white font-semibold rounded hover:bg-[#173a6b]">
                  {t('कार्यालय थप्नुहोस्', 'Add Office')}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-lg p-5 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-2.5 text-left">Code</th>
                  <th className="p-2.5 text-left">{t('कार्यालयको नाम', 'Office')}</th>
                  <th className="p-2.5 text-left">{t('प्रदेश / जिल्ला', 'Province / District')}</th>
                  <th className="p-2.5 text-left">{t('कार्यालय प्रमुख', 'Office Head')}</th>
                  <th className="p-2.5 text-center">{t('स्थिति', 'Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {master.offices.map((o) => (
                  <tr key={o.id}>
                    <td className="p-2.5 font-mono">{o.office_code}</td>
                    <td className="p-2.5 font-semibold">{o.name_np}</td>
                    <td className="p-2.5">{o.province_name_np} · {o.district_name_np}</td>
                    <td className="p-2.5">{o.office_head_name}</td>
                    <td className="p-2.5 text-center">
                      {isSuper ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/offices/${o.id}/toggle`, { method: 'PATCH' });
                            refreshMaster();
                          }}
                          className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${o.is_active ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                        >
                          {o.is_active ? 'Active' : 'Inactive'}
                        </button>
                      ) : (
                        <span>{o.is_active ? 'Active' : 'Inactive'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users */}
      {tab === 'users' && master && (
        <div className="space-y-5">
          {isSuper && (
            <form onSubmit={handleCreateUser} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#0F294D] flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {t('नयाँ प्रयोगकर्ता थप्नुहोस्', 'Create New User Account')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <input required placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded" />
                <input required type="email" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded" />
                <input required type="password" placeholder="Password (min 6)" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded" />
                <input required placeholder="पूरा नाम (नेपाली)" value={newUser.full_name_np} onChange={(e) => setNewUser({ ...newUser, full_name_np: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded" />
                <select value={newUser.role_code} onChange={(e) => setNewUser({ ...newUser, role_code: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded bg-white">
                  {master.roles.map((r) => <option key={r.code} value={r.code}>{r.name_np}</option>)}
                </select>
                <select value={newUser.ministry_id} onChange={(e) => setNewUser({ ...newUser, ministry_id: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded bg-white">
                  <option value="">मन्त्रालय (ऐच्छिक)</option>
                  {master.ministries.map((m) => <option key={m.id} value={m.id}>{m.name_np}</option>)}
                </select>
                <select value={newUser.office_id} onChange={(e) => setNewUser({ ...newUser, office_id: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded bg-white">
                  <option value="">कार्यालय आबद्धता (ऐच्छिक)</option>
                  {master.offices.map((o) => <option key={o.id} value={o.id}>{o.name_np}</option>)}
                </select>
                <button type="submit" className="px-4 py-2 bg-[#0F294D] text-white font-semibold rounded hover:bg-[#173a6b]">
                  {t('प्रयोगकर्ता सिर्जना', 'Create User')}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-lg p-5 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-2.5 text-left">{t('प्रयोगकर्ता', 'User')}</th>
                  <th className="p-2.5 text-left">{t('भूमिका', 'Role')}</th>
                  <th className="p-2.5 text-left">{t('आबद्ध कार्यालय / मन्त्रालय', 'Linked Office / Ministry')}</th>
                  <th className="p-2.5 text-center">{t('स्थिति', 'Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {usersList.map((u) => (
                  <tr key={u.id}>
                    <td className="p-2.5">
                      <div className="font-semibold">{u.full_name_np}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{u.username} · {u.email}</div>
                    </td>
                    <td className="p-2.5 font-medium">{u.role_name_np}</td>
                    <td className="p-2.5 text-slate-600">
                      {u.offices.length > 0 ? u.offices.map((o) => o.office_name_np).join(', ') : u.ministry_name_np || 'केन्द्रीय स्तर'}
                    </td>
                    <td className="p-2.5 text-center">
                      {isSuper ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/users/${u.id}/toggle`, { method: 'PATCH' });
                            loadAdminData();
                          }}
                          className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${u.is_active ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                        >
                          {u.is_active ? 'Active' : 'Inactive'}
                        </button>
                      ) : (
                        <span>{u.is_active ? 'Active' : 'Inactive'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Logs */}
      {tab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 overflow-x-auto">
          <h3 className="text-sm font-bold text-[#0F294D] mb-3 flex items-center gap-1.5">
            <Shield className="w-4 h-4" />
            {t('प्रणाली सुरक्षा तथा क्रियाकलाप लग (Audit Trail)', 'System Security & Audit Trail')}
          </h3>
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="p-2 text-left">समय</th>
                <th className="p-2 text-left">प्रयोगकर्ता</th>
                <th className="p-2 text-left">क्रियाकलाप</th>
                <th className="p-2 text-left">विवरण</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="p-2 text-slate-500 whitespace-nowrap">{log.created_at}</td>
                  <td className="p-2 font-sans font-semibold">{log.full_name_np || log.username || 'System'}</td>
                  <td className="p-2 font-bold text-[#0F294D]">{log.action}</td>
                  <td className="p-2 text-slate-600">{log.entity_type} #{log.entity_id} {log.details_json}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
