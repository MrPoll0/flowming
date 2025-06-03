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

interface InputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function InputDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
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
              Value
            </Label>
            <Input
              id="input-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="w-full h-11 text-base"
              autoFocus
            />
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