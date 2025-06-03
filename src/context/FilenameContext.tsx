import React, { createContext, useState, ReactNode, useContext } from 'react';

interface FilenameContextType {
  filename: string;
  setFilename: (filename: string) => void;
}

const FilenameContext = createContext<FilenameContextType>({
  filename: 'Untitled',
  setFilename: () => {},
});

export const useFilename = () => useContext(FilenameContext);

interface FilenameProviderProps {
  children: ReactNode;
}

export const FilenameProvider: React.FC<FilenameProviderProps> = ({ children }) => {
  const [filename, setFilename] = useState<string>('Untitled');

  return (
    <FilenameContext.Provider value={{ filename, setFilename }}>
      {children}
    </FilenameContext.Provider>
  );
}; 