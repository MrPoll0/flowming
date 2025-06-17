import React from 'react';
import { useVariables } from '../../context/VariablesContext';
import { Expression } from '../../models';
import { operators as expressionOperators } from '../../models/Expression';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import {
  DraggableExpressionElement,
  DraggablePaletteItem,
  ExpressionDropArea,
  FunctionExpressionElement,
} from '../Panel/Tabs/editors/shared/DragAndDropComponents';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
import { Label } from './label';
import { Input } from './input';
import { Button } from './button';
import { Variable } from '../../models/Variable';

interface ExpressionBuilderProps {
  expression: Expression;
  removeExpressionElement: (id: string) => void;
  addExpressionElement: (type: 'literal' | 'variable' | 'operator' | 'function', value: string) => void;
  disabled?: boolean;
  dropAreaId: string;
  excludeVariables?: (variable: Variable) => boolean;
  showPalette?: boolean;
}

const ExpressionBuilder: React.FC<ExpressionBuilderProps> = ({
  expression,
  removeExpressionElement,
  addExpressionElement,
  disabled = false,
  dropAreaId,
  excludeVariables,
  showPalette = true,
}) => {
  const { getAllVariables } = useVariables();

  // Apply variable exclusion if provided
  const variables = excludeVariables
    ? getAllVariables().filter((variable: Variable) => excludeVariables(variable))
    : getAllVariables();

  return (
    <div className="space-y-4">
      <ExpressionDropArea id={dropAreaId} disabled={disabled}>
        <SortableContext items={expression.rightSide.map((item) => item.id)} strategy={horizontalListSortingStrategy}>
          {expression.rightSide.map((element, index) =>
            element.isFunction() ? (
              <FunctionExpressionElement
                key={element.id}
                element={element}
                removeExpressionElement={removeExpressionElement}
                disabled={disabled}
              />
            ) : (
              <DraggableExpressionElement
                key={element.id}
                element={element}
                index={index}
                removeExpressionElement={removeExpressionElement}
                disabled={disabled}
              />
            )
          )}
        </SortableContext>
      </ExpressionDropArea>

      {showPalette && (
      <Tabs defaultValue="variables">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="variables">Variables</TabsTrigger>
          <TabsTrigger value="literals">Literals</TabsTrigger>
          <TabsTrigger value="operators">Operators</TabsTrigger>
          <TabsTrigger value="functions">Functions</TabsTrigger>
        </TabsList>

        <TabsContent value="variables" className="mt-4">
          <div className="flex flex-wrap gap-2">
            {variables.map((variable) => (
              <DraggablePaletteItem
                key={`var-${variable.id}`}
                id={`var-${variable.id}`}
                type="variable"
                value={variable.type === 'array' ? `${variable.name}[]` : variable.name}
                backgroundColor="#d1e7ff"
                disabled={disabled}
                onClick={() => addExpressionElement('variable', variable.id)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="literals" className="mt-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Boolean</Label>
              <div className="flex gap-1">
                <DraggablePaletteItem
                  id="lit-boolean-true" type="literal" value="true" backgroundColor="#d1ffd1" disabled={disabled}
                  onClick={() => addExpressionElement('literal', 'true')}
                />
                <DraggablePaletteItem
                  id="lit-boolean-false" type="literal" value="false" backgroundColor="#d1ffd1" disabled={disabled}
                  onClick={() => addExpressionElement('literal', 'false')}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Integer</Label>
              <div className="flex gap-1">
                <Input type="number" step="1" placeholder="Integer" id={`int-lit-input-${dropAreaId}`} className="flex-1 text-sm" disabled={disabled} />
                <Button variant="outline" size="sm" disabled={disabled}
                  onClick={() => {
                    const input = document.getElementById(`int-lit-input-${dropAreaId}`) as HTMLInputElement;
                    if (input && input.value) {
                      addExpressionElement('literal', parseInt(input.value).toString());
                      input.value = '';
                    }
                  }}>Add</Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">String</Label>
              <div className="flex gap-1">
                <Input type="text" placeholder="String" id={`str-lit-input-${dropAreaId}`} className="flex-1 text-sm" disabled={disabled} />
                <Button variant="outline" size="sm" disabled={disabled}
                  onClick={() => {
                    const input = document.getElementById(`str-lit-input-${dropAreaId}`) as HTMLInputElement;
                    if (input && input.value) {
                      addExpressionElement('literal', `"${input.value}"`);
                      input.value = '';
                    }
                  }}>Add</Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Float</Label>
              <div className="flex gap-1">
                <Input type="number" step="0.1" placeholder="Float" id={`float-lit-input-${dropAreaId}`} className="flex-1 text-sm" disabled={disabled} />
                <Button variant="outline" size="sm" disabled={disabled}
                  onClick={() => {
                    const input = document.getElementById(`float-lit-input-${dropAreaId}`) as HTMLInputElement;
                    if (input && input.value) {
                      addExpressionElement('literal', parseFloat(input.value).toString());
                      input.value = '';
                    }
                  }}>Add</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="operators" className="mt-4">
          <div className="flex flex-wrap gap-2">
            {expressionOperators.map((op) => (
              <DraggablePaletteItem
                key={`op-${op}`}
                id={`op-${op}`}
                type="operator"
                value={op}
                backgroundColor="#ffd1d1"
                disabled={disabled}
                onClick={() => addExpressionElement('operator', op)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="functions" className="mt-4">
          <div className="flex flex-wrap gap-2">
            {['integer', 'string', 'float', 'boolean'].map((func) => (
              <DraggablePaletteItem
                key={`func-${func}`}
                id={`func-${func}`}
                type="function"
                value={`${func}()`}
                backgroundColor="#d1d1ff"
                disabled={disabled}
                onClick={() => addExpressionElement('function', func)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
};

export default ExpressionBuilder; 