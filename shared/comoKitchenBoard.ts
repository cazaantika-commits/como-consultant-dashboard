type Item = Record<string, any>;
export type KitchenBoard = { owner: Item[]; manus: Item[]; waiting: Item[]; scheduled: Item[] };
const finished = new Set(['verified', 'cancelled', 'closed']);

export function kitchenProjectLabel(item: Item, files: Item[] = []) {
  const file = files.find(f => Number(f.id) === Number(item.workFileId));
  const explicit = item.projectLabel || file?.projectLabel;
  if (explicit) return String(explicit).trim();
  if (String(file?.title || '').startsWith('المشاريع —')) return String(file?.title).split(':')[0].trim();
  if (String(file?.plotNumber || '') === '6457956') return 'ماجان لايف ستايل سنتر';
  return String(item.projectName || file?.projectName || (item.projectId ? `المشروع ${item.projectId}` : 'المشاريع')).trim();
}

/** The same project can need both owner work and Manus work; never collapse one behind the other. */
export function buildKitchenBoard(queue: Item[] = [], files: Item[] = []): KitchenBoard {
  const board: KitchenBoard = { owner: [], manus: [], waiting: [], scheduled: [] };
  const seen = new Set<string>();
  for (const topic of queue) {
    const entries = Array.isArray(topic.relatedItems) && topic.relatedItems.length ? topic.relatedItems : [topic];
    for (const raw of entries) {
      if (finished.has(raw.actionStatus) || finished.has(raw.status)) continue;
      const id = `${raw.kind}:${raw.recordId || raw.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const bucket = raw.phase === 'waiting_external' ? 'waiting'
        : raw.phase === 'scheduled' ? 'scheduled'
        : raw.ownerType === 'manus' || raw.ownerType === 'team' || ['gap', 'email', 'specialist', 'proposal'].includes(raw.kind) ? 'manus' : 'owner';
      // A saved analysis/intake suggestion is office work, not another task for the owner.
      board[bucket].push({ ...raw, projectLabel: kitchenProjectLabel(raw, files), canConfirmReceipt: raw.kind === 'action' && raw.phase === 'waiting_external' });
    }
  }
  // One intervention per actual record, while showing independent lanes in the same subject.
  const priorities: Record<string,number> = {urgent:0,important:1,normal:2};
  const rank = (item: Item) => priorities[String(item.priority)] ?? 3;
  for (const bucket of Object.values(board)) bucket.sort((a,b) => rank(a)-rank(b));
  return board;
}
