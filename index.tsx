import React from "react";
import { createRoot } from "react-dom/client";
import { Builder } from "./QuestionBoard";
import { Answer } from "./components/Answer";

const App = () => {
  // Simple hash-based routing or pathname check
  // Since we are likely in a single-page environment without real server routing, 
  // checking pathname or hash is safer. 
  // We'll use pathname check as requested "/answer".
  const path = window.location.pathname;

  if (path === "/answer") {
    return <Answer />;
  }

  return <Builder />;
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);