import React, { useState, useEffect, useRef } from 'react';
import { useFilename } from '../context/FilenameContext';
import { useFlowExecutorContext } from '../context/FlowExecutorContext';
import { useCollaboration } from '../context/CollaborationContext';

const SYNC_ORIGIN_FILENAME = 'local_filename_sync';

const FilenameEditor: React.FC = () => {
  const { filename, setFilename } = useFilename();
  const { isRunning } = useFlowExecutorContext();
  const { ydoc, ySharedFilename, awareness } = useCollaboration();
  const [isEditingFilename, setIsEditingFilename] = useState(false);
  const [tempFilename, setTempFilename] = useState(filename);
  const awarenessInitialized = useRef(false);

  // Reset initialization state when collaboration context changes
  useEffect(() => {
    if (!ydoc || !awareness) {
      awarenessInitialized.current = false;
    }
  }, [ydoc, awareness]);

  // Update tempFilename when filename changes from context (local or remote)
  useEffect(() => {
    setTempFilename(filename);
    if(awareness) awareness.setLocalStateField('filename', filename);
  }, [filename]);

  // NOTE: if only 1 client in the room, we dont really care about suscribing or pushing changes to Y.Text for filename
  // since the updated filename will be pushed to the awareness
  // NOTE2: when connecting to a room, we want to get its filename. Due to sync issues, the gotten values might be empty
  // so we wait for the awareness to be retrieved with the filename on it. This filename will be reliable
  // once we have this, then we sync both the client already in the room and the joining client through Y.Text
  // the client with the earliest joinedAt is the one that will be used to sync the filename (the host ideally, contrary to the joining client)

  // Handle awareness-based filename synchronization on join
  useEffect(() => {
    if (!awareness || awarenessInitialized.current) return;

    const handleAwarenessChange = () => {
      // Only run initial synchronization once
      if (awarenessInitialized.current) return;
      // Gather all client states (clientID and state)
      const states = Array.from(awareness.getStates().entries()) as [number, any][];
      // Only proceed once there's at least one other peer
      if (states.length < 2) return;

      // Find the earliest client by earlist joinedAt 
      let [firstID, firstState] = states[0];
      for (const [id, state] of states) {
        if (state.user.joinedAt < firstState.user.joinedAt) {
          firstID = id;
          firstState = state;
        }
      }

      // If the earliest isn't us and has a filename, adopt it
      if (firstID !== awareness.clientID && firstState.filename) {
        setFilename(firstState.filename);
      }
      // Mark synchronization as done
      awarenessInitialized.current = true;
    };

    awareness.on('change', handleAwarenessChange);
    // Trigger immediately in case states already include peers
    handleAwarenessChange();

    return () => {
      awareness.off('change', handleAwarenessChange);
    };
  }, [awareness, setFilename]);

  // Subscribe to ongoing Y.Text filename changes
  useEffect(() => {
    if (!ySharedFilename || !awarenessInitialized.current) return;

    const observer = (event: any) => {
      if (event.transaction.origin !== SYNC_ORIGIN_FILENAME) {
        const updated = ySharedFilename.toString();
        setFilename(updated || 'Untitled');
      }
    };

    ySharedFilename.observe(observer);
    return () => {
      ySharedFilename.unobserve(observer);
    };
  }, [ySharedFilename, awarenessInitialized.current]);

  // Push local filename changes to remote and awareness
  useEffect(() => {
    if (!awarenessInitialized.current || !ySharedFilename || !ydoc) return;

    const remote = ySharedFilename.toString();
    if (filename !== remote) {
      ydoc.transact(() => {
        ySharedFilename.delete(0, ySharedFilename.length);
        ySharedFilename.insert(0, filename);
      }, SYNC_ORIGIN_FILENAME);
    }
  }, [filename, ySharedFilename, ydoc]);

  // Handle filename editing
  const handleFilenameClick = () => {
    if (!isRunning) {
      setIsEditingFilename(true);
    }
  };

  const handleFilenameSubmit = () => {
    setFilename(tempFilename.trim() || 'Untitled');
    setIsEditingFilename(false);
  };

  const handleFilenameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFilenameSubmit();
    } else if (e.key === 'Escape') {
      setTempFilename(filename);
      setIsEditingFilename(false);
    }
  };

  const handleFilenameBlur = () => {
    // No update on blur
    setTempFilename(filename);
    setIsEditingFilename(false);
  };

  return (
    <div className="flex items-center gap-1">
      {isEditingFilename ? (
        <input
          type="text"
          value={tempFilename}
          onChange={(e) => setTempFilename(e.target.value)}
          onKeyDown={handleFilenameKeyPress}
          onBlur={handleFilenameBlur}
          autoFocus
          style={{
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid #4ade80',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '14px',
            outline: 'none',
            maxWidth: '200px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
          placeholder="Enter filename"
        />
      ) : (
        <div
          onClick={handleFilenameClick}
          style={{
            cursor: isRunning ? 'default' : 'pointer',
            padding: '4px 8px',
            borderRadius: '6px',
            backgroundColor: isRunning ? 'rgba(100,100,100,0.1)' : 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(200,200,200,0.4)',
            fontSize: '14px',
            minWidth: '120px',
            opacity: isRunning ? 0.7 : 1,
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(2px)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
          title={isRunning ? "Cannot edit filename while running" : "Click to edit filename"}
          onMouseEnter={(e) => {
            if (!isRunning) {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)';
              e.currentTarget.style.borderColor = 'rgba(200,200,200,0.6)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isRunning) {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.borderColor = 'rgba(200,200,200,0.4)';
            }
          }}
        >
          {filename || 'Untitled'}
        </div>
      )}
      <span 
        style={{
          fontSize: '14px',
          color: 'rgba(100,100,100,0.8)',
          fontWeight: '500',
          userSelect: 'none'
        }}
      >
        .flowming
      </span>
    </div>
  );
};

export default FilenameEditor; 