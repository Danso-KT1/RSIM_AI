/**
 * useStorage — Reactive hook for reading RSIM localStorage data.
 *
 * Returns stable references that only update when you call `reload()`.
 * Components that consume this hook will NOT re-render just because
 * another part of the tree calls storage.saveDocument(), etc.
 * Call `reload()` explicitly after any mutation to trigger a re-render.
 *
 * Usage:
 *   const { documents, meetings, reload } = useStorage();
 */
import { useState, useCallback } from 'react';
import { storage } from '../services/storage';
import { UserProfile, Meeting, DocumentItem, ActionItem } from '../types';

export interface StorageSnapshot {
  user: UserProfile;
  meetings: Meeting[];
  documents: DocumentItem[];
  actionItems: ActionItem[];
  reload: () => void;
}

export function useStorage(): StorageSnapshot {
  const [user, setUser] = useState<UserProfile>(() => storage.getUser());
  const [meetings, setMeetings] = useState<Meeting[]>(() => storage.getMeetings());
  const [documents, setDocuments] = useState<DocumentItem[]>(() => storage.getDocuments());
  const [actionItems, setActionItems] = useState<ActionItem[]>(() => storage.getActionItems());

  const reload = useCallback(() => {
    setUser(storage.getUser());
    setMeetings(storage.getMeetings());
    setDocuments(storage.getDocuments());
    setActionItems(storage.getActionItems());
  }, []);

  return { user, meetings, documents, actionItems, reload };
}
