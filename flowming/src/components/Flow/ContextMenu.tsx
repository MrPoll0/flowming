import { useContext, useRef, useEffect, memo, useMemo } from 'react';
import { FlowInteractionContext } from "../../context/FlowInteractionContext";
import { SelectedNodeContext } from "../../context/SelectedNodeContext";
import { useCollaboration } from '../../context/CollaborationContext';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, MessageSquareText, Bug } from "lucide-react";
import { useFlowExecutorState } from '../../context/FlowExecutorContext';

interface ContextMenuProps {
  onDelete: (element: { id: string; type: 'node' | 'edge' }) => void;
  onToggleBreakpoint: (elementId: string) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ onDelete, onToggleBreakpoint }) => {
  const { contextMenuPosition, hideContextMenu } = useContext(FlowInteractionContext);
  const { selectedNode, setSelectedNode } = useContext(SelectedNodeContext)
  const { x, y, visible, elements } = contextMenuPosition;
  const menuRef = useRef<HTMLDivElement>(null);
  const { isRunning } = useFlowExecutorState();

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
  
  const handleToggleBreakpoint = () => {
    if (elements && elements.length === 1 && elements[0].type === 'node') {
      onToggleBreakpoint(elements[0].id);
    }
  };

  const isValueOutputNode = elements.length === 1 && elements[0].type === 'node' && document.querySelector(`[data-id="${elements[0].id}"]`)?.closest('.react-flow__node')?.classList.contains('react-flow__node-ValueOutput');
  const isErrorNode = elements.length === 1 && elements[0].type === 'node' && document.querySelector(`[data-id="${elements[0].id}"]`)?.closest('.react-flow__node')?.classList.contains('react-flow__node-ErrorNode');
  const isDismissible = isValueOutputNode || isErrorNode;
  const showBreakpointButton = elements.length === 1 && elements[0].type === 'node' && !isDismissible;
  const hasBreakpoint = selectedNode?.data?.hasBreakpoint;
  const deleteDisabled = (isDismissible && !isHost) || (isRunning && !isDismissible);

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
        disabled={deleteDisabled}
        className={`w-full justify-start ${isDismissible ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50' : 'text-destructive hover:text-destructive hover:bg-destructive/10'}`}
      >
        {isDismissible ? <MessageSquareText className="h-4 w-4 mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
        {isDismissible ? 'Dismiss' : 'Delete'}
      </Button>
      {showBreakpointButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleBreakpoint}
          disabled={!isHost}
          className="w-full justify-start"
        >
          <Bug className="h-4 w-4 mr-2" />
          {hasBreakpoint ? 'Remove Breakpoint' : 'Add Breakpoint'}
        </Button>
      )}
    </Card>
  );
};

// Memoize the context menu to prevent unnecessary re-renders
export default memo(ContextMenu); 