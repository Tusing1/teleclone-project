export const GIB = 1024 ** 3;
export const STORAGE_CHANGED = 'studygram-storage-budget-changed';
export function storageBudget(accountId: string): number {
  try { return localStorage.getItem(`studygram-storage-budget:${accountId}`) === '5' ? 5 * GIB : GIB; }
  catch { return GIB; }
}
export function setStorageBudget(accountId: string, gib: 1 | 5) {
  localStorage.setItem(`studygram-storage-budget:${accountId}`, String(gib));
  window.dispatchEvent(new Event(STORAGE_CHANGED));
}
// Never evict explicit downloads. Replacing a URL counts its new size only once.
export function planCacheWrite(rows: { key: string; size: number; savedOffline?: boolean; cachedAt: number }[], key: string, size: number, budget: number) {
  const others = rows.filter(row => row.key !== key);
  if (size + others.filter(row => row.savedOffline).reduce((sum, row) => sum + row.size, 0) > budget) {
    throw new Error('Offline storage limit reached. Choose 5 GB in Settings or remove a download you no longer need.');
  }
  let total = size + others.reduce((sum, row) => sum + row.size, 0);
  const evict: string[] = [];
  for (const row of others.filter(row => !row.savedOffline).sort((a, b) => a.cachedAt - b.cachedAt)) {
    if (total <= budget) break;
    evict.push(row.key); total -= row.size;
  }
  return evict;
}
