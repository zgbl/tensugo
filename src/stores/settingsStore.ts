export type EngineProfile = {
  id: string;
  name: string;
  executablePath: string;
  configPath?: string;
  modelPath?: string;
};

export type SettingsState = {
  activeEngineProfileId?: string;
  engineProfiles: EngineProfile[];
};

export const defaultSettings: SettingsState = {
  engineProfiles: []
};

