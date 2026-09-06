// Iterative traversals keep the declared node bound independent of call-stack size.
export function connectivity(nodes, edges) {
  const ids = nodes.map((node) => node.id);
  const out = new Map(ids.map((id) => [id, []]));
  const incoming = new Map(ids.map((id) => [id, []]));
  for (const edge of edges) {
    out.get(edge.source).push(edge.target);
    incoming.get(edge.target).push(edge.source);
  }
  const visited = new Set();
  const order = [];
  for (const id of ids) {
    if (visited.has(id)) continue;
    visited.add(id);
    const stack = [[id, 0]];
    while (stack.length) {
      const top = stack[stack.length - 1];
      const neighbors = out.get(top[0]);
      if (top[1] === neighbors.length) {
        order.push(top[0]);
        stack.pop();
      } else {
        const next = neighbors[top[1]++];
        if (!visited.has(next)) {
          visited.add(next);
          stack.push([next, 0]);
        }
      }
    }
  }
  const collect = (id, seen, neighbors) => {
    const queue = [id];
    seen.add(id);
    for (let i = 0; i < queue.length; i += 1) {
      for (const next of neighbors(queue[i])) if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
    return queue.length;
  };
  const strongSeen = new Set();
  let strongComponentCount = 0;
  let cyclicNodeCount = 0;
  for (const id of order.reverse()) if (!strongSeen.has(id)) {
    const count = collect(id, strongSeen, (node) => incoming.get(node));
    strongComponentCount += 1;
    if (count > 1) cyclicNodeCount += count;
  }
  const weakSeen = new Set();
  let weakComponentCount = 0;
  for (const id of ids) if (!weakSeen.has(id)) {
    collect(id, weakSeen, (node) => [...out.get(node), ...incoming.get(node)]);
    weakComponentCount += 1;
  }
  return {
    weakComponentCount, strongComponentCount, cyclicNodeCount,
    isolatedNodeCount: ids.filter((id) => out.get(id).length === 0 && incoming.get(id).length === 0).length
  };
}
