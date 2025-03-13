import './App.css';
import { Mosaic, MosaicWindow } from 'react-mosaic-component';
import '@xyflow/react/dist/style.css';
import 'react-mosaic-component/react-mosaic-component.css';
import 'react-tabs/style/react-tabs.css';

// Import modular components
import FlowContentWrapper from './components/Flow/FlowContentWrapper';
import Panel from './components/Panel/Panel';

// Import context providers
import { SelectedNodeProvider } from './context/SelectedNodeContext';
import Toolbar from './components/Toolbar/Toolbar';

// Bottom panel component
const BottomPanel: React.FC = () => (
  <div className="bottom-content">Bottom Bar</div>
);

export default function App() {
  return (
    <div id="app">
      <SelectedNodeProvider>
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
                  {id === 'middle' && <FlowContentWrapper />}
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
      </SelectedNodeProvider>
    </div>
  );
}