'use client';

import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react';

type Listener = () => void;

function createStore() {
  let labels: Record<string, string> = {};
  const listeners = new Set<Listener>();
  return {
    getSnapshot: () => labels,
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setLabel: (id: string, label: string) => {
      if (labels[id] === label) return;
      labels = { ...labels, [id]: label };
      listeners.forEach((listener) => listener());
    },
  };
}

type BreadcrumbStore = ReturnType<typeof createStore>;

const BreadcrumbStoreContext = createContext<BreadcrumbStore | null>(null);
const emptyBreadcrumbLabels: Record<string, string> = {};
const getEmptyBreadcrumbLabels = () => emptyBreadcrumbLabels;

/** Wraps the dashboard layout so any page below it can register a friendly
 * breadcrumb label for the dynamic id segment in the current URL. */
export function BreadcrumbLabelProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<BreadcrumbStore | null>(null);
  if (!storeRef.current) storeRef.current = createStore();
  return (
    <BreadcrumbStoreContext.Provider value={storeRef.current}>
      {children}
    </BreadcrumbStoreContext.Provider>
  );
}

/** Used by Topbar to read the current id → label map. */
export function useBreadcrumbLabels(): Record<string, string> {
  const store = useContext(BreadcrumbStoreContext);
  return useSyncExternalStore(
    store ? store.subscribe : () => () => {},
    store ? store.getSnapshot : getEmptyBreadcrumbLabels,
    getEmptyBreadcrumbLabels,
  );
}

/** Call from a detail page (e.g. chit group, loan, customer) to register a
 * human-readable name for the current record's id, so the topbar breadcrumb
 * shows the name instead of the raw database id. */
export function useRegisterBreadcrumbLabel(id: string | undefined | null, label: string | undefined | null) {
  const store = useContext(BreadcrumbStoreContext);
  useEffect(() => {
    if (!store || !id || !label) return;
    store.setLabel(id, label);
  }, [store, id, label]);
}
