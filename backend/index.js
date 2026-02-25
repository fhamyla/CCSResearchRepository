// Copyright (c) 2025 fhamyla
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/auth");
const papersRoutes = require("./routes/papers");
const paperRequestsRoutes = require("./routes/paperRequests");

const app = express();
const port = process.env.PORT || 3000;

const corsOptions = {
  origin: [
    "https://ccs-research-repo.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "user-role"],
};

app.use(helmet());
app.use(cors(corsOptions));

app.use(express.json());

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== "object") return;
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (key.includes("$") || key.includes(".")) {
      const safeKey = key.replace(/\$/g, "_").replace(/\./g, "_");
      obj[safeKey] = value;
      delete obj[key];
      if (typeof value === "object") sanitizeObject(obj[safeKey]);
    } else if (typeof value === "object") {
      sanitizeObject(value);
    }
  });
};

const sanitizeString = (str) => {
  if (typeof str !== "string") return str;
  try {
    return str
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  } catch (e) {
    return "";
  }
};

const sanitizeValue = (value) => {
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v));
  if (value && typeof value === "object") {
    sanitizeObject(value);
    return value;
  }
  return value;
};

app.use((req, res, next) => {
  try {
    if (req.query) sanitizeObject(req.query);
    if (req.params) sanitizeObject(req.params);
    if (req.body) sanitizeObject(req.body);

    if (req.query)
      Object.keys(req.query).forEach((k) => {
        req.query[k] = sanitizeValue(req.query[k]);
      });
    if (req.params)
      Object.keys(req.params).forEach((k) => {
        req.params[k] = sanitizeValue(req.params[k]);
      });
    if (req.body)
      Object.keys(req.body).forEach((k) => {
        req.body[k] = sanitizeValue(req.body[k]);
      });
  } catch (err) {
    console.error("Sanitization error:", err);
  }
  next();
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter);

console.log("MONGODB_URI:", process.env.MONGODB_URI);
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use("/api/auth", authRoutes);
app.use("/api/papers", papersRoutes);
app.use("/api/paper-requests", paperRequestsRoutes);

app.get("/", (req, res) => {
  res.send("Backend API is running!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Visit http://localhost:${port} to see the app`);
});
