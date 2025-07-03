import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

interface InputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  placeholder?: string;
  variableType: 'string' | 'integer' | 'float' | 'boolean'; // TODO: array
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function InputDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  variableType,
  onSubmit,
  onCancel,
}: InputDialogProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validation: disallow empty value except for string type
    if (variableType !== 'string' && value.trim() === '') {
      setError('Please enter a value.');
      return;
    }

    setError(null);
    onSubmit(value);
    setValue('');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setValue('');
      onCancel();
    }
    onOpenChange(newOpen);
  };

  const renderInput = () => {
    switch (variableType) {
        // TODO: array
      case 'boolean':
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger className="w-full h-11">
              <SelectValue placeholder="Select a boolean value" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">true</SelectItem>
              <SelectItem value="false">false</SelectItem>
            </SelectContent>
          </Select>
        );
      
      case 'integer':
        return (
          <Input
            id="input-value"
            type="number"
            step="1"
            value={value}
            onChange={(e) => { setValue(e.target.value); if(error) setError(null); }}
            placeholder={placeholder || "Enter an integer"}
            className="w-full h-11 text-base"
            autoFocus
          />
        );
      
      case 'float':
        return (
          <Input
            id="input-value"
            type="number"
            step="any"
            value={value}
            onChange={(e) => { setValue(e.target.value); if(error) setError(null); }}
            placeholder={placeholder || "Enter a decimal number"}
            className="w-full h-11 text-base"
            autoFocus
          />
        );
      
      case 'string':
      default:
        return (
          <Input
            id="input-value"
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); if(error) setError(null); }}
            placeholder={placeholder || "Enter text"}
            className="w-full h-11 text-base"
            autoFocus
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideCloseButton
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="input-value" className="text-sm font-medium">
              Value ({variableType})
            </Label>
            {renderInput()}
            {error && (
              <div className="flex items-center gap-1 text-destructive text-xs ml-1">
                <svg className="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}
          </div>
          
          <DialogFooter className="pt-2">
            <Button 
              type="submit" 
              className="w-full h-11 text-base font-medium"
            >
              Submit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 