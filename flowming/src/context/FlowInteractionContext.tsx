import React, { createContext, useState, ReactNode } from 'react';

interface ContextMenuPosition {
  x: number;
  y: number;
  visible: boolean;
  elements: { id: string; type: 'node' | 'edge' }[] | null;
}

interface FlowInteractionContextType {
  hoveredElement: { id: string; type: 'node' | 'edge' } | null;
  selectedElement: { id: string; type: 'node' | 'edge' } | null;
  contextMenuPosition: ContextMenuPosition;
  setHoveredElement: (element: { id: string; type: 'node' | 'edge' } | null) => void;
  setSelectedElement: (element: { id: string; type: 'node' | 'edge' } | null) => void;
  showContextMenu: (x: number, y: number, elements: { id: string; type: 'node' | 'edge' }[] | null) => void;
  hideContextMenu: () => void;
  resetInteractions: () => void;
}

export const FlowInteractionContext = createContext<FlowInteractionContextType>({
  hoveredElement: null,
  selectedElement: null,
  contextMenuPosition: { x: 0, y: 0, visible: false, elements: null },
  setHoveredElement: () => {},
  setSelectedElement: () => {},
  showContextMenu: () => {},
  hideContextMenu: () => {},
  resetInteractions: () => {},
});

interface FlowInteractionProviderProps {
  children: ReactNode;
}

export const FlowInteractionProvider: React.FC<FlowInteractionProviderProps> = ({ children }) => {
  const [hoveredElement, setHoveredElement] = useState<{ id: string; type: 'node' | 'edge' } | null>(null);
  const [selectedElement, setSelectedElement] = useState<{ id: string; type: 'node' | 'edge' } | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition>({
    x: 0,
    y: 0,
    visible: false,
    elements: null,
  });

  const resetInteractions = () => {
    setHoveredElement(null);
    setSelectedElement(null);
    hideContextMenu();
  };

  const showContextMenu = (x: number, y: number, elements: { id: string; type: 'node' | 'edge' }[] | null) => {
    setContextMenuPosition({
      x,
      y,
      visible: true,
      elements,
    });
  };

  const hideContextMenu = () => {
    setContextMenuPosition(prev => ({
      ...prev,
      visible: false,
      elements: null,
    }));
  };

  return (
    <FlowInteractionContext.Provider
      value={{
        hoveredElement,
        selectedElement,
        contextMenuPosition,
        setHoveredElement,
        setSelectedElement,
        showContextMenu,
        hideContextMenu,
        resetInteractions,
      }}
    >
      {children}
    </FlowInteractionContext.Provider>
  );
}; 