import { createContext, useContext } from 'react';

type TakeSnapshotFn = () => void;

export const UndoRedoContext = createContext<TakeSnapshotFn>(() => {});

/** Call before any mutation to record undo state */
export const useTakeSnapshot = () => useContext(UndoRedoContext);
