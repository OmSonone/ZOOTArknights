import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Provider, Session } from "@supabase/supabase-js";
import { Dialog } from "../components/neu/Dialog";
import { Button } from "../components/neu/ui";
import { normalizeState, serializeSave } from "../lib/storage";
import { cloudEnabled, supabase } from "../lib/supabase";
import type { AppState } from "../lib/types";
import { useApp } from "./store";
import { useToast } from "./toast";

export type CloudStatus = "disabled" | "signed-out" | "syncing" | "synced" | "conflict" | "error";

interface CloudValue {
  enabled: boolean;
  status: CloudStatus;
  user: { email: string | null; name: string | null; avatar: string | null } | null;
  lastSynced: Date | null;
  signIn: (provider: Extract<Provider, "discord" | "google">) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const CloudContext = createContext<CloudValue | null>(null);

const PUSH_DELAY = 1500;
const isEmpty = (state: AppState) =>
  Object.keys(state.roster).length === 0 && state.goals.length === 0 && Object.keys(state.depot).length === 0;

interface RemoteSave {
  state: AppState;
  updatedAt: string;
}

export function CloudProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useApp();
  const { push } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<CloudStatus>(cloudEnabled ? "signed-out" : "disabled");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [conflict, setConflict] = useState<RemoteSave | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const syncedJson = useRef<string | null>(null);
  const pushTimer = useRef<number | null>(null);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const pull = useCallback(async (): Promise<RemoteSave | null> => {
    if (!supabase || !userId) return null;
    const { data, error } = await supabase
      .from("saves")
      .select("state, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? { state: normalizeState(data.state), updatedAt: data.updated_at as string } : null;
  }, [userId]);

  const push_ = useCallback(
    async (next: AppState) => {
      if (!supabase || !userId) return;
      const { error } = await supabase
        .from("saves")
        .upsert({ user_id: userId, state: next, updated_at: new Date().toISOString() });
      if (error) throw error;
      syncedJson.current = serializeSave(next);
      setLastSynced(new Date());
      setStatus("synced");
    },
    [userId],
  );

  const adoptRemote = useCallback((remote: RemoteSave) => {
    syncedJson.current = serializeSave(remote.state);
    dispatch({ type: "state/replace", state: remote.state });
    setLastSynced(new Date());
    setStatus("synced");
  }, [dispatch]);

  const reconcile = useCallback(async () => {
    if (!userId) return;
    setStatus("syncing");
    try {
      const remote = await pull();
      const local = stateRef.current;
      const localJson = serializeSave(local);
      if (!remote) return await push_(local);
      const remoteJson = serializeSave(remote.state);
      if (remoteJson === localJson) {
        syncedJson.current = localJson;
        setLastSynced(new Date());
        return setStatus("synced");
      }
      if (isEmpty(local) || localJson === syncedJson.current) return adoptRemote(remote);
      setConflict(remote);
      setStatus("conflict");
    } catch (error) {
      console.warn("Cloud sync failed.", error);
      setStatus("error");
    }
  }, [userId, pull, push_, adoptRemote]);

  useEffect(() => {
    if (!userId) {
      syncedJson.current = null;
      setConflict(null);
      setLastSynced(null);
      setStatus(cloudEnabled ? "signed-out" : "disabled");
      return;
    }
    void reconcile();
  }, [userId, reconcile]);

  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && status !== "conflict") void reconcile();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId, status, reconcile]);

  useEffect(() => {
    if (!userId || syncedJson.current == null || status === "conflict" || status === "syncing") return;
    if (serializeSave(state) === syncedJson.current) return;
    if (pushTimer.current != null) window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => {
      push_(stateRef.current).catch((error) => {
        console.warn("Cloud sync failed.", error);
        setStatus("error");
      });
    }, PUSH_DELAY);
    return () => {
      if (pushTimer.current != null) window.clearTimeout(pushTimer.current);
    };
  }, [state, userId, status, push_]);

  const signIn = useCallback<CloudValue["signIn"]>(async (provider) => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) push(`Could not start ${provider} sign-in: ${error.message}`, "error");
  }, [push]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    push("Signed out. Your save stays in this browser.", "info");
  }, [push]);

  const resolveConflict = async (choice: "cloud" | "local") => {
    const remote = conflict;
    setConflict(null);
    if (!remote) return;
    setStatus("syncing");
    try {
      if (choice === "cloud") adoptRemote(remote);
      else await push_(stateRef.current);
    } catch (error) {
      console.warn("Cloud sync failed.", error);
      setStatus("error");
    }
  };

  const meta = session?.user.user_metadata as Record<string, string> | undefined;
  const value = useMemo<CloudValue>(
    () => ({
      enabled: cloudEnabled,
      status,
      user: session
        ? {
            email: session.user.email ?? null,
            name: meta?.full_name ?? meta?.name ?? meta?.user_name ?? null,
            avatar: meta?.avatar_url ?? null,
          }
        : null,
      lastSynced,
      signIn,
      signOut,
      syncNow: reconcile,
    }),
    [status, session, meta, lastSynced, signIn, signOut, reconcile],
  );

  return (
    <CloudContext.Provider value={value}>
      {children}
      <Dialog
        open={conflict != null}
        onClose={() => setConflict(null)}
        title="Two different saves"
        subtitle="This browser and your cloud account both have progress."
        footer={
          <>
            <Button onClick={() => void resolveConflict("cloud")}>Use cloud save</Button>
            <Button variant="primary" onClick={() => void resolveConflict("local")}>
              Overwrite cloud with this browser
            </Button>
          </>
        }
      >
        <p className="hint">
          Pick the one to keep. The other is replaced. Tip: export this browser's save from Input first if
          you are unsure.
        </p>
      </Dialog>
    </CloudContext.Provider>
  );
}

export function useCloud(): CloudValue {
  const value = useContext(CloudContext);
  if (!value) throw new Error("useCloud must be used inside CloudProvider");
  return value;
}
