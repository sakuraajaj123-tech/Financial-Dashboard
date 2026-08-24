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

const QUICK_REPLIES_COLLECTION = 'whatsapp_quick_replies';

/**
 * Custom React hook for managing WhatsApp Quick Replies / Saved Templates in Firestore.
 * Collection: whatsapp_quick_replies
 * Schema:
 *   - id: string
 *   - title: string
 *   - content: string
 *   - createdAt: string (ISO string)
 *   - updatedAt?: string
 */
export function useQuickReplies() {
  const [quickReplies, setQuickReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsubscribe;
    try {
      const colRef = collection(db, QUICK_REPLIES_COLLECTION);
      const q = query(colRef, orderBy('createdAt', 'desc'));

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title || '',
              content: data.content || '',
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || null,
            };
          });
          setQuickReplies(items);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.warn('[useQuickReplies] Ordered query failed, falling back to unordered:', err);
          const fallbackColRef = collection(db, QUICK_REPLIES_COLLECTION);
          unsubscribe = onSnapshot(
            fallbackColRef,
            (fallbackSnapshot) => {
              const items = fallbackSnapshot.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  title: data.title || '',
                  content: data.content || '',
                  createdAt: data.createdAt || new Date().toISOString(),
                  updatedAt: data.updatedAt || null,
                };
              });
              items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              setQuickReplies(items);
              setLoading(false);
              setError(null);
            },
            (fallbackErr) => {
              console.error('[useQuickReplies] Firestore error:', fallbackErr);
              setError(fallbackErr.message);
              setLoading(false);
            }
          );
        }
      );
    } catch (err) {
      console.error('[useQuickReplies] Setup error:', err);
      setError(err.message);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  /**
   * Adds a new quick reply template.
   */
  const addQuickReply = async ({ title, content }) => {
    if (!title?.trim() || !content?.trim()) {
      throw new Error('Title and content are required');
    }
    const colRef = collection(db, QUICK_REPLIES_COLLECTION);
    const newDoc = {
      title: title.trim(),
      content: content.trim(),
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    };
    const docRef = await addDoc(colRef, newDoc);
    return { id: docRef.id, ...newDoc };
  };

  /**
   * Updates an existing quick reply template.
   */
  const updateQuickReply = async (id, { title, content }) => {
    if (!id) throw new Error('ID is required');
    if (!title?.trim() || !content?.trim()) {
      throw new Error('Title and content are required');
    }
    const docRef = doc(db, QUICK_REPLIES_COLLECTION, id);
    const updateData = {
      title: title.trim(),
      content: content.trim(),
      updatedAt: new Date().toISOString(),
    };
    await updateDoc(docRef, updateData);
    return { id, ...updateData };
  };

  /**
   * Deletes a quick reply template.
   */
  const deleteQuickReply = async (id) => {
    if (!id) throw new Error('ID is required');
    const docRef = doc(db, QUICK_REPLIES_COLLECTION, id);
    await deleteDoc(docRef);
  };

  return {
    quickReplies,
    loading,
    error,
    addQuickReply,
    updateQuickReply,
    deleteQuickReply,
  };
}
