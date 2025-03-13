// Define tab configurations for top and bottom panels
import React from 'react';
import DetailsTab from './Tabs/DetailsTab';
import CodeTab from './Tabs/CodeTab';
import ProblemTab from './Tabs/ProblemTab';
import CollaborateTab from './Tabs/CollaborateTab';
import CommandTab from './Tabs/CommandTab';
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
      label: "Código",
      content: <CodeTab />
    },
    {
      label: "Problemas",
      content: <ProblemTab />
    },
    {
      label: "Colaborar",
      content: <CollaborateTab />
    }
  ];
  
  const bottomPanelTabs: PanelTab[] = [
    {
      label: "Comandos",
      content: <CommandTab />
    },
    {
      label: "Depurador",
      content: <DebuggerTab />
    }
  ];

  export { topPanelTabs, bottomPanelTabs }; 