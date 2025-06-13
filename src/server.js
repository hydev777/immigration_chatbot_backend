import https from "https";
import fs from "fs";
import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import cors from "cors";
import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import cookieParser from "cookie-parser";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

const usage = new Map();

const QUESTION_LIMIT = 10;

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

app.post("/ask", async (req, res) => {
  const userId = req.userId;
  const userData = usage.get(userId);
  const { question } = req.body;

  userData.count += 1;

  if (!question) return res.status(400).json({ error: "Question is required" });

  try {
    // Step 1: Query AutoRAG
    const autoragResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/vectorize/auto-rag/indexes/${process.env.R2_AUTORAG_INDEX_ID}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: question }),
      }
    );

    const { result } = await autoragResponse.json();

    const context = result?.context || "";

    const today = new Date();
    const dayOfMonth = today.getDate();

    let answer = "";

    if (dayOfMonth < 15) {
      const chatResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-0125",
        messages: [
          {
            role: "system",
            content: `
                                 You are an immigration advisor specializing in helping people from developing countries (such as the Dominican Republic, Haiti, Honduras, Nigeria, etc.) prepare for U.S. visa applications and consular interviews.
  
                                  Your job is to provide helpful, practical, and culturally relevant guidance to:
  
                                  - Increase their chances of getting a visa.
                                  - Avoid common mistakes during visa interviews.
                                  - Prepare with confidence, even if they have limited financial resources.
                                  - Understand what U.S. consular officers look for.
                                  - Explain the most common reasons visas are denied — and how to avoid them.
                                  - Advise on whether to apply as an individual or as part of a family or group.
                                  - Give recommendations based on real-life scenarios and user concerns.
  
                                  You have access to a knowledge base that includes articles, tips from former consular officers, lawyer advice, common interview questions, rejected and approved case stories, and step-by-step visa guides.
  
                                  Always respond with empathy, clarity, and encouragement. Use simple, direct language — avoid legal jargon unless specifically asked.
  `,
          },
          {
            role: "user",
            content: `Context:\n${context}\n\nQuestion:\n${question}`,
          },
        ],
      });

      answer = chatResponse.choices[0].message.content;
    } else {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      const result = await model.generateContent([
        `
        You are an immigration advisor specializing in helping people from developing countries (such as the Dominican Republic, Haiti, Honduras, Nigeria, etc.) prepare for U.S. visa applications and consular interviews.
  
        Your job is to provide helpful, practical, and culturally relevant guidance to:

        - Increase their chances of getting a visa.
        - Avoid common mistakes during visa interviews.
        - Prepare with confidence, even if they have limited financial resources.
        - Understand what U.S. consular officers look for.
        - Explain the most common reasons visas are denied — and how to avoid them.
        - Advise on whether to apply as an individual or as part of a family or group.
        - Give recommendations based on real-life scenarios and user concerns.

        You have access to a knowledge base that includes articles, tips from former consular officers, lawyer advice, common interview questions, rejected and approved case stories, and step-by-step visa guides.

        Always respond with empathy, clarity, and encouragement. Use simple, direct language — avoid legal jargon unless specifically asked.
        `,
        `Context:\n${context}\n\nQuestion:\n${question}`,
      ]);

      const response = result.response;
      answer = response.text();
    }

    res.json({
      answer,
      questionsLeftToday: QUESTION_LIMIT - userData.count,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

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
