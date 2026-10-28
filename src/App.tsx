import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/layout/Shell";
import { Button } from "./components/neu/ui";
import { Icon } from "./components/neu/Icon";
import { ZootMark } from "./components/common/ZootMark";
import { useGameDataContext, GameDataProvider } from "./state/data";
import { CloudProvider } from "./state/cloud";
import { StoreProvider } from "./state/store";
import { ThemeProvider } from "./state/theme";
import { ToastProvider } from "./state/toast";
import { RosterPage } from "./pages/RosterPage";

const CollectionPage = lazy(() => import("./pages/CollectionPage"));
const PlannerPage = lazy(() => import("./pages/PlannerPage"));
const InputPage = lazy(() => import("./pages/InputPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ImportPage = lazy(() => import("./pages/ImportPage"));

function RouteFallback() {
  return (
    <div className="boot" style={{ minHeight: "50dvh" }}>
      <div className="boot__bar" style={{ maxWidth: 220 }}>
        <span />
      </div>
    </div>
  );
}

function DataGate({ children }: { children: React.ReactNode }) {
  const { status, error, retry } = useGameDataContext();

  if (status === "ready") return <>{children}</>;

  if (status === "error") {
    return (
      <div className="boot">
        <div className="boot__card">
          <span className="boot__mark" style={{ color: "var(--danger)" }}>
            <Icon name="alert" size={26} />
          </span>
          <h1 className="title">ZOOT could not load game data</h1>
          <p className="hint">
            {error}
            <br />
            Make sure the files in <code>public/data</code> are served alongside the app.
          </p>
          <Button variant="primary" onClick={retry}>
            <Icon name="refresh" size={17} />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="boot">
      <div className="boot__card">
        <span className="boot__mark">
          <ZootMark size={28} />
        </span>
        <div className="col" style={{ gap: 4, alignItems: "center" }}>
          <h1 className="title">Booting ZOOT</h1>
          <p className="hint">Zeroth Order Oil Tank — parsing 434 operators, materials and skins.</p>
        </div>
        <div className="boot__bar">
          <span />
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <GameDataProvider>
          <StoreProvider>
            <CloudProvider>
            <DataGate>
              <BrowserRouter>
                <Shell>
                  <Suspense fallback={<RouteFallback />}>
                    <Routes>
                      <Route path="/" element={<RosterPage />} />
                      <Route path="/collection" element={<CollectionPage />} />
                      <Route path="/planner" element={<PlannerPage />} />
                      <Route path="/input" element={<InputPage />} />
                      <Route path="/import" element={<ImportPage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </Shell>
              </BrowserRouter>
            </DataGate>
            </CloudProvider>
          </StoreProvider>
        </GameDataProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
