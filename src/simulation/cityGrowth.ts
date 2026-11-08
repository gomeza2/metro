export const ALL_CITY_STATIONS = ['harbor','gardens','north','museum','market','civic','east','university','stadium','heights','clinic','south','orchard','airport'] as const;
export function cityGrowthAt(elapsed: number, progressive: boolean) {
  if (!progressive) return { ids: [...ALL_CITY_STATIONS] as string[], lines: 4, nextAt: null as number | null };
  const ids = ['north','museum','market'];
  let lines = 1;
  if (elapsed >= 30) { ids.push('harbor','gardens','orchard'); lines = 2; }
  if (elapsed >= 60) { ids.push('civic','east','university','stadium'); lines = 3; }
  if (elapsed >= 150) { ids.push('clinic','south','heights','airport'); lines = 4; }
  return { ids, lines, nextAt: elapsed < 30 ? 30 : elapsed < 60 ? 60 : elapsed < 150 ? 150 : null };
}
export type TutorialStep = 'connect' | 'observe' | 'plan' | 'inspect' | 'done';
export function tutorialStep(snapshot: { connected: boolean; delivered: number; pausedOnce: boolean; inspected: boolean }): TutorialStep {
  if (!snapshot.connected) return 'connect';
  if (snapshot.delivered < 1) return 'observe';
  if (!snapshot.pausedOnce) return 'plan';
  return snapshot.inspected ? 'done' : 'inspect';
}
