// express-validator rule chains. Each chain validates AND sanitizes one input.
const { body, param, query } = require("express-validator");
const books = require("../data/books");
const store = require("../data/store");

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(new Date(iso + "T00:00:00Z").getTime() + n * 864e5).toISOString().slice(0, 10);

// Business-rule failures (not simple format errors) are flagged so the route can answer 409 Conflict.
const conflict = (req, msg) => { req.conflict = true; throw new Error(msg); };

const reservationRules = [
  body("name").trim().notEmpty().withMessage("Full name is required.").bail()
    .isLength({ min: 3, max: 50 }).withMessage("Name must be 3 to 50 characters long.").bail()
    .matches(/^[A-Za-z][A-Za-z .'-]*$/).withMessage("Name may contain only letters, spaces, . ' and -."),

  body("studentId").trim().toUpperCase().notEmpty().withMessage("Student ID is required.").bail()
    .matches(/^\d{2}[A-Z]{2,3}\d{3,4}$/).withMessage("Student ID must look like 23CS1045 (2 digits, 2-3 letters, 3-4 digits)."),

  body("email").trim().toLowerCase().notEmpty().withMessage("Email is required.").bail()
    .isEmail().withMessage("Enter a valid email address, like name@college.edu.").bail()
    .isLength({ max: 100 }).withMessage("Email is too long."),

  body("phone").trim().notEmpty().withMessage("Mobile number is required.").bail()
    .isNumeric({ no_symbols: true }).withMessage("Mobile number must contain digits only.").bail()
    .isLength({ min: 10, max: 10 }).withMessage("Mobile number must be exactly 10 digits.").bail()
    .matches(/^[6-9]/).withMessage("Mobile number must start with 6, 7, 8 or 9."),

  body("bookId").trim().notEmpty().withMessage("Select a book.").bail()
    .isInt({ min: 1 }).withMessage("Invalid book selected.").toInt().bail()
    .custom((id) => { if (!books.some((b) => b.id === id)) throw new Error("That book does not exist."); return true; }).bail()
    .custom((id, { req }) => {
      if (store.available(id) < 1) conflict(req, "Sorry, no copies of this book are available right now.");
      return true;
    }),

  body("pickupDate").trim().notEmpty().withMessage("Choose a pickup date.").bail()
    .isISO8601({ strict: true, strictSeparator: true }).withMessage("Enter a valid date.").bail()
    .custom((d) => {
      if (d < today()) throw new Error("Pickup date cannot be in the past.");
      if (d > addDays(today(), 7)) throw new Error("You can reserve at most 7 days ahead.");
      if (new Date(d + "T00:00:00Z").getUTCDay() === 0) throw new Error("The library is closed on Sundays. Choose another day.");
      return true;
    }),

  body("days").trim().notEmpty().withMessage("Enter the number of borrowing days.").bail()
    .isInt({ min: 1, max: 14 }).withMessage("Borrowing period must be a whole number from 1 to 14 days.").toInt(),

  body("notes").optional({ values: "falsy" }).trim().isLength({ max: 200 }).withMessage("Notes can be at most 200 characters."),

  body("terms").custom((v) => v === "on" || v === "true" || v === true).withMessage("You must accept the library rules."),

  // Rule that depends on several fields + stored data (only runs if the student ID and book are fine)
  body("studentId").custom((id, { req }) => {
    const bookId = Number(req.body.bookId);
    if (store.hasActive(id, bookId)) conflict(req, "You already have an active reservation for this book.");
    if (store.activeCountFor(id) >= 3) conflict(req, "A student can hold at most 3 active reservations.");
    return true;
  }),
];

const idParam = param("id").isInt({ min: 1 }).withMessage("Reservation ID must be a positive number.").toInt();

const searchRules = [
  query("q").optional().trim().isLength({ max: 50 }).withMessage("Search text must be 50 characters or fewer."),
  query("genre").optional().trim().custom((g) => g === "" || books.some((b) => b.genre === g)).withMessage("Unknown genre."),
];

module.exports = { reservationRules, idParam, searchRules, today, addDays };
