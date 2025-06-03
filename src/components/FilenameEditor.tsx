import React, { useState, useEffect } from 'react';
import { useFilename } from '../context/FilenameContext';
import { useFlowExecutorContext } from '../context/FlowExecutorContext';

const FilenameEditor: React.FC = () => {
  const { filename, setFilename } = useFilename();
  const { isRunning } = useFlowExecutorContext();
  const [isEditingFilename, setIsEditingFilename] = useState(false);
  const [tempFilename, setTempFilename] = useState(filename);

  // Update tempFilename when filename changes from context
  useEffect(() => {
    setTempFilename(filename);
  }, [filename]);

  // Handle filename editing
  const handleFilenameClick = () => {
    if (!isRunning) {
      setIsEditingFilename(true);
    }
  };

  const handleFilenameSubmit = () => {
    setFilename(tempFilename.trim() || 'Untitled');
    setIsEditingFilename(false);
  };

  const handleFilenameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFilenameSubmit();
    } else if (e.key === 'Escape') {
      setTempFilename(filename);
      setIsEditingFilename(false);
    }
  };

  const handleFilenameBlur = () => {
    // No update on blur
    setTempFilename(filename);
    setIsEditingFilename(false);
  };

  return (
    <>
      {isEditingFilename ? (
        <input
          type="text"
          value={tempFilename}
          onChange={(e) => setTempFilename(e.target.value)}
          onKeyDown={handleFilenameKeyPress}
          onBlur={handleFilenameBlur}
          autoFocus
          style={{
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid #4ade80',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '14px',
            outline: 'none',
            maxWidth: '200px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
          placeholder="Enter filename"
        />
      ) : (
        <div
          onClick={handleFilenameClick}
          style={{
            cursor: isRunning ? 'default' : 'pointer',
            padding: '4px 8px',
            borderRadius: '6px',
            backgroundColor: isRunning ? 'rgba(100,100,100,0.1)' : 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(200,200,200,0.4)',
            fontSize: '14px',
            minWidth: '120px',
            opacity: isRunning ? 0.7 : 1,
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(2px)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
          title={isRunning ? "Cannot edit filename while running" : "Click to edit filename"}
          onMouseEnter={(e) => {
            if (!isRunning) {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)';
              e.currentTarget.style.borderColor = 'rgba(200,200,200,0.6)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isRunning) {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.borderColor = 'rgba(200,200,200,0.4)';
            }
          }}
        >
          {filename || 'Untitled'}
        </div>
      )}
    </>
  );
};

export default FilenameEditor; 