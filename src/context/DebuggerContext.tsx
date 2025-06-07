import React, { createContext, useContext, ReactNode, useState, useRef, useEffect } from 'react';
import { Node } from '@xyflow/react';
import { IValuedVariable, ValuedVariable } from '../models/ValuedVariable';
import { VariableType } from '../models/Variable';
import { useCollaboration } from './CollaborationContext';
import * as Y from 'yjs';

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
  // Collaboration-shared debugger state
  const { ySharedExecutionHistory, ySharedCurrentVariables, ySharedVariableHistories, ySharedIsRecording } = useCollaboration();

  const [executionHistory, setExecutionHistory] = useState<ExecutionStep[]>([]);
  const [variableHistories, setVariableHistories] = useState<Map<string, VariableHistory>>(new Map());
  const [currentVariables, setCurrentVariables] = useState<Map<string, IValuedVariable<VariableType>>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const stepCounter = useRef(0);

  // Subscribe to shared execution history updates
  useEffect(() => {
    if (!ySharedExecutionHistory) return;

    const onArrayChange = () => {
      const history = ySharedExecutionHistory.toArray() as ExecutionStep[];
      setExecutionHistory(history);
    };
    ySharedExecutionHistory.observe(onArrayChange);

    // initial load
    onArrayChange();
    return () => { ySharedExecutionHistory.unobserve(onArrayChange); };
  }, [ySharedExecutionHistory]);

  // Subscribe to shared current variable updates
  useEffect(() => {
    if (!ySharedCurrentVariables) return;

    const onMapChange = () => {
      const newMap = new Map<string, IValuedVariable<VariableType>>();
      ySharedCurrentVariables.forEach((val: any, key: string) => {
        newMap.set(key, val as IValuedVariable<VariableType>);
      });
      setCurrentVariables(newMap);
    };
    ySharedCurrentVariables.observe(onMapChange);

    // initial load
    onMapChange();
    return () => { ySharedCurrentVariables.unobserve(onMapChange); };
  }, [ySharedCurrentVariables]);

  // Subscribe to shared variable histories updates
  useEffect(() => {
    if (!ySharedVariableHistories) return;

    const onDeepChange = () => {
      const newHist = new Map<string, VariableHistory>();
      ySharedVariableHistories.forEach((val: any, varId: string) => {
        const arr = val as Y.Array<any>;
        const changes = arr.toArray() as VariableHistory['changes'];
        // Get variable name from the changes if available, fallback to varId
        const variableName = changes.length > 0 ? changes[0].nodeVisualId : varId;
        newHist.set(varId, { variableId: varId, variableName, changes });
      });
      setVariableHistories(newHist);
    };
    ySharedVariableHistories.observeDeep(onDeepChange);

    // initial load
    onDeepChange();
    return () => { ySharedVariableHistories.unobserveDeep(onDeepChange); };
  }, [ySharedVariableHistories]);

  // Subscribe to shared recording flag updates
  useEffect(() => {
    if (!ySharedIsRecording) return;

    const onMapChange = () => {
      const recording = (ySharedIsRecording.get('isRecording') as boolean) || false;
      if (recording && !isRecordingRef.current) {
        // inline clearHistory logic
        setExecutionHistory([]);
        setVariableHistories(new Map());
        setCurrentVariables(new Map());
        stepCounter.current = 0;
        isRecordingRef.current = true;
        setIsRecording(true);
      } else if (!recording && isRecordingRef.current) {
        isRecordingRef.current = false;
        setIsRecording(false);
      }
    };
    ySharedIsRecording.observe(onMapChange);

    // initial load
    onMapChange();
    return () => { ySharedIsRecording.unobserve(onMapChange); };
  }, [ySharedIsRecording]);

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
    // Share execution step via Yjs
    if (ySharedExecutionHistory) {
      ySharedExecutionHistory.push([step]);
    }
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
    // Share current variables via Yjs
    if (ySharedCurrentVariables) {
      variables.forEach(variable => {
        ySharedCurrentVariables.set(variable.id, variable.toObject());
      });
    }
    // Share variable history changes via Yjs
    if (ySharedVariableHistories) {
      variables.forEach(variable => {
        let arr = ySharedVariableHistories.get(variable.id) as Y.Array<any>;
        if (!arr) {
          arr = new Y.Array<any>();
          ySharedVariableHistories.set(variable.id, arr);
        }

        const lastChange = arr.length > 0 ? arr.get(arr.length - 1) : null;
        if (!lastChange || lastChange.value !== variable.value) {
            const visualId = (node.data?.visualId as string) || `Node-${stepCounter.current}`;
            const change = { stepNumber: stepCounter.current, nodeVisualId: visualId, value: variable.value, timestamp: Date.now() };
            arr.push([change]);
        }
      });
    }
  };

  const clearHistory = () => {
    setExecutionHistory([]);
    setVariableHistories(new Map());
    setCurrentVariables(new Map());
    stepCounter.current = 0;
  };

  const startRecording = () => {
    // Clear local and shared histories, then start recording
    clearHistory();
    if (ySharedExecutionHistory) {
      ySharedExecutionHistory.delete(0, ySharedExecutionHistory.length);
    }
    if (ySharedCurrentVariables) {
      ySharedCurrentVariables.clear();
    }
    if (ySharedVariableHistories) {
      ySharedVariableHistories.clear();
    }
    isRecordingRef.current = true;
    setIsRecording(true);
    if (ySharedIsRecording) {
      ySharedIsRecording.set('isRecording', true);
    }
  };

  const stopRecording = () => {
    // Stop recording locally and in shared state
    isRecordingRef.current = false;
    setIsRecording(false);
    if (ySharedIsRecording) {
      ySharedIsRecording.set('isRecording', false);
    }
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