import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { loadGameData } from "../lib/data";
import type { GameData } from "../lib/types";

interface DataContextValue {
  status: "loading" | "ready" | "error";
  data: GameData | null;
  error: string | null;
  retry: () => void;
}

const GameDataContext = createContext<DataContextValue | null>(null);

export function GameDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    loadGameData()
      .then((loaded) => {
        if (alive) setData(loaded);
      })
      .catch((reason: unknown) => {
        if (alive) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = () => {
    setData(null);
    setAttempt((value) => value + 1);
  };

  const status = error ? "error" : data ? "ready" : "loading";

  return (
    <GameDataContext.Provider value={{ status, data, error, retry }}>{children}</GameDataContext.Provider>
  );
}

export function useGameDataContext(): DataContextValue {
  const value = useContext(GameDataContext);
  if (!value) throw new Error("useGameDataContext must be used inside GameDataProvider");
  return value;
}

export function useGameData(): GameData {
  const { data } = useGameDataContext();
  if (!data) throw new Error("Game data is not loaded yet");
  return data;
}
