import React from 'react';
import './Toolbar.css';
import toolbarBlocksList from './ToolbarBlocksList';
import ToolbarBlock from './ToolbarBlock';

// Main Toolbar component
const Toolbar: React.FC = () => {
  const blocks = toolbarBlocksList;

  return (
    <div className="toolbar">
      <div className="toolbar-header">
        <h3>Blocks</h3>
      </div>
      <div className="toolbar-blocks">
        {blocks.map((block) => (
          <ToolbarBlock
            key={block.id}
            block={block}
          />
        ))}
      </div>
    </div>
  );
};

export default Toolbar; 