import React, { useContext, useRef, useEffect, memo } from 'react';
import { FlowInteractionContext } from '../../context/FlowInteractionContext';
import { SelectedNodeContext } from '../../context/SelectedNodeContext';

interface ContextMenuProps {
  onDelete: (element: { id: string; type: 'node' | 'edge' }) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ onDelete }) => {
  const { contextMenuPosition, hideContextMenu } = useContext(FlowInteractionContext);
  const { setSelectedNode } = useContext(SelectedNodeContext)
  const { x, y, visible, element } = contextMenuPosition;
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

  if (!visible || !element) return null;

  const handleDelete = () => {
    if (element) {
      onDelete(element);
      setSelectedNode(null)
      hideContextMenu();
    }
  };

  return (
    <div 
      ref={menuRef}
      className="context-menu" 
      style={{ 
        position: 'absolute',
        top: y,
        left: x,
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '5px 0',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        zIndex: 1000,
      }}
    >
      <div 
        className="context-menu-item delete" 
        onClick={handleDelete}
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          color: 'red',
          fontWeight: 'bold',
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        Delete
      </div>
    </div>
  );
};

// Memoize the context menu to prevent unnecessary re-renders
export default memo(ContextMenu); 