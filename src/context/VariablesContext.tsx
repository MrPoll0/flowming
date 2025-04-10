import React, { createContext, useState, ReactNode, useContext } from 'react';
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
});

// Custom hook for using the context
export const useVariables = () => useContext(VariablesContext);

// Provider component
interface VariablesProviderProps {
  children: ReactNode;
}

export const VariablesProvider: React.FC<VariablesProviderProps> = ({ children }) => {
  const [variables, setVariables] = useState<Variable[]>([]);

  const addVariable = (variable: Variable) => {
    setVariables(prev => [...prev, variable]);
  };

  const updateVariable = (id: string, updates: Partial<Variable>) => {
    setVariables(prev => 
      prev.map(variable => 
        variable.id === id ? variable.update(updates) : variable
      )
    );
  };

  const deleteVariable = (id: string) => {
    setVariables(prev => prev.filter(variable => variable.id !== id));
  };

  const getNodeVariables = (nodeId: string) => {
    return variables.filter(variable => variable.nodeId === nodeId);
  };

  const getAllVariables = () => {
    return variables;
  };

  const updateNodeVariables = (nodeId: string, nodeVariables: Variable[]): void => {
    setVariables(prevVariables => [
      ...prevVariables.filter(v => v.nodeId !== nodeId),
      ...nodeVariables.map(v => new Variable(v.id, v.type, v.name, nodeId))
    ]);
  };

  // Delete all variables associated with a specific node
  const deleteNodeVariables = (nodeId: string) => {
    setVariables(prev => prev.filter(variable => variable.nodeId !== nodeId));
  };

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
      }}
    >
      {children}
    </VariablesContext.Provider>
  );
}; 