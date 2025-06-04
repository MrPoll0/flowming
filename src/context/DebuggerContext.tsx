import React, { createContext, useContext, ReactNode, useState, useRef } from 'react';
import { Node } from '@xyflow/react';
import { IValuedVariable, ValuedVariable } from '../models/ValuedVariable';
import { VariableType } from '../models/Variable';

export interface ExecutionStep {
  stepNumber: number;
  nodeId: string;
  visualId: string;
  nodeType: string;
  nodeLabel: string;
  timestamp: number;
}

export interface VariableHistory {
  variableId: string;
  variableName: string;
  changes: Array<{
    stepNumber: number;
    nodeVisualId: string;
    value: any;
    timestamp: number;
  }>;
}

interface DebuggerContextType {
  executionHistory: ExecutionStep[];
  variableHistories: Map<string, VariableHistory>;
  currentVariables: Map<string, IValuedVariable<VariableType>>;
  isRecording: boolean;
  addExecutionStep: (node: Node) => void;
  updateVariables: (node: Node, variables: ValuedVariable<VariableType>[]) => void;
  clearHistory: () => void;
  startRecording: () => void;
  stopRecording: () => void;
}

const DebuggerContext = createContext<DebuggerContextType | null>(null);

export const useDebugger = () => {
  const context = useContext(DebuggerContext);
  if (!context) {
    throw new Error('useDebugger must be used within a DebuggerProvider');
  }
  return context;
};

export const DebuggerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [executionHistory, setExecutionHistory] = useState<ExecutionStep[]>([]);
  const [variableHistories, setVariableHistories] = useState<Map<string, VariableHistory>>(new Map());
  const [currentVariables, setCurrentVariables] = useState<Map<string, IValuedVariable<VariableType>>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const stepCounter = useRef(0);

  const addExecutionStep = (node: Node) => {
    if (!isRecordingRef.current) return;

    stepCounter.current++;
    const step: ExecutionStep = {
      stepNumber: stepCounter.current,
      nodeId: node.id,
      visualId: (node.data?.visualId as string) || `Node-${stepCounter.current}`,
      nodeType: node.type || 'default',
      nodeLabel: (node.data?.label as string) || 'Untitled',
      timestamp: Date.now()
    };

    setExecutionHistory(prev => [...prev, step]);
  };

  const updateVariables = (node: Node, variables: ValuedVariable<VariableType>[]) => {
    if (!isRecordingRef.current) return;

    // Update current variables
    setCurrentVariables(prev => {
      const newMap = new Map(prev);
      variables.forEach(variable => {
        newMap.set(variable.id, variable.toObject());
      });
      return newMap;
    });

    // Update variable histories
    setVariableHistories(prev => {
      const newHistories = new Map(prev);
      variables.forEach(variable => {
        if (!newHistories.has(variable.id)) {
          newHistories.set(variable.id, {
            variableId: variable.id,
            variableName: variable.name,
            changes: []
          });
        }
        const history = newHistories.get(variable.id)!;
        const lastChange = history.changes[history.changes.length - 1];
        if (!lastChange || lastChange.value !== variable.value) {
          history.changes.push({
            stepNumber: stepCounter.current,
            nodeVisualId: (node.data?.visualId as string) || `Node-${stepCounter.current}`,
            value: variable.value,
            timestamp: Date.now()
          });
        }
      });
      return newHistories;
    });
  };

  const clearHistory = () => {
    setExecutionHistory([]);
    setVariableHistories(new Map());
    setCurrentVariables(new Map());
    stepCounter.current = 0;
  };

  const startRecording = () => {
    clearHistory();
    isRecordingRef.current = true;
    setIsRecording(true);
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
  };

  return (
    <DebuggerContext.Provider
      value={{
        executionHistory,
        variableHistories,
        currentVariables,
        isRecording,
        addExecutionStep,
        updateVariables,
        clearHistory,
        startRecording,
        stopRecording
      }}
    >
      {children}
    </DebuggerContext.Provider>
  );
}; 