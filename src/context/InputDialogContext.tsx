import { createContext, useContext, useState, ReactNode } from 'react';
import { InputDialog } from '../components/ui/InputDialog';

interface InputDialogState {
  open: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  resolve?: (value: string | null) => void;
}

interface InputDialogContextType {
  showInputDialog: (title: string, description?: string, placeholder?: string) => Promise<string | null>;
}

const InputDialogContext = createContext<InputDialogContextType | undefined>(undefined);

export function useInputDialog() {
  const context = useContext(InputDialogContext);
  if (context === undefined) {
    throw new Error('useInputDialog must be used within an InputDialogProvider');
  }
  return context;
}

interface InputDialogProviderProps {
  children: ReactNode;
}

export function InputDialogProvider({ children }: InputDialogProviderProps) {
  const [dialogState, setDialogState] = useState<InputDialogState>({
    open: false,
    title: '',
  });

  const showInputDialog = (
    title: string,
    description?: string,
    placeholder?: string
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      setDialogState({
        open: true,
        title,
        description,
        placeholder,
        resolve,
      });
    });
  };

  const handleSubmit = (value: string) => {
    if (dialogState.resolve) {
      dialogState.resolve(value);
    }
    setDialogState(prev => ({ ...prev, open: false, resolve: undefined }));
  };

  const handleCancel = () => {
    if (dialogState.resolve) {
      dialogState.resolve(null);
    }
    setDialogState(prev => ({ ...prev, open: false, resolve: undefined }));
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && dialogState.resolve) {
      dialogState.resolve(null);
      setDialogState(prev => ({ ...prev, open: false, resolve: undefined }));
    }
  };

  return (
    <InputDialogContext.Provider value={{ showInputDialog }}>
      {children}
      <InputDialog
        open={dialogState.open}
        onOpenChange={handleOpenChange}
        title={dialogState.title}
        description={dialogState.description}
        placeholder={dialogState.placeholder}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </InputDialogContext.Provider>
  );
} 