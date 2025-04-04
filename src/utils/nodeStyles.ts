/**
 * Utility functions for node styling
 */

interface NodeStyleOptions {
  isHovered?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  borderRadius?: string | number;
  padding?: string;
  minWidth?: string;
  minHeight?: string;
  additionalStyles?: React.CSSProperties;
}

export function getNodeStyles({
  isHovered,
  isSelected,
  isHighlighted,
  borderRadius = '0px',
  padding = '10px 20px',
  minWidth = '250px',
  minHeight,
  additionalStyles = {}
}: NodeStyleOptions): React.CSSProperties {
  return {
    borderRadius, 
    padding,
    border: isHighlighted
      ? '2px solid #0066ff'
      : isSelected 
        ? '1px solid #1a73e8' 
        : isHovered 
          ? '1px solid #4d9cff' 
          : '1px solid #000',
    boxShadow: isHighlighted
      ? '0 0 10px rgba(0, 102, 255, 0.5)'
      : isSelected 
        ? '0 0 8px rgba(26, 115, 232, 0.6)' 
        : isHovered 
          ? '0 0 5px rgba(77, 156, 255, 0.5)' 
          : 'none',
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    minWidth,
    ...(minHeight && { minHeight }),
    ...additionalStyles
  };
} 