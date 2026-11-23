/** Remy's reply while it is still being written: a bold marker whose closing "**" hasn't arrived yet is hidden
 * (and a lone trailing "*"), so the text doesn't flash "**" before turning bold. */
export function tidyPartial(text: string): string {
  let t = text.endsWith("*") && !text.endsWith("**") ? text.slice(0, -1) : text;
  const marks = t.split("**").length - 1;
  if (marks % 2 === 1) { const i = t.lastIndexOf("**"); t = t.slice(0, i) + t.slice(i + 2); }
  return t;
}
