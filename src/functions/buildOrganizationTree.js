import { stratify, tree } from "d3-hierarchy";

const ROOT_ID = "__root__";
const NODE_WIDTH = 260;
const NODE_HEIGHT = 160;

/**
 * Resolves an employee's parent for stratify(), promoting to the synthetic
 * root whenever manager_id doesn't point to a real node in this list OR
 * doing so would create a cycle. d3.stratify() throws on any cycle rather
 * than breaking it -- and real employees data does contain cycles: the most
 * common case is someone's manager_id pointing at their own id ("I have no
 * manager" recorded as a self-reference instead of null), but a multi-hop
 * cycle (A reports to B who -- directly or transitively -- reports back to
 * A) is a real possibility in hand-maintained org data too, so this walks
 * the full proposed ancestor chain rather than only checking the immediate
 * parent.
 */
function resolveParentId(employee, employeesById, idSet) {
  if (!employee.manager_id || !idSet.has(employee.manager_id)) {
    return ROOT_ID;
  }

  const seen = new Set([employee.id]);
  let current = employeesById.get(employee.manager_id);
  while (current) {
    if (seen.has(current.id)) {
      return ROOT_ID;
    }
    seen.add(current.id);
    if (!current.manager_id || !idSet.has(current.manager_id)) break;
    current = employeesById.get(current.manager_id);
  }

  return employee.manager_id;
}

/**
 * Builds React Flow nodes/edges for an org chart from a flat list of
 * employees, each carrying its own manager_id. An employee whose manager_id
 * doesn't resolve to another employee in the same list (no manager, a
 * manager filtered out for not being Active, or a cyclical reporting line --
 * see resolveParentId above) is promoted to a root under a synthetic
 * super-root, so stratify() always sees one connected, acyclic tree and no
 * employee is ever silently dropped or crashes the page.
 *
 * NOT YET IMPLEMENTED -- designated hierarchy levels (documented here for
 * whenever this is picked up, not built yet): today `d.y` below is pure
 * reporting-line depth from d3.tree(), which conflates "how many hops from
 * the top" with organizational seniority -- e.g. a PA reporting directly to
 * the GEC would render on the same row as the GEC's actual deputy, since
 * both are one hop away. The fix, once `employees` gains an HR-settable
 * `hierarchy_level` column (plain integer vs. a lookup table mirroring
 * employment_status/employment_type is an open decision for that pass, not
 * settled here):
 *   - Change the position assignment below to
 *     `y: (employee.hierarchy_level ?? d.depth) * NODE_HEIGHT` -- explicit
 *     level wins when HR has set one, falls back to computed depth
 *     otherwise, so the chart renders correctly with zero data entry the
 *     moment the column exists and only diverges for people HR has
 *     explicitly re-leveled.
 *   - Keep `d.x` untouched -- only Y changes, so d3.tree()'s sibling-spacing
 *     stays valid. Edges still connect actual manager_id pairs regardless of
 *     level gap (a GEC-to-PA edge would then visibly span multiple rows).
 *   - EmployeeNode should show a "Level N" badge only when hierarchy_level
 *     is explicitly set, never for the depth-fallback case, so it never
 *     implies a designation HR hasn't actually made.
 *   - Accepted limitation: two people explicitly set to the same level from
 *     different branches will still land far apart horizontally (X stays
 *     tree-structure-derived, not level-grouped) -- a full "cluster by
 *     level" layout is a materially harder problem than this fix.
 */
export function buildOrganizationTree(employees, currentUserId = null) {
  if (!employees || employees.length === 0) {
    return { nodes: [], edges: [] };
  }

  const idSet = new Set(employees.map((e) => e.id));
  const employeesById = new Map(employees.map((e) => [e.id, e]));

  const stratifyInput = [
    { id: ROOT_ID, parentId: null, employee: null },
    ...employees.map((e) => ({
      id: e.id,
      parentId: resolveParentId(e, employeesById, idSet),
      employee: e,
    })),
  ];

  const root = stratify()
    .id((d) => d.id)
    .parentId((d) => d.parentId)(stratifyInput);

  tree().nodeSize([NODE_WIDTH, NODE_HEIGHT])(root);

  const nodes = [];
  const edges = [];

  root.each((d) => {
    if (d.id === ROOT_ID) return;

    const employee = d.data.employee;
    const manager =
      d.parent && d.parent.id !== ROOT_ID ? d.parent.data.employee : null;

    nodes.push({
      id: employee.id,
      type: "employee",
      position: { x: d.x, y: d.y },
      // Nodes are position-fixed for now -- mutation-by-drag is an explicit
      // follow-up decision, not built in this pass (see plan).
      draggable: false,
      data: {
        employee,
        isCrossDepartment: Boolean(
          manager && employee.department_id !== manager.department_id,
        ),
        isCurrentUser: currentUserId != null && employee.id === currentUserId,
      },
    });

    if (manager) {
      edges.push({
        id: `${manager.id}->${employee.id}`,
        source: manager.id,
        target: employee.id,
        type: "smoothstep",
      });
    }
  });

  return { nodes, edges };
}

/**
 * Manager filter = subtree extraction: the manager plus every descendant,
 * recursively. Unambiguous regardless of department, unlike the department
 * filter below. Returns null (no restriction) when managerId is falsy.
 */
export function getManagerSubtreeIds(employees, managerId) {
  if (!managerId) return null;

  const childIdsByManager = new Map();
  employees.forEach((e) => {
    if (!e.manager_id) return;
    if (!childIdsByManager.has(e.manager_id)) {
      childIdsByManager.set(e.manager_id, []);
    }
    childIdsByManager.get(e.manager_id).push(e.id);
  });

  const subtreeIds = new Set([managerId]);
  const queue = [managerId];
  while (queue.length > 0) {
    const currentId = queue.shift();
    (childIdsByManager.get(currentId) || []).forEach((childId) => {
      if (!subtreeIds.has(childId)) {
        subtreeIds.add(childId);
        queue.push(childId);
      }
    });
  }
  return subtreeIds;
}

/**
 * Department filter = highlight, not remove: shows which employees match
 * the selected department AND keeps their full ancestor chain (whatever
 * department those managers are actually in) so a cross-department
 * reporting line stays traceable instead of being severed. Returns null (no
 * restriction, nothing dimmed) when departmentId is falsy.
 */
export function getDepartmentHighlightIds(employees, departmentId) {
  if (!departmentId) return null;

  const employeesById = new Map(employees.map((e) => [e.id, e]));
  const highlightIds = new Set();

  employees.forEach((e) => {
    if (String(e.department_id) !== String(departmentId)) return;

    highlightIds.add(e.id);

    let current = e;
    const seen = new Set();
    while (current?.manager_id && !seen.has(current.manager_id)) {
      seen.add(current.manager_id);
      highlightIds.add(current.manager_id);
      current = employeesById.get(current.manager_id);
    }
  });

  return highlightIds;
}
