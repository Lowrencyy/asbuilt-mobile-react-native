/**
 * Background prefetch — runs once on app start.
 * Warms the cache for projects → nodes → poles + teardown data.
 * Non-blocking: never throws, never delays the UI.
 */
import api from "./api";
import { cacheSet } from "./cache";

async function run() {
  // 1. Fetch projects + teardown data in parallel
  const [projRes, logsRes, subsRes] = await Promise.allSettled([
    api.get("/projects"),
    api.get("/teardown-logs?per_page=500"),
    api.get("/teardown-submissions?per_page=500"),
  ]);

  if (logsRes.status === "fulfilled") {
    const d = logsRes.value.data;
    const list = Array.isArray(d) ? d : d?.data ?? [];
    await cacheSet("teardown_logs", list);
  }
  if (subsRes.status === "fulfilled") {
    const d = subsRes.value.data;
    const list = Array.isArray(d) ? d : d?.data ?? [];
    await cacheSet("teardown_submissions", list);
  }

  if (projRes.status !== "fulfilled") return;
  const projects: any[] = Array.isArray(projRes.value.data) ? projRes.value.data : [];
  await cacheSet("projects_list", projects);

  // 2. Fetch all nodes for each project in parallel
  const nodeResults = await Promise.allSettled(
    projects.map((proj) =>
      api.get(`/nodes?project_id=${proj.id}`).then(({ data }) => ({
        proj_id: proj.id,
        nodes: Array.isArray(data) ? data : data?.data ?? [],
      }))
    )
  );

  const allNodes: any[] = [];
  for (const r of nodeResults) {
    if (r.status !== "fulfilled") continue;
    const { proj_id, nodes } = r.value;
    await cacheSet(`nodes_project_${proj_id}`, nodes);
    allNodes.push(...nodes);
  }

  // 3. Fetch poles for each node in parallel
  const poleResults = await Promise.allSettled(
    allNodes.map((node) =>
      api.get(`/nodes/${node.id}/poles`).then(({ data }) => {
        const poles = Array.isArray(data) ? data : data?.data ?? [];
        cacheSet(`poles_node_${node.id}`, poles);
        return poles as any[];
      })
    )
  );

  const allPoles: any[] = [];
  for (const r of poleResults) {
    if (r.status === "fulfilled") allPoles.push(...r.value);
  }

  // 4. Fetch spans for each pole in parallel
  await Promise.allSettled(
    allPoles.map((pole) =>
      api.get(`/poles/${pole.pole_code}/spans`).then(({ data }) => {
        const spans = Array.isArray(data) ? data : data?.data ?? [];
        return cacheSet(`spans_pole_${pole.pole_code}`, spans);
      })
    )
  );
}

let _prefetchDone = false;

export function isPrefetchDone(): boolean { return _prefetchDone; }
export function markPrefetchDone(): void  { _prefetchDone = true; }
export function resetPrefetchSession(): void { _prefetchDone = false; }

export function prefetchAll(): Promise<void> {
  return run().catch(() => {});
}
