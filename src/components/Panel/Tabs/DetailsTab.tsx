import { useContext, useRef } from 'react';
import { SelectedNodeContext } from '../../../context/SelectedNodeContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import VariableDeclarationEditor from './editors/VariableDeclarationEditor';
import VariableAssignmentEditor from './editors/VariableAssignmentEditor';
import OutputEditor from './editors/OutputEditor';
import ConditionalEditor from './editors/ConditionalEditor';
import InputEditor from './editors/InputEditor';

// TODO: if cannot select element while running, then also hide its editor in DetailsTab for consistency (i prefer being able to select elements while running and see their values but not modify them)

// TODO: proper expression reset depending on type (null, leftside undefined, empty array, etc)

const DetailsTab = () => {
  const { selectedNode } = useContext(SelectedNodeContext);
  const scrollableContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container
  const additionalInfoRef = useRef<HTMLDivElement>(null); // Ref for auto-scrolling to additional info

  return (
    <>
      {selectedNode ? (
        <div className="h-full flex flex-col overflow-hidden">
          {/* Scrollable editors */}
          <div 
            ref={scrollableContainerRef} 
            className="flex-1 overflow-y-auto overflow-x-hidden mt-5"
          >
            <VariableDeclarationEditor />
            <VariableAssignmentEditor />
            <OutputEditor />
            <ConditionalEditor />
            <InputEditor />
            
            {/* Additional information accordion - shown for any selected node */}
            {selectedNode && (
              <div ref={additionalInfoRef} className="w-full">
                <Accordion type="single" collapsible className="mt-5">
                  <AccordionItem value="additional-info">
                    <AccordionTrigger 
                      className="text-sm"
                      onClick={() => {
                        // Auto-scroll when expanded (with delay to allow full accordion animation)
                        setTimeout(() => {
                          if (additionalInfoRef.current && scrollableContainerRef.current) {
                            // First try scrollIntoView
                            additionalInfoRef.current.scrollIntoView({ 
                              behavior: 'smooth', 
                              block: 'end'
                            });
                            
                            // Fallback: scroll to the very bottom of the container
                            setTimeout(() => {
                              if (scrollableContainerRef.current) {
                                scrollableContainerRef.current.scrollTop = scrollableContainerRef.current.scrollHeight;
                              }
                            }, 100);
                          }
                        }, 300); // TODO: smoother/faster animation
                      }}
                    >
                      Additional information
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 text-sm break-words overflow-hidden">
                        <p className="break-all"><span className="font-medium">Node ID:</span> {selectedNode.data.visualId}</p>
                        <p><span className="font-medium">Type:</span> {selectedNode.type || 'default'}</p>
                        <p className="break-words"><span className="font-medium">Label:</span> {selectedNode.data.label}</p>
                        <p><span className="font-medium">Position:</span> x={selectedNode.position.x.toFixed(2)}, y={selectedNode.position.y.toFixed(2)}</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p>No node selected</p>
      )}
    </>
  );
};

export default DetailsTab;