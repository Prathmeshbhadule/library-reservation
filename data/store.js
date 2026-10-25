// In-memory reservation store (resets on restart).
const books = require("./books");
let list = [];
let nextId = 1;

const active = () => list.filter((r) => r.status === "active");

module.exports = {
  all: () => list,
  find: (id) => list.find((r) => r.id === id),
  available: (bookId) => {
    const book = books.find((b) => b.id === bookId);
    return book ? book.copies - active().filter((r) => r.bookId === bookId).length : 0;
  },
  activeCountFor: (studentId) => active().filter((r) => r.studentId === studentId).length,
  hasActive: (studentId, bookId) => active().some((r) => r.studentId === studentId && r.bookId === bookId),
  add(data) { const r = { id: nextId++, status: "active", createdAt: new Date().toISOString(), ...data }; list.push(r); return r; },
  cancel(id) { const r = list.find((x) => x.id === id && x.status === "active"); if (r) r.status = "cancelled"; return !!r; },
  reset() { list = []; nextId = 1; },
};
