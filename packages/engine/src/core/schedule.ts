import { phaseRank, type SystemPhase } from "./Component";

export type Schedulable = {
  phase: SystemPhase;
  order: number;
  sequence: number;
};

export const compareComponents = (a: Schedulable, b: Schedulable): number =>
  phaseRank(a.phase) - phaseRank(b.phase) || a.order - b.order || a.sequence - b.sequence;

export const sortByPhase = <T extends Schedulable>(items: readonly T[]): T[] => items.slice().sort(compareComponents);

export const groupByPhase = <T extends Schedulable>(items: readonly T[]): Map<SystemPhase, T[]> => {
  const groups = new Map<SystemPhase, T[]>();
  for (const item of sortByPhase(items)) {
    const bucket = groups.get(item.phase);
    if (bucket) bucket.push(item);
    else groups.set(item.phase, [item]);
  }
  return groups;
};
