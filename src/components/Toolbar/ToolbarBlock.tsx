import { Block } from "./ToolbarTypes";

// Individual block component
const ToolbarBlock: React.FC<{
    block: Block;
  }> = ({ block }) => {
    
    const handleDragStart = (event: React.DragEvent) => {
      // Only allow dragging for node blocks
      /*if (block.type !== 'node') {
        event.preventDefault();
        return;
      }*/
  
      // Set drag data - use a simple format that's easy to debug
      const dragData = JSON.stringify(block);
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
          onDragStart={handleDragStart}
          title={block.description || block.label}
        >
          {block.icon && <span className="toolbar-block-icon">{block.icon}</span>}
          <span className="toolbar-block-label">{block.label}</span>
        </div>
      </div>
    );
};

export default ToolbarBlock;