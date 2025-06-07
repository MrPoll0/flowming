import { useContext, useRef, useEffect, memo, useMemo } from 'react';
import { FlowInteractionContext } from "../../context/FlowInteractionContext";
import { SelectedNodeContext } from "../../context/SelectedNodeContext";
import { useCollaboration } from '../../context/CollaborationContext';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, MessageSquareText } from "lucide-react";

interface ContextMenuProps {
  onDelete: (element: { id: string; type: 'node' | 'edge' }) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ onDelete }) => {
  const { contextMenuPosition, hideContextMenu } = useContext(FlowInteractionContext);
  const { setSelectedNode } = useContext(SelectedNodeContext)
  const { x, y, visible, elements } = contextMenuPosition;
  const menuRef = useRef<HTMLDivElement>(null);

  const { awareness, users } = useCollaboration();
  const hostUser = useMemo(() => {
      if (!users.length) return null;
      return users.reduce((prev, curr) => (prev.joinedAt <= curr.joinedAt ? prev : curr));
  }, [users]);
  const localClientID = awareness?.clientID;
  const isHost = hostUser?.clientID === localClientID;

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
  
  const isValueOutputNode = elements.length === 1 && elements[0].type === 'node' && document.querySelector(`[data-id="${elements[0].id}"]`)?.closest('.react-flow__node')?.classList.contains('react-flow__node-ValueOutput');

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
        disabled={isValueOutputNode && !isHost}
        className={`w-full justify-start ${isValueOutputNode ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50' : 'text-destructive hover:text-destructive hover:bg-destructive/10'}`}
      >
        {isValueOutputNode ? <MessageSquareText className="h-4 w-4 mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
        {isValueOutputNode ? 'Dismiss' : 'Delete'}
      </Button>
    </Card>
  );
};

// Memoize the context menu to prevent unnecessary re-renders
export default memo(ContextMenu); 