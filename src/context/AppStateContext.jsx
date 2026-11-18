import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { cloudSnapshotSignature, loadCloudState, saveCloudState } from '../lib/cloudStore.js';
import { saveDemoState } from '../lib/demoStore.js';
import { emptyMemberData } from '../lib/friendsStore.js';

const AppStateContext = createContext(null);

const cloudKey = (state, user) => state?.mode === 'cloud' && state.experience?.id && user?.id
  && (!state.activeUserId || state.activeUserId === user.id)
  ? `${user.id}:${state.experience.id}`
  : '';

export function AppStateProvider({ children }) {
  const [state, setStateValue] = useState(null);
  const [cloudUser, setCloudUserValue] = useState(null);
  const [syncError, setSyncError] = useState('');
  const stateRef = useRef(null);
  const cloudUserRef = useRef(null);
  const syncKeyRef = useRef('');
  const lastSavedSignatureRef = useRef('');
  const dirtyRef = useRef(false);
  const saveQueueRef = useRef(Promise.resolve());
  const refreshInFlightRef = useRef(false);
  const refreshPendingRef = useRef(false);

  stateRef.current = state;
  cloudUserRef.current = cloudUser;

  const setCloudUser = useCallback((user) => {
    const nextUser = user || null;
    const previousId = cloudUserRef.current?.id;
    cloudUserRef.current = nextUser;
    setCloudUserValue(nextUser);
    if (!nextUser) {
      syncKeyRef.current = '';
      lastSavedSignatureRef.current = '';
      dirtyRef.current = false;
      return;
    }
    if (previousId && previousId !== nextUser.id) {
      syncKeyRef.current = '';
      lastSavedSignatureRef.current = '';
      dirtyRef.current = false;
      refreshPendingRef.current = false;
    }
  }, []);

  const setState = useCallback((value) => {
    const previous = stateRef.current;
    const next = typeof value === 'function' ? value(previous) : value;
    stateRef.current = next;
    const user = cloudUserRef.current;
    const key = cloudKey(next, user);
    if (key && key !== syncKeyRef.current) {
      syncKeyRef.current = key;
      lastSavedSignatureRef.current = '';
      dirtyRef.current = true;
    }
    if (key) dirtyRef.current = cloudSnapshotSignature(next, user.id) !== lastSavedSignatureRef.current;
    else if (!next || next.mode !== 'cloud') {
      syncKeyRef.current = '';
      lastSavedSignatureRef.current = '';
      dirtyRef.current = false;
    }
    setStateValue(next);
  }, []);

  const hydrateCloudState = useCallback((next, user = cloudUserRef.current) => {
    if (user) {
      cloudUserRef.current = user;
      setCloudUserValue(user);
    }
    const key = cloudKey(next, user);
    syncKeyRef.current = key;
    lastSavedSignatureRef.current = key ? cloudSnapshotSignature(next, user.id) : '';
    dirtyRef.current = false;
    stateRef.current = next;
    setStateValue(next);
  }, []);

  const update = useCallback((updater) => setState(updater), [setState]);
  const updateMember = useCallback((updater, memberId) => {
    const current = stateRef.current;
    const id = memberId || current?.activeUserId;
    if (!current || !id) return;
    setState((previous) => {
      if (!previous) return previous;
      const before = previous.memberData?.[id] || emptyMemberData();
      const after = typeof updater === 'function' ? updater(before) : { ...before, ...updater };
      return { ...previous, memberData: { ...previous.memberData, [id]: after } };
    });
  }, [setState]);

  const refreshFromRemote = useCallback(async () => {
    if (refreshInFlightRef.current) {
      refreshPendingRef.current = true;
      return;
    }
    refreshInFlightRef.current = true;
    refreshPendingRef.current = false;
    try {
      const user = cloudUserRef.current;
      const current = stateRef.current;
      const key = cloudKey(current, user);
      if (!key || !current?.experience?.id) return;
      if (dirtyRef.current) {
        refreshPendingRef.current = true;
        return;
      }

      const beforeSignature = cloudSnapshotSignature(current, user.id);
      const fresh = await loadCloudState(user, current.experience.id);
      if (!fresh) return;
      const latest = stateRef.current;
      if (cloudUserRef.current?.id !== user.id || cloudKey(latest, user) !== key) return;
      if (dirtyRef.current || cloudSnapshotSignature(latest, user.id) !== beforeSignature) {
        refreshPendingRef.current = true;
        return;
      }

      const remoteSignature = cloudSnapshotSignature(fresh, user.id);
      if (remoteSignature !== beforeSignature) hydrateCloudState(fresh, user);
    } catch {
      // La última versión local permanece visible. El siguiente evento Realtime vuelve a intentar.
    } finally {
      refreshInFlightRef.current = false;
      if (refreshPendingRef.current && !dirtyRef.current) {
        refreshPendingRef.current = false;
        queueMicrotask(() => refreshFromRemote());
      }
    }
  }, [hydrateCloudState]);

  const persistCurrent = useCallback(async () => {
    const latest = stateRef.current;
    const latestUser = cloudUserRef.current;
    const key = cloudKey(latest, latestUser);
    if (!key || !dirtyRef.current || !latestUser?.id) return;

    const latestSignature = cloudSnapshotSignature(latest, latestUser.id);
    const task = saveQueueRef.current.catch(() => {}).then(() => saveCloudState(latest, latestUser.id));
    saveQueueRef.current = task;
    try {
      await task;
      if (cloudUserRef.current?.id !== latestUser.id || syncKeyRef.current !== key) return;
      lastSavedSignatureRef.current = latestSignature;
      const current = stateRef.current;
      dirtyRef.current = !current || cloudSnapshotSignature(current, latestUser.id) !== latestSignature;
      setSyncError('');
      if (refreshPendingRef.current && !dirtyRef.current) refreshFromRemote();
    } catch (error) {
      if (cloudUserRef.current?.id === latestUser.id && syncKeyRef.current === key) {
        dirtyRef.current = true;
        setSyncError(error.message || 'No pudimos sincronizar este cambio.');
      }
    }
  }, [refreshFromRemote]);

  useEffect(() => {
    if (state?.mode === 'demo') saveDemoState(state);
  }, [state]);

  useEffect(() => {
    if (state?.mode !== 'cloud' || !cloudUser || !state.experience?.id) return undefined;
    const key = cloudKey(state, cloudUser);
    if (!key) return undefined;
    if (key !== syncKeyRef.current) {
      syncKeyRef.current = key;
      lastSavedSignatureRef.current = '';
      dirtyRef.current = true;
    }
    const signature = cloudSnapshotSignature(state, cloudUser.id);
    if (!dirtyRef.current && signature === lastSavedSignatureRef.current) return undefined;

    const timer = window.setTimeout(persistCurrent, 650);

    return () => window.clearTimeout(timer);
  }, [state, cloudUser, persistCurrent]);

  useEffect(() => {
    if (state?.mode !== 'cloud' || !cloudUser || !cloudKey(state, cloudUser) || !supabase) return undefined;
    const experienceId = state.experience.id;
    let debounceTimer;
    const scheduleRefresh = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => refreshFromRemote(), 80);
    };
    const channel = supabase.channel(`chippa-state-${cloudUser.id}-${experienceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experience_state', filter: `experience_id=eq.${experienceId}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participant_private_state', filter: `experience_id=eq.${experienceId}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participant_shared_state', filter: `experience_id=eq.${experienceId}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experience_participants', filter: `experience_id=eq.${experienceId}` }, scheduleRefresh)
      .subscribe();
    const refreshOnReturn = () => {
      if (document.hidden) return;
      if (dirtyRef.current) persistCurrent();
      else refreshFromRemote();
    };
    window.addEventListener('focus', refreshOnReturn);
    window.addEventListener('online', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => {
      window.clearTimeout(debounceTimer);
      window.removeEventListener('focus', refreshOnReturn);
      window.removeEventListener('online', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
      supabase.removeChannel(channel);
    };
  }, [state?.mode, state?.experience?.id, cloudUser?.id, refreshFromRemote, persistCurrent]);

  const clearSyncError = useCallback(() => setSyncError(''), []);
  const value = useMemo(() => ({ state, setState, update, updateMember, setCloudUser, hydrateCloudState, syncError, clearSyncError }), [state, setState, update, updateMember, setCloudUser, hydrateCloudState, syncError, clearSyncError]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState debe usarse dentro de AppStateProvider.');
  return context;
}
