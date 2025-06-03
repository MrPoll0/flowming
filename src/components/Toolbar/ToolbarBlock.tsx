import { Block } from "./ToolbarTypes";
import { memo } from 'react';
import { useDnD } from '../../context/DnDContext';
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Individual block component
const ToolbarBlock: React.FC<{
    block: Block;
  }> = ({ block }) => {
    const [, setDnDData] = useDnD();
    
    const handleDragStart = (event: React.DragEvent, block: Block) => {  
      // Clear any text selection that might interfere with dragging
      window.getSelection()?.removeAllRanges();
      
      const dragData = JSON.stringify(block);

      event.dataTransfer.setData('text/plain', dragData); // needed for the drag event to work (could be simply '')
      event.dataTransfer.effectAllowed = 'move';
      setDnDData(dragData);
    };

    const handleDragEnd = () => {
      setDnDData(null);
    };

    const blockTypeColors = {
      input: 'border-blue-200 bg-blue-50 hover:bg-blue-100',
      output: 'border-green-200 bg-green-50 hover:bg-green-100', 
      process: 'border-purple-200 bg-purple-50 hover:bg-purple-100',
      control: 'border-orange-200 bg-orange-50 hover:bg-orange-100',
      default: 'border-gray-200 bg-gray-50 hover:bg-gray-100'
    };
  
    return (
      <Card 
        className={cn(
          "p-3 cursor-grab active:cursor-grabbing transition-colors border-2 select-none",
          blockTypeColors[block.type as keyof typeof blockTypeColors] || blockTypeColors.default
        )}
        onDragStart={(event) => handleDragStart(event, block)}
        onDragEnd={handleDragEnd}
        title={block.description || block.label}
        draggable
      >
        <div className="flex items-center gap-2">
          {block.icon && (
            <span className="text-lg flex-shrink-0">
              {block.icon}
            </span>
          )}
          <span className="text-sm font-medium text-gray-700 leading-tight">
            {block.label}
          </span>
        </div>
      </Card>
    );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(ToolbarBlock);