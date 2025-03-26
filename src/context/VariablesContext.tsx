import React, { createContext, useState, ReactNode, useContext } from 'react';

// Define the variable structure
export interface Variable {
  id: string;
  type: string;
  name: string;
  nodeId: string; // ID of the node that declared this variable
}

// Define the context type
interface VariablesContextType {
  variables: Variable[];
  addVariable: (variable: Variable) => void;
  updateVariable: (id: string, updates: Partial<Variable>) => void;
  deleteVariable: (id: string) => void;
  getNodeVariables: (nodeId: string) => Variable[];
  getAllVariables: () => Variable[];
  updateNodeVariables: (nodeId: string, variables: Omit<Variable, 'nodeId'>[]) => void;
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
        variable.id === id ? { ...variable, ...updates } : variable
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

  const updateNodeVariables = (nodeId: string, nodeVariables: Omit<Variable, 'nodeId'>[]) => {
    // Use functional update pattern to avoid dependency on current variables
    setVariables(prevVariables => {
      // Remove all variables for this node
      const filteredVariables = prevVariables.filter(v => v.nodeId !== nodeId);
      
      // Add the new variables with the nodeId
      const newVariables = nodeVariables.map(v => ({
        ...v,
        nodeId
      }));
      
      // Create a completely new array for proper re-rendering
      return [...filteredVariables, ...newVariables];
    });
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
      }}
    >
      {children}
    </VariablesContext.Provider>
  );
}; 