import React from 'react';
import toolbarBlocksList from './ToolbarBlocksList';
import ToolbarBlock from './ToolbarBlock';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

// Main Toolbar component
const Toolbar: React.FC = () => {
  const blocks = toolbarBlocksList;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Blocks</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-full px-4 pb-4">
          <div className="space-y-2">
            {blocks.map((block) => (
              <ToolbarBlock
                key={block.id}
                block={block}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default Toolbar; 