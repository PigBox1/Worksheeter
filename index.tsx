import React from "react";
import { createRoot } from "react-dom/client";
import { Builder } from "./QuestionBoard";
import { Answer } from "./components/Answer";

const App = () => {
  const path = window.location.pathname;

  if (path === "/answer") {
    return <Answer />;
  }

  return <Builder />;
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);