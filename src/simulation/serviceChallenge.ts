export const CHALLENGE_DURATION = 320;
export type ChallengeSnapshot = { elapsed: number; score: number; coverage: number; grants: number };
export function serviceChallengeStatus(snapshot: ChallengeSnapshot) {
  const goals = [
    { label: 'Transporta 30 personas', current: snapshot.score, target: 30 },
    { label: 'Conecta 8 estaciones en una red', current: snapshot.coverage, target: 8 },
    { label: 'Completa 2 contratos', current: snapshot.grants, target: 2 },
  ];
  const remaining = Math.max(0, CHALLENGE_DURATION - snapshot.elapsed);
  // Deadlines are exclusive, matching city grants. All goals must hold together.
  const outcome = remaining === 0 ? 'lost' : goals.every(goal => goal.current >= goal.target) ? 'won' : 'running';
  return { goals, remaining, outcome } as const;
}
