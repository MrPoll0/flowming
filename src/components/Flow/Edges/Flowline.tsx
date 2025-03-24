import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';

// Memoize the node component to prevent unnecessary re-renders
export default memo(function Flowline(props: EdgeProps) {
    const { data } = props;
    const isHovered = data?.isHovered;
    const isSelected = data?.isSelected;

    // Determine styling based on hover/selected state
    const edgeColor = isSelected 
        ? '#1a73e8' 
        : isHovered 
            ? '#4d9cff' 
            : (props.style?.stroke || '#555');

    // Calculate the path
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX: props.sourceX,
        sourceY: props.sourceY,
        sourcePosition: props.sourcePosition,
        targetX: props.targetX,
        targetY: props.targetY,
        targetPosition: props.targetPosition,
        borderRadius: props.pathOptions?.borderRadius,
        offset: props.pathOptions?.offset,
    });

    // Create the edge style
    const edgeStyle = {
        ...props.style,
        stroke: edgeColor,
    };

    // Create a unique marker ID for this edge
    const markerId = `arrowhead-${props.id}`;

    return (
        <>
            <defs>
                <marker
                    id={markerId}
                    markerWidth='10'
                    markerHeight='10'
                    viewBox='-10 -10 20 20'
                    markerUnits='strokeWidth'
                    orient='auto-start-reverse'
                    refX='0'
                    refY='0'
                >
                    <polyline
                        stroke-linecap='round'
                        stroke-linejoin='round'
                        points='-5,-4 0,0 -5,4 -5,-4'
                        style={{ stroke: edgeColor, fill: edgeColor, strokeWidth: 1 }}
                    ></polyline>
                </marker>
            </defs>
            <BaseEdge
            id={props.id}
            path={edgePath}
            labelX={labelX}
            labelY={labelY}
            label={props.label}
            labelStyle={props.labelStyle}
            labelShowBg={props.labelShowBg}
            labelBgStyle={props.labelBgStyle}
            labelBgPadding={props.labelBgPadding}
            labelBgBorderRadius={props.labelBgBorderRadius}
            style={edgeStyle}
            markerEnd={`url(#${markerId})`}
            markerStart={props.markerStart}
            interactionWidth={props.interactionWidth}
            />
        </>
    );
});