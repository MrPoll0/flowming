import React, { createContext, useContext, ReactNode, useState } from 'react';

export interface SystemSettings {
  executionSpeed: number; // in milliseconds
  typingMode: 'strongly-typed' | 'weakly-typed';
  language: string;
  backgroundColor: string;
  textColor: string;
}

export interface SystemSettingsContextType {
  settings: SystemSettings;
  updateSetting: <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => void;
}

const defaultSettings: SystemSettings = {
  executionSpeed: 2000, // 2 seconds default
  typingMode: 'strongly-typed',
  language: 'en',
  backgroundColor: '#ffffff',
  textColor: '#000000',
};

const SystemSettingsContext = createContext<SystemSettingsContextType | null>(null);

export const useSystemSettings = () => {
  const context = useContext(SystemSettingsContext);
  if (!context) {
    throw new Error('useSystemSettings must be used within a SystemSettingsProvider');
  }
  return context;
};

export const SystemSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);

  const updateSetting = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <SystemSettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SystemSettingsContext.Provider>
  );
}; 