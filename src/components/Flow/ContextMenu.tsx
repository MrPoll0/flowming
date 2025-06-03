import React, { useContext, useRef, useEffect, memo } from 'react';
import { FlowInteractionContext } from '../../context/FlowInteractionContext';
import { SelectedNodeContext } from '../../context/SelectedNodeContext';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2 } from "lucide-react";

interface ContextMenuProps {
  onDelete: (element: { id: string; type: 'node' | 'edge' }) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ onDelete }) => {
  const { contextMenuPosition, hideContextMenu } = useContext(FlowInteractionContext);
  const { setSelectedNode } = useContext(SelectedNodeContext)
  const { x, y, visible, elements } = contextMenuPosition;
  const menuRef = useRef<HTMLDivElement>(null);

  // Hide the context menu if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        hideContextMenu();
      }
    };

    // Only add listener if menu is visible
    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible, hideContextMenu]);

  if (!visible || !elements) return null;

  const handleDelete = () => {
    if (elements) {
      // Delete all elements
      for (const element of elements) {
        onDelete(element);
      }
      setSelectedNode(null)
      hideContextMenu();
    }
  };

  return (
    <Card 
      ref={menuRef}
      className="fixed z-[1000] p-1 shadow-lg border"
      style={{ 
        top: y,
        left: x,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete
      </Button>
    </Card>
  );
};

// Memoize the context menu to prevent unnecessary re-renders
export default memo(ContextMenu); 