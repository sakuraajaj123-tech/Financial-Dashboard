// AdminPhonesSettings.jsx — Admin WhatsApp recipients & Real-time Live Reminder Queue
// Strictly follows the Zero-Cost Architecture with instant test triggers and live queue monitoring

import { useState, useEffect } from 'react';
import {
  Bell,
  Phone,
  Plus,
  Trash2,
  Send,
  Loader2,
  CheckCircle,
  Clock,
  Home,
  User,
  AlertTriangle,
  Play,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../shared/Button';
import { db } from '../../lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';

const SETTINGS_DOC_REF = doc(db, 'settings', 'global_settings');
const REMINDERS_COLLECTION_REF = collection(db, 'pending_reminders');

export function AdminPhonesSettings() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  // ─── Admin Phones State ───────────────────────────────────────────────────
  const [adminPhones, setAdminPhones] = useState([]);
  const [newPhone, setNewPhone] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingPhones, setSavingPhones] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [testStatus, setTestStatus] = useState({}); // { [phone_type]: 'loading' | 'sent' | 'error' }

  // ─── Live Queue State ─────────────────────────────────────────────────────
  const [queue, setQueue] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [triggeringCron, setTriggeringCron] = useState(false);
  const [cronResult, setCronResult] = useState(null);

  // ─── 1. Load & Subscribe to Global Settings ──────────────────────────────
  useEffect(() => {
    async function loadSettings() {
      try {
        const snap = await getDoc(SETTINGS_DOC_REF);
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.adminPhones)) {
            setAdminPhones(data.adminPhones);
          }
        }
      } catch (err) {
        console.error('[AdminSettings] Failed to fetch settings:', err);
      } finally {
        setLoadingSettings(false);
      }
    }
    loadSettings();
  }, []);

  // ─── 2. Live Subscription to pending_reminders ───────────────────────────
  useEffect(() => {
    const unsubscribe = onSnapshot(
      REMINDERS_COLLECTION_REF,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        // Sort by triggerTime ascending (earliest first)
        items.sort((a, b) => {
          const timeA = a.triggerTime ? new Date(a.triggerTime).getTime() : 0;
          const timeB = b.triggerTime ? new Date(b.triggerTime).getTime() : 0;
          return timeA - timeB;
        });
        setQueue(items);
        setLoadingQueue(false);
      },
      (err) => {
        console.error('[AdminSettings] Error listening to reminder queue:', err);
        setLoadingQueue(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ─── Save phone numbers list to Firestore ─────────────────────────────────
  const savePhoneList = async (updatedList) => {
    setSavingPhones(true);
    try {
      await setDoc(SETTINGS_DOC_REF, { adminPhones: updatedList }, { merge: true });
      setAdminPhones(updatedList);
    } catch (err) {
      console.error('[AdminSettings] Failed to save phone list:', err);
    } finally {
      setSavingPhones(false);
    }
  };

  const handleAddPhone = (e) => {
    e.preventDefault();
    const clean = newPhone.trim();
    if (!clean) return;

    if (!clean.startsWith('+') && !clean.startsWith('00') && !clean.startsWith('966') && !clean.startsWith('05')) {
      setPhoneError(
        isArabic
          ? 'يرجى إدخال رقم هاتف بصيغة دولية صحيحة مثل +9665XXXXXXXX'
          : 'Please enter a valid international number e.g. +9665XXXXXXXX'
      );
      return;
    }

    let formatted = clean;
    if (formatted.startsWith('05')) {
      formatted = '+966' + formatted.slice(1);
    } else if (!formatted.startsWith('+')) {
      formatted = '+' + formatted;
    }

    if (adminPhones.includes(formatted)) {
      setPhoneError(isArabic ? 'هذا الرقم مضاف مسبقاً' : 'This phone number already exists');
      return;
    }

    setPhoneError('');
    const updated = [...adminPhones, formatted];
    savePhoneList(updated);
    setNewPhone('');
  };

  const handleRemovePhone = (phoneToRemove) => {
    const updated = adminPhones.filter((p) => p !== phoneToRemove);
    savePhoneList(updated);
  };

  // ─── Instant Template Test ────────────────────────────────────────────────
  const handleTestTemplate = async (phone, templateType) => {
    const key = `${phone}_${templateType}`;
    setTestStatus((prev) => ({ ...prev, [key]: 'loading' }));

    try {
      const mode = templateType === 'entry' ? 'entry_reminder' : 'reminder';
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          to: phone,
          unitNumber: '1',
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || `HTTP ${res.status}`);
      }

      setTestStatus((prev) => ({ ...prev, [key]: 'sent' }));
      setTimeout(() => {
        setTestStatus((prev) => ({ ...prev, [key]: null }));
      }, 4000);
    } catch (err) {
      console.error('[AdminSettings] Test send failed:', err);
      setTestStatus((prev) => ({ ...prev, [key]: 'error' }));
      setTimeout(() => {
        setTestStatus((prev) => ({ ...prev, [key]: null }));
      }, 4000);
    }
  };

  // ─── Manual Trigger Cron ──────────────────────────────────────────────────
  const handleTriggerCronNow = async () => {
    setTriggeringCron(true);
    setCronResult(null);
    try {
      let res = await fetch('/api/reminders/trigger', {
        method: 'POST',
      });

      if (!res.ok && res.status === 404) {
        res = await fetch('/.netlify/functions/booking-reminders', {
          method: 'POST',
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data.error) {
        data.error = `HTTP ${res.status}: ${res.statusText || 'Failed to trigger cron'}`;
      }
      setCronResult(data);
    } catch (err) {
      console.error('[AdminSettings] Manual cron trigger error:', err);
      setCronResult({ error: err.message });
    } finally {
      setTriggeringCron(false);
    }
  };

  // ─── Delete reminder from queue ───────────────────────────────────────────
  const handleDeleteQueueItem = async (docId) => {
    try {
      await deleteDoc(doc(db, 'pending_reminders', docId));
    } catch (err) {
      console.error('[AdminSettings] Failed to delete queue item:', err);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-12">

      {/* ─── Section 1: Admin WhatsApp Numbers ──────────────────────────────── */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 sm:p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {t('reminders.adminPhonesTitle')}
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-semibold border border-indigo-500/30">
                  {adminPhones.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{t('reminders.adminPhonesSubtitle')}</p>
            </div>
          </div>
        </div>

        {/* Add phone input form */}
        <form onSubmit={handleAddPhone} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="tel"
              placeholder={t('reminders.addPhonePlaceholder')}
              value={newPhone}
              onChange={(e) => {
                setNewPhone(e.target.value);
                if (phoneError) setPhoneError('');
              }}
              className={`w-full bg-slate-800/70 border rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none transition-all focus:ring-2 focus:ring-indigo-500/40 ${
                phoneError ? 'border-rose-500/60' : 'border-slate-700/60 hover:border-slate-600'
              }`}
            />
            {phoneError && <p className="text-xs text-rose-400 mt-1 font-medium">{phoneError}</p>}
          </div>
          <Button
            type="submit"
            variant="primary"
            size="md"
            icon={Plus}
            loading={savingPhones}
            disabled={!newPhone.trim() || savingPhones}
          >
            {t('reminders.addPhoneBtn')}
          </Button>
        </form>

        {/* Admin numbers list */}
        {loadingSettings ? (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : adminPhones.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-800/30 border border-slate-800 text-center space-y-2">
            <Phone className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-400">{t('reminders.noAdmins')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {adminPhones.map((phone) => {
              const entryKey = `${phone}_entry`;
              const exitKey = `${phone}_exit`;
              const entryState = testStatus[entryKey];
              const exitState = testStatus[exitKey];

              return (
                <div
                  key={phone}
                  className="rounded-xl bg-slate-800/40 border border-slate-700/50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:border-slate-600/70"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                      <Phone className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className="font-mono text-sm font-semibold text-slate-200" dir="ltr">
                      {phone}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Test Entry Template button */}
                    <button
                      onClick={() => handleTestTemplate(phone, 'entry')}
                      disabled={entryState === 'loading'}
                      title="Test check-in template (entry_reminder)"
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      {entryState === 'loading' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : entryState === 'sent' ? (
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      <span>{entryState === 'sent' ? t('reminders.testSent') : t('reminders.testEntryBtn')}</span>
                    </button>

                    {/* Test Exit Template button */}
                    <button
                      onClick={() => handleTestTemplate(phone, 'exit')}
                      disabled={exitState === 'loading'}
                      title="Test check-out template (reminder)"
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      {exitState === 'loading' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : exitState === 'sent' ? (
                        <CheckCircle className="w-3 h-3 text-amber-400" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      <span>{exitState === 'sent' ? t('reminders.testSent') : t('reminders.testExitBtn')}</span>
                    </button>

                    {/* Remove number button */}
                    <button
                      onClick={() => handleRemovePhone(phone)}
                      title="Remove number"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Section 2: Real-time Live Reminder Queue ──────────────────────── */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 sm:p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {t('reminders.liveQueueTitle')}
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30">
                  {queue.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{t('reminders.liveQueueSubtitle')}</p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={triggeringCron ? Loader2 : Play}
            loading={triggeringCron}
            onClick={handleTriggerCronNow}
            className="hover:border-amber-500/40"
          >
            {t('reminders.triggerNowBtn')}
          </Button>
        </div>

        {/* Cron trigger response notification */}
        {cronResult && (
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1 animate-fade-in text-xs text-slate-300">
            <p className="font-semibold text-emerald-400">
              {isArabic ? 'نتيجة تشغيل الفحص المجدول:' : 'Scheduled Cron Execution Result:'}
            </p>
            <pre className="font-mono text-[11px] text-slate-300 overflow-x-auto p-2 rounded bg-slate-900/80">
              {JSON.stringify(cronResult, null, 2)}
            </pre>
          </div>
        )}

        {/* Queue Items List */}
        {loadingQueue ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
          </div>
        ) : queue.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-800/30 border border-slate-800 text-center space-y-2">
            <Clock className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-400">{t('reminders.emptyQueue')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item) => {
              const triggerDate = item.triggerTime ? parseISO(item.triggerTime) : null;
              const isDue = triggerDate ? triggerDate <= new Date() : false;
              const isEntry = item.type === 'entry';

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isDue
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/5'
                      : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start md:items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isEntry
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      <Bell className="w-4 h-4" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                          <Home className="w-3 h-3" />
                          {t('reminders.unitLabel')} {item.unitNumber}
                        </span>

                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                            isEntry
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {isEntry ? t('reminders.entryType') : t('reminders.exitType')}
                        </span>

                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            isDue
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                              : 'bg-slate-700/60 text-slate-400'
                          }`}
                        >
                          {isDue ? t('reminders.statusDue') : t('reminders.statusWaiting')}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                        {item.tenantName && (
                          <span className="flex items-center gap-1 text-slate-300 font-medium">
                            <User className="w-3 h-3 text-slate-500" />
                            {item.tenantName}
                          </span>
                        )}
                        {item.phone && (
                          <span className="font-mono text-slate-400 text-[11px]" dir="ltr">
                            {item.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-700/40">
                    <div className="text-right rtl:text-left space-y-0.5">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        {t('reminders.triggerAt')}
                      </p>
                      <p className="font-mono text-xs font-medium text-slate-200">
                        {triggerDate
                          ? format(triggerDate, 'MMM d, yyyy · hh:mm a')
                          : item.triggerTime}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteQueueItem(item.id)}
                      title={t('reminders.deleteReminderTooltip')}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
