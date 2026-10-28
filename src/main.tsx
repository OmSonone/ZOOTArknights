import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/neu.css";
import "./styles/layout.css";
import "./styles/roster.css";
import "./styles/pages.css";
import "./styles/motion.css";
import { App } from "./App";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
