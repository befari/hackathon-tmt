import { create } from 'zustand';
import type { ThreatModel, Diagram, Component, DataFlow, Threat } from '@hackathon-tmt/shared';

interface ThreatModelState {
  currentModel: ThreatModel | null;
  diagrams: Diagram[];
  currentDiagramId: string | null;
  components: Component[];
  dataFlows: DataFlow[];
  threats: Threat[];
  loading: boolean;

  setCurrentModel: (model: ThreatModel | null) => void;
  setDiagrams: (diagrams: Diagram[]) => void;
  setCurrentDiagramId: (id: string | null) => void;
  setComponents: (components: Component[]) => void;
  setDataFlows: (flows: DataFlow[]) => void;
  setThreats: (threats: Threat[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useThreatModelStore = create<ThreatModelState>((set) => ({
  currentModel: null,
  diagrams: [],
  currentDiagramId: null,
  components: [],
  dataFlows: [],
  threats: [],
  loading: false,

  setCurrentModel: (model) => set({ currentModel: model }),
  setDiagrams: (diagrams) => set({ diagrams }),
  setCurrentDiagramId: (currentDiagramId) => set({ currentDiagramId }),
  setComponents: (components) => set({ components }),
  setDataFlows: (dataFlows) => set({ dataFlows }),
  setThreats: (threats) => set({ threats }),
  setLoading: (loading) => set({ loading }),
}));
