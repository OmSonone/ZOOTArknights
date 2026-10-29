import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import type { Dispatch, ReactNode } from "react";
import type { AppState, Depot, DoctorProfile, Operator, PlannerGoal, PlannerSettings, Roster, SupportSlot } from "../lib/types";
import { createDefaultState, loadState, saveState } from "../lib/storage";

export type Action =
  | { type: "operator/set"; opId: string; op: Operator }
  | { type: "operator/patch"; opId: string; update: Partial<Operator> }
  | { type: "operator/remove"; opId: string }
  | { type: "goal/add"; goal: PlannerGoal }
  | { type: "goal/remove"; id: string }
  | { type: "goal/update"; id: string; patch: Partial<PlannerGoal> }
  | { type: "goal/clear" }
  | { type: "goal/removeMany"; ids: string[] }
  | { type: "depot/set"; itemId: string; quantity: number }
  | { type: "depot/bulk"; entries: Record<string, number> }
  | { type: "depot/clear" }
  | { type: "profile/patch"; patch: Partial<DoctorProfile> }
  | { type: "profile/support"; index: number; slot: SupportSlot | null }
  | { type: "settings/patch"; patch: Partial<PlannerSettings> }
  | { type: "settings/craftToggle"; itemId: string }
  | { type: "settings/craftSetAll"; itemIds: string[] }
  | {
      type: "import/apply";
      roster?: Roster;
      depot?: Depot;
      profile?: DoctorProfile;
      supports?: (SupportSlot | null)[];
    }
  | { type: "state/replace"; state: AppState }
  | { type: "state/reset" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "operator/set":
      return { ...state, roster: { ...state.roster, [action.opId]: action.op } };
    case "operator/patch": {
      const current = state.roster[action.opId];
      if (!current) return state;
      return {
        ...state,
        roster: { ...state.roster, [action.opId]: { ...current, ...action.update } },
      };
    }
    case "operator/remove": {
      const roster = { ...state.roster };
      delete roster[action.opId];
      return { ...state, roster };
    }
    case "goal/add":
      return { ...state, goals: [...state.goals, action.goal] };
    case "goal/remove":
      return { ...state, goals: state.goals.filter((goal) => goal.id !== action.id) };
    case "goal/update":
      return {
        ...state,
        goals: state.goals.map((goal) =>
          goal.id === action.id ? ({ ...goal, ...action.patch } as PlannerGoal) : goal,
        ),
      };
    case "goal/clear":
      return { ...state, goals: [] };
    case "goal/removeMany": {
      const remove = new Set(action.ids);
      return { ...state, goals: state.goals.filter((goal) => !remove.has(goal.id)) };
    }
    case "depot/set": {
      const depot = { ...state.depot };
      if (action.quantity > 0) depot[action.itemId] = Math.floor(action.quantity);
      else delete depot[action.itemId];
      return { ...state, depot };
    }
    case "depot/bulk":
      return { ...state, depot: { ...state.depot, ...action.entries } };
    case "depot/clear":
      return { ...state, depot: {} };
    case "profile/patch":
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case "profile/support": {
      const supports = [...state.profile.supports];
      supports[action.index] = action.slot;
      return { ...state, profile: { ...state.profile, supports } };
    }
    case "settings/patch":
      return { ...state, plannerSettings: { ...state.plannerSettings, ...action.patch } };
    case "settings/craftToggle": {
      const list = state.plannerSettings.craftingItems;
      const next = list.includes(action.itemId)
        ? list.filter((id) => id !== action.itemId)
        : [...list, action.itemId];
      return { ...state, plannerSettings: { ...state.plannerSettings, craftingItems: next } };
    }
    case "settings/craftSetAll":
      return { ...state, plannerSettings: { ...state.plannerSettings, craftingItems: action.itemIds } };
    case "import/apply": {
      const profile = action.profile
        ? { ...action.profile, supports: action.supports ?? action.profile.supports }
        : action.supports
          ? { ...state.profile, supports: action.supports }
          : state.profile;
      return {
        ...state,
        roster: action.roster ?? state.roster,
        depot: action.depot ?? state.depot,
        profile,
      };
    }
    case "state/replace":
      return action.state;
    case "state/reset":
      return createDefaultState();
    default:
      return state;
  }
}

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const timeout = useRef<number | null>(null);

  useEffect(() => {
    if (timeout.current != null) window.clearTimeout(timeout.current);
    timeout.current = window.setTimeout(() => saveState(state), 200);
    return () => {
      if (timeout.current != null) window.clearTimeout(timeout.current);
    };
  }, [state]);

  // Flush the pending save when the tab is hidden so nothing is lost on close.
  useEffect(() => {
    const flush = () => saveState(state);
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useApp(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useApp must be used inside StoreProvider");
  return value;
}
