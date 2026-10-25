// Custom middleware: logs method, URL, status and time taken for every request.
module.exports = function logger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start} ms)`));
  next();
};
