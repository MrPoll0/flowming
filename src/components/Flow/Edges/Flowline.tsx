import { BaseEdge, getSmoothStepPath, type EdgeProps, EdgeLabelRenderer, Edge } from '@xyflow/react';
import { FC, memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FlowlineData extends Record<string, unknown> {
    label?: string;
    isHovered?: boolean;
    isSelected?: boolean;
    isEditing?: boolean;
    isAnimated?: boolean;
    animationDuration?: number;
}

// Memoize the node component to prevent unnecessary re-renders
const Flowline: FC<EdgeProps<Edge<FlowlineData>>> = (props) => {
    const { data } = props;
    const isHovered = data?.isHovered;
    const isSelected = data?.isSelected;
    const isEditing = data?.isEditing;
    const [labelText, setLabelText] = useState(data?.label || '');

    const isAnimated = data?.isAnimated;
    const animationDuration = data?.animationDuration || 1000;
    const [animationKey, setAnimationKey] = useState(Date.now());
    
    // Create a unique marker ID for this edge
    const markerId = `marker-${props.id}`;
    
    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLabelText(e.target.value);
    };
    
    // Handle input blur (save changes)
    const handleInputBlur = () => {
        // Save the changes by dispatching a custom event
        const event = new CustomEvent('edge:labelChanged', {
            detail: { id: props.id, label: labelText }
        });
        document.dispatchEvent(event);
    };
    
    // Handle key press (Enter to save, Escape to cancel)
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleInputBlur();
        } else if (e.key === 'Escape') {
            setLabelText(data?.label || '');
            handleInputBlur();
        }
    };

    // Determine styling based on hover/selected state
    const edgeColor = isAnimated 
        ? '#0066ff' 
        : isSelected 
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

    // issue -> set 4 blocks in a loop after start (start -> up left -> down left -> down right -> up right -> up left...)
    //       the animation from the down right to the up right sometimes gets stuck at the beginning, time passes, then appears at the end and it continues normally
    // adding one more to the one bugged then makes it bugged for that and not for the previous one
    // ====> pausing and then resuming fixes it and it also continues from where it should be
    // ====> only happens with nodes going up from the TOP handle (!!!!!!!!!)

    useEffect(() => {
        if (isAnimated) {
            // Reset animation whenever path changes or isAnimated becomes true
            setAnimationKey(Date.now());

            // Quick hotfix: for some reason, top handle animations sometimes get stuck at the beginning
            // Pausing and resuming the animations fixes it, so just do that very quickly with a timeout (immediately does not work)
            setTimeout(() => {
                const svgElements = document.querySelectorAll('svg[id^="edge-animation-"]');
                svgElements.forEach(svg => {
                    const svgElement = svg as SVGSVGElement;
                    svgElement.pauseAnimations();
                    svgElement.unpauseAnimations();
                });
            }, 10);
        }

    }, [isAnimated, edgePath]); // edgePath in dependecy array to force re-render when path changes (i.e. different edge) to prevent animation from being stuck

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
                label={undefined} // hide default label
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

            {/* Edge animation */}
            {/* TODO: use Framer Motion for the ball animation too? (not really needed) */}
            <AnimatePresence>
                {isAnimated && (
                    <motion.svg
                        key={`svg-${animationKey}`}
                        style={{ 
                            position: 'absolute', 
                            top: 0, 
                            left: 0, 
                            width: '100%', 
                            height: '100%', 
                            overflow: 'visible', 
                            pointerEvents: 'none' 
                        }}
                        id={`edge-animation-${props.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.1 }}
                    >
                        <defs>
                            <path id={`path-${props.id}-${animationKey}`} d={edgePath} key={`path-${animationKey}`} />
                        </defs>
                        <circle r="6" fill="#0066ff">
                            <animateMotion
                                key={`motion-${animationKey}`}
                                dur={`${animationDuration/1000}s`}
                                fill="freeze"
                                begin="0s"
                                repeatCount="1"
                                calcMode="linear"
                                restart="always"
                            >
                                <mpath href={`#path-${props.id}-${animationKey}`} />
                            </animateMotion>
                        </circle>
                    </motion.svg>
                )}
            </AnimatePresence>
            
            {(isEditing || labelText || data?.label) && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        }}
                        className="edge-label-renderer__custom-edge nodrag nopan"
                    >
                        {isEditing ? (
                            <input
                                type="text"
                                value={labelText}
                                onChange={handleInputChange}
                                onBlur={handleInputBlur}
                                onKeyDown={handleKeyPress}
                                autoFocus
                                className="edge-label-input"
                            />
                        ) : (
                            labelText || data?.label || ''
                        )}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
};

export default memo(Flowline);