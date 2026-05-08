"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export interface ScatterPoint {
  id: string;
  position: [number, number];
  color?: [number, number, number, number];
  radius?: number;
  metadata?: {
    category?: string;
    title?: string;
    summary?: string;
    [key: string]: unknown;
  };
}

export interface ViewState {
  target: [number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
}

interface ScatterplotState {
  points: ScatterPoint[];
  hoveredPoint: ScatterPoint | null;
  selectedPoints: ScatterPoint[];
  viewState: ViewState;
  messageSelections: Map<string, string[]>;
  pendingSelection: string[] | null;
}

type PointClickListener = (point: ScatterPoint) => void;

interface ScatterplotContextValue {
  state: ScatterplotState;
  setPoints: (points: ScatterPoint[]) => void;
  setHoveredPoint: (point: ScatterPoint | null) => void;
  selectPoint: (point: ScatterPoint) => void;
  deselectPoint: (pointId: string) => void;
  togglePoint: (point: ScatterPoint) => void;
  clearSelection: () => void;
  setViewState: (viewState: ViewState) => void;
  getSelectedContext: () => Record<string, unknown>[];
  captureSelectionForMessage: () => void;
  associatePendingSelection: (messageId: string) => void;
  restoreMessageSelection: (messageId: string) => void;
  getMessageSelection: (messageId: string) => string[] | undefined;
  clickPoint: (point: ScatterPoint) => void;
  onPointClick: (listener: PointClickListener) => () => void;
}

const initialViewState: ViewState = {
  target: [0, 0],
  zoom: 1,
  minZoom: 0.1,
  maxZoom: 10,
};

const initialState: ScatterplotState = {
  points: [],
  hoveredPoint: null,
  selectedPoints: [],
  viewState: initialViewState,
  messageSelections: new Map(),
  pendingSelection: null,
};

const ScatterplotContext = createContext<ScatterplotContextValue | null>(null);

export function ScatterplotProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ScatterplotState>(initialState);
  const pointClickListenersRef = useRef<Set<PointClickListener>>(new Set());

  const onPointClick = useCallback((listener: PointClickListener) => {
    pointClickListenersRef.current.add(listener);
    return () => {
      pointClickListenersRef.current.delete(listener);
    };
  }, []);

  const setPoints = useCallback((points: ScatterPoint[]) => {
    setState((prev) => ({ ...prev, points }));
  }, []);

  const setHoveredPoint = useCallback((point: ScatterPoint | null) => {
    setState((prev) => ({ ...prev, hoveredPoint: point }));
  }, []);

  const selectPoint = useCallback((point: ScatterPoint) => {
    setState((prev) => ({
      ...prev,
      selectedPoints: prev.selectedPoints.some((p) => p.id === point.id)
        ? prev.selectedPoints
        : [...prev.selectedPoints, point],
    }));
  }, []);

  const deselectPoint = useCallback((pointId: string) => {
    setState((prev) => ({
      ...prev,
      selectedPoints: prev.selectedPoints.filter((p) => p.id !== pointId),
    }));
  }, []);

  const togglePoint = useCallback((point: ScatterPoint) => {
    setState((prev) => {
      const isSelected = prev.selectedPoints.some((p) => p.id === point.id);
      return {
        ...prev,
        selectedPoints: isSelected
          ? prev.selectedPoints.filter((p) => p.id !== point.id)
          : [...prev.selectedPoints, point],
      };
    });
  }, []);

  const clickPoint = useCallback((point: ScatterPoint) => {
    for (const listener of pointClickListenersRef.current) {
      listener(point);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setState((prev) => ({ ...prev, selectedPoints: [] }));
  }, []);

  const setViewState = useCallback((viewState: ViewState) => {
    setState((prev) => ({ ...prev, viewState }));
  }, []);

  const getSelectedContext = useCallback(() => {
    return state.selectedPoints.map((p) => p.metadata || {});
  }, [state.selectedPoints]);

  const captureSelectionForMessage = useCallback(() => {
    const selectedIds = state.selectedPoints.map((p) => p.id);
    if (selectedIds.length > 0) {
      setState((prev) => ({
        ...prev,
        pendingSelection: selectedIds,
        selectedPoints: [],
      }));
    }
  }, [state.selectedPoints]);

  const associatePendingSelection = useCallback((messageId: string) => {
    setState((prev) => {
      if (!prev.pendingSelection) return prev;
      const newSelections = new Map(prev.messageSelections);
      newSelections.set(messageId, prev.pendingSelection);
      return {
        ...prev,
        messageSelections: newSelections,
        pendingSelection: null,
      };
    });
  }, []);

  const restoreMessageSelection = useCallback(
    (messageId: string) => {
      const pointIds = state.messageSelections.get(messageId);
      if (!pointIds || pointIds.length === 0) return;

      const points = state.points.filter((p) => pointIds.includes(p.id));
      setState((prev) => ({ ...prev, selectedPoints: points }));
    },
    [state.messageSelections, state.points]
  );

  const getMessageSelection = useCallback(
    (messageId: string): string[] | undefined => {
      return state.messageSelections.get(messageId);
    },
    [state.messageSelections]
  );

  const value = useMemo<ScatterplotContextValue>(
    () => ({
      state,
      setPoints,
      setHoveredPoint,
      selectPoint,
      deselectPoint,
      togglePoint,
      clearSelection,
      setViewState,
      getSelectedContext,
      captureSelectionForMessage,
      associatePendingSelection,
      restoreMessageSelection,
      getMessageSelection,
      clickPoint,
      onPointClick,
    }),
    [
      state,
      setPoints,
      setHoveredPoint,
      selectPoint,
      deselectPoint,
      togglePoint,
      clearSelection,
      setViewState,
      getSelectedContext,
      captureSelectionForMessage,
      associatePendingSelection,
      restoreMessageSelection,
      getMessageSelection,
      clickPoint,
      onPointClick,
    ]
  );

  return (
    <ScatterplotContext.Provider value={value}>
      {children}
    </ScatterplotContext.Provider>
  );
}

export function useScatterplot() {
  const context = useContext(ScatterplotContext);
  if (!context) {
    throw new Error("useScatterplot must be used within a ScatterplotProvider");
  }
  return context;
}
