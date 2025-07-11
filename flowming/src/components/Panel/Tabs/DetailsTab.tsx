import { useContext, useRef } from 'react';
import { SelectedNodeContext } from '../../../context/SelectedNodeContext';
import { useReactFlow } from '@xyflow/react';
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
import SystemSettings from '../../SystemSettings';

// TODO: if cannot select element while running, then also hide its editor in DetailsTab for consistency (i prefer being able to select elements while running and see their values but not modify them)

// TODO: proper expression reset depending on type (null, leftside undefined, empty array, etc)

const DetailsTab = () => {
  const { selectedNode } = useContext(SelectedNodeContext);
  const reactFlowInstance = useReactFlow();
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
            
            {/* Start Node Information */}
            {selectedNode.type === 'Start' && (
              <div className="p-4 mx-4 mt-4 bg-blue-50 border border-blue-200 rounded-md">
                <h3 className="text-blue-800 font-medium mb-2">Start Block</h3>
                <ul className="text-blue-700 text-sm space-y-1 list-disc list-inside">
                  <li>This block is the starting point of the diagram flow.</li>
                  <li>There can only be one Start block in the diagram.</li>
                  <li>This block only admits outgoing connections.</li>
                  <li>This block must exist for the execution to be able to start, and it will do so from here.</li>
                </ul>
              </div>
            )}
            
            {/* End Node Information */}
            {selectedNode.type === 'End' && (
              <div className="p-4 mx-4 mt-4 bg-gray-50 border border-gray-200 rounded-md">
                <h3 className="text-gray-800 font-medium mb-2">End Block</h3>
                <ul className="text-gray-700 text-sm space-y-1 list-disc list-inside">
                  <li>This block indicates an ending point of the diagram flow.</li>
                  <li>This is an optional block: you can have zero or multiple End blocks.</li>
                  <li>This block only admits incoming connections.</li>
                </ul>
              </div>
            )}
            
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
                        <p><span className="font-medium">Position:</span> x={selectedNode.position.x.toFixed(2)}, y={selectedNode.position.y.toFixed(2)}</p>
                        
                        {/* Connection information */}
                        <p><span className="font-medium">Connections:</span> {(() => {
                          const connections = reactFlowInstance.getNodeConnections({ nodeId: selectedNode.id });
                          const incoming = connections.filter((c: any) => c.target === selectedNode.id).length;
                          const outgoing = connections.filter((c: any) => c.source === selectedNode.id).length;
                          return `${incoming} incoming, ${outgoing} outgoing`;
                        })()}</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="h-full overflow-y-auto overflow-x-hidden">
          <SystemSettings />
        </div>
      )}
    </>
  );
};

export default DetailsTab;