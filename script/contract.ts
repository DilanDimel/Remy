// Frontend ↔ backend contract check. Static: no server needed.
// Every api()/download() call in client/src must hit a route registered in
// server/routes.ts with the same method, and every save("section") must be a
// section PUT /api/ws/:section accepts. Field shapes are covered by `npm run check`
// (client and server share shared/types.ts).
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const routesSrc = fs.readFileSync(path.join(root, "server/routes.ts"), "utf8");

type Route = { method: string; path: string; re: RegExp };
const routes: Route[] = [...routesSrc.matchAll(/app\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)].map((m) => ({
  method: m[1].toUpperCase(),
  path: m[2],
  re: new RegExp("^" + m[2].replace(/\./g, "\\.").replace(/:[A-Za-z]+/g, "[^/]+") + "$"),
}));
const sectionsMatch = routesSrc.match(/const SECTIONS = \[([^\]]+)\]/);
if (!routes.length || !sectionsMatch) {
  console.error("contract: could not read routes or SECTIONS from server/routes.ts — update script/contract.ts");
  process.exit(1);
}
const sections = [...sectionsMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

type Call = { file: string; line: number; method: string; url: string };
const calls: Call[] = [];
const saves: { file: string; line: number; section: string }[] = [];
const unparsed: { file: string; line: number; text: string }[] = [];

for (const file of walk(path.join(root, "client/src"))) {
  const rel = path.relative(root, file);
  fs.readFileSync(file, "utf8").split("\n").forEach((text, i) => {
    const line = i + 1;
    let found = false;
    for (const m of text.matchAll(/\bapi(?:<[^()]*?>)?\(\s*"([A-Z]+)",\s*(["`])(\/api[^"`]*)\2/g)) {
      calls.push({ file: rel, line, method: m[1], url: m[3] });
      found = true;
    }
    for (const m of text.matchAll(/\bdownload\(\s*(["`])(\/api[^"`]*)\1/g)) {
      calls.push({ file: rel, line, method: "GET", url: m[2] });
      found = true;
    }
    for (const m of text.matchAll(/\bsave\(\s*"([A-Za-z]+)"/g)) saves.push({ file: rel, line, section: m[1] });
    // A call whose URL isn't a literal can't be checked; flag it so it gets a look.
    if (!found && /\b(api(?:<[^()]*?>)?|download)\(/.test(text) && !/export async function (api|download)/.test(text) && !/\/api\/ws\/\$\{section\}/.test(text))
      unparsed.push({ file: rel, line, text: text.trim().slice(0, 120) });
  });
}

// An effect must return nothing or a cleanup function. `useEffect(() => expr, …)`
// returns expr's value, and newer browsers return Promises from methods like
// scrollIntoView(); React then calls that Promise as a cleanup and the screen blanks.
const effectErrors: string[] = [];
for (const file of walk(path.join(root, "client/src"))) {
  const rel = path.relative(root, file);
  fs.readFileSync(file, "utf8").split("\n").forEach((text, i) => {
    if (/useEffect\(\s*\(\)\s*=>\s*(?![{(\s]|$)/.test(text) && !/useEffect\(\s*\(\)\s*=>\s*\(\)\s*=>/.test(text))
      effectErrors.push(`${rel}:${i + 1}  useEffect(() => expression) — wrap the body in { } so the effect returns nothing`);
  });
}

const normalize = (url: string) => url.split("?")[0].replace(/\$\{[^}]+\}/g, "x");
const errors: string[] = [];
const used = new Set<Route>();
for (const c of calls) {
  const p = normalize(c.url);
  const hit = routes.find((r) => r.method === c.method && r.re.test(p));
  if (hit) used.add(hit);
  else {
    const other = routes.filter((r) => r.re.test(p)).map((r) => r.method);
    errors.push(`${c.file}:${c.line}  ${c.method} ${c.url}  →  ${other.length ? `route exists only as ${other.join("/")}` : "no such route on the server"}`);
  }
}
for (const s of saves)
  if (!sections.includes(s.section)) errors.push(`${s.file}:${s.line}  save("${s.section}")  →  PUT /api/ws/${s.section} is rejected; allowed sections: ${sections.join(", ")}`);
if (saves.length) used.add(routes.find((r) => r.path === "/api/ws/:section")!);

console.log(`contract: ${calls.length} API calls and ${saves.length} section saves in client/src, ${routes.length} server routes`);
for (const u of unparsed) console.log(`  note: non-literal URL, not checked — ${u.file}:${u.line}  ${u.text}`);
const unusedRoutes = routes.filter((r) => !used.has(r));
if (unusedRoutes.length) console.log(`  info: server routes the client never calls: ${unusedRoutes.map((r) => `${r.method} ${r.path}`).join(", ")}`);
errors.push(...effectErrors);

// One colour set (design council, Nov 21, 2026): a raw colour (#abc / #aabbcc) outside a token definition
// (--name: #...) in index.css, or in a page's code, must already be on script/color-allowlist.json. New colours
// go in as tokens in index.css :root, so the palette can't drift back to 100+ one-offs.
{
  const allow = new Set<string>(JSON.parse(fs.readFileSync(path.join(root, "script/color-allowlist.json"), "utf8")).colors);
  // Comments are blanked (newlines kept, so line numbers stay right) so "/* note */ --x: #fff" still reads as a definition.
  const cssSrc = fs.readFileSync(path.join(root, "client/src/index.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  const found: { where: string; color: string }[] = [];
  let line = 1;
  for (const piece of cssSrc.split(/([;{}])/)) {
    if (!/^\s*--[\w-]+\s*:/.test(piece)) for (const m of piece.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) found.push({ where: `client/src/index.css:${line + (piece.slice(0, m.index).match(/\n/g)?.length || 0)}`, color: m[0].toLowerCase() });
    line += piece.match(/\n/g)?.length || 0;
  }
  for (const f of walk(path.join(root, "client/src")).filter((f) => f.endsWith(".tsx") && !f.includes("/components/ui/"))) {
    fs.readFileSync(f, "utf8").split("\n").forEach((text, i) => {
      for (const m of text.matchAll(/(?<=["'`])#[0-9a-fA-F]{3,8}\b/g)) found.push({ where: `${path.relative(root, f)}:${i + 1}`, color: m[0].toLowerCase() });
    });
  }
  for (const f of found) if (!allow.has(f.color)) errors.push(`${f.where}  new raw colour ${f.color}: use a token from client/src/index.css :root (e.g. var(--stage), var(--fox)) instead`);
}
if (errors.length) {
  console.error(`\ncontract FAILED (${errors.length}):`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log("contract OK");
