import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SupabaseGameRepository } from "../src/lib/repositories/SupabaseGameRepository";
import { InMemoryGameRepository } from "../src/lib/repositories/InMemoryGameRepository";
import { gameView } from "../src/lib/publicState";
import {
  SEAT_ROUND_WARNING,
  logSupabaseError,
} from "../src/lib/supabaseDiagnostics";
import ReadWarnings from "../src/components/ReadWarnings";

async function fixture(
  fault: "load" | "round" | "counts" | "snapshot" | "transport" | "table",
) {
  const memory = new InMemoryGameRepository();
  const id = randomUUID();
  memory.registerAccount(id);
  let state = await memory.readState(id);
  state = await memory.setup(
    id,
    { type: "BEGIN", branch: "CIVIL" },
    state.revision,
    randomUUID(),
  );
  await memory.setup(id, { type: "CONFIRM" }, state.revision, randomUUID());
  state = await memory.readState(id);
  const calls: string[] = [];
  const postgres = {
    code: "21000",
    message: "UPDATE requires a WHERE clause",
    hint: "Add a WHERE clause.",
    details: `Failing row contains (${id}, private@example.test, sb_secret_do_not_log).`,
  };
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init),
      name = new URL(request.url).pathname.split("/").at(-1)!;
    calls.push(name);
    if (name === "seat_world_load" && fault === "transport")
      throw new Error("private@example.test sb_secret_do_not_log");
    const failed =
      (fault === "load" && name === "seat_world_load") ||
      (fault === "round" && name === "commit_seat_world") ||
      (fault === "counts" && name === "read_seat_board") ||
      (fault === "snapshot" && name === "runtime_snapshot") ||
      (fault === "table" && name === "action_requests");
    if (failed)
      return new Response(JSON.stringify(postgres), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    let data: unknown;
    if (name === "seat_world_clock")
      data = { due: ["load", "round", "transport"].includes(fault) };
    else if (name === "seat_world_load")
      data = {
        version: 0,
        lastRound: 0,
        season: state.season,
        serverNow: Date.parse(state.season.seasonStartTimestamp) + 2100000,
        states: [],
        applications: [],
        assignments: [],
        requirements: [],
        history: [],
        rounds: [],
      };
    else if (name === "runtime_snapshot") data = state;
    else if (name === "read_seat_board") data = state.seatBoard;
    else if (name === "read_game_journal") data = [];
    else if (name === "action_requests") data = null;
    else throw new Error(`Unexpected call ${name}`);
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const repo = new SupabaseGameRepository(
    createClient("https://fixture.supabase.test", "test-api-key-do-not-log", {
      global: { fetch: fetcher },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  );
  return { repo, id, calls };
}
for (const fault of ["load", "round", "transport"] as const)
  test(`read snapshot/seat board/journal survive ${fault} failure; warning renders and source is logged; writes stay strict`, async (t) => {
    const spy = t.mock.method(console, "error", () => {}),
      { repo, id, calls } = await fixture(fault);
    const state = await repo.readState(id);
    assert.equal(state.character!.status, "ACTIVE");
    assert.equal(state.account.id, id);
    assert(state.seatBoard!.length > 0);
    assert.deepEqual(state.readWarnings, [SEAT_ROUND_WARNING]);
    const view = gameView(state);
    assert.equal(view.character!.rankId, "civil_8");
    assert(!("suspicion" in view.character!));
    const html = renderToStaticMarkup(
      createElement(ReadWarnings, { warnings: view.readWarnings }),
    );
    assert.match(html, /role="status"/);
    assert(html.includes(SEAT_ROUND_WARNING));
    assert((await repo.seatBoard()).length > 0);
    assert.deepEqual(await repo.logs(id, 0), []);
    const events = spy.mock.calls.map(
      (c) =>
        c.arguments[1] as { target: string; code: string; message: string },
    );
    assert(
      events.some(
        (e) =>
          e.target ===
          `rpc:${fault === "round" ? "commit_seat_world" : "seat_world_load"}`,
      ),
    );
    if (fault !== "transport")
      assert(
        events.some(
          (e) =>
            e.code === "21000" &&
            e.message === "UPDATE requires a WHERE clause",
        ),
      );
    const logs = JSON.stringify(spy.mock.calls.map((c) => c.arguments));
    for (const secret of [
      id,
      "private@example.test",
      "sb_secret_do_not_log",
      "test-api-key-do-not-log",
    ])
      assert(!logs.includes(secret));
    for (const write of [
      () => repo.act(id, "APPLY", randomUUID()),
      () => repo.setup(id, { type: "REROLL" }, state.revision, randomUUID()),
      () => repo.releaseSeats(state.character!.id),
      () => repo.convertInnerCourtToHarem(state.character!.id),
    ])
      await assert.rejects(write);
    assert(!calls.includes("commit_runtime_setup"));
    assert(!calls.includes("commit_game_action"));
    assert(!calls.includes("release_seats"));
    assert(!calls.includes("convert_inner_court_to_harem"));
  });
test("seat-count failure preserves profile with warning; essential snapshot errors are not swallowed", async (t) => {
  const spy = t.mock.method(console, "error", () => {});
  const counts = await fixture("counts");
  const state = await counts.repo.readState(counts.id);
  assert(state.character);
  assert.deepEqual(state.seatBoard, []);
  assert.equal(state.readWarnings!.length, 1);
  assert(
    spy.mock.calls.some((c) =>
      JSON.stringify(c.arguments).includes("rpc:read_seat_board"),
    ),
  );
  const snapshot = await fixture("snapshot");
  await assert.rejects(
    () => snapshot.repo.readState(snapshot.id),
    /Không thể cập nhật dữ liệu/,
  );
});
test("table failures log static table name and diagnostics without filters or player IDs", async (t) => {
  const spy = t.mock.method(console, "error", () => {}),
    f = await fixture("table");
  await assert.rejects(() => f.repo.act(f.id, "STUDY", randomUUID()));
  assert(
    spy.mock.calls.some((c) =>
      JSON.stringify(c.arguments).includes("table:action_requests"),
    ),
  );
  assert(
    !JSON.stringify(spy.mock.calls.map((c) => c.arguments)).includes(f.id),
  );
});
test("diagnostics allow reviewed safe constants only; arbitrary tokens, email, UUID and row data are redacted", (t) => {
  const spy = t.mock.method(console, "error", () => {});
  logSupabaseError("rpc:seat_world_load", {
    code: "21000",
    message: "UPDATE requires a WHERE clause",
    hint: "unquoted Alice Example private@example.test token",
    details:
      "Key (account_id)=(01234567-0123-4567-8901-012345678901) already exists",
    authorization: "Bearer secret",
    args: { player: "Alice Example" },
  });
  const event = spy.mock.calls[0].arguments[1] as Record<string, unknown>;
  assert.deepEqual(Object.keys(event), [
    "target",
    "code",
    "message",
    "hint",
    "details",
  ]);
  assert.equal(event.message, "UPDATE requires a WHERE clause");
  assert.match(String(event.details), /redacted/);
  assert(!JSON.stringify(event).includes("Alice"));
  assert(!JSON.stringify(event).includes("01234567"));
  assert(!JSON.stringify(event).includes("secret"));
});
