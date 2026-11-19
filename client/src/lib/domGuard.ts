// Live error, Nov 14: one visitor's page crashed 20 times in a second with "Failed to execute 'removeChild' / 'insertBefore'
// on 'Node'". That's the known React problem when browser translation (Chrome "Translate this page") or an extension
// wraps or moves text nodes behind React's back: React then removes or inserts relative to a node that's no longer
// where it left it, and the whole page fails. The usual guard (facebook/react#11538): if the node isn't a child any more,
// skip that one step instead of throwing, so the page keeps working (translated text may lag a moment behind).
export function guardDomAgainstTranslators() {
  if (typeof Node !== "function" || !Node.prototype) return;
  const remove = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return remove.call(this, child) as T;
  };
  const insert = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return insert.call(this, node, null) as T;
    return insert.call(this, node, ref) as T;
  };
}
