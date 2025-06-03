import {
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ExpressionElement } from '../../../../../models';
import { Button } from "@/components/ui/button";

// Define props interfaces for components
export interface DraggableExpressionElementProps {
  element: ExpressionElement;
  index: number;
  removeExpressionElement: (id: string) => void;
  disabled: boolean;
}

// Draggable expression element component
export const DraggableExpressionElement = ({ element, removeExpressionElement, disabled }: DraggableExpressionElementProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: element.id, disabled });

  const bgColor = 
    element.type === 'variable' ? 'bg-blue-100' :
    element.type === 'operator' ? 'bg-red-100' : 'bg-green-100';

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
      className={`
        group relative inline-block px-2 py-1 m-1 rounded text-sm
        ${bgColor}
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab'}
        ${isDragging ? 'opacity-0' : 'opacity-100'}
      `}
    >
      <span>{element.value}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          removeExpressionElement(element.id);
        }}
        disabled={disabled}
        className="ml-1 h-4 w-4 p-0 text-xs opacity-70 hover:opacity-100"
      >
        ×
      </Button>
    </div>
  );
};

// Define types for palette item props
export interface DraggablePaletteItemProps {
  id: string;
  type: string;
  value: string;
  backgroundColor: string;
  disabled: boolean;
  onClick?: () => void;
  onRightClick?: () => void;
}

// Draggable palette item component (non-sortable)
export const DraggablePaletteItem = ({ id, value, backgroundColor, disabled, onClick, onRightClick }: DraggablePaletteItemProps) => {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: id,
    disabled
  });

  // Map background colors to Tailwind classes
  const bgColorClass = 
    backgroundColor === '#d1e7ff' ? 'bg-blue-100' :
    backgroundColor === '#ffd1d1' ? 'bg-red-100' :
    backgroundColor === '#d1ffd1' ? 'bg-green-100' : 'bg-gray-200';

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && onClick) {
      onClick();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && onRightClick) {
      onRightClick();
    }
  };

  const getTooltipText = () => {
    if (onClick && onRightClick) {
      return `Left-click: add "${value}" to left side, Right-click: add to right side`;
    } else if (onClick) {
      return `Drag or click to add "${value}" to expression`;
    }
    return `Drag "${value}" to expression`;
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={`
        inline-block px-2 py-1 m-1 rounded text-sm
        ${bgColorClass}
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab hover:cursor-pointer'}
        ${!disabled ? 'hover:opacity-80 transition-opacity' : ''}
      `}
      title={getTooltipText()}
    >
      {value}
    </div>
  );
};

// Droppable area component
export const ExpressionDropArea = ({ id, children, disabled }: { id: string, children: React.ReactNode, disabled: boolean }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: id
  });

  return (
    <div 
      ref={setNodeRef}
      className={`
        p-2.5 
        ${isOver 
          ? 'border-2 border-solid border-blue-400 bg-blue-50' 
          : 'border-2 border-dashed border-gray-300 bg-transparent'
        }
        rounded 
        min-h-[60px] 
        flex 
        flex-wrap 
        items-center
        ${disabled ? 'opacity-50' : ''}
      `}
    >
      {children}
    </div>
  );
}; 