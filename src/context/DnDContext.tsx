import { createContext, ReactNode, useContext, useState } from 'react';

const DnDContext = createContext<[string | null, (value: string | null) => void]>([null, () => {}]);

export const DnDProvider = ({ children }: { children: ReactNode }) => {
  const [DnDData, setDnDData] = useState<string | null>(null);

  return (
    <DnDContext.Provider value={[DnDData, setDnDData]}>
      {children}
    </DnDContext.Provider>
  );
}

export default DnDContext;

export const useDnD = () => {
  return useContext(DnDContext);
}