// HTML routes built with express.Router()
const express = require("express");
const { validationResult, matchedData } = require("express-validator");
const books = require("../data/books");
const store = require("../data/store");
const { reservationRules, idParam, searchRules, today, addDays } = require("../validators/reservation");

const router = express.Router();
const genres = [...new Set(books.map((b) => b.genre))];
const msg = (res, status, heading, text) => res.status(status).render("message", { title: heading, heading, text });

// Home: list/search books. Query-string values are validated too.
router.get("/", searchRules, (req, res) => {
  const result = validationResult(req);
  const { q = "", genre = "" } = result.isEmpty() ? matchedData(req, { locations: ["query"] }) : {};
  const shown = books.filter((b) => (!genre || b.genre === genre) && (!q || (b.title + b.author).toLowerCase().includes(q.toLowerCase())))
    .map((b) => ({ ...b, available: store.available(b.id) }));
  res.status(result.isEmpty() ? 200 : 400).render("index", { books: shown, genres, q, genre, errors: result.mapped() });
});

router.get("/reserve", (req, res) => {
  const bookId = Number(req.query.book) || "";
  res.render("reserve", { books: books.map((b) => ({ ...b, available: store.available(b.id) })), values: { bookId, days: 7 }, errors: {}, min: today(), max: addDays(today(), 7) });
});

router.post("/reserve", reservationRules, (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(req.conflict ? 409 : 422).render("reserve", {
      books: books.map((b) => ({ ...b, available: store.available(b.id) })),
      values: req.body, errors: result.mapped(), min: today(), max: addDays(today(), 7),
    });
  }
  const record = store.add(matchedData(req, { locations: ["body"] }));
  res.redirect(303, `/reservations/${record.id}`); // Post/Redirect/Get
});

router.get("/reservations", (req, res) => {
  res.render("list", { rows: store.all().map((r) => ({ ...r, book: books.find((b) => b.id === r.bookId) })), note: req.query.cancelled ? "Reservation cancelled." : "" });
});

router.get("/reservations/:id", idParam, (req, res) => {
  if (!validationResult(req).isEmpty()) return msg(res, 400, "400 – Bad request", "Reservation ID must be a positive number.");
  const r = store.find(req.params.id);
  if (!r) return msg(res, 404, "404 – Not found", "No reservation with that ID.");
  res.render("confirmation", { r, book: books.find((b) => b.id === r.bookId) });
});

router.post("/reservations/:id/cancel", idParam, (req, res) => {
  if (!validationResult(req).isEmpty()) return msg(res, 400, "400 – Bad request", "Reservation ID must be a positive number.");
  if (!store.cancel(req.params.id)) return msg(res, 404, "404 – Not found", "No active reservation with that ID.");
  res.redirect(303, "/reservations?cancelled=1");
});

module.exports = router;
