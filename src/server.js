import https from "https";
import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
import fs from "fs";
import dotenv from "dotenv";

import { usage } from "./core/storage.js";
import { QUESTION_LIMIT } from './core/globals.js';
import { getAnswerQuestion } from "./features/answer/answer_controller.js";

dotenv.config();
const app = express();
app.use(cookieParser());

app.use(
  cors({
    origin: "https://tuasistentemigratorio.app",
    credentials: true,
  })
);

app.use(express.json());

function getToday() {
  return new Date().toISOString().slice(0, 10); // e.g., "2025-06-11"
}

app.use((req, res, next) => {
  let userId = req.cookies.user_id;

  if (!userId) {
    userId = `${getToday()}-${Math.random()}`;
    res.cookie("user_id", userId, {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      httpOnly: true,
      sameSite: "none",
      secure: true,
    });
  }

  const today = getToday();

  // Create or update user usage record
  const existing = usage.get(userId);

  if (!existing) {
    usage.set(userId, { date: today, count: 0 });
  } else if (existing.date !== today) {
    // Reset daily count
    usage.set(userId, { date: today, count: 0 });
  }

  if (existing != null) {
    if (existing.count >= QUESTION_LIMIT) {
      return res
        .status(429)
        .json({ message: "Daily limit reached. Come back tomorrow." });
    }
  }

  req.userId = userId;
  next();
});

app.post("/ask", getAnswerQuestion);

https
  .createServer(
    {
      key: fs.readFileSync("./cert/key.pem"),
      cert: fs.readFileSync("./cert/cert.pem"),
    },
    app
  )
  .listen(8443, () => {
    console.log("Express HTTPS server running at https://localhost:8443");
  });

// app.listen(5000, () => console.log("Server running at http://localhost:5000"));
