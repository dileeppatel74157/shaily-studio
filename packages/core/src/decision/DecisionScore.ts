export interface DecisionScore {
  readonly alignment: number;
  readonly feasibility: number;
  readonly efficiency: number;
  readonly riskImpact: number;
  readonly overall: number;
}
