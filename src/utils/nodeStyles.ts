/**
 * Utility functions for node styling
 */

interface NodeStyleOptions {
  isHovered?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  isCodeHighlighted?: boolean;
  borderRadius?: string | number;
  padding?: string;
  minWidth?: string;
  minHeight?: string;
  additionalStyles?: React.CSSProperties;
}


// TODO: move this to NodeTypes? (even rename that to BaseNode or similar)

// TODO: use shadcn/ui

export function getNodeActionsStyles({
  isHovered,
  isSelected,
  isHighlighted,
  isCodeHighlighted,
  additionalStyles = {}
}: NodeStyleOptions): React.CSSProperties {
  const borderStyle = isHighlighted
    ? '2px solid #0066ff'
    : isCodeHighlighted
      ? '1px solid #f59e0b'
      : isSelected
        ? '1px solid #1a73e8'
        : isHovered
          ? '1px solid #4d9cff'
          : '1px solid #000';
  const boxShadow = isHighlighted
    ? '0 0 10px rgba(0, 102, 255, 0.5)'
    : isCodeHighlighted
      ? '0 0 10px rgba(245, 158, 11, 0.6)'
      : isSelected
        ? '0 0 8px rgba(26, 115, 232, 0.6)'
        : isHovered
          ? '0 0 5px rgba(77, 156, 255, 0.5)'
          : 'none';

  return {
    border: borderStyle,
    boxShadow: boxShadow,
    backgroundColor: '#fff',
    ...additionalStyles
  };
}
export function getNodeStyles({
  isHovered,
  isSelected,
  isHighlighted,
  isCodeHighlighted,
  borderRadius = '0px',
  padding = '10px 20px',
  minWidth = '250px',
  minHeight,
  additionalStyles = {}
}: NodeStyleOptions): React.CSSProperties {
  return {
    borderRadius, 
    padding,
    ...getNodeActionsStyles({
      isHovered,
      isSelected,
      isHighlighted,
      isCodeHighlighted,
    }),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    minWidth,
    ...(minHeight && { minHeight }),
    ...additionalStyles
  };
} 