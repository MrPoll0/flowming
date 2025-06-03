import React, { memo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
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
  const panelTabs = mapping[type];
  const [activeTab, setActiveTab] = useState(panelTabs[0]?.label || "");
  
  if (panelTabs.length === 0) {
    return (
      <Card className="h-full p-4">
        <div className="text-muted-foreground">No tabs available</div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList 
          className="grid w-full" 
          style={{ 
            gridTemplateColumns: `repeat(${panelTabs.length}, minmax(0, 1fr))` 
          }}
        >
          {panelTabs.map((tab, index) => (
            <TabsTrigger key={index} value={tab.label}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <div className="flex-1 overflow-hidden relative">
          {panelTabs.map((tab, index) => (
            <div
              key={index}
              className={`absolute inset-0 overflow-auto p-4 ${
                activeTab === tab.label ? 'block' : 'hidden' // Keep the tab content rendered even if not active to prevent unmounting and losing state when switching tabs
              }`}
            >
              {tab.content}
            </div>
          ))}
        </div>
      </Tabs>
    </Card>
  );
};

// Memoize the panel component to prevent unnecessary re-renders
export default memo(Panel); 