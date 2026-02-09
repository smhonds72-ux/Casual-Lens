
export type AppView = 'dashboard' | 'lab' | 'playground' | 'process' | 'connect';

export interface Overlay {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface CausalEvent {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  importance: number;
  x?: number; // Normalized x coordinate (0-1)
  y?: number; // Normalized y coordinate (0-1)
  zScore?: number; // For anomaly detection
}

export interface CausalLink {
  id: string;
  cause_event_id: string;
  effect_event_id: string;
  explanation: string;
  confidence: number;
}

export interface Anomaly {
  id: string;
  message: string;
  timestamp: string;
  severity: 'low' | 'high';
}

export interface LabMetric {
  trialId: string;
  variable: string;
  value: string;
  outcome: string;
  confidence: number;
}

export interface GameMetric {
  score: number;
  length: number;
  creativity: number;
  efficiency: number;
}

export interface ProcessMetric {
  cycleTime: string;
  defectRate: string;
  efficiency: string;
  safetyAlert: string;
  roiSavings?: string;
}

export interface CausalAnalysisResponse {
  overlays: Overlay[];
  events: CausalEvent[];
  causal_links: CausalLink[];
  summary: string;
  anomalies?: Anomaly[];
  lab_data?: LabMetric;
  game_data?: GameMetric;
  process_data?: ProcessMetric;
}

export interface SessionRecord {
  id: string;
  startTime: string;
  mode: AppView;
  eventCount: number;
  accuracy: string;
}
