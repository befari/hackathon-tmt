import { create } from 'zustand';
import type { ThreatModel, Component, DataFlow, Threat } from '@superior-tmt/shared';

interface ThreatModelState {
  currentModel: ThreatModel | null;
  components: Component[];
  dataFlows: DataFlow[];
  threats: Threat[];
  loading: boolean;

  setCurrentModel: (model: ThreatModel | null) => void;
  setComponents: (components: Component[]) => void;
  setDataFlows: (flows: DataFlow[]) => void;
  setThreats: (threats: Threat[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useThreatModelStore = create<ThreatModelState>((set) => ({
  currentModel: null,
  components: [],
  dataFlows: [],
  threats: [],
  loading: false,

  setCurrentModel: (model) => set({ currentModel: model }),
  setComponents: (components) => set({ components }),
  setDataFlows: (dataFlows) => set({ dataFlows }),
  setThreats: (threats) => set({ threats }),
  setLoading: (loading) => set({ loading }),
}));
