import { Block } from "./ToolbarTypes";
import { memo } from 'react';
import { useDnD } from '../../context/DnDContext';
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Individual block component
const ToolbarBlock: React.FC<{
    block: Block;
    disabled?: boolean;
  }> = ({ block, disabled = false }) => {
    const [, setDnDData] = useDnD();
    
    const handleDragStart = (event: React.DragEvent, block: Block) => {  
      // Prevent dragging if disabled
      if (disabled) {
        event.preventDefault();
        return;
      }

      // Clear any text selection that might interfere with dragging
      window.getSelection()?.removeAllRanges();
      
      const dragData = JSON.stringify(block);

      event.dataTransfer.setData('text/plain', dragData); // needed for the drag event to work (could be simply '')
      event.dataTransfer.effectAllowed = 'move';
      setDnDData(dragData);
    };

    const handleDragEnd = () => {
      if (!disabled) {
        setDnDData(null);
      }
    };

    const blockTypeColors = {
      input: 'border-green-200 bg-green-50 hover:bg-green-100',
      output: 'border-green-200 bg-green-50 hover:bg-green-100', 
      process: 'border-orange-200 bg-orange-50 hover:bg-orange-100',
      control: 'border-blue-200 bg-blue-50 hover:bg-blue-100',
      default: 'border-gray-200 bg-gray-50 hover:bg-gray-100'
    };

    const disabledColors = {
      input: 'border-gray-200 bg-gray-100',
      output: 'border-gray-200 bg-gray-100', 
      process: 'border-gray-200 bg-gray-100',
      control: 'border-gray-200 bg-gray-100',
      default: 'border-gray-200 bg-gray-100'
    };
  
    return (
      <Card 
        className={cn(
          "p-3 transition-colors border-2 select-none",
          disabled 
            ? cn(
                "cursor-not-allowed opacity-60",
                disabledColors[block.type as keyof typeof disabledColors] || disabledColors.default
              )
            : cn(
                "cursor-grab active:cursor-grabbing",
                blockTypeColors[block.type as keyof typeof blockTypeColors] || blockTypeColors.default
              )
        )}
        onDragStart={(event) => handleDragStart(event, block)}
        onDragEnd={handleDragEnd}
        title={disabled ? "Cannot add blocks while flow is running" : (block.description || block.label)}
        draggable={!disabled}
      >
        <div className="flex items-center gap-2">
          {block.icon && (
            <div className={cn("flex-shrink-0", disabled && "opacity-50")}>
              {block.icon}
            </div>
          )}
          <span className={cn(
            "text-sm font-medium leading-tight",
            disabled ? "text-gray-400" : "text-gray-700"
          )}>
            {block.label}
          </span>
        </div>
      </Card>
    );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(ToolbarBlock);