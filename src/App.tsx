import './App.css';
import { ReactFlow, Controls, Background } from '@xyflow/react';
import { Mosaic, MosaicWindow } from 'react-mosaic-component';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import '@xyflow/react/dist/style.css';
import 'react-mosaic-component/react-mosaic-component.css';
import 'react-tabs/style/react-tabs.css';

const initialNodes = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: '1' } },
  { id: '2', position: { x: 0, y: 100 }, data: { label: '2' } },
];
const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

const RightWindowContent = ({ title }: { title: string }) => (
  <Tabs>
    <TabList>
      <Tab>Tab 1</Tab>
      <Tab>Tab 2</Tab>
    </TabList>
    <TabPanel>
      <h3>{title} - Content 1</h3>
    </TabPanel>
    <TabPanel>
      <h3>{title} - Content 2</h3>
    </TabPanel>
  </Tabs>
);

const FlowContent = () => (
  <ReactFlow
    nodes={initialNodes}
    edges={initialEdges}
    fitView
    proOptions={{ hideAttribution: true }}
  >
    <Controls />
    <Background variant="lines" gap={12} size={1} />
  </ReactFlow>
);

export default function App() {
  return (
    <div id="app">
      <div className="layout">
        <div className="top-bar">Top Bar</div>
        <div className="main-content">
          <Mosaic<string>
            renderTile={(id, path) => (
              <MosaicWindow<string>
                path={path}
                title=""
                draggable={false}
                toolbarControls={[]}
              >
                {id === 'left' && <div className="left-content">Left Bar</div>}
                {id === 'middle' && <FlowContent />}
                {id === 'bottom' && <div className="bottom-content">Bottom Bar</div>}
                {id === 'right-top' && <RightWindowContent title="Top" />}
                {id === 'right-bottom' && <RightWindowContent title="Bottom" />}
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
    </div>
  );
}