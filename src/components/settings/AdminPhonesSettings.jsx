// src/components/settings/AdminPhonesSettings.jsx
// Manages the list of admin WhatsApp phone numbers stored in
// Firestore: settings/global_settings { adminPhoneNumbers: string[] }
// Also provides live testing & diagnostic tools for reminders.

import { useState, useEffect } from 'react';
import {
  Phone,
  Plus,
  Trash2,
  Loader2,
  Check,
  AlertCircle,
  Bell,
  Send,
  RefreshCw,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { db } from '../../lib/firebase';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';

const SETTINGS_DOC = doc(db, 'settings', 'global_settings');
const REMINDERS_COL = collection(db, 'pending_reminders');

// ── Toast helper ──────────────────────────────────────────────────────────────
function Toast({ type, message }) {
  const styles =
    type === 'error'
      ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
      : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300';
  const Icon = type === 'error' ? AlertCircle : Check;
  return (
    <div className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-xs font-medium ${styles}`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {message}
    </div>
  );
}

// ── Phone number row ──────────────────────────────────────────────────────────
function PhoneRow({ phone, onRemove, removing, onTest, testingTemplate }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50 group hover:border-slate-600/60 transition-colors flex-wrap sm:flex-nowrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
          <Phone className="w-4 h-4 text-emerald-400" />
        </div>
        <span className="text-sm font-mono text-slate-200 truncate">{phone}</span>
      </div>

      <div className="flex items-center gap-2 mr-auto rtl:mr-0 rtl:ml-auto sm:mr-0">
        {/* Test Entry Reminder */}
        <button
          onClick={() => onTest(phone, 'entry_reminder')}
          disabled={!!testingTemplate}
          title="إرسال قالب تذكير الدخول التجريبي (entry_reminder)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-medium transition-all disabled:opacity-40"
        >
          {testingTemplate === `${phone}_entry_reminder` ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Send className="w-3 h-3" />
          )}
          <span>تجربة الدخول (entry_reminder)</span>
        </button>

        {/* Test Exit Reminder */}
        <button
          onClick={() => onTest(phone, 'reminder')}
          disabled={!!testingTemplate}
          title="إرسال قالب تذكير الخروج التجريبي (reminder)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-medium transition-all disabled:opacity-40"
        >
          {testingTemplate === `${phone}_reminder` ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Send className="w-3 h-3" />
          )}
          <span>تجربة الخروج (reminder)</span>
        </button>

        <button
          onClick={() => onRemove(phone)}
          disabled={removing}
          title="Remove number"
          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40 flex-shrink-0"
        >
          {removing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function AdminPhonesSettings() {
  const [phones, setPhones]                   = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [input, setInput]                     = useState('');
  const [inputError, setInputError]           = useState('');
  const [saving, setSaving]                   = useState(false);
  const [removing, setRemoving]               = useState(null);
  const [testingTemplate, setTestingTemplate] = useState(null);
  const [toast, setToast]                     = useState(null);

  // Live reminders list from Firestore
  const [pendingReminders, setPendingReminders] = useState([]);
  const [runningCheck, setRunningCheck]         = useState(false);

  // ── Real-time Firestore subscription for Admin Phones ────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      SETTINGS_DOC,
      (snap) => {
        if (snap.exists()) {
          setPhones(snap.data().adminPhoneNumbers || []);
        } else {
          setPhones([]);
        }
        setLoading(false);
      },
      (err) => {
        console.error('[AdminPhones] Firestore error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // ── Real-time Firestore subscription for Pending Reminders ───────────────
  useEffect(() => {
    const unsub = onSnapshot(
      REMINDERS_COL,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })).sort((a, b) => (a.triggerTime || '').localeCompare(b.triggerTime || ''));
        setPendingReminders(list);
      },
      (err) => {
        console.error('[PendingReminders] Firestore error:', err);
      }
    );
    return () => unsub();
  }, []);

  // ── Auto-dismiss toast ───────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Validate E.164 phone number ──────────────────────────────────────────
  function validatePhone(value) {
    const cleaned = value.trim();
    if (!cleaned) return 'Phone number is required.';
    if (!/^\+?\d{7,15}$/.test(cleaned.replace(/\s/g, ''))) {
      return 'Enter a valid international number, e.g. +966512345678';
    }
    const normalised = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    if (phones.includes(normalised)) return 'This number is already in the list.';
    return null;
  }

  // ── Add phone ────────────────────────────────────────────────────────────
  async function handleAdd() {
    const err = validatePhone(input);
    if (err) {
      setInputError(err);
      return;
    }
    const normalised = input.trim().startsWith('+') ? input.trim() : `+${input.trim()}`;
    setSaving(true);
    setInputError('');
    try {
      await setDoc(
        SETTINGS_DOC,
        { adminPhoneNumbers: arrayUnion(normalised) },
        { merge: true }
      );
      setInput('');
      setToast({ type: 'success', message: `${normalised} added successfully.` });
    } catch (e) {
      console.error('[AdminPhones] Add failed:', e);
      setToast({ type: 'error', message: 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  // ── Remove phone ─────────────────────────────────────────────────────────
  async function handleRemove(phone) {
    setRemoving(phone);
    try {
      await updateDoc(SETTINGS_DOC, {
        adminPhoneNumbers: arrayRemove(phone),
      });
      setToast({ type: 'success', message: `${phone} removed.` });
    } catch (e) {
      console.error('[AdminPhones] Remove failed:', e);
      setToast({ type: 'error', message: 'Failed to remove. Please try again.' });
    } finally {
      setRemoving(null);
    }
  }

  // ── Handle enter key in input ─────────────────────────────────────────────
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
    if (inputError) setInputError('');
  }

  // ── Test send WhatsApp template ──────────────────────────────────────────
  async function handleTestTemplate(phone, templateName) {
    setTestingTemplate(`${phone}_${templateName}`);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: templateName,
          to: phone,
          unitNumber: '101',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || data?.details?.error?.message || 'Meta API Error');
      }

      setToast({
        type: 'success',
        message: `تم إرسال قالب ${templateName} بنجاح إلى ${phone} ✓`,
      });
    } catch (e) {
      console.error('[WhatsApp Test] Error:', e);
      setToast({
        type: 'error',
        message: `فشل الإرسال: ${e.message}`,
      });
    } finally {
      setTestingTemplate(null);
    }
  }

  // ── Run full reminders check directly from client & send due reminders ──
  async function handleRunCheckNow() {
    setRunningCheck(true);
    try {
      const nowISO = new Date().toISOString();
      let dueReminders = [];

      // Fetch pending reminders directly from Firestore
      const snap = await getDocs(REMINDERS_COL);
      const allReminders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      dueReminders = allReminders.filter((r) => r.triggerTime && r.triggerTime <= nowISO);

      // Auto-backfill if pending_reminders was empty
      if (allReminders.length === 0) {
        const unitsSnap = await getDocs(collection(db, 'units'));
        const batch = writeBatch(db);
        let backfillCount = 0;

        unitsSnap.docs.forEach((uDoc) => {
          const u = uDoc.data();
          const unitNum = u.number ?? uDoc.id;
          const bookings = Array.isArray(u.bookings) ? u.bookings : [];

          bookings.forEach((b) => {
            if (!b.id || !b.checkIn || !b.checkOut) return;
            const checkInMs = Date.parse(b.checkIn);
            const checkOutMs = Date.parse(b.checkOut);
            const entryOffset = (Number(b.entryReminderMinutes) || 180) * 60 * 1000;
            const exitOffset = (Number(b.exitReminderMinutes) || 15) * 60 * 1000;

            if (!isNaN(checkInMs)) {
              const entryTrigger = new Date(checkInMs - entryOffset).toISOString();
              batch.set(doc(db, 'pending_reminders', `${b.id}_entry`), {
                bookingId: b.id,
                unitId: uDoc.id,
                unitNumber: String(unitNum),
                type: 'entry',
                template: 'entry_reminder',
                triggerTime: entryTrigger,
                entryReminderMinutes: Number(b.entryReminderMinutes) || 180,
                createdAt: new Date().toISOString(),
              });
              backfillCount++;
            }
            if (!isNaN(checkOutMs)) {
              const exitTrigger = new Date(checkOutMs - exitOffset).toISOString();
              batch.set(doc(db, 'pending_reminders', `${b.id}_exit`), {
                bookingId: b.id,
                unitId: uDoc.id,
                unitNumber: String(unitNum),
                type: 'exit',
                template: 'reminder',
                triggerTime: exitTrigger,
                exitReminderMinutes: Number(b.exitReminderMinutes) || 15,
                createdAt: new Date().toISOString(),
              });
              backfillCount++;
            }
          });
        });

        if (backfillCount > 0) {
          await batch.commit();
        }
      }

      if (dueReminders.length === 0) {
        setToast({
          type: 'success',
          message: 'تم فحص التذكيرات. لا توجد تذكيرات مستحقة في هذه اللحظة (جميع التذكيرات مجدولة في أوقاتها القادمة).',
        });
        return;
      }

      // Process due reminders
      let sentCount = 0;
      for (const due of dueReminders) {
        // Send to all admin numbers
        for (const phone of phones) {
          try {
            await fetch('/api/whatsapp/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                mode: due.template,
                to: phone,
                unitNumber: due.unitNumber || '101',
              }),
            });
          } catch (e) {
            console.error('Send error:', e);
          }
        }
        // Delete processed reminder from Firestore
        await deleteDoc(doc(db, 'pending_reminders', due.id));
        sentCount++;
      }

      setToast({
        type: 'success',
        message: `تم بنجاح إرسال ${sentCount} تذكير مستحق الآن إلى أرقام المسؤولين ✓`,
      });
    } catch (err) {
      console.error('[Check Reminders Error]', err);
      setToast({
        type: 'error',
        message: `خطأ أثناء فحص التذكيرات: ${err.message}`,
      });
    } finally {
      setRunningCheck(false);
    }
  }

  const nowISO = new Date().toISOString();

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* ── Admin Phone Numbers Card ─────────────────────────────────────── */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-700/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-700/50 bg-gradient-to-r from-violet-500/5 to-indigo-500/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
              <Bell className="w-4.5 h-4.5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">أرقام هواتف مسؤولي التذكيرات (Admin Reminder Numbers)</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                تستقبل هذه الأرقام رسائل واتساب التلقائية لتذكيرات الدخول والخروج قبل الموعد المحدد.
              </p>
            </div>
          </div>
          {!loading && (
            <span className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {phones.length} رقم مسجل
            </span>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Toast */}
          {toast && <Toast type={toast.type} message={toast.message} />}

          {/* Phone list */}
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-3 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading numbers…</span>
            </div>
          ) : phones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
              <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center">
                <Phone className="w-5 h-5 text-slate-600" />
              </div>
              <p className="text-sm text-slate-500 font-medium">لم يتم إضافة أرقام مسؤولين بعد</p>
              <p className="text-xs text-slate-600">أضف رقمك أدناه للبدء في استقبال رسائل التذكير.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {phones.map((phone) => (
                <PhoneRow
                  key={phone}
                  phone={phone}
                  onRemove={handleRemove}
                  removing={removing === phone}
                  onTest={handleTestTemplate}
                  testingTemplate={testingTemplate}
                />
              ))}
            </div>
          )}

          {/* Add new number input */}
          <div className="pt-1 space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Plus className="w-3 h-3" />
              إضافة رقم مسؤول جديد
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="tel"
                  placeholder="+966512345678"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (inputError) setInputError('');
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={saving}
                  className={`w-full bg-slate-800/60 border rounded-lg px-3 py-2.5 text-sm font-mono text-slate-200 placeholder-slate-500 outline-none transition-colors focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50 ${
                    inputError
                      ? 'border-rose-500/60'
                      : 'border-slate-700/50 hover:border-slate-600/60'
                  }`}
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={saving || !input.trim()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 flex-shrink-0"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                إضافة
              </button>
            </div>
            {inputError && (
              <p className="flex items-center gap-1.5 text-xs text-rose-400">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {inputError}
              </p>
            )}
            <p className="text-xs text-slate-600">
              استخدم الصيغة الدولية شاملة مفتاح الدولة، مثل:&nbsp;
              <span className="text-slate-500 font-mono">+966512345678</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Reminders Health & Live Queue Card ────────────────────────────── */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-700/50 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 bg-gradient-to-r from-blue-500/5 to-cyan-500/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4.5 h-4.5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">جدول التذكيرات المباشر (Live Reminders Queue)</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                قائمة حية لجميع التذكيرات المجدولة في قاعدة البيانات مع أوقات إطلاقها الدقيقة.
              </p>
            </div>
          </div>
          <button
            onClick={handleRunCheckNow}
            disabled={runningCheck}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-semibold transition-all disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningCheck ? 'animate-spin' : ''}`} />
            <span>فحص وإرسال المستحق فوراً</span>
          </button>
        </div>

        <div className="p-5 space-y-4 bg-slate-950/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
              <p className="text-[11px] text-slate-500">التذكيرات المستحقة الآن (Due Now)</p>
              <p className="text-base font-bold text-amber-400 mt-0.5">
                {pendingReminders.filter((r) => r.triggerTime && r.triggerTime <= nowISO).length} تذكير
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
              <p className="text-[11px] text-slate-500">إجمالي التذكيرات المجدولة في الانتظار</p>
              <p className="text-base font-bold text-emerald-400 mt-0.5">
                {pendingReminders.length} تذكير
              </p>
            </div>
          </div>

          {/* List of pending reminders */}
          {pendingReminders.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-xs">
              لا توجد تذكيرات مجدولة حالياً في قاعدة البيانات. ستظهر التذكيرات هنا فور إضافة حجز جديد.
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-slate-300">التذكيرات المجدولة ومواعيدها:</p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {pendingReminders.map((r) => {
                  const isDue = r.triggerTime && r.triggerTime <= nowISO;
                  const triggerDate = r.triggerTime ? new Date(r.triggerTime) : null;
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-mono border transition-colors ${
                        isDue
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                          : 'bg-slate-800/60 border-slate-700/40 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isDue ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                          }`}
                        />
                        <span className="font-semibold text-slate-100">
                          وحدة {r.unitNumber} ({r.type === 'entry' ? 'دخول' : 'خروج'})
                        </span>
                        <span className="text-[11px] text-slate-400">
                          [{r.template}]
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-right">
                        <span className="text-xs text-slate-300">
                          {triggerDate ? triggerDate.toLocaleString('ar-SA') : 'N/A'}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                            isDue
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {isDue ? 'مستحق الآن 🔔' : 'في الانتظار ⏳'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
