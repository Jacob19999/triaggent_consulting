import { buildDemoData } from "./demo";

/** Insert-ready rows for the labelled demo network, with fresh ids (used by the live
 * workspace's "Load demo shelves" and by the Supabase integration test). */
export function demoInsertRows(uid: () => string, limit?: number) {
  const demo = buildDemoData();
  const picked = limit ? demo.shelves.slice(0, limit) : demo.shelves;
  const ids = new Map<string, string>();
  const shelves = picked.map((sh) => {
    const id = uid();
    ids.set(sh.id, id);
    const { created_at: _c, ...rest } = sh;
    return { ...rest, id, is_demo: true };
  });
  const reports = demo.reports
    .filter((r) => ids.has(r.shelf_id))
    .map(({ id: _id, submitted_by: _b, ...r }) => ({ ...r, shelf_id: ids.get(r.shelf_id)! }));
  const requests = demo.requests
    .filter((r) => ids.has(r.shelf_id))
    .map(({ id: _id, ...r }) => ({ ...r, shelf_id: ids.get(r.shelf_id)! }));
  return { shelves, reports, requests };
}
