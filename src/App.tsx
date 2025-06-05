import './App.css';
import '@xyflow/react/dist/style.css';

// Import modular components
import FlowContent from './components/Flow/FlowContent';
import Panel from './components/Panel/Panel';
import ImportExport from './components/ImportExport';

// Import context providers
import { SelectedNodeProvider } from './context/SelectedNodeContext';
import { FlowInteractionProvider } from './context/FlowInteractionContext';
import { VariablesProvider } from './context/VariablesContext';
import { FilenameProvider } from './context/FilenameContext';
import { InputDialogProvider } from './context/InputDialogContext';
import { SystemSettingsProvider } from './context/SystemSettingsContext';
import { DebuggerProvider } from './context/DebuggerContext';
import Toolbar from './components/Toolbar/Toolbar';
import { ReactFlowProvider } from '@xyflow/react';
import ExecutionControl from './components/ExecutionControl';
import { DnDProvider } from './context/DnDContext';
import { FlowExecutorProvider } from './context/FlowExecutorContext';
import { CollaborationProvider } from './context/CollaborationContext';

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

function AppHeader() {
  return (
    <div className="bg-muted/50 p-4 border-b border-border flex-shrink-0 flex items-center justify-between">
      <h1 className="text-lg font-semibold">Flowming</h1>
      <ImportExport />
    </div>
  );
}

export default function App() {
  return (
    <div className="h-screen w-screen m-0 p-0 overflow-hidden bg-background text-foreground">
      <ReactFlowProvider>
        <SystemSettingsProvider>
          <DebuggerProvider>
            <CollaborationProvider>
              <FlowExecutorProvider>
                <DnDProvider>
                  <FilenameProvider>
                    <SelectedNodeProvider>
                      <FlowInteractionProvider>
                        <VariablesProvider>
                          <InputDialogProvider>
                            <div className="h-full w-full flex flex-col">
                              {/* Header */}
                              <AppHeader />
                              
                              {/* Main content area with resizable panels */}
                              <div className="flex-1">
                                <ResizablePanelGroup direction="horizontal" className="h-full">
                                  {/* Left panel - Toolbar */}
                                  <ResizablePanel defaultSize={10} minSize={0} maxSize={25}>
                                    <Toolbar />
                                  </ResizablePanel>
                                  
                                  <ResizableHandle withHandle/>
                                  
                                  {/* Middle section - Flow + Execution Control */}
                                  <ResizablePanel defaultSize={65} minSize={30}>
                                    <ResizablePanelGroup direction="vertical">
                                      <ResizablePanel defaultSize={85} minSize={60}>
                                        <FlowContent />
                                      </ResizablePanel>
                                      
                                      <ResizableHandle withHandle />
                                      
                                      <ResizablePanel defaultSize={15} minSize={0} maxSize={40}>
                                        <ExecutionControl />
                                      </ResizablePanel>
                                    </ResizablePanelGroup>
                                  </ResizablePanel>
                                  
                                  <ResizableHandle withHandle />
                                  
                                  {/* Right section - Panels */}
                                  <ResizablePanel defaultSize={35} minSize={0} maxSize={75}> {/* TODO: minSize={25} ? */}
                                    <ResizablePanelGroup direction="vertical">
                                      <ResizablePanel defaultSize={65} minSize={5}>
                                        <Panel type="top" />
                                      </ResizablePanel>
                                      
                                      <ResizableHandle withHandle />
                                      
                                      <ResizablePanel defaultSize={50} minSize={5}>
                                        <Panel type="bottom" />
                                      </ResizablePanel>
                                    </ResizablePanelGroup>
                                  </ResizablePanel>
                                </ResizablePanelGroup>
                              </div>
                            </div>
                          </InputDialogProvider>
                        </VariablesProvider>
                      </FlowInteractionProvider>
                    </SelectedNodeProvider>
                  </FilenameProvider>
                </DnDProvider>
              </FlowExecutorProvider>
            </CollaborationProvider>
          </DebuggerProvider>
        </SystemSettingsProvider>
      </ReactFlowProvider>
    </div>
  );
}