// 404 + centralised error-handling middleware.
const wantsJson = (req) => req.path.startsWith("/api");

exports.notFound = (req, res) => {
  if (wantsJson(req)) return res.status(404).json({ success: false, message: "Route not found." });
  res.status(404).render("message", { title: "Page not found", heading: "404 – Page not found", text: "The page you asked for does not exist." });
};

exports.errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const text = status === 400 ? "Malformed request body." : status === 413 ? "Request body too large." : "Something went wrong on the server.";
  if (status === 500) console.error(err);
  if (wantsJson(req)) return res.status(status).json({ success: false, message: text });
  res.status(status).render("message", { title: "Error", heading: `${status} – Error`, text });
};
