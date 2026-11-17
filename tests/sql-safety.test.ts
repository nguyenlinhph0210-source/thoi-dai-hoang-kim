import { test } from "node:test";
import assert from "node:assert/strict";
import { auditSql, unsafeSql } from "../scripts/sqlSafety";
test("scan every migration, schema.sql and literal SQL in src; only exact superseded 0005 incident is allowed", async () => {
  await auditSql();
});
test("SQL guard detects DML inside dollar-quoted RPC bodies and does not mistake subquery WHERE for a mutation predicate", () => {
  for (const sql of [
    "UPDATE public.accounts SET ap=1;",
    "DELETE FROM public.characters;",
    "update public.accounts set ap=(select ap from other where id=1);",
    "with x as (delete from accounts returning *) select * from x where true;",
    'create function f() returns void language plpgsql as $body$ begin update "accounts" set ap=1; end $body$;',
    "DO $$ BEGIN DELETE FROM accounts; END $$;",
    'UPDATE accounts SET "where"=1;',
  ])
    assert.equal(unsafeSql(sql).length, 1, sql);
});
test("SQL guard ignores nested comments/strings, row locks, trigger declarations, foreign keys and conflict-scoped upserts", () => {
  for (const sql of [
    "-- UPDATE a SET n=1;\n/* DELETE FROM a; /* nested */ */ SELECT 'UPDATE a SET n=1;';",
    "select $$ DELETE FROM a $$; select E'escaped \\' UPDATE a SET n=1';",
    "select * from accounts order by id for update;",
    "create trigger x before insert or update or delete on accounts for each statement execute function f();",
    "create trigger x before update on accounts for each row execute function f();",
    "create table x(id uuid references accounts on delete cascade);",
    "insert into a(id) values(1) on conflict(id) do update set count=a.count+1;",
    "update a set n=1 where id=1; delete from a where exists(select 1);",
  ])
    assert.deepEqual(unsafeSql(sql), [], sql);
});
test("a new unbounded mutation cannot borrow WHERE from another statement or a comment", () => {
  assert.equal(
    unsafeSql("update a set n=1 /* where true */; delete from b where id=1;")
      .length,
    1,
  );
  assert.equal(unsafeSql("update a set value='where id=1';").length, 1);
});
