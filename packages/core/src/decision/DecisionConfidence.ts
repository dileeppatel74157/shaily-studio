export interface DecisionConfidence {
  readonly score: number;
  readonly dataDensity: number;
  readonly riskBuffer: number;
  readonly explanation: string;
}
