import { Block } from "./ToolbarTypes";
import { memo } from 'react';
import { useDnD } from '../../context/DnDContext';

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
  
    return (
      <div className="toolbar-block-container">
        <div
          className={`toolbar-block toolbar-block-${block.type} draggable`}
          onDragStart={ (event) => handleDragStart(event, block) }
          onDragEnd={handleDragEnd}
          title={block.description || block.label}
          draggable
          style={{ userSelect: 'none' }} // prevent text selection interference with dragging node handles
        >
          {block.icon && <span className="toolbar-block-icon">{block.icon}</span>}
          <span className="toolbar-block-label">{block.label}</span>
        </div>
      </div>
    );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(ToolbarBlock);