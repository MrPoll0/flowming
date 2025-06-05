import React, { createContext, useState, ReactNode, useContext, useCallback } from 'react';
import { Variable } from '../models';

// Define the context type
interface VariablesContextType {
  variables: Variable[];
  addVariable: (variable: Variable) => void;
  updateVariable: (id: string, updates: Partial<Variable>) => void;
  deleteVariable: (id: string) => void;
  getNodeVariables: (nodeId: string) => Variable[];
  getAllVariables: () => Variable[];
  updateNodeVariables: (nodeId: string, variables: Variable[]) => void;
  deleteNodeVariables: (nodeId: string) => void;
  setVariables: (variables: Variable[]) => void;
}

// Create the context
export const VariablesContext = createContext<VariablesContextType>({
  variables: [],
  addVariable: () => {},
  updateVariable: () => {},
  deleteVariable: () => {},
  getNodeVariables: () => [],
  getAllVariables: () => [],
  updateNodeVariables: () => {},
  deleteNodeVariables: () => {},
  setVariables: () => {},
});

// Custom hook for using the context
export const useVariables = () => useContext(VariablesContext);

// Provider component
interface VariablesProviderProps {
  children: ReactNode;
}

export const VariablesProvider: React.FC<VariablesProviderProps> = ({ children }) => {
  const [variables, setVariables] = useState<Variable[]>([]);

  const addVariable = useCallback((variable: Variable) => {
    setVariables(prev => [...prev, variable]);
  }, []);

  const updateVariable = useCallback((id: string, updates: Partial<Variable>) => {
    setVariables(prev => 
      prev.map(variable => 
        variable.id === id ? variable.update(updates) : variable
      )
    );
  }, []);

  const deleteVariable = useCallback((id: string) => {
    setVariables(prev => prev.filter(variable => variable.id !== id));
  }, []);

  const getNodeVariables = useCallback((nodeId: string) => {
    return variables.filter(variable => variable.nodeId === nodeId);
  }, [variables]);

  const getAllVariables = useCallback(() => {
    return variables;
  }, [variables]);

  const updateNodeVariables = useCallback((nodeId: string, nodeVariables: Variable[]): void => {
    setVariables(prevVariables => [
      ...prevVariables.filter(v => v.nodeId !== nodeId),
      ...nodeVariables.map(v => new Variable(v.id, v.type, v.name, nodeId))
    ]);
  }, []);

  // Delete all variables associated with a specific node
  const deleteNodeVariables = useCallback((nodeId: string) => {
    setVariables(prev => prev.filter(variable => variable.nodeId !== nodeId));
  }, []);

  return (
    <VariablesContext.Provider
      value={{
        variables,
        addVariable,
        updateVariable,
        deleteVariable,
        getNodeVariables,
        getAllVariables,
        updateNodeVariables,
        deleteNodeVariables,
        setVariables,
      }}
    >
      {children}
    </VariablesContext.Provider>
  );
}; 