import React, { memo } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import { topPanelTabs, bottomPanelTabs, PanelTab } from './PanelList';

// Define the type for the mapping
type PanelType = 'top' | 'bottom';

interface PanelProps {
  type: PanelType;
}

const mapping: Record<PanelType, PanelTab[]> = {
  top: topPanelTabs,
  bottom: bottomPanelTabs
}

const Panel: React.FC<PanelProps> = ({ type }) => {
  return (
    <Tabs forceRenderTabPanel={true}>
      {/* Tabs label definition */}
      <TabList>
        {mapping[type].map((tab, index) => (
          <Tab key={index}>{tab.label}</Tab>
        ))}
      </TabList>

      {/* Tabs content definition */}
      {mapping[type].map((tab, index) => (
        <TabPanel key={index}>
          {tab.content}
        </TabPanel>
      ))}
    </Tabs>
  );
};

// Memoize the panel component to prevent unnecessary re-renders
export default memo(Panel); 