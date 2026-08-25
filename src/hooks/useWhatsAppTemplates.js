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

/**
 * Custom React hook for managing WhatsApp Approved Templates in Firestore.
 * Collection: whatsapp_templates
 * Schema:
 *   - id: string
 *   - name: string (Exact Meta WhatsApp Template Name e.g. 'booking_confirmation')
 *   - language: string (Language code: 'ar', 'en_US', etc.)
 *   - text: string (Full template text body with {{1}}, {{2}}, etc.)
 *   - variables: Array<string> (Human names for each variable e.g. ['اسم العميل', 'رقم الوحدة'])
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
              name: data.name || '',
              language: data.language || 'ar',
              text: data.text || '',
              variables: Array.isArray(data.variables) ? data.variables : [],
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || null,
            };
          });

          setTemplates(items);
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
                  name: data.name || '',
                  language: data.language || 'ar',
                  text: data.text || '',
                  variables: Array.isArray(data.variables) ? data.variables : [],
                  createdAt: data.createdAt || new Date().toISOString(),
                  updatedAt: data.updatedAt || null,
                };
              });

              items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              setTemplates(items);
              setLoading(false);
              setError(null);
            },
            (fallbackErr) => {
              console.error('[useWhatsAppTemplates] Firestore error:', fallbackErr);
              setTemplates([]);
              setError(fallbackErr.message);
              setLoading(false);
            }
          );
        }
      );
    } catch (err) {
      console.error('[useWhatsAppTemplates] Setup error:', err);
      setTemplates([]);
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
  const addTemplate = async ({ name, language = 'ar', text = '', variables = [] }) => {
    const cleanName = (name || '').trim().toLowerCase().replace(/\s+/g, '_');
    const cleanLanguage = (language || 'ar').trim();
    const cleanText = (text || '').trim();

    if (!cleanName) {
      throw new Error('Template Name is required (as approved in Meta)');
    }

    const colRef = collection(db, TEMPLATES_COLLECTION);
    const newDoc = {
      name: cleanName,
      language: cleanLanguage,
      text: cleanText,
      variables: Array.isArray(variables) ? variables.map((v) => String(v).trim()).filter(Boolean) : [],
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    };

    const docRef = await addDoc(colRef, newDoc);
    return { id: docRef.id, ...newDoc };
  };

  /**
   * Updates an existing WhatsApp template in Firestore.
   */
  const updateTemplate = async (id, { name, language = 'ar', text = '', variables = [] }) => {
    if (!id) throw new Error('ID is required');
    const cleanName = (name || '').trim().toLowerCase().replace(/\s+/g, '_');
    const cleanLanguage = (language || 'ar').trim();
    const cleanText = (text || '').trim();

    if (!cleanName) {
      throw new Error('Template Name is required');
    }

    const docRef = doc(db, TEMPLATES_COLLECTION, id);
    const updateData = {
      name: cleanName,
      language: cleanLanguage,
      text: cleanText,
      variables: Array.isArray(variables) ? variables.map((v) => String(v).trim()).filter(Boolean) : [],
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
