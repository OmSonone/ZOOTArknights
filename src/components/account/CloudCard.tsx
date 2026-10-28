import { useCloud } from "../../state/cloud";
import type { CloudStatus } from "../../state/cloud";
import { Badge, Button } from "../neu/ui";

const STATUS_LABEL: Record<CloudStatus, string> = {
  disabled: "Not configured",
  "signed-out": "Local only",
  syncing: "Syncing…",
  synced: "Synced",
  conflict: "Needs your choice",
  error: "Sync failed",
};

export function CloudCard() {
  const { enabled, status, user, lastSynced, signIn, signOut, syncNow } = useCloud();

  return (
    <section className="neu-card col" style={{ gap: 12 }}>
      <div className="section-head">
        <span className="section-head__title">Cloud save</span>
        <div className="section-head__actions">
          <Badge>{STATUS_LABEL[status]}</Badge>
        </div>
      </div>
      {!enabled && (
        <p className="hint">
          Cloud sync is off. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see{" "}
          <code>.env.example</code>) and restart to enable sign-in.
        </p>
      )}
      {enabled && !user && (
        <>
          <p className="hint">
            Sign in to keep your save across browsers and devices. Without signing in, your save stays only in
            this browser.
          </p>
          <div className="row row--wrap" style={{ gap: 10 }}>
            <Button variant="primary" onClick={() => void signIn("discord")}>
              Continue with Discord
            </Button>
            <Button onClick={() => void signIn("google")}>Continue with Google</Button>
          </div>
        </>
      )}
      {enabled && user && (
        <>
          <div className="row" style={{ gap: 12 }}>
            {user.avatar && (
              <img src={user.avatar} alt="" width={36} height={36} style={{ borderRadius: "50%" }} />
            )}
            <div className="col" style={{ gap: 2 }}>
              <strong>{user.name ?? user.email ?? "Signed in"}</strong>
              {user.email && user.name && <span className="hint">{user.email}</span>}
              {lastSynced && <span className="hint">Last synced {lastSynced.toLocaleTimeString()}</span>}
            </div>
          </div>
          <div className="row row--wrap" style={{ gap: 10 }}>
            <Button size="sm" onClick={() => void syncNow()}>
              Sync now
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
