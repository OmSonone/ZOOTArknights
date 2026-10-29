import { useEffect, useMemo, useRef, useState } from "react";
import { Page } from "../components/layout/Shell";
import { Img } from "../components/common/Img";
import { Icon } from "../components/neu/Icon";
import { Button, IconButton, Stat, Switch } from "../components/neu/ui";
import { formatExact, formatNumber } from "../lib/format";
import { itemUrl } from "../lib/images";
import {
  IMPORT_SERVERS,
  clearCredentials,
  fileToDataUrl,
  loadSavedCredentials,
  mapImportedAccount,
  requestAccount,
  requestAccountWithToken,
  requestCode,
  requestDepotOcr,
  saveCredentials,
} from "../lib/gameImport";
import type { ImportOptions, ImportServer, ImportSummary, SavedCredentials } from "../lib/gameImport";
import { isGoalComplete } from "../lib/planner";
import type { DoctorProfile } from "../lib/types";
import { useGameData } from "../state/data";
import { useApp } from "../state/store";
import { useToast } from "../state/toast";

type Phase = "idle" | "sending" | "syncing";
type StepState = "done" | "active" | "todo";

const defaultOptions: ImportOptions = {
  operators: true,
  profile: true,
  depot: true,
  applyPotentials: false,
};

const MAX_SCREENSHOTS = 12;
const RESEND_SECONDS = 30;

export default function ImportPage() {
  const data = useGameData();
  const { state, dispatch } = useApp();
  const { push } = useToast();

  const [server, setServer] = useState<ImportServer>("en");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [options, setOptions] = useState<ImportOptions>(defaultOptions);
  const [remember, setRemember] = useState(true);
  const [pruneGoals, setPruneGoals] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [saved, setSaved] = useState<SavedCredentials | null>(() => loadSavedCredentials());

  const [shots, setShots] = useState<{ file: File; url: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrResult, setOcrResult] = useState<Record<string, number> | null>(null);
  const [ocrApplied, setOcrApplied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const shotsRef = useRef(shots);
  shotsRef.current = shots;

  useEffect(() => {
    if (saved?.server && saved.server !== server) setServer(saved.server);
    // Only sync the selector when saved credentials change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.savedAt]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    return () => shotsRef.current.forEach((shot) => URL.revokeObjectURL(shot.url));
  }, []);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const busy = phase !== "idle";

  const step1: StepState = codeSent ? "done" : "active";
  const step2: StepState = summary ? "done" : codeSent ? "active" : "todo";
  const step3: StepState = summary ? "done" : codeSent && code.length >= 4 ? "active" : "todo";

  const sendCode = async () => {
    if (!emailValid || busy || cooldown > 0) return;
    setPhase("sending");
    try {
      await requestCode(email, server);
      setCodeSent(true);
      setCooldown(RESEND_SECONDS);
      push("Code sent. It can take a minute — check spam too.", "success");
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not send the code.", "error");
    } finally {
      setPhase("idle");
    }
  };

  const applyImport = (
    user: Parameters<typeof mapImportedAccount>[0],
    tokenData: Parameters<typeof saveCredentials>[0]["tokenData"],
    usedServer: ImportServer,
  ) => {
    const mapped = mapImportedAccount(user, data, { roster: state.roster, profile: state.profile }, options);

    dispatch({
      type: "import/apply",
      roster: options.operators ? mapped.roster : undefined,
      depot: options.depot ? mapped.depot : undefined,
      profile: options.profile
        ? { ...mapped.profile, server: usedServer.toUpperCase() as DoctorProfile["server"] }
        : undefined,
      supports: options.profile ? mapped.supports : undefined,
    });

    if (pruneGoals) {
      const roster = options.operators ? mapped.roster : state.roster;
      const completed = state.goals
        .filter((goal) => isGoalComplete(goal, roster, data))
        .map((goal) => goal.id);
      if (completed.length > 0) dispatch({ type: "goal/removeMany", ids: completed });
    }

    if (remember) {
      const credentials: SavedCredentials = { server: usedServer, tokenData, savedAt: Date.now() };
      saveCredentials(credentials);
      setSaved(credentials);
    } else {
      clearCredentials();
      setSaved(null);
    }

    setSummary(mapped.summary);
    push(
      `Imported ${mapped.summary.operators} operators and ${mapped.summary.depotItems} depot items.`,
      "success",
    );
  };

  const sync = async (useSaved: boolean) => {
    setPhase("syncing");
    try {
      if (useSaved) {
        if (!saved) throw new Error("No saved credentials.");
        const result = await requestAccountWithToken(saved.tokenData, saved.server);
        setServer(saved.server);
        applyImport(result.user, result.tokenData, saved.server);
      } else {
        const result = await requestAccount(email, code, server);
        applyImport(result.user, result.tokenData, server);
        setCode("");
      }
    } catch (error) {
      push(error instanceof Error ? error.message : "Import failed.", "error");
    } finally {
      setPhase("idle");
    }
  };

  const addFiles = (incoming: File[]) => {
    const images = incoming.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) {
      push("Only image files are supported.", "error");
      return;
    }
    const next = [...shots, ...images.map((file) => ({ file, url: URL.createObjectURL(file) }))];
    if (next.length > MAX_SCREENSHOTS) {
      push(`Only the first ${MAX_SCREENSHOTS} screenshots are used.`, "info");
      next.slice(MAX_SCREENSHOTS).forEach((shot) => URL.revokeObjectURL(shot.url));
    }
    setShots(next.slice(0, MAX_SCREENSHOTS));
    setOcrResult(null);
    setOcrApplied(false);
  };

  const removeFile = (index: number) => {
    setShots((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((_, i) => i !== index);
    });
    setOcrResult(null);
    setOcrApplied(false);
  };

  const runOcr = async () => {
    if (shots.length === 0) return;
    setOcrBusy(true);
    setOcrApplied(false);
    try {
      const images = await Promise.all(shots.map((shot) => fileToDataUrl(shot.file)));
      const { items } = await requestDepotOcr(images);
      const known = Object.fromEntries(
        Object.entries(items).filter(([id, count]) => data.itemMap[id] && typeof count === "number" && count > 0),
      );
      setOcrResult(known);
      if (Object.keys(known).length === 0) {
        push("No materials were recognized. Use full-screen depot screenshots.", "error");
      }
    } catch (error) {
      push(error instanceof Error ? error.message : "Screenshot recognition failed.", "error");
    } finally {
      setOcrBusy(false);
    }
  };

  const recognised = useMemo(() => {
    if (!ocrResult) return [];
    return Object.entries(ocrResult)
      .map(([id, count]) => ({ id, count, item: data.itemMap[id] }))
      .sort((a, b) => (b.item?.tier ?? 0) - (a.item?.tier ?? 0) || (a.item?.sortId ?? 0) - (b.item?.sortId ?? 0));
  }, [ocrResult, data.itemMap]);

  const totalUnits = recognised.reduce((total, entry) => total + entry.count, 0);
  const setOption = (key: keyof ImportOptions, value: boolean) =>
    setOptions((current) => ({ ...current, [key]: value }));

  return (
    <Page title="Import" subtitle="Sync your roster, profile and depot directly from the game account.">
      <section className="neu-card import-warning">
        <span className="import-warning__icon">
          <Icon name="alert" size={20} />
        </span>
        <div style={{ minWidth: 0 }}>
          <strong style={{ fontSize: "0.92rem" }}>Unofficial, use at your own risk</strong>
          <p className="hint" style={{ marginTop: 2 }}>
            ZOOT mimics the game login on your own machine. Logging in through Yostar signs the game client out, and
            Hypergryph/Yostar have not approved tools like this. Your email and code only travel to your device
            and the official servers — no third party is involved.
          </p>
        </div>
      </section>

      <div className="page-grid page-grid--split">
        <section className="neu-card col import-sync" style={{ gap: 18 }}>
          <ol className="import-steps" aria-label="Import steps">
            {[
              { index: 1, label: "Email", state: step1 },
              { index: 2, label: "Code", state: step2 },
              { index: 3, label: "Sync", state: step3 },
            ].map((step) => (
              <li key={step.index} className={`is-${step.state}`}>
                <span className="import-steps__num">{step.state === "done" ? <Icon name="check" size={13} /> : step.index}</span>
                <span className="import-steps__label">{step.label}</span>
              </li>
            ))}
          </ol>

          <div className="section-head" style={{ marginBottom: 0 }}>
            <span className="section-head__title">Account</span>
            <div className="section-head__actions">
              <div className="seg" role="group" aria-label="Server">
                {IMPORT_SERVERS.map((entry) => (
                  <button
                    key={entry.value}
                    type="button"
                    className="seg__opt"
                    aria-pressed={server === entry.value}
                    onClick={() => {
                      setServer(entry.value);
                      setCodeSent(false);
                      setCode("");
                      setCooldown(0);
                    }}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={`import-step${codeSent ? " is-done" : ""}`}>
            <div className="field">
              <span className="field__label">Yostar email</span>
              <div className="input-group">
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  placeholder="doctor@example.com"
                  value={email}
                  disabled={busy}
                  onChange={(event) => {
                    setEmail(event.target.value.trim());
                    if (codeSent) {
                      setCodeSent(false);
                      setCode("");
                    }
                  }}
                />
                <Button
                  onClick={() => void sendCode()}
                  disabled={!emailValid || busy || cooldown > 0}
                  className="input-group__action"
                >
                  {phase === "sending" ? "Sending…" : cooldown > 0 ? `Resend ${cooldown}s` : "Send code"}
                </Button>
              </div>
              <p className="hint">
                {cooldown > 0
                  ? "Code sent. It can take a minute to arrive — check spam before resending."
                  : "Use the email bound in game (User Center → Bind Email), not a Google/Apple login."}
              </p>
            </div>
          </div>

          <div className={`import-step${codeSent ? "" : " is-locked"}`}>
            <div className="field">
              <span className="field__label">Email code</span>
              <input
                className="input code-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={code}
                maxLength={8}
                disabled={busy || !codeSent}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
              />
            </div>
            <label className="import-confirm">
              <Switch checked={confirmed} onChange={setConfirmed} label="Confirmed email binding" />
              <span>
                <strong style={{ display: "block", fontSize: "0.84rem" }}>This email is bound to my main account</strong>
                <span className="hint">
                  An unbound email makes Yostar create a new level-1 account, which the import rejects.
                </span>
              </span>
            </label>
          </div>

          <Button
            variant="primary"
            block
            size="lg"
            disabled={busy || !codeSent || code.length < 4 || !confirmed}
            onClick={() => void sync(false)}
          >
            {phase === "syncing" ? "Syncing account…" : "Log in and sync"}
          </Button>

          <hr className="neu-divider" style={{ margin: 0 }} />

          {saved ? (
            <div className="saved-creds">
              <span className="saved-creds__icon">
                <Icon name="clock" size={17} />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ display: "block", fontSize: "0.84rem" }}>Saved credentials</strong>
                <span className="hint">
                  {saved.server.toUpperCase()} · {new Date(saved.savedAt).toLocaleDateString()}
                </span>
              </span>
              <div className="row" style={{ gap: 6 }}>
                <Button size="sm" variant="primary" disabled={busy} onClick={() => void sync(true)}>
                  Sync
                </Button>
                <IconButton
                  icon="trash"
                  size="sm"
                  variant="ghost"
                  label="Forget saved credentials"
                  onClick={() => {
                    clearCredentials();
                    setSaved(null);
                    push("Saved credentials removed.", "info");
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="hint" style={{ margin: 0 }}>
              After a successful sync you can keep the token in this browser to skip the email step next time.
            </p>
          )}
        </section>

        <aside className="col" style={{ gap: 16 }}>
          <section className="neu-card col" style={{ gap: 12 }}>
            <div className="section-head">
              <span className="section-head__title">What to import</span>
            </div>
            {(
              [
                ["operators", "Operators", "Levels, promotions, skills, masteries, modules, skins"],
                ["profile", "Profile & supports", "Name, UID, level, onboard date, support line-up"],
                ["depot", "Depot", "Material stock and LMD"],
                ["applyPotentials", "Apply unused tokens", "Counts spare potential tokens as potentials"],
              ] as [keyof ImportOptions, string, string][]
            ).map(([key, label, description]) => (
              <div key={key} className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                <Switch checked={options[key]} onChange={(value) => setOption(key, value)} label={label} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: "0.85rem", fontWeight: 560 }}>{label}</span>
                  <span className="hint">{description}</span>
                </span>
              </div>
            ))}
            <hr className="neu-divider" style={{ margin: 0 }} />
            <div className="row" style={{ gap: 10 }}>
              <Switch checked={remember} onChange={setRemember} label="Save credentials" />
              <span className="hint">Keep the token in this browser for later syncs</span>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <Switch checked={pruneGoals} onChange={setPruneGoals} label="Prune completed goals" />
              <span className="hint">Remove planner goals the imported roster already finished</span>
            </div>
          </section>

          {summary ? (
            <section className="neu-card import-success">
              <div className="import-success__mark">
                <Icon name="check" size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: "0.92rem" }}>Import complete</strong>
                <p className="hint">Roster, profile and depot are up to date.</p>
              </div>
              <div className="collection-stats">
                <Stat label="Operators" value={summary.operators} />
                <Stat label="Elite 2" value={summary.e2} />
                <Stat label="Depot items" value={summary.depotItems} />
                <Stat label="LMD" value={formatNumber(summary.lmd)} hint={formatExact(summary.lmd)} />
              </div>
            </section>
          ) : (
            <section className="neu-card col" style={{ gap: 10 }}>
              <div className="section-head" style={{ marginBottom: 0 }}>
                <span className="section-head__title">Before you start</span>
              </div>
              <p className="hint">
                {Object.keys(state.roster).length > 0
                  ? "Importing replaces the operators it finds; favourites are kept, and your planner goals stay unless they are already complete."
                  : "Importing fills your roster, profile and depot in one go. Nothing leaves this computer."}
              </p>
              <p className="hint">Only EN, JP and KR accounts are supported; CN uses Skland and is not implemented.</p>
            </section>
          )}
        </aside>
      </div>

      <section className="neu-card col" style={{ gap: 14 }}>
        <div className="section-head">
          <span className="section-head__title">Depot from screenshots</span>
          <span className="badge">OCR</span>
          <div className="section-head__actions">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            <Button size="sm" variant="ghost" onClick={() => fileInput.current?.click()}>
              Choose screenshots
            </Button>
          </div>
        </div>

        <div
          className={`ocr-drop${dragging ? " is-dragging" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => fileInput.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              fileInput.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <span className="ocr-drop__icon">
            <Icon name="image" size={24} />
          </span>
          <div>
            <strong style={{ display: "block", fontSize: "0.9rem" }}>Drop depot screenshots here</strong>
            <span className="hint">
              or click to browse · up to {MAX_SCREENSHOTS} images · read locally, never uploaded
            </span>
          </div>
          <span className="spacer" />
          <span className="badge">{shots.length}/{MAX_SCREENSHOTS}</span>
        </div>

        {shots.length > 0 && (
          <div className="ocr-thumbs">
            {shots.map(({ file, url }, index) => (
              <figure key={`${file.name}-${index}`} className="ocr-thumb">
                <img src={url} alt={file.name} />
                <button
                  type="button"
                  className="ocr-thumb__remove"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => removeFile(index)}
                >
                  <Icon name="close" size={11} />
                </button>
              </figure>
            ))}
          </div>
        )}

        {shots.length > 0 && (
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Button variant="primary" disabled={ocrBusy} onClick={() => void runOcr()}>
              {ocrBusy ? "Reading screenshots…" : `Read ${shots.length} screenshot${shots.length === 1 ? "" : "s"}`}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                shots.forEach((shot) => URL.revokeObjectURL(shot.url));
                setShots([]);
                setOcrResult(null);
                setOcrApplied(false);
              }}
            >
              Clear
            </Button>
          </div>
        )}

        {ocrBusy && (
          <div className="ocr-progress" aria-live="polite">
            <div className="boot__bar">
              <span />
            </div>
            <span className="hint">
              Scanning {shots.length} screenshot{shots.length === 1 ? "" : "s"} locally. The first run also downloads
              a few MB of model data.
            </span>
          </div>
        )}

        {recognised.length > 0 && (
          <div className="ocr-result">
            <div className="ocr-summary">
              <Stat label="Materials" value={recognised.length} />
              <Stat label="Total units" value={formatNumber(totalUnits)} hint={formatExact(totalUnits)} />
              <Stat label="Screenshots" value={shots.length} />
            </div>

            <div className="ocr-grid">
              {recognised.map(({ id, count, item }) => (
                <div key={id} className="depot-item" style={{ gridTemplateColumns: "34px minmax(0,1fr)" }}>
                  <span style={{ width: 34, height: 34 }}>
                    <Img
                      src={item ? itemUrl(item.iconId) : undefined}
                      alt={item?.name ?? id}
                      fallback={item?.name ?? id}
                    />
                  </span>
                  <span className="depot-item__name" title={item?.name}>
                    {item?.name ?? id}
                  </span>
                  <span className="num" style={{ gridColumn: 2, fontSize: "0.82rem" }}>
                    ×{count}
                  </span>
                </div>
              ))}
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <Button
                variant="primary"
                disabled={ocrApplied}
                onClick={() => {
                  dispatch({ type: "depot/bulk", entries: ocrResult ?? {} });
                  setOcrApplied(true);
                  push(`Applied ${recognised.length} materials to the depot.`, "success");
                }}
              >
                {ocrApplied ? "Applied ✓" : `Apply ${recognised.length} to depot`}
              </Button>
              <span className="hint">Only the recognized items are updated; everything else stays as is.</span>
            </div>
          </div>
        )}
      </section>

      <details className="neu-card import-how">
        <summary>
          <span className="section-head__title">How it works</span>
          <Icon name="chevronDown" size={16} />
        </summary>
        <ol className="hint">
          <li>The local server asks Yostar to email a code to your bound address.</li>
          <li>The code is exchanged for a Yostar token, then for a u8 token and a game login secret.</li>
          <li>The client calls <code>/account/syncData</code> and maps the response into this save file.</li>
          <li>Screenshots are read locally by the Arkntools depot recognizer; nothing is uploaded anywhere.</li>
        </ol>
      </details>
    </Page>
  );
}
