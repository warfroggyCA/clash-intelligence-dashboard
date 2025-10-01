export interface ElderMetricInputs {
  playerTag: string;
  name: string;
  tenureDays: number;
  isElder?: boolean;
  role?: string;
  previousScore?: number | null;
  consistency: number; // precomputed 0-100 or raw that we'll clamp
  generosity: number;
  performance: number;
}

export type ElderBand = 'promote' | 'monitor' | 'risk' | 'ineligible';

export interface ElderRecommendation {
  playerTag: string;
  name: string;
  tenureDays: number;
  consistency: number;
  generosity: number;
  performance: number;
  score: number;
  band: ElderBand;
  recommendation: string;
  failingDimensions: string[];
  notes?: string;
}

export interface ElderEvaluatorOptions {
  consecutiveThreshold?: number; // default 55
  promotionThreshold?: number;   // default 70
  monitorThreshold?: number;     // default 55
}
