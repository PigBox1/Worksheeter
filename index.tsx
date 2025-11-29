
import React from "react";
import { createRoot } from "react-dom/client";
import { QuestionBoard } from "./QuestionBoard";

const App = () => {
  return <QuestionBoard />;
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
