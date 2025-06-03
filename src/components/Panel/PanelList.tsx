// Define tab configurations for top and bottom panels
import React from 'react';
import DetailsTab from './Tabs/DetailsTab';
import CodeTab from './Tabs/CodeTab';
import ExercisesTab from './Tabs/ExercisesTab';
import CollaborateTab from './Tabs/CollaborateTab';
import DebuggerTab from './Tabs/DebuggerTab';

export interface PanelTab {
    label: string;
    content: React.ReactNode;
  }

const topPanelTabs: PanelTab[] = [
    {
      label: "Details",
      content: <DetailsTab />
    },
    {
      label: "Exercises",
      content: <ExercisesTab />
    },
    {
      label: "Collaboration",
      content: <CollaborateTab />
    }
  ];
  
const bottomPanelTabs: PanelTab[] = [
    {
      label: "Debugger",
      content: <DebuggerTab />
    },
    {
      label: "Code",
      content: <CodeTab />
    }
  ];

  export { topPanelTabs, bottomPanelTabs }; 