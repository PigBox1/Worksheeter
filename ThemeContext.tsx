
import React from "react";
import { DesignSettings } from "./types";

export const ThemeContext = React.createContext<DesignSettings>({
  accentColor: '#6366f1', 
  font: 'sans'
});
