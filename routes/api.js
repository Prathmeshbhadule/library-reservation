// JSON API (handy for Postman / curl testing)
const express = require("express");
const { validationResult, matchedData } = require("express-validator");
const books = require("../data/books");
const store = require("../data/store");
const { reservationRules, idParam } = require("../validators/reservation");

const router = express.Router();

router.get("/books", (req, res) => res.json(books.map((b) => ({ ...b, available: store.available(b.id) }))));
router.get("/reservations", (req, res) => res.json(store.all()));

router.post("/reservations", (req, res, next) => (req.is("application/json") ? next() : res.status(415).json({ success: false, message: "Send the body as application/json." })),
  reservationRules, (req, res) => {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      const errors = Object.fromEntries(Object.entries(result.mapped()).map(([k, v]) => [k, v.msg]));
      return res.status(req.conflict ? 409 : 422).json({ success: false, message: "Validation failed.", errors });
    }
    res.status(201).json({ success: true, message: "Book reserved successfully.", data: store.add(matchedData(req, { locations: ["body"] })) });
  });

router.delete("/reservations/:id", idParam, (req, res) => {
  if (!validationResult(req).isEmpty()) return res.status(400).json({ success: false, message: "Reservation ID must be a positive number." });
  if (!store.cancel(req.params.id)) return res.status(404).json({ success: false, message: "No active reservation with that ID." });
  res.json({ success: true, message: "Reservation cancelled." });
});

module.exports = router;
