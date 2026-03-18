import fetch from "node-fetch";
import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { usage } from "../../core/storage.js";
import { QUESTION_LIMIT } from "../../core/globals.js";
import { storeQuestion } from "./answer_repository.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
const mistral = new OpenAI({
  apiKey: process.env.MISTRAL_API_KEY,
  baseURL: "https://api.mistral.ai",
});

export const getAnswerQuestion = async (req, res) => {
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

    const SYSTEM_PROMPT = `
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
      `;

    if (dayOfMonth <= 8) {
      const chatResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-0125",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: `Context:\n${context}\n\nQuestion:\n${question}`,
          },
        ],
      });

      answer = chatResponse.choices[0].message.content;
    } else if (dayOfMonth <= 16) {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

      const result = await model.generateContent([
        SYSTEM_PROMPT,
        `Context:\n${context}\n\nQuestion:\n${question}`,
      ]);

      const response = result.response;
      answer = response.text();
    } else if (dayOfMonth <= 24) {
      const deepseekResponse = await fetch(
        "https://api.deepseek.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${deepseekApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: `Context:\n${context}\n\nQuestion:\n${question}`,
              },
            ],
          }),
        }
      );

      const deepseekData = await deepseekResponse.json();
      answer =
        deepseekData.choices?.[0]?.message?.content || "No answer received";
    } else {
      const mistralResponse = await mistral.chat.completions.create({
        model: "ministral-8b-latest",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Context:\n${context}\n\nQuestion:\n${question}`,
          },
        ],
      });

      answer = mistralResponse.choices[0].message.content;
    }

    storeQuestion(question);

    res.json({
      answer,
      questionsLeftToday: QUESTION_LIMIT - userData.count,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Something went wrong." });
  }
};
