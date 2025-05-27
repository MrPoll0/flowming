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
      label: "Detalles",
      content: <DetailsTab />
    },
    {
      label: "Ejercicios",
      content: <ExercisesTab />
    },
    {
      label: "Colaborar",
      content: <CollaborateTab />
    }
  ];
  
const bottomPanelTabs: PanelTab[] = [
    {
      label: "Depurador",
      content: <DebuggerTab />
    },
    {
      label: "Código",
      content: <CodeTab />
    }
  ];

  export { topPanelTabs, bottomPanelTabs }; 