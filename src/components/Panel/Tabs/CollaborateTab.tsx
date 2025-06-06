import React, { useContext, useState, useMemo } from 'react';
import { useCollaboration } from '../../../context/CollaborationContext';
import { useReactFlow } from '@xyflow/react';
import { clearDiagram } from '../../ImportExport';
import { useVariables } from '../../../context/VariablesContext';
import { useFlowExecutorActions, useFlowExecutorState } from '../../../context/FlowExecutorContext';
import { useDebugger } from '../../../context/DebuggerContext';
import { useFilename } from '../../../context/FilenameContext';
import { SelectedNodeContext } from '../../../context/SelectedNodeContext';

const CollaborateTab: React.FC = () => {
  const { joinRoom, leaveRoom, users, provider } = useCollaboration();
  const [room, setRoom] = useState('');
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const { setNodes, setEdges, getNodes, fitView } = useReactFlow();
  const { deleteNodeVariables } = useVariables();
  const { setSelectedNode } = useContext(SelectedNodeContext);
  const { filename, setFilename } = useFilename();
  const { stop } = useFlowExecutorActions();
  const { clearHistory } = useDebugger();
  const { isRunning } = useFlowExecutorState();

  const hostUser = useMemo(() => {
    if (!users.length) return null;
    return users.reduce((prev, curr) => (prev.joinedAt <= curr.joinedAt ? prev : curr));
  }, [users]);

  const handleJoin = () => {
    if (room && username) {
      // Clear current diagram
      clearDiagram(setNodes, setEdges, getNodes, deleteNodeVariables, setSelectedNode, setFilename, stop, clearHistory);

      joinRoom(room, username, filename);
      setJoined(true);

      setTimeout(() => {
        fitView({ padding: 0.2, duration: 800 });
      }, 500);
    }
  };

  const handleLeave = () => {
    leaveRoom();
    setJoined(false);
  };

  return (
    <div className="p-4 space-y-4">
      {!joined ? (
        <div className="space-y-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Room ID</label>
            <input
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-1"
            />
          </div>
          <button 
            onClick={handleJoin} 
            className={`px-4 py-2 text-white rounded ${isRunning ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600'}`}
            disabled={isRunning}
          >
            Join Room
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Room: {provider?.roomName || room}</span>
            <button onClick={handleLeave} className="px-2 py-1 text-red-600">
              Leave
            </button>
          </div>
          <div>
            <h4 className="text-sm font-medium">Users</h4>
            <ul className="mt-2 space-y-1">
              {users.map((user) => (
                <li key={user.clientID} className="flex items-center space-x-2">
                  <span
                    style={{ backgroundColor: user.color, width: 12, height: 12, borderRadius: '50%' }}
                  ></span>
                  <span>{user.name}</span>
                  {user.clientID === hostUser?.clientID && <span title="Host" className="ml-1">👑</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(CollaborateTab);
