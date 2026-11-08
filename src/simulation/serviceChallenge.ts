export const CHALLENGE_DURATION = 320;
export type ChallengeSnapshot = { elapsed: number; score: number; coverage: number; grants: number };
export function serviceChallengeStatus(snapshot: ChallengeSnapshot) {
  const goals = [
    { label: 'Deliver 30 passengers', current: snapshot.score, target: 30 },
    { label: 'Connect 8 stations in one network', current: snapshot.coverage, target: 8 },
    { label: 'Complete 2 city grants', current: snapshot.grants, target: 2 },
  ];
  const remaining = Math.max(0, CHALLENGE_DURATION - snapshot.elapsed);
  // Deadlines are exclusive, matching city grants. All goals must hold together.
  const outcome = remaining === 0 ? 'lost' : goals.every(goal => goal.current >= goal.target) ? 'won' : 'running';
  return { goals, remaining, outcome } as const;
}
