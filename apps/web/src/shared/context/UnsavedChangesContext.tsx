import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface UnsavedChangesContextType {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  requestNavigate: (to: string | (() => void)) => boolean;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType>({
  isDirty: false,
  setDirty: () => {},
  requestNavigate: () => true,
});

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [isDirty, setDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const requestNavigate = useCallback(
    (to: string | (() => void)) => {
      if (isDirty) {
        setPendingAction(() => () => {
          if (typeof to === 'string') {
            navigate(to);
          } else {
            to();
          }
        });
        return false;
      }
      if (typeof to === 'string') {
        navigate(to);
      } else {
        to();
      }
      return true;
    },
    [isDirty, navigate],
  );

  const handleConfirm = useCallback(() => {
    setDirty(false);
    const action = pendingAction;
    setPendingAction(null);
    if (action) {
      action();
    }
  }, [pendingAction]);

  const handleCancel = useCallback(() => {
    setPendingAction(null);
  }, []);

  return (
    <UnsavedChangesContext.Provider value={{ isDirty, setDirty, requestNavigate }}>
      {children}
      {pendingAction ? (
        <ConfirmDialog
          title="O‘zgarishlar saqlanmagan"
          description="Boshqa bo‘limga o‘tsangiz, kiritilgan o‘zgarishlar yo‘qoladi."
          confirmLabel="O‘zgarishsiz davom etish"
          onCancel={handleCancel}
          onConfirm={handleConfirm}
        />
      ) : null}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges(isPageDirty?: boolean) {
  const context = useContext(UnsavedChangesContext);

  useEffect(() => {
    if (typeof isPageDirty === 'boolean') {
      context.setDirty(isPageDirty);
      return () => {
        context.setDirty(false);
      };
    }
  }, [isPageDirty, context]);

  return context;
}
