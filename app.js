// Creates and configures the Express app (separate from server.js so tests can import it).
const path = require("path");
const express = require("express");
const logger = require("./middleware/logger");
const { notFound, errorHandler } = require("./middleware/errors");

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.disable("x-powered-by");

if (process.env.NODE_ENV !== "test") app.use(logger);
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/", require("./routes/pages"));
app.use("/api", require("./routes/api"));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
