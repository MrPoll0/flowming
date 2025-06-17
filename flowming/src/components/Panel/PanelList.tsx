// Define tab configurations for top and bottom panels
import React from 'react';
import DetailsTab from './Tabs/DetailsTab';
import CodeTab from './Tabs/CodeTab';
import ExercisesTab from './Tabs/ExercisesTab';
import CollaborateTab from './Tabs/CollaborateTab';
import DebuggerTab from './Tabs/DebuggerTab';
import { useCollaboration } from '../../context/CollaborationContext';

export interface PanelTab {
  id: string;
  label: React.ReactNode;
  content: React.ReactNode;
}

export const usePanelTabs = () => {
  const { provider } = useCollaboration();

  const topPanelTabs: PanelTab[] = [
    {
      id: "details",
      label: "Details",
      content: <DetailsTab />
    },
    {
      id: "exercises",
      label: "Exercises",
      content: <ExercisesTab />
    },
    {
      id: "collaboration",
      label: provider ? (
        <div className="flex items-center justify-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            Collaboration
            <span className="text-muted-foreground ml-1">({provider.roomName})</span>
        </div>
      ) : "Collaboration",
      content: <CollaborateTab />
    }
  ];

  const bottomPanelTabs: PanelTab[] = [
    {
      id: "debugger",
      label: "Debugger",
      content: <DebuggerTab />
    },
    {
      id: "code",
      label: "Code",
      content: <CodeTab />
    }
  ];

  return { topPanelTabs, bottomPanelTabs };
}; 