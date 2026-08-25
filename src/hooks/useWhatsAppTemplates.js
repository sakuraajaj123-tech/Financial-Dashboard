import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

const TEMPLATES_COLLECTION = 'whatsapp_templates';

// Default built-in suggested templates for PMS
export const DEFAULT_TEMPLATES = [
  {
    title: 'تأكيد الحجز (Booking Confirmation)',
    name: 'booking_confirmation',
    language: 'ar',
    variables: ['اسم العميل', 'رقم الوحدة', 'تاريخ الدخول', 'تاريخ الخروج', 'المبلغ'],
    description: 'تأكيد تفاصيل حجز العميل للوحدة والمواعيد',
  },
  {
    title: 'تنبيه موعد الدخول (Check-in Reminder)',
    name: 'entry_reminder',
    language: 'ar',
    variables: ['رقم الوحدة'],
    description: 'تذكير العميل بموعد استلام الوحدة وتعليمات الدخول',
  },
  {
    title: 'تنبيه موعد الخروج (Check-out Reminder)',
    name: 'reminder',
    language: 'ar',
    variables: ['رقم الوحدة'],
    description: 'تذكير العميل بموعد تسليم الوحدة وإخلاء الطرف',
  },
  {
    title: 'شروط العقد والتعليمات (Terms)',
    name: 'terms',
    language: 'ar',
    variables: ['رقم الشروط / المتغير'],
    description: 'إرسال شروط الإقامة واللوائح المعتمدة للضيف',
  },
  {
    title: 'رسالة تجريبية (Hello World)',
    name: 'hello_world',
    language: 'en_US',
    variables: [],
    description: 'قالب واتساب الافتراضي المعتمد للاختبار الفوري',
  },
];

/**
 * Custom React hook for managing WhatsApp Approved Templates in Firestore.
 * Collection: whatsapp_templates
 * Schema:
 *   - id: string
 *   - title: string (Friendly display name)
 *   - name: string (Exact Meta WhatsApp Template Name)
 *   - language: string (Language code: 'ar', 'en_US', etc.)
 *   - variables: Array<string> (Parameter label names e.g. ['اسم العميل'])
 *   - description?: string
 *   - createdAt: string (ISO string)
 *   - updatedAt?: string
 */
export function useWhatsAppTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsubscribe;
    try {
      const colRef = collection(db, TEMPLATES_COLLECTION);
      const q = query(colRef, orderBy('createdAt', 'desc'));

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title || data.name || '',
              name: data.name || '',
              language: data.language || 'ar',
              variables: Array.isArray(data.variables) ? data.variables : [],
              description: data.description || '',
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || null,
            };
          });

          // If no custom templates yet in DB, show default suggestions
          if (items.length === 0) {
            setTemplates(DEFAULT_TEMPLATES.map((t, idx) => ({ ...t, id: `default_${idx}` })));
          } else {
            setTemplates(items);
          }
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.warn('[useWhatsAppTemplates] Ordered query failed, falling back to unordered:', err);
          const fallbackColRef = collection(db, TEMPLATES_COLLECTION);
          unsubscribe = onSnapshot(
            fallbackColRef,
            (fallbackSnapshot) => {
              const items = fallbackSnapshot.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  title: data.title || data.name || '',
                  name: data.name || '',
                  language: data.language || 'ar',
                  variables: Array.isArray(data.variables) ? data.variables : [],
                  description: data.description || '',
                  createdAt: data.createdAt || new Date().toISOString(),
                  updatedAt: data.updatedAt || null,
                };
              });

              if (items.length === 0) {
                setTemplates(DEFAULT_TEMPLATES.map((t, idx) => ({ ...t, id: `default_${idx}` })));
              } else {
                items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setTemplates(items);
              }
              setLoading(false);
              setError(null);
            },
            (fallbackErr) => {
              console.error('[useWhatsAppTemplates] Firestore error:', fallbackErr);
              // Fallback to default in-memory templates on Firestore read error
              setTemplates(DEFAULT_TEMPLATES.map((t, idx) => ({ ...t, id: `default_${idx}` })));
              setError(fallbackErr.message);
              setLoading(false);
            }
          );
        }
      );
    } catch (err) {
      console.error('[useWhatsAppTemplates] Setup error:', err);
      setTemplates(DEFAULT_TEMPLATES.map((t, idx) => ({ ...t, id: `default_${idx}` })));
      setError(err.message);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  /**
   * Adds a new WhatsApp template to Firestore.
   */
  const addTemplate = async ({ title, name, language = 'ar', variables = [], description = '' }) => {
    const cleanName = (name || '').trim().toLowerCase().replace(/\s+/g, '_');
    const cleanTitle = (title || cleanName).trim();
    const cleanLanguage = (language || 'ar').trim();

    if (!cleanName) {
      throw new Error('Template Name is required (as approved in Meta)');
    }

    const colRef = collection(db, TEMPLATES_COLLECTION);
    const newDoc = {
      title: cleanTitle,
      name: cleanName,
      language: cleanLanguage,
      variables: Array.isArray(variables) ? variables.map((v) => String(v).trim()).filter(Boolean) : [],
      description: (description || '').trim(),
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    };

    const docRef = await addDoc(colRef, newDoc);
    return { id: docRef.id, ...newDoc };
  };

  /**
   * Updates an existing WhatsApp template in Firestore.
   */
  const updateTemplate = async (id, { title, name, language = 'ar', variables = [], description = '' }) => {
    if (!id) throw new Error('ID is required');
    const cleanName = (name || '').trim().toLowerCase().replace(/\s+/g, '_');
    const cleanTitle = (title || cleanName).trim();
    const cleanLanguage = (language || 'ar').trim();

    if (!cleanName) {
      throw new Error('Template Name is required');
    }

    // If updating a default suggestion that isn't yet a real Firestore doc, add it as a new doc
    if (String(id).startsWith('default_')) {
      return await addTemplate({ title: cleanTitle, name: cleanName, language: cleanLanguage, variables, description });
    }

    const docRef = doc(db, TEMPLATES_COLLECTION, id);
    const updateData = {
      title: cleanTitle,
      name: cleanName,
      language: cleanLanguage,
      variables: Array.isArray(variables) ? variables.map((v) => String(v).trim()).filter(Boolean) : [],
      description: (description || '').trim(),
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(docRef, updateData);
    return { id, ...updateData };
  };

  /**
   * Deletes a template from Firestore.
   */
  const deleteTemplate = async (id) => {
    if (!id) throw new Error('ID is required');
    if (String(id).startsWith('default_')) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      return;
    }
    const docRef = doc(db, TEMPLATES_COLLECTION, id);
    await deleteDoc(docRef);
  };

  return {
    templates,
    loading,
    error,
    addTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
