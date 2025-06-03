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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
            onChange={(e) => setValue(e.target.value)}
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
            onChange={(e) => setValue(e.target.value)}
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
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder || "Enter text"}
            className="w-full h-11 text-base"
            autoFocus
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
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