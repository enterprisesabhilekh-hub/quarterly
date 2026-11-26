import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useI18n } from '../context/I18nContext.tsx';
import { NotificationItem } from '../types/index.ts';

interface Props {
  onOpenSubmission?: (submissionId: number) => void;
}

export function NotificationsView({ onOpenSubmission }: Props) {
  const { apiFetch } = useAuth();
  const { lang, t } = useI18n();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [passErr, setPassErr] = useState('');

  const load = () => {
    apiFetch<{ notifications: NotificationItem[] }>('/api/notifications').then((d) => setItems(d.notifications));
  };

  useEffect(() => {
    load();
  }, []);

  const markAllRead = async () => {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    load();
  };

  const handleChangePass = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg('');
    setPassErr('');
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPassMsg(res.message);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: unknown) {
      setPassErr(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#0F294D]" />
            <h2 className="text-base font-bold text-[#0F294D]">{t('सूचना तथा सन्देशहरू', 'Notifications & Alerts')}</h2>
          </div>
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded hover:bg-slate-50"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {t('सबै पठित चिन्ह लगाउनुहोस्', 'Mark All Read')}
          </button>
        </div>

        <div className="divide-y divide-slate-200">
          {items.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">{t('कुनै सूचना छैन।', 'No notifications.')}</p>
          ) : (
            items.map((n) => (
              <div key={n.id} className={`py-3.5 px-2 flex items-start justify-between gap-4 ${n.is_read ? 'opacity-70' : 'bg-blue-50/30'}`}>
                <div>
                  <p className="text-xs font-bold text-[#0F294D]">{lang === 'ne' ? n.title_np : n.title_en}</p>
                  <p className="text-xs text-slate-700 mt-1">{lang === 'ne' ? n.message_np : n.message_en}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{n.created_at}</p>
                </div>
                {n.link_submission_id && onOpenSubmission && (
                  <button
                    type="button"
                    onClick={() => onOpenSubmission(n.link_submission_id!)}
                    className="text-xs font-semibold text-[#0F294D] hover:underline shrink-0"
                  >
                    {t('खोल्नुहोस्', 'Open')}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Password Change Panel */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 text-[#0F294D]" />
          <h3 className="text-sm font-bold text-[#0F294D]">{t('पासवर्ड परिवर्तन', 'Change Password')}</h3>
        </div>
        {passErr && <div className="mb-3 p-2.5 rounded bg-red-50 border border-red-200 text-xs text-red-800">{passErr}</div>}
        {passMsg && <div className="mb-3 p-2.5 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{passMsg}</div>}
        <form onSubmit={handleChangePass} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('हालको पासवर्ड', 'Current Password')}</label>
            <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('नयाँ पासवर्ड (कम्तीमा ६ अक्षर)', 'New Password (min 6 chars)')}</label>
            <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded" />
          </div>
          <button type="submit" className="w-full py-2 bg-[#0F294D] text-white font-semibold rounded hover:bg-[#173a6b]">
            {t('पासवर्ड अद्यावधिक गर्नुहोस्', 'Update Password')}
          </button>
        </form>
      </div>
    </div>
  );
}
