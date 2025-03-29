import './App.css';
import { Mosaic, MosaicWindow } from 'react-mosaic-component';
import '@xyflow/react/dist/style.css';
import 'react-mosaic-component/react-mosaic-component.css';
import 'react-tabs/style/react-tabs.css';

// Import modular components
import FlowContent from './components/Flow/FlowContent';
import Panel from './components/Panel/Panel';

// Import context providers
import { SelectedNodeProvider } from './context/SelectedNodeContext';
import { FlowInteractionProvider } from './context/FlowInteractionContext';
import { VariablesProvider } from './context/VariablesContext';
import Toolbar from './components/Toolbar/Toolbar';
import { ReactFlowProvider } from '@xyflow/react';

// Bottom panel component
const BottomPanel: React.FC = () => (
  <div className="bottom-content">Bottom Bar</div>
);

export default function App() {
  return (
    <div id="app">
      <ReactFlowProvider>
        <SelectedNodeProvider>
          <FlowInteractionProvider>
            <VariablesProvider>
              <div className="layout">
                <div className="top-bar">
                  Top Bar
                </div>
                <div className="main-content">
                  <Mosaic<string>
                    renderTile={(id, path) => (
                      <MosaicWindow<string>
                        path={path}
                        title=""
                        draggable={false}
                        toolbarControls={[]}
                      >
                        {id === 'left' && <Toolbar />}
                        {id === 'middle' && <FlowContent />}
                        {id === 'bottom' && <BottomPanel />}
                        {id === 'right-top' && <Panel type="top" />}
                        {id === 'right-bottom' && <Panel type="bottom" />}
                      </MosaicWindow>
                    )}
                    resize={{ minimumPaneSizePercentage: 5 }}
                    initialValue={{
                      direction: 'row',
                      first: {
                        direction: 'row',
                        first: 'left',
                        second: {
                          direction: 'column',
                          first: 'middle',
                          second: 'bottom',
                          splitPercentage: 90,
                        },
                        splitPercentage: 10,
                      },
                      second: {
                        direction: 'column',
                        first: 'right-top',
                        second: 'right-bottom',
                        splitPercentage: 50,
                      },
                      splitPercentage: 65,
                    }}
                  />
                </div>
              </div>
            </VariablesProvider>
          </FlowInteractionProvider>
        </SelectedNodeProvider>
      </ReactFlowProvider>
    </div>
  );
}