import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
interface Token {
  value: string;
  offset: number;
}
export interface UnsafeSql {
  line: number;
  statement: string;
}
/** A lexical guard, not a PostgreSQL parser. See AGENTS SQL rules for limits. */
function tokens(sql: string, base = 0): Token[] {
  const result: Token[] = [];
  let i = 0;
  while (i < sql.length) {
    if (/\s/.test(sql[i])) {
      i++;
      continue;
    }
    if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i + 2);
      i = end < 0 ? sql.length : end;
      continue;
    }
    if (sql.startsWith("/*", i)) {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth) {
        if (sql.startsWith("/*", i)) {
          depth++;
          i += 2;
        } else if (sql.startsWith("*/", i)) {
          depth--;
          i += 2;
        } else i++;
      }
      continue;
    }
    const delimiter = sql[i];
    if (delimiter === "'" || delimiter === '"') {
      const start = i++;
      const escape = delimiter === "'" && sql[start - 1]?.toLowerCase() === "e";
      while (i < sql.length) {
        if (escape && sql[i] === "\\") {
          i += 2;
          continue;
        }
        if (sql[i] === delimiter) {
          if (sql[i + 1] === delimiter) {
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      // A quoted identifier can be a table name, but never a WHERE keyword.
      if (delimiter === '"')
        result.push({ value: "_quoted_identifier_", offset: base + start });
      continue;
    }
    const dollar = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/)?.[0];
    if (dollar) {
      const start = i + dollar.length,
        end = sql.indexOf(dollar, start);
      if (end < 0) throw new Error("Unterminated SQL dollar quote");
      // SQL/PLpgSQL AS/DO bodies are executable, ordinary dollar strings are data.
      if (["as", "do"].includes(result.at(-1)?.value ?? ""))
        result.push(...tokens(sql.slice(start, end), base + start));
      i = end + dollar.length;
      continue;
    }
    const word = sql.slice(i).match(/^[A-Za-z_][A-Za-z_0-9$]*/)?.[0];
    result.push({ value: word?.toLowerCase() ?? sql[i], offset: base + i });
    i += word?.length ?? 1;
  }
  return result;
}
export function unsafeSql(sql: string): UnsafeSql[] {
  const code = tokens(sql),
    violations: UnsafeSql[] = [];
  let depth = 0;
  for (let i = 0; i < code.length; i++) {
    const value = code[i].value;
    if (value === "(") {
      depth++;
      continue;
    }
    if (value === ")") {
      depth--;
      continue;
    }
    const update =
      value === "update" &&
      code[i - 1]?.value !== "for" &&
      code[i + 1]?.value !== "set";
    const deletion =
      value === "delete" &&
      code[i + 1]?.value === "from" &&
      code[i - 1]?.value !== "on";
    if (!update && !deletion) continue;
    let inner = depth,
      where = false,
      set = false,
      end = i + 1;
    for (; end < code.length; end++) {
      const v = code[end].value;
      if (v === ";" || (v === ")" && inner === depth)) break;
      if (v === "(") inner++;
      else if (v === ")") inner--;
      if (inner === depth && v === "where") where = true;
      if (inner === depth && v === "set") set = true;
    }
    // Trigger declarations / SELECT FOR UPDATE / ON CONFLICT DO UPDATE are not unbounded DML.
    if ((deletion || set) && !where)
      violations.push({
        line: sql.slice(0, code[i].offset).split("\n").length,
        statement: code
          .slice(i, end)
          .map((t) => t.value)
          .join(" "),
      });
  }
  return violations;
}
async function files(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? files(path.join(root, e.name))
          : [path.join(root, e.name)],
      ),
    )
  ).flat();
}
export async function auditSql(root = process.cwd()): Promise<void> {
  const migrationDir = path.join(root, "supabase/migrations");
  const migrations = (await readdir(migrationDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const violations: { file: string; line: number; statement: string }[] = [];
  for (const file of migrations)
    for (const issue of unsafeSql(
      await readFile(path.join(migrationDir, file), "utf8"),
    ))
      violations.push({ file, ...issue });
  // Immutable 0005 contains the incident being repaired. This exact occurrence is
  // tracked, never a blanket exemption for the file or for later migrations.
  const historical = violations.filter(
    (v) =>
      v.file === "0005_seats_and_promotion.sql" &&
      v.statement ===
        "update public . seat_world_state set revision = revision + 1",
  );
  if (historical.length !== 1)
    throw new Error(
      "Expected exactly one immutable 0005 incident; review migration history.",
    );
  const repair = await readFile(
    path.join(migrationDir, "0006_fix_safeupdate.sql"),
    "utf8",
  );
  const repairTokens = tokens(repair)
    .map((t) => t.value)
    .join(" ");
  if (
    !repairTokens.includes(
      "create or replace function public . seat_world_after_write ( )",
    )
  )
    throw new Error("0006 must replace the historical unsafe trigger.");
  const fresh = violations.filter((v) => !historical.includes(v));
  // M1 lives in schema.sql; there is no 0001 migration in this repository.
  for (const issue of unsafeSql(
    await readFile(path.join(root, "supabase/schema.sql"), "utf8"),
  ))
    fresh.push({ file: "schema.sql", ...issue });
  // No raw SQL currently lives in src; guard literal SQL if it is added later.
  for (const file of (await files(path.join(root, "src"))).filter((f) =>
    /\.tsx?$/.test(f),
  )) {
    const source = await readFile(file, "utf8"),
      ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node): void {
      let text: string | undefined;
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
        text = node.text;
      else if (ts.isTemplateExpression(node))
        text =
          node.head.text +
          node.templateSpans
            .map((span) => " _dynamic_ " + span.literal.text)
            .join("");
      if (text)
        for (const issue of unsafeSql(text))
          fresh.push({
            ...issue,
            file: path.relative(root, file),
            line:
              ast.getLineAndCharacterOfPosition(node.getStart(ast)).line +
              issue.line,
          });
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  if (fresh.length)
    throw new Error(
      `SQL missing WHERE:\n${fresh.map((v) => `${v.file}:${v.line} ${v.statement}`).join("\n")}`,
    );
}
