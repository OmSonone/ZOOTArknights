import { CloudCard } from "../components/account/CloudCard";
import { useMemo } from "react";
import { Page } from "../components/layout/Shell";
import { Img } from "../components/common/Img";
import { Icon } from "../components/neu/Icon";
import { Select } from "../components/neu/Select";
import { Badge, Button, Empty, IconButton, Stepper } from "../components/neu/ui";
import { SERVERS } from "../lib/constants";
import { formatDate } from "../lib/format";
import { avatarUrl, skillUrl } from "../lib/images";
import type { OperatorData, SupportSlot } from "../lib/types";
import { useGameData } from "../state/data";
import { useApp } from "../state/store";
import { useToast } from "../state/toast";

function SupportCard({
  slot,
  dataOp,
  onEdit,
}: {
  slot: SupportSlot | null;
  dataOp: OperatorData | null;
  onEdit: () => void;
}) {
  return (
    <button type="button" className="support-slot" onClick={onEdit}>
      {dataOp ? (
        <span className="support-slot__art">
          <Img src={avatarUrl(dataOp.id, 2)} alt={dataOp.name} />
        </span>
      ) : (
        <span className="support-slot__empty">
          <Icon name="plus" size={20} />
        </span>
      )}
      <span className="support-slot__name">{dataOp?.name ?? "Add support"}</span>
      {dataOp && slot ? (
        <span className="hint">
          S{slot.skill}
          {slot.module > 0 ? ` · M${slot.module}` : ""}
        </span>
      ) : (
        <span className="hint">Empty slot</span>
      )}
    </button>
  );
}

export default function ProfilePage() {
  const data = useGameData();
  const { state, dispatch } = useApp();
  const { push } = useToast();
  const profile = state.profile;

  const operators = useMemo(() => [...data.operators].sort((a, b) => a.name.localeCompare(b.name)), [data.operators]);

  const assistant = profile.assistant ? data.operatorMap[profile.assistant] : null;

  const operatorOptions = useMemo(
    () =>
      operators.map((op) => ({
        value: op.id,
        label: op.name,
        description: `${op.rarity}★ ${op.class}`,
        icon: <Img src={avatarUrl(op.id, 0)} alt="" />,
      })),
    [operators],
  );

  const patch = (value: Partial<typeof profile>) => dispatch({ type: "profile/patch", patch: value });

  const setSupport = (index: number, slot: SupportSlot | null) => dispatch({ type: "profile/support", index, slot });

  const updateSupport = (index: number, update: Partial<SupportSlot>) => {
    const current = profile.supports[index];
    if (!current) return;
    setSupport(index, { ...current, ...update });
  };

  const copyProfile = async () => {
    const lines = [
      `${profile.name || "Doctor"}${profile.uid ? `#${profile.uid}` : ""}`,
      `Server ${profile.server} · Doctor level ${profile.level}`,
      profile.onboard ? `Onboard ${formatDate(profile.onboard)}` : "",
      assistant ? `Assistant: ${assistant.name}` : "",
      "Supports:",
      ...profile.supports.map((slot, index) => {
        if (!slot) return `- Slot ${index + 1}: empty`;
        const op = data.operatorMap[slot.opId];
        return `- ${op?.name ?? slot.opId} · skill ${slot.skill}${slot.module > 0 ? ` · module ${slot.module}` : ""}`;
      }),
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      push("Profile copied to clipboard.", "success");
    } catch {
      push("Clipboard access was blocked by the browser.", "error");
    }
  };

  return (
    <Page
      title="Profile"
      subtitle="Your doctor card, stored in this browser, and in the cloud if you sign in."
      actions={
        <Button size="sm" variant="ghost" onClick={copyProfile}>
          Copy profile
        </Button>
      }
    >
      <CloudCard />

      <section className="doctor-card">
        <div className="doctor-card__head">
          <span className="doctor-card__assistant">
            {assistant ? (
              <Img src={avatarUrl(assistant.id, 2)} alt={assistant.name} />
            ) : (
              <Img src={avatarUrl("char_002_amiya", 2)} alt="" />
            )}
          </span>
          <div className="doctor-card__id">
            <span className="doctor-card__name">{profile.name || "Doctor"}</span>
            <span className="doctor-card__uid">{profile.uid ? `#${profile.uid}` : "UID not set"}</span>
            <div className="doctor-card__meta">
              <Badge tone="accent">{profile.server}</Badge>
              <Badge>Lv {profile.level}</Badge>
              {profile.onboard && <Badge>Onboard {formatDate(profile.onboard)}</Badge>}
            </div>
          </div>
          <span className="spacer" />
          <span
            style={{
              fontFamily: "var(--font-num)",
              fontSize: "2.6rem",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "var(--text-faint)",
              lineHeight: 1,
            }}
            aria-hidden="true"
          >
            LV{profile.level}
          </span>
        </div>

        <div>
          <div className="section-head">
            <span className="section-head__title">Support units</span>
          </div>
          <div className="supports">
            {profile.supports.map((slot, index) => (
              <SupportCard
                key={index}
                slot={slot}
                dataOp={slot ? (data.operatorMap[slot.opId] ?? null) : null}
                onEdit={() => {
                  const element = document.getElementById(`support-picker-${index}`);
                  element?.focus();
                  element?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="neu-card col" style={{ gap: 16 }}>
        <div className="section-head">
          <span className="section-head__title">Doctor details</span>
        </div>
        <div className="profile-form">
          <label className="field">
            <span className="field__label">Display name</span>
            <input
              className="input"
              value={profile.name}
              maxLength={24}
              placeholder="Kal'tsit fan #1"
              onChange={(event) => patch({ name: event.target.value })}
            />
          </label>
          <label className="field">
            <span className="field__label">UID</span>
            <input
              className="input"
              value={profile.uid}
              inputMode="numeric"
              maxLength={12}
              placeholder="12345678"
              onChange={(event) => patch({ uid: event.target.value.replace(/[^\d]/g, "") })}
            />
          </label>
          <div className="field">
            <span className="field__label">Server</span>
            <Select<string>
              ariaLabel="Server"
              value={profile.server}
              onChange={(value) => patch({ server: value as typeof profile.server })}
              options={SERVERS.map((server) => ({ value: server, label: server }))}
            />
          </div>
          <div className="field">
            <span className="field__label">Doctor level</span>
            <Stepper
              value={profile.level}
              min={1}
              max={120}
              onChange={(value) => patch({ level: value })}
              label="doctor level"
              size="lg"
            />
          </div>
          <label className="field">
            <span className="field__label">Onboard date</span>
            <input
              className="input"
              type="date"
              value={profile.onboard}
              onChange={(event) => patch({ onboard: event.target.value })}
            />
          </label>
          <div className="field">
            <span className="field__label">Assistant</span>
            <Select<string>
              ariaLabel="Assistant"
              value={profile.assistant ?? ""}
              onChange={(value) => patch({ assistant: value || null })}
              searchable
              options={[{ value: "", label: "No assistant" }, ...operatorOptions]}
            />
          </div>
        </div>
      </section>

      <section className="neu-card col" style={{ gap: 16 }}>
        <div className="section-head">
          <span className="section-head__title">Support line-up</span>
          <span className="hint" style={{ marginLeft: "auto" }}>
            Three slots, shown on your card.
          </span>
        </div>

        {profile.supports.map((slot, index) => {
          const slotOp = slot ? data.operatorMap[slot.opId] : null;
          const skillCount = slotOp?.skillData?.length ?? 0;
          return (
            <div key={index} className="skill-row" style={{ gap: 12 }} aria-label={`Support slot ${index + 1}`}>
              <div className="skill-row__head">
                <span className="skill-row__icon">{slotOp ? <Img src={avatarUrl(slotOp.id, 2)} alt="" /> : null}</span>
                <span className="skill-row__name">
                  Slot {index + 1}
                  {slotOp ? ` · ${slotOp.name}` : ""}
                </span>
                <span className="spacer" />
                {slot && (
                  <IconButton
                    icon="trash"
                    label={`Clear support slot ${index + 1}`}
                    size="sm"
                    variant="ghost"
                    onClick={() => setSupport(index, null)}
                  />
                )}
              </div>
              <div className="row row--wrap" style={{ gap: 8 }}>
                <div className="support-picker">
                  <Select<string>
                    id={`support-picker-${index}`}
                    ariaLabel={`Support operator for slot ${index + 1}`}
                    placeholder="Choose an operator…"
                    value={slot?.opId ?? ""}
                    searchable
                    options={[{ value: "", label: "Choose an operator…" }, ...operatorOptions]}
                    onChange={(opId) => {
                      if (!opId) {
                        setSupport(index, null);
                        return;
                      }
                      setSupport(index, { opId, skill: 1, module: 0 });
                    }}
                  />
                </div>

                {slot && skillCount > 0 && (
                  <div className="support-picker support-picker--skill">
                    <Select<number>
                      ariaLabel="Support skill"
                      value={slot.skill}
                      onChange={(value) => updateSupport(index, { skill: value })}
                      options={Array.from({ length: skillCount }, (_, skillIndex) => ({
                        value: skillIndex + 1,
                        label: `Skill ${skillIndex + 1}`,
                      }))}
                    />
                  </div>
                )}

                {slot && (slotOp?.moduleData?.length ?? 0) > 0 && (
                  <div className="support-picker support-picker--module">
                    <Select<number>
                      ariaLabel="Support module"
                      value={slot.module}
                      onChange={(value) => updateSupport(index, { module: value })}
                      options={[
                        { value: 0, label: "No module" },
                        ...(slotOp?.moduleData ?? []).map((mod, modIndex) => ({
                          value: modIndex + 1,
                          label: mod.typeName,
                        })),
                      ]}
                    />
                  </div>
                )}
              </div>
              {slot && slotOp?.skillData?.[slot.skill - 1] && (
                <div className="row" style={{ gap: 8 }}>
                  <span className="skill-row__icon" style={{ width: 22, height: 22 }}>
                    <Img
                      src={skillUrl(
                        slotOp.skillData[slot.skill - 1].iconId ?? slotOp.skillData[slot.skill - 1].skillId,
                      )}
                      alt=""
                    />
                  </span>
                  <span className="hint">{slotOp.skillData[slot.skill - 1].skillName}</span>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {Object.keys(state.roster).length === 0 && (
        <Empty icon="info" title="Nothing owned yet">
          Your collection, roster and planner all start from the Input page.
        </Empty>
      )}
    </Page>
  );
}
