// Run with: npm test   (Node's built-in test runner; no extra packages)
process.env.NODE_ENV = "test";
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const app = require("../app");
const store = require("../data/store");
const { today, addDays } = require("../validators/reservation");

let server, base;
before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); }); }));
after(() => server.close());
beforeEach(() => store.reset());

const isSunday = (d) => new Date(d + "T00:00:00Z").getUTCDay() === 0;
const findDay = (pred) => { for (let i = 0; i <= 7; i++) { const d = addDays(today(), i); if (pred(d)) return d; } };
const okDate = findDay((d) => !isSunday(d) && d >= today());
const sunday = findDay(isSunday);

const valid = { name: "Riya Sharma", studentId: "23cs1045", email: "Riya@College.edu", phone: "9876543210", bookId: 1, pickupDate: okDate, days: 7, terms: true };
const postJson = (body) => fetch(base + "/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const postForm = (body) => fetch(base + "/reserve", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body), redirect: "manual" });

test("home page lists books and search filters them", async () => {
  const all = await (await fetch(base + "/")).text();
  assert.match(all, /Clean Code/);
  const some = await (await fetch(base + "/?q=sapiens")).text();
  assert.match(some, /Sapiens/); assert.doesNotMatch(some, /Clean Code/);
});

test("invalid query string returns 400", async () => {
  assert.equal((await fetch(base + "/?genre=Cooking")).status, 400);
});

test("valid reservation returns 201 and sanitises input", async () => {
  const res = await postJson(valid);
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.data.studentId, "23CS1045");
  assert.equal(body.data.email, "riya@college.edu");
  assert.equal(body.data.days, 7);
});

test("empty body gives an error for every required field", async () => {
  const res = await postJson({});
  const { errors } = await res.json();
  assert.equal(res.status, 422);
  for (const k of ["name", "studentId", "email", "phone", "bookId", "pickupDate", "days", "terms"]) assert.ok(errors[k], `missing error for ${k}`);
});

test("each invalid field is rejected with its own message", async () => {
  const cases = [
    [{ name: "R2" }, "name"], [{ name: "<b>x</b>" }, "name"], [{ studentId: "ABC" }, "studentId"], [{ email: "abc@" }, "email"],
    [{ phone: "12345" }, "phone"], [{ phone: "5876543210" }, "phone"], [{ bookId: 99 }, "bookId"], [{ bookId: "abc" }, "bookId"],
    [{ pickupDate: addDays(today(), -1) }, "pickupDate"], [{ pickupDate: addDays(today(), 20) }, "pickupDate"],
    [{ pickupDate: "2026-13-45" }, "pickupDate"], [{ pickupDate: sunday }, "pickupDate"],
    [{ days: 0 }, "days"], [{ days: 15 }, "days"], [{ days: 2.5 }, "days"], [{ notes: "x".repeat(201) }, "notes"], [{ terms: false }, "terms"],
  ];
  for (const [patch, field] of cases) {
    const res = await postJson({ ...valid, ...patch });
    const body = await res.json();
    assert.equal(res.status, 422, JSON.stringify(patch));
    assert.ok(body.errors[field], `expected error on ${field} for ${JSON.stringify(patch)}`);
  }
});

test("out-of-stock book returns 409", async () => {
  await postJson({ ...valid, bookId: 3 });
  const res = await postJson({ ...valid, bookId: 3, studentId: "23CS2000" });
  assert.equal(res.status, 409);
  assert.match((await res.json()).errors.bookId, /no copies/);
});

test("same student cannot reserve the same book twice, or more than 3 books", async () => {
  await postJson(valid);
  const dup = await postJson(valid);
  assert.equal(dup.status, 409);
  assert.match((await dup.json()).errors.studentId, /already have/);
  await postJson({ ...valid, bookId: 2 }); await postJson({ ...valid, bookId: 4 });
  const fourth = await postJson({ ...valid, bookId: 5 });
  assert.equal(fourth.status, 409);
  assert.match((await fourth.json()).errors.studentId, /at most 3/);
});

test("cancelling frees the copy again", async () => {
  const { data } = await (await postJson({ ...valid, bookId: 3 })).json();
  assert.equal((await fetch(`${base}/api/reservations/${data.id}`, { method: "DELETE" })).status, 200);
  assert.equal((await postJson({ ...valid, bookId: 3, studentId: "23CS2000" })).status, 201);
});

test("route params are validated: bad id 400, unknown id 404", async () => {
  assert.equal((await fetch(base + "/reservations/abc")).status, 400);
  assert.equal((await fetch(base + "/reservations/999")).status, 404);
  assert.equal((await fetch(base + "/api/reservations/abc", { method: "DELETE" })).status, 400);
});

test("wrong content type 415, malformed JSON 400", async () => {
  assert.equal((await fetch(base + "/api/reservations", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "x" })).status, 415);
  assert.equal((await fetch(base + "/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad" })).status, 400);
});

test("HTML form: invalid post re-renders with errors and keeps values", async () => {
  const res = await postForm({ ...valid, phone: "123", terms: "on" });
  const html = await res.text();
  assert.equal(res.status, 422);
  assert.match(html, /exactly 10 digits/);
  assert.match(html, /value="Riya Sharma"/);
});

test("HTML form: script injection is escaped on output", async () => {
  const res = await postForm({ ...valid, notes: "<script>alert(1)</script>", terms: "on" });
  assert.equal(res.status, 303);
  const list = await (await fetch(base + "/api/reservations")).json();
  assert.ok(list.length === 1);
});

test("HTML form: valid post redirects 303 to confirmation page", async () => {
  const res = await postForm({ ...valid, terms: "on" });
  assert.equal(res.status, 303);
  assert.match(await (await fetch(base + res.headers.get("location"))).text(), /Reservation successful/);
});

test("unknown routes return 404", async () => {
  assert.equal((await fetch(base + "/nothing")).status, 404);
  assert.equal((await fetch(base + "/api/nothing")).status, 404);
});
