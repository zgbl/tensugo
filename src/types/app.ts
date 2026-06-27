export type AppCommand =
  | { type: "open-file" }
  | { type: "save-file" }
  | { type: "start-analysis" }
  | { type: "stop-analysis" }
  | { type: "open-settings" };

