import { useContext } from 'react';
import { SelectedNodeContext } from '../../../context/SelectedNodeContext';

// Component for Details tab that uses the context
const DetailsTab = () => {
    const { selectedNode } = useContext(SelectedNodeContext);
    
    // TODO: dynamic display of node data properties (need to wrap this with ReactFlowProvider? https://reactflow.dev/learn/troubleshooting#001)
    return (
      <>
        <h3>Detalles</h3>
        {selectedNode ? (
          <div>
            <p>ID del nodo seleccionado: <strong>{selectedNode.id}</strong></p>
            <p>Tipo: {selectedNode.type || 'default'}</p>
            <p>Etiqueta: {selectedNode.data.label}</p>
            <p>Posición: x={selectedNode.position.x.toFixed(2)}, y={selectedNode.position.y.toFixed(2)}</p>
            {/* Display additional data properties if they exist */}
            {Object.entries(selectedNode.data)
              .filter(([key]) => key !== 'label')
              .map(([key, value]) => (
                <p key={key}>{key}: {JSON.stringify(value)}</p>
              ))
            }
          </div>
        ) : (
          <p>No hay ningún nodo seleccionado</p>
        )}
      </>
    );
};

export default DetailsTab;