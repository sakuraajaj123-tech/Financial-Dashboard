// src/components/settings/BotMenuSettings.jsx
// Dynamic WhatsApp Auto-Reply Menu configuration with Nested-Box UI (Interactive Buttons & Lists)

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminPhonesSettings } from './AdminPhonesSettings';
import {
  Bot,
  Plus,
  Trash2,
  Save,
  Loader2,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  MessageSquare,
  CornerDownRight,
  AlertCircle,
  Eye,
  Send,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchBotMenuSettings, saveBotMenuSettings } from '../../api/botSettings';

// ── Color styles per nesting level for rich depth hierarchy ──────────────────
const LEVEL_STYLES = [
  {
    bg: 'bg-slate-900/90',
    border: 'border-indigo-500/30',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    accent: 'text-indigo-400',
    dot: 'bg-indigo-400',
    name: 'المستوى الرئيسي (Level 1)',
  },
  {
    bg: 'bg-slate-950/80',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    accent: 'text-emerald-400',
    dot: 'bg-emerald-400',
    name: 'قائمة فرعية (Level 2)',
  },
  {
    bg: 'bg-[#111827]/90',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    accent: 'text-amber-400',
    dot: 'bg-amber-400',
    name: 'مستوى فرعي متقدم (Level 3)',
  },
  {
    bg: 'bg-[#0f172a]/95',
    border: 'border-violet-500/30',
    badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    accent: 'text-violet-400',
    dot: 'bg-violet-400',
    name: 'مستوى فرعي (Level 4+)',
  },
];

function getLevelStyle(level) {
  return LEVEL_STYLES[Math.min(level, LEVEL_STYLES.length - 1)];
}

// ── Unique ID Generator ──────────────────────────────────────────────────────
function generateUniqueId(prefix = 'opt') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

// ── Recursive Tree Manipulators ──────────────────────────────────────────────
function updateNodeInTree(nodes, targetId, updater) {
  return nodes.map((node) => {
    if (node.id === targetId) {
      return updater(node);
    }
    if (node.subOptions && node.subOptions.length > 0) {
      return {
        ...node,
        subOptions: updateNodeInTree(node.subOptions, targetId, updater),
      };
    }
    return node;
  });
}

function deleteNodeFromTree(nodes, targetId) {
  return nodes
    .filter((node) => node.id !== targetId)
    .map((node) => {
      if (node.subOptions && node.subOptions.length > 0) {
        return {
          ...node,
          subOptions: deleteNodeFromTree(node.subOptions, targetId),
        };
      }
      return node;
    });
}

function addSubOptionToTree(nodes, parentId, newNode) {
  return nodes.map((node) => {
    if (node.id === parentId) {
      const subOptions = Array.isArray(node.subOptions) ? [...node.subOptions, newNode] : [newNode];
      return { ...node, subOptions };
    }
    if (node.subOptions && node.subOptions.length > 0) {
      return {
        ...node,
        subOptions: addSubOptionToTree(node.subOptions, parentId, newNode),
      };
    }
    return node;
  });
}

// ── Recursive Menu Option Box Component ──────────────────────────────────────
function MenuOptionBox({
  option,
  level = 0,
  path = '1',
  onUpdate,
  onDelete,
  onAddSubOption,
}) {
  const { t } = useTranslation();
  const style = getLevelStyle(level);
  const subOptions = option.subOptions || [];
  const hasChildren = subOptions.length > 0;

  const handleChange = (field, value) => {
    onUpdate(option.id, (prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div
      className={`rounded-2xl border ${style.border} ${style.bg} p-4 sm:p-5 shadow-lg transition-all duration-200 hover:shadow-indigo-500/5 space-y-4`}
    >
      {/* Box Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-700/40 pb-3">
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full ${style.dot} animate-pulse`} />
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${style.badge}`}>
            #{path} • {level === 0 ? 'خيار رئيسي' : `خيار فرعي - مستوى ${level + 1}`}
          </span>
          {option.title && (
            <span className="text-xs font-semibold text-slate-300 truncate max-w-[200px]">
              {option.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAddSubOption(option.id)}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            title="إضافة خيار فرعي داخل هذا الخيار"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة خيار فرعي</span>
          </button>

          <button
            type="button"
            onClick={() => onDelete(option.id)}
            className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all active:scale-95"
            title="حذف هذا الخيار"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Input Fields Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
        {/* Option Title / Button Name */}
        <div className="md:col-span-12 space-y-1.5">
          <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span>عنوان الزر / الخيار (Option Title)</span>
              <span className="text-rose-400">*</span>
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              النص الظاهر على الزر التفاعلي أو عنصر القائمة
            </span>
          </label>
          <input
            type="text"
            value={option.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="مثال: أسعار الشقق والاستديوهات"
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all font-medium"
            dir="auto"
          />
        </div>

        {/* Bot Response Text */}
        <div className="md:col-span-12 space-y-1.5">
          <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span>نص رد البوت (Bot Reply Text)</span>
              <span className="text-rose-400">*</span>
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              يدعم الإيموجي وتنسيقات واتساب والأسطر المتعددة
            </span>
          </label>
          <textarea
            rows={3}
            value={option.responseText || ''}
            onChange={(e) => handleChange('responseText', e.target.value)}
            placeholder="اكتب هنا الرسالة التي سيرسلها البوت للعميل عند النقر على هذا الخيار..."
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all resize-y min-h-[80px]"
            dir="auto"
          />
        </div>
      </div>

      {/* Nested Sub-options Container (Indented with distinct style) */}
      {hasChildren && (
        <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-3 ps-2 sm:ps-5 border-s-2 border-s-emerald-500/40">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <CornerDownRight className="w-3.5 h-3.5 rtl:-scale-x-100" />
              <span>الخيارات الفرعية التابعة ({subOptions.length})</span>
            </h4>
            <span className="text-[10px] text-slate-400">
              عند اختيار "{option.title || path}"، سيتم عرض هذه القائمة التفاعلية
            </span>
          </div>

          <div className="space-y-3">
            {subOptions.map((subNode, subIdx) => (
              <MenuOptionBox
                key={subNode.id}
                option={subNode}
                level={level + 1}
                path={`${path}.${subIdx + 1}`}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onAddSubOption={onAddSubOption}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Live Interactive Simulator Modal/Drawer ──────────────────────────────────
function BotMenuSimulator({ welcomeMessage, menuOptions, isOpen, onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [currentMenuState, setCurrentMenuState] = useState(null); // null (root) or node object

  // Restart simulator on open
  useEffect(() => {
    if (isOpen) {
      setCurrentMenuState(null);
      setMessages([
        {
          id: 'welcome',
          from: 'bot',
          text: welcomeMessage || 'مرحباً بك في شققنا المفروشة 🏨',
          options: menuOptions,
          isSub: false,
        },
      ]);
    }
  }, [isOpen, welcomeMessage, menuOptions]);

  const handleSelectOption = (opt) => {
    if (!opt) return;

    // User selected this option
    const userMsg = {
      id: Date.now().toString(),
      from: 'user',
      text: opt.title || 'خيار',
    };

    const isCS = opt.id === 'opt_support' || opt.id === 'btn_support' || (opt.title && opt.title.includes('خدمة العملاء'));
    let botMsg;
    if (hasSub) {
      setCurrentMenuState(opt);
      botMsg = {
        id: (Date.now() + 1).toString(),
        from: 'bot',
        text: opt.responseText || 'يرجى اختيار أحد الخيارات التالية:',
        options: opt.subOptions,
        isSub: true,
      };
    } else {
      botMsg = {
        id: (Date.now() + 1).toString(),
        from: 'bot',
        text: opt.responseText || 'تمت معالجة طلبك بنجاح.',
        options: [],
        showReturnButton: true,
        isCustomerService: isCS,
      };
    }

    setMessages((prev) => [...prev, userMsg, botMsg]);
  };

  const handleResetToMain = () => {
    setCurrentMenuState(null);
    const userMsg = {
      id: Date.now().toString(),
      from: 'user',
      text: '🏠 القائمة الرئيسية',
    };
    const botMsg = {
      id: (Date.now() + 1).toString(),
      from: 'bot',
      text: welcomeMessage || 'مرحباً بك في شققنا المفروشة 🏨',
      options: menuOptions,
      isSub: false,
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);
  };

  const handleCustomerSupport = () => {
    const userMsg = {
      id: Date.now().toString(),
      from: 'user',
      text: 'التواصل مع خدمة العملاء',
    };
    const botMsg = {
      id: (Date.now() + 1).toString(),
      from: 'bot',
      text: 'سيقوم أحد ممثلي خدمة العملاء بالتواصل معك مباشرة في أقرب وقت ممكن! 👨‍💼📞',
      options: [],
      showReturnButton: true,
      isCustomerService: true,
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);
  };

  const handleSimulateSendText = (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');

    const norm = text.toLowerCase();
    const isSupport = ['خدمة العملاء', 'التواصل مع خدمة العملاء', 'الدعم', 'support'].some((s) => norm.includes(s));
    const isBack = ['0', 'رجوع', 'back', 'menu', 'قائمة', 'start', 'main', 'رئيسية', 'القائمة الرئيسية', 'العودة للقائمة الرئيسية', '🏠 القائمة الرئيسية'].includes(norm);

    if (isSupport) {
      handleCustomerSupport();
      return;
    }

    if (isBack) {
      handleResetToMain();
      return;
    }

    const activeOptions = currentMenuState ? currentMenuState.subOptions || [] : menuOptions;
    const matched = activeOptions.find(
      (opt) => (opt.title || '').trim().toLowerCase() === norm || (opt.id || '').toLowerCase() === norm
    );

    if (matched) {
      handleSelectOption(matched);
    } else {
      // No matter what the user sends, reply with the welcome message + main menu
      setCurrentMenuState(null);
      const userMsg = { id: Date.now().toString(), from: 'user', text };
      const botMsg = {
        id: (Date.now() + 1).toString(),
        from: 'bot',
        text: welcomeMessage || 'مرحباً بك في شققنا المفروشة 🏨',
        options: menuOptions,
        isSub: false,
      };
      setMessages((prev) => [...prev, userMsg, botMsg]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111b21] border border-slate-700/80 rounded-3xl w-full max-w-md h-[620px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-[#202c33] border-b border-slate-700/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">محاكي الأزرار التفاعلية (Live Test)</h3>
              <p className="text-xs text-emerald-400">أزرار وقوائم تفاعلية مباشرة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0b141a]" dir="ltr">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.from === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed shadow-md ${
                  m.from === 'user'
                    ? 'bg-[#005c4b] text-white rounded-br-none'
                    : 'bg-[#202c33] text-slate-100 rounded-bl-none border border-white/5'
                }`}
                dir="auto"
              >
                {m.text}
              </div>

              {/* Interactive Buttons Rendering in Simulator */}
              {m.from === 'bot' && (
                <div className="mt-2 flex flex-col gap-1.5 w-full max-w-[85%]">
                  {m.options && m.options.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {m.options.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => handleSelectOption(opt)}
                          className="w-full text-center py-2 px-3 bg-[#1f2c34] hover:bg-[#2a3942] active:bg-[#005c4b] text-emerald-400 hover:text-emerald-300 font-semibold text-xs rounded-xl border border-slate-700/60 shadow-sm transition-all flex items-center justify-center gap-1.5"
                          dir="auto"
                        >
                          <span>🔘</span>
                          <span>{opt.title || 'خيار بدون عنوان'}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Universal Options: Support & Return to Main Menu */}
                  {(m.showReturnButton || m.isSub) && (
                    <div className="flex flex-col gap-1.5 mt-1 border-t border-slate-700/40 pt-1.5">
                      {!m.isCustomerService && (
                        <button
                          onClick={handleCustomerSupport}
                          className="w-full text-center py-2 px-3 bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 hover:text-white text-xs font-semibold rounded-xl border border-indigo-500/30 transition-all flex items-center justify-center gap-1.5"
                        >
                          <span>👨‍💼 التواصل مع خدمة العملاء</span>
                        </button>
                      )}
                      <button
                        onClick={handleResetToMain}
                        className="w-full text-center py-2 px-3 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700/60 transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>🏠 العودة للقائمة الرئيسية</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSimulateSendText} className="bg-[#202c33] p-3 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="اكتب رسالة أو اضغط الأزرار..."
            className="flex-1 bg-[#2a3942] border-0 rounded-2xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            dir="auto"
          />
          <button
            type="submit"
            className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-all shadow-md active:scale-95"
          >
            <Send className="w-4 h-4 ml-0.5 rtl:-scale-x-100" />
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main Bot Menu Settings Component ─────────────────────────────────────────
export function BotMenuSettings() {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [errorMessage, setErrorMessage] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Settings State
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [menuOptions, setMenuOptions] = useState([]);

  // ── Load Settings from Firestore on mount ──────────────────────────────────
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetchBotMenuSettings();
      const data = res?.data || {};
      setWelcomeMessage(data.welcomeMessage || '');
      // Ensure any legacy triggers are scrubbed
      const sanitizeOptions = (nodes) => {
        if (!Array.isArray(nodes)) return [];
        return nodes.map((node) => {
          const { trigger, ...cleanNode } = node;
          return {
            ...cleanNode,
            subOptions: sanitizeOptions(cleanNode.subOptions),
          };
        });
      };
      setMenuOptions(sanitizeOptions(data.menuOptions));
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Failed to load bot menu settings:', err);
      setErrorMessage(err.message || 'فشل تحميل إعدادات القائمة');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ── Tree Mutators ──────────────────────────────────────────────────────────
  const handleUpdateOption = useCallback((id, updater) => {
    setMenuOptions((prev) => updateNodeInTree(prev, id, updater));
    setHasUnsavedChanges(true);
  }, []);

  const handleDeleteOption = useCallback((id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الخيار وجميع الخيارات الفرعية التابعة له؟')) return;
    setMenuOptions((prev) => deleteNodeFromTree(prev, id));
    setHasUnsavedChanges(true);
  }, []);

  const handleAddSubOption = useCallback((parentId) => {
    const newNode = {
      id: generateUniqueId('sub'),
      title: '',
      responseText: '',
      subOptions: [],
    };
    setMenuOptions((prev) => addSubOptionToTree(prev, parentId, newNode));
    setHasUnsavedChanges(true);
  }, []);

  const handleAddMainOption = () => {
    const newRootNode = {
      id: generateUniqueId('opt'),
      title: '',
      responseText: '',
      subOptions: [],
    };
    setMenuOptions((prev) => [...prev, newRootNode]);
    setHasUnsavedChanges(true);
  };

  // ── Save to Firestore ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (saveStatus === 'saving') return;
    setSaveStatus('saving');
    setErrorMessage('');

    // Validation
    const validateNodes = (nodes) => {
      for (const node of nodes) {
        if (!node.title?.trim()) {
          return 'يرجى ملء عنوان الخيار (Option Title) لجميع الخيارات والأزرار.';
        }
        if (!node.responseText?.trim()) {
          return 'يرجى ملء نص الرد (Bot Reply Text) لجميع الخيارات.';
        }
        if (node.subOptions && node.subOptions.length > 0) {
          const subErr = validateNodes(node.subOptions);
          if (subErr) return subErr;
        }
      }
      return null;
    };

    const valErr = validateNodes(menuOptions);
    if (valErr) {
      setSaveStatus('error');
      setErrorMessage(valErr);
      return;
    }

    try {
      await saveBotMenuSettings({
        welcomeMessage,
        menuOptions,
      });
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveStatus('idle'), 3500);
    } catch (err) {
      console.error('Failed to save bot settings:', err);
      setSaveStatus('error');
      setErrorMessage(err.message || 'فشل حفظ الإعدادات في قاعدة البيانات');
    }
  };

  // ── Counts summary ─────────────────────────────────────────────────────────
  const countStats = useMemo(() => {
    let totalOptions = 0;
    let maxDepth = 0;

    const traverse = (nodes, depth = 1) => {
      totalOptions += nodes.length;
      if (depth > maxDepth && nodes.length > 0) maxDepth = depth;
      for (const n of nodes) {
        if (n.subOptions && n.subOptions.length > 0) {
          traverse(n.subOptions, depth + 1);
        }
      }
    };

    traverse(menuOptions);
    return { totalOptions, maxDepth };
  }, [menuOptions]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        <p className="text-sm text-slate-400">جارٍ تحميل إعدادات قائمة الرد التلقائي من Firestore...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto animate-fade-in">
      {/* ── Admin Reminder Phone Numbers ──────────────────────────────────────── */}
      <AdminPhonesSettings />

      {/* Top Banner & Action Bar */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/20 to-slate-900/60 border border-indigo-500/20 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>إعدادات قائمة الرد التلقائي (Interactive Menu)</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                  Buttons & Lists
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                تخصيص الأزرار والقوائم التفاعلية الهرمية والردود الآلية عبر الواتساب بدون أرقام تفعيل.
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsSimulatorOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-sm"
              title="اختبار تجربة الأزرار والقوائم التفاعلية مباشرة"
            >
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>معاينة وتجربة الأزرار (Live Test)</span>
            </button>

            <button
              type="button"
              onClick={loadSettings}
              disabled={loading || saveStatus === 'saving'}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-all active:scale-95 disabled:opacity-50"
              title="إعادة تحميل من قاعدة البيانات"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Badges */}
        <div className="mt-4 pt-4 border-t border-slate-700/40 flex items-center gap-4 text-xs text-slate-400 flex-wrap font-mono">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>إجمالي الخيارات: <strong className="text-white">{countStats.totalOptions}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>أقصى عمق للقوائم: <strong className="text-white">{countStats.maxDepth} مستويات</strong></span>
          </div>
          {hasUnsavedChanges && (
            <div className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>توجد تعديلات غير محفوظة!</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Message Toast */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-sm text-rose-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <p className="flex-1">{errorMessage}</p>
        </div>
      )}

      {/* Global Welcome Message Card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <span>رسالة الترحيب العامة الأساسية (Welcome Message)</span>
        </h3>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>نص رسالة الترحيب الأولى (Welcome Message)</span>
            <span className="text-[11px] text-slate-500">الرسالة التلقائية التي تظهر دائماً مع الأزرار الرئيسية</span>
          </label>
          <textarea
            rows={3}
            value={welcomeMessage}
            onChange={(e) => {
              setWelcomeMessage(e.target.value);
              setHasUnsavedChanges(true);
            }}
            placeholder="مثال: مرحباً بك في شققنا المفروشة 🏨... يسعدنا خدمتكم! يرجى اختيار الخدمة المطلوبة من القائمة أدناه:"
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            dir="auto"
          />
        </div>
      </div>

      {/* Main Hierarchy Box Container */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>هيكل الأزرار والقوائم التفاعلية (Menu Hierarchy)</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {menuOptions.length} خيارات رئيسية
          </span>
        </div>

        {menuOptions.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl space-y-3">
            <Bot className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-400">لا توجد خيارات في القائمة حالياً.</p>
            <button
              type="button"
              onClick={handleAddMainOption}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-2 transition-all shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة أول خيار رئيسي</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {menuOptions.map((opt, idx) => (
              <MenuOptionBox
                key={opt.id}
                option={opt}
                level={0}
                path={(idx + 1).toString()}
                onUpdate={handleUpdateOption}
                onDelete={handleDeleteOption}
                onAddSubOption={handleAddSubOption}
              />
            ))}
          </div>
        )}

        {/* Add Main Option Button */}
        <button
          type="button"
          onClick={handleAddMainOption}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-700/80 hover:border-indigo-500/60 bg-slate-900/30 hover:bg-indigo-950/20 text-slate-300 hover:text-indigo-300 font-bold text-sm flex items-center justify-center gap-2.5 transition-all group active:scale-[0.99]"
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-600/30 group-hover:bg-indigo-600 flex items-center justify-center text-indigo-300 group-hover:text-white transition-colors">
            <Plus className="w-4 h-4" />
          </div>
          <span>إضافة خيار رئيسي جديد (Add Main Option)</span>
        </button>
      </div>

      {/* Fixed / Floating Save Settings Bar at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800 p-4 shadow-2xl">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-300 font-medium">
              الوجهة: <strong className="text-white font-mono">Firestore (settings/bot_menu)</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {saveStatus === 'saved' && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 animate-fade-in">
                <Check className="w-4 h-4" />
                <span>تم حفظ الإعدادات بنجاح!</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-xs text-rose-400 font-semibold flex items-center gap-1.5 animate-fade-in">
                <AlertCircle className="w-4 h-4" />
                <span>فشل الحفظ</span>
              </span>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/30 active:scale-95"
            >
              {saveStatus === 'saving' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ الحفظ...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>حفظ التغييرات (Save Settings)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Simulator Modal */}
      <BotMenuSimulator
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        welcomeMessage={welcomeMessage}
        menuOptions={menuOptions}
      />
    </div>
  );
}
