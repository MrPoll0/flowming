import React, { useCallback, useState, useContext } from 'react';
import { Edge, Node, useReactFlow } from '@xyflow/react';
import { useVariables } from '../context/VariablesContext';
import { useFilename } from '../context/FilenameContext';
import { useFlowExecutorActions } from '../context/FlowExecutorContext';
import { SelectedNodeContext } from '../context/SelectedNodeContext';
import { Variable } from '../models';
import { Button } from './ui/button';
import { Download, Upload, FileX } from 'lucide-react';
import { useDebugger } from '../context/DebuggerContext';
import { FlowNode } from './Flow/FlowTypes';

interface FlowData {
  nodes: any[];
  edges: any[];
  variables: any[];
  timestamp: string;
  version: string;
  filename?: string;
}

export const clearDiagram = (setNodes: (nodes: FlowNode[]) => void, setEdges: (edges: Edge[]) => void, getNodes: () => Node[], deleteNodeVariables: (nodeId: string) => void, setSelectedNode: (node: FlowNode | null) => void, setFilename: (filename: string) => void, stop: () => void, clearHistory: () => void) => {
  // Stop execution before creating new diagram
  stop();
  clearHistory();

  // Clear all nodes and edges
  setNodes([]);
  setEdges([]);
  
  // Clear all variables
  const existingNodes = getNodes();
  existingNodes.forEach(node => {
    deleteNodeVariables(node.id);
  });
  
  // Clear selected node (this will clear the Details tab)
  setSelectedNode(null);
  
  // Reset filename
  setFilename('Untitled');
}

const ImportExport: React.FC = () => {
  const { getNodes, getEdges, setNodes, setEdges, fitView, setViewport } = useReactFlow();
  const { variables, updateNodeVariables, deleteNodeVariables } = useVariables();
  const { filename, setFilename } = useFilename();
  const { stop } = useFlowExecutorActions();
  const { setSelectedNode } = useContext(SelectedNodeContext);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { clearHistory } = useDebugger();

  const onNew = useCallback(() => {
    clearDiagram(setNodes, setEdges, getNodes, deleteNodeVariables, setSelectedNode, setFilename, stop, clearHistory);
    
    // Fit view to center
    setTimeout(() => {
      setViewport({ x: 0, y: 0, zoom: 2 });
    }, 100);
  }, [setNodes, setEdges, getNodes, deleteNodeVariables, setFilename, setViewport, stop, setSelectedNode, clearHistory]);

  const onExport = useCallback(() => {
    // Stop execution before exporting to avoid exporting unexpected node/edge data
    stop();

    setIsExporting(true);
    
    // Add a delay to ensure stop() has fully reset all animations and state
    setTimeout(() => {
      try {
        const nodes = getNodes()
          .filter(node => node.type !== 'ErrorNode' && node.type !== 'ValueOutput') // Make sure to exclude ErrorNode and ValueOutput nodes, only core flowchart is exported
          .map(node => {
            // Remove any transient state like `isError` from the data
            if (node.data.isError) {
              const { isError, ...restData } = node.data;
              return { ...node, data: restData };
            }
            return node;
          });
        const edges = getEdges();

        // Serialize variables to plain objects
        const serializedVariables = variables.map(variable => variable.toObject());

        const flowData: FlowData = {
          nodes,
          edges,
          variables: serializedVariables,
          timestamp: new Date().toISOString(),
          version: '1.0',
          filename
        };

        // Create and download the file
        const dataStr = JSON.stringify(flowData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename || 'Untitled'}.flowming`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error exporting:', error);
        alert('Error exporting. Please try again.');
      } finally {
        setIsExporting(false);
      }
    }, 200); // 200ms delay to ensure stop() completes
  }, [getNodes, getEdges, variables, filename, stop]);

  const onImport = useCallback(() => {
    // Stop execution before importing
    stop();

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.flowming';
    
    input.onchange = async (event) => {
      clearHistory(); // Clear debugger history
      setIsImporting(true);
      try {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const text = await file.text();
        const flowData: FlowData = JSON.parse(text);

        // Validate the imported data structure
        if (!flowData.nodes || !flowData.edges || !flowData.variables) {
          throw new Error('Invalid flow file format');
        }

        // Clear existing variables
        const existingNodes = getNodes();
        existingNodes.forEach(node => {
          deleteNodeVariables(node.id);
        });

        // First clear everything
        setNodes([]);
        setEdges([]);
        
        // Restore filename if available
        if (flowData.filename) {
          setFilename(flowData.filename);
        } else {
          // Extract filename from file name (remove .flowming extension)
          const importedFilename = file.name.replace(/\.flowming$/, '');
          setFilename(importedFilename || 'Untitled');
        }

        // Restore variables
        if (flowData.variables && Array.isArray(flowData.variables)) {
          // Group variables by nodeId and restore them
          const variablesByNode = flowData.variables.reduce((acc: Record<string, Variable[]>, varData: any) => {
            if (!acc[varData.nodeId]) {
              acc[varData.nodeId] = [];
            }
            acc[varData.nodeId].push(Variable.fromObject(varData));
            return acc;
          }, {} as Record<string, Variable[]>);

          // Update variables for each node
          Object.entries(variablesByNode).forEach(([nodeId, nodeVariables]) => {
            updateNodeVariables(nodeId, nodeVariables);
          });
        }

        setNodes(flowData.nodes || []);
        setEdges(flowData.edges || []);

        // Fit and center the view for the imported diagram
        setTimeout(() => {
          fitView({ padding: 0.2, duration: 800 });
        }, 100);

      } catch (error) {
        console.error('Error importing:', error);
        alert('Error importing. Please check the file format and try again.');
      } finally {
        setIsImporting(false);
      }
    };

    input.click();
  }, [setNodes, setEdges, getNodes, updateNodeVariables, deleteNodeVariables, fitView, setFilename, stop]);

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={onNew}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        <FileX className="h-4 w-4" />
        New
      </Button>

      <Button
        onClick={onExport}
        disabled={isExporting}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        <Download className="h-4 w-4" />
        {isExporting ? 'Exporting...' : 'Export'}
      </Button>
      
      <Button
        onClick={onImport}
        disabled={isImporting}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        <Upload className="h-4 w-4" />
        {isImporting ? 'Importing...' : 'Import'}
      </Button>
    </div>
  );
};

export default React.memo(ImportExport); 