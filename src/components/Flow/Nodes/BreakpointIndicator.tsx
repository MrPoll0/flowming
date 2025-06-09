import React from 'react';

const BreakpointIndicator: React.FC = () => {
  return (
    <div
      style={{
        width: '8px',
        height: '8px',
        backgroundColor: '#f44336',
        borderRadius: '50%',
        marginRight: '4px',
      }}
      title="Breakpoint"
    />
  );
};

export default BreakpointIndicator; 