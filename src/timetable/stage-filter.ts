/** The URL keeps the selected stages, so that the selection stays when the user changes the day. */
export const STAGE_PARAM = 'stage';

/**
 * The selected stage ids, in the order of `stageIds`.
 * `stageIds` are all the stages of the festival, so the selection keeps a stage with no sets on this day.
 * The function ignores an id that is not in `stageIds`. An empty list selects all stages.
 */
export function readStageSelection(search: string, stageIds: string[]): string[] {
  const selected = new Set(new URLSearchParams(search).getAll(STAGE_PARAM));
  return stageIds.filter((id) => selected.has(id));
}

/** The selected stages that have sets on the day. An empty list shows all stages of the day. */
export function daySelection(selection: string[], dayStageIds: string[]): string[] {
  return selection.filter((id) => dayStageIds.includes(id));
}

/** Adds the stage to the selection or removes it from the selection. */
export function toggleStage(selection: string[], stageId: string, stageIds: string[]): string[] {
  const selected = new Set(selection);
  if (selected.has(stageId)) selected.delete(stageId);
  else selected.add(stageId);
  return stageIds.filter((id) => selected.has(id));
}

export function isStageShown(selection: string[], stageId: string): boolean {
  return selection.length === 0 || selection.includes(stageId);
}

/** Puts the selection in the URL and keeps the other parts of the URL. */
export function withStageSelection(url: URL, selection: string[]): URL {
  const result = new URL(url);
  result.searchParams.delete(STAGE_PARAM);
  for (const id of selection) result.searchParams.append(STAGE_PARAM, id);
  return result;
}
