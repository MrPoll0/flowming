import React, { useEffect, useState } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';
import { useReactFlow } from '@xyflow/react';

interface RemoteCursor {
  clientID: number;
  name: string;
  color: string;
  colorLight: string;
  cursor?: { x: number; y: number };
}

interface RemoteCursorsOverlayProps {
  reactFlowWrapper: React.RefObject<HTMLDivElement | null>;
}

const RemoteCursorsOverlay: React.FC<RemoteCursorsOverlayProps> = ({ reactFlowWrapper }) => {
  const { awareness } = useCollaboration();
  const reactFlowInstance = useReactFlow();
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);

  useEffect(() => {
    if (!awareness) return;
    const onChange = (changes: { added: number[]; updated: number[]; removed: number[] }) => {
      // Only update on remote join/leave or cursor movement
      const remoteAdded = changes.added.filter(id => id !== awareness.clientID);
      const remoteRemoved = changes.removed.filter(id => id !== awareness.clientID);
      const remoteUpdated = changes.updated.filter(id => id !== awareness.clientID);
      if (remoteAdded.length === 0 && remoteRemoved.length === 0 && remoteUpdated.length === 0) {
        return;
      }
      const entries = Array.from(awareness.getStates().entries()) as [number, any][];
      const states = entries
        .filter(([clientID]) => clientID !== awareness.clientID)
        .map(([clientID, state]) => ({
          clientID,
          name: state.user.name,
          color: state.user.color,
          colorLight: state.user.colorLight,
          cursor: state.cursor,
        }));
      setRemoteCursors(states);
    };

    awareness.on('change', onChange);
    // Initial load
    onChange({
      added: Array.from(awareness.getStates().keys()),
      updated: [],
      removed: [],
    });

    return () => {
      awareness.off('change', onChange);
    };
  }, [awareness]);

  return (
    <>
      {remoteCursors.map(({ clientID, name, color, colorLight, cursor }) => {
        if (!cursor || !reactFlowWrapper.current || !reactFlowInstance) return null;
        const screenPosition = reactFlowInstance.flowToScreenPosition(cursor);
        const rect = reactFlowWrapper.current.getBoundingClientRect();

        return (
          <div
            key={clientID}
            style={{
              position: 'absolute',
              left: screenPosition.x - rect.left,
              top: screenPosition.y - rect.top,
              pointerEvents: 'none',
              zIndex: 100,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '-4px',
                top: '-4px',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: color,
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: '8px',
                top: '0px',
                transform: 'translateY(-50%)',
                color: color,
                fontSize: '12px',
                fontWeight: 500,
                backgroundColor: colorLight,
                padding: '2px 4px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </span>
          </div>
        );
      })}
    </>
  );
};

export default React.memo(RemoteCursorsOverlay); 