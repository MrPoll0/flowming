import React, { useState, useRef } from 'react';
import { useSystemSettings } from '../context/SystemSettingsContext';
import { useFlowExecutorState } from '../context/FlowExecutorContext';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Reusable WIP Badge Component
const WIPBadge: React.FC = () => (
  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full border">
    WIP
  </span>
);

// Reusable Setting Row Component
const SettingRow: React.FC<{
  label: string;
  children: React.ReactNode;
  showWIP?: boolean;
  tooltip?: React.ReactNode;
  htmlFor?: string;
}> = ({ label, children, showWIP = false, tooltip, htmlFor }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {showWIP && <WIPBadge />}
      {tooltip && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
    <div className="flex items-center space-x-2">
      {children}
    </div>
  </div>
);

const SystemSettings: React.FC = () => {
  const { settings, updateSetting } = useSystemSettings();
  const { isRunning } = useFlowExecutorState();

  const executionSpeedOptions = [
    { value: 500, label: 'Very Fast (0.5s)' },
    { value: 1000, label: 'Fast (1s)' },
    { value: 2000, label: 'Normal (2s)' },
    { value: 3000, label: 'Slow (3s)' },
    { value: 5000, label: 'Very Slow (5s)' },
  ];

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español', disabled: true }
  ];

  const typingModeOptions = [
    { value: 'strongly-typed', label: 'Strongly Typed' },
    { value: 'weakly-typed', label: 'Weakly Typed' },
  ];

  const handleColorChange = (type: 'background' | 'text', color: string) => {
    if (type === 'background') {
      updateSetting('backgroundColor', color);
    } else {
      updateSetting('textColor', color);
    }
  };

  const ColorPicker: React.FC<{ 
    value: string; 
    onChange: (color: string) => void;
    type: 'background' | 'text';
  }> = ({ value, onChange, type }) => {
    const [localCustomColor, setLocalCustomColor] = useState(value);
    const prevValueRef = useRef(value);

    if (value !== prevValueRef.current) {
      setLocalCustomColor(value);
      prevValueRef.current = value;
    }

    const presetColors = [
      '#ffffff', '#f8f9fa', '#e9ecef', '#dee2e6', '#ced4da', '#adb5bd',
      '#6c757d', '#495057', '#343a40', '#212529', '#000000',
      '#d1ecf1', '#b8daff', '#c3e6cb', '#ffeaa7', '#fab1a0', '#fd79a8',
      '#e17055', '#a29bfe', '#6c5ce7', '#00b894', '#00cec9'
    ];

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className="w-8 h-8 p-0 border-2"
            style={{ backgroundColor: value }}
            disabled={true}
          />
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Choose Color</Label>
            <div className="grid grid-cols-6 gap-2">
              {presetColors.map((color) => (
                <button
                  key={color}
                  className="w-8 h-8 rounded border-2 border-gray-300 hover:border-gray-500 transition-colors"
                  style={{ backgroundColor: color }}
                  onClick={() => onChange(color)}
                />
              ))}
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor={`custom-color-${type}`} className="text-sm">Custom:</Label>
              <input
                id={`custom-color-${type}`}
                type="color"
                value={localCustomColor}
                onChange={(e) => setLocalCustomColor(e.target.value)}
                onBlur={() => onChange(localCustomColor)}
                className="w-12 h-8 border rounded cursor-pointer"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="p-4 space-y-6">
      <div className="border-b pb-2">
        <h2 className="text-lg font-semibold">System Settings</h2>
      </div>

      <div className="space-y-4">
        {/* Language Setting */}
        <SettingRow 
          label="Language" 
          showWIP={true}
          htmlFor="language"
        >
          <Select 
            value={settings.language} 
            onValueChange={(value) => updateSetting('language', value)}
            disabled={isRunning}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languageOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        {/* Background Color Setting */}
        <SettingRow 
          label="Background Color" 
          showWIP={true}
        >
          <ColorPicker 
            value={settings.backgroundColor}
            onChange={(color) => handleColorChange('background', color)}
            type="background"
          />
        </SettingRow>

        {/* Text Color Setting */}
        <SettingRow 
          label="Text Color" 
          showWIP={true}
        >
          <ColorPicker 
            value={settings.textColor}
            onChange={(color) => handleColorChange('text', color)}
            type="text"
          />
        </SettingRow>

        {/* Typing Mode Setting */}
        <SettingRow 
          label="Typing" 
          showWIP={true}
          tooltip={
            <div className="text-sm max-w-xs">
              <p className="font-medium">Strongly Typed:</p>
              <p>Type checking is enforced.</p>
              <br />
              <p className="font-medium">Weakly Typed:</p>
              <p>Type checking is not enforced and there are implicit type conversions.</p>
            </div>
          }
        >
          <Select 
            value={settings.typingMode} 
            onValueChange={(value: 'strongly-typed' | 'weakly-typed') => updateSetting('typingMode', value)}
            disabled={isRunning}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typingModeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={option.value === 'weakly-typed'}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        {/* Execution Speed Setting */}
        <SettingRow 
          label="Execution Speed"
          tooltip={
            <div className="text-sm max-w-xs">
              <p>Controls how fast the flow execution moves between nodes.</p>
              <p>Slower speeds are better for learning and debugging.</p>
            </div>
          }
        >
          <Select 
            value={settings.executionSpeed.toString()} 
            onValueChange={(value) => updateSetting('executionSpeed', parseInt(value))}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {executionSpeedOptions.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </div>
    </div>
  );
};

export default React.memo(SystemSettings); 