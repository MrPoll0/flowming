import { Block } from "./ToolbarTypes";
import { memo } from 'react';

// Individual block component
const ToolbarBlock: React.FC<{
    block: Block;
  }> = ({ block }) => {
    
    const handleDragStart = (event: React.DragEvent, block: Block) => {  
      // Set drag data - use a simple format that's easy to debug
      const dragData = JSON.stringify(block);

      // TODO: use Context to pass data instead of dataTransfer? possible source of problems (see ReactFlow example)
      event.dataTransfer.setData('text/plain', dragData);
      event.dataTransfer.setData('application/reactflow', dragData);
      event.dataTransfer.effectAllowed = 'move';
      
      console.log('Drag started with data:', dragData);
  
  
    };
  
    return (
      <div className="toolbar-block-container">
        <div
          className={`toolbar-block toolbar-block-${block.type} draggable`}
          draggable={ true }
          onDragStart={ (event) => handleDragStart(event, block) }
          title={block.description || block.label}
        >
          {block.icon && <span className="toolbar-block-icon">{block.icon}</span>}
          <span className="toolbar-block-label">{block.label}</span>
        </div>
      </div>
    );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(ToolbarBlock);