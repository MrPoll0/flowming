import React, { createContext, ReactNode, useContext, useState, useEffect } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

// Define user type
interface User {
  clientID: number;
  name: string;
  color: string;
  colorLight: string;
  cursor?: { x: number; y: number };
  joinedAt: number;
}

interface CollaborationContextType {
  ydoc: Y.Doc | null;
  provider: WebrtcProvider | null;
  awareness: any;
  users: User[];
  joinRoom: (room: string, userName: string, currentFilename?: string) => void;
  leaveRoom: () => void;
  ySharedNodes: Y.Map<any> | null;
  ySharedEdges: Y.Map<any> | null;
  ySharedFilename: Y.Text | null;
  ySharedVariables: Y.Map<any> | null;
}

const CollaborationContext = createContext<CollaborationContextType>({
  ydoc: null,
  provider: null,
  awareness: null,
  users: [],
  joinRoom: () => {},
  leaveRoom: () => {},
  ySharedNodes: null,
  ySharedEdges: null,
  ySharedFilename: null,
  ySharedVariables: null,
});

export const useCollaboration = () => useContext(CollaborationContext);

// Predefined colors for users
const userColors = [
  { color: '#30bced', light: '#30bced33' },
  { color: '#6eeb83', light: '#6eeb8333' },
  { color: '#ffbc42', light: '#ffbc4233' },
  { color: '#ecd444', light: '#ecd44433' },
  { color: '#ee6352', light: '#ee635233' },
  { color: '#9ac2c9', light: '#9ac2c933' },
  { color: '#8acb88', light: '#8acb8833' },
  { color: '#1be7ff', light: '#1be7ff33' },
];

export const CollaborationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebrtcProvider | null>(null);
  const [awareness, setAwareness] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [ySharedNodes, setYSharedNodes] = useState<Y.Map<any> | null>(null);
  const [ySharedEdges, setYSharedEdges] = useState<Y.Map<any> | null>(null);
  const [ySharedFilename, setYSharedFilename] = useState<Y.Text | null>(null);
  const [ySharedVariables, setYSharedVariables] = useState<Y.Map<any> | null>(null);

  const joinRoom = (room: string, userName: string, currentFilename?: string) => {
    const doc = new Y.Doc();
    const prov = new WebrtcProvider(room, doc);

    const sharedNodes = doc.getMap<any>('nodes');
    const sharedEdges = doc.getMap<any>('edges');
    const sharedFilename = doc.getText('filename');
    const sharedVariables = doc.getMap<any>('variables');

    // Assign random color to user
    const idx = Math.floor(Math.random() * userColors.length);
    const { color, light } = userColors[idx];
    prov.awareness.setLocalStateField('user', { clientID: prov.awareness.clientID, name: userName, color, colorLight: light, joinedAt: Date.now() });
    prov.awareness.setLocalStateField('filename', currentFilename || 'Untitled');

    setYdoc(doc);
    setProvider(prov);
    setAwareness(prov.awareness);
    setYSharedNodes(sharedNodes);
    setYSharedEdges(sharedEdges);
    setYSharedFilename(sharedFilename);
    setYSharedVariables(sharedVariables);
  };

  const leaveRoom = () => {
    if (provider) {
      provider.disconnect();
      provider.destroy();
    }

    if (ydoc) {
      ydoc.destroy();
    }

    setYdoc(null);
    setProvider(null);
    setAwareness(null);
    setUsers([]);
    setYSharedNodes(null);
    setYSharedEdges(null);
    setYSharedFilename(null);
    setYSharedVariables(null);
  };

  useEffect(() => {
    if (!awareness) return;
    // Update user metadata list on any join/leave events
    const onChange = (changes: { added: number[]; updated: number[]; removed: number[] }) => {
      // Only proceed on join or leave
      if (changes.added.length === 0 && changes.removed.length === 0) return;
      // Rebuild metadata list for all participants including self
      const entries = Array.from(awareness.getStates().entries()) as [number, any][];
      const states = entries
        .map(([clientID, state]) => ({
          clientID,
          name: state.user.name,
          color: state.user.color,
          colorLight: state.user.colorLight,
          joinedAt: state.user.joinedAt,
        }));
      setUsers(states);
    };
    awareness.on('change', onChange);
    // Initial metadata load for all participants including self
    const initEntries = Array.from(awareness.getStates().entries()) as [number, any][];
    const initStates = initEntries.map(([clientID, state]) => ({
      clientID,
      name: state.user.name,
      color: state.user.color,
      colorLight: state.user.colorLight,
      joinedAt: state.user.joinedAt,
    }));
    setUsers(initStates);
    return () => {
      awareness.off('change', onChange);
    };
  }, [awareness]);

  return (
    <CollaborationContext.Provider value={{ ydoc, provider, awareness, users, joinRoom, leaveRoom, ySharedNodes, ySharedEdges, ySharedFilename, ySharedVariables }}>
      {children}
    </CollaborationContext.Provider>
  );
}; 