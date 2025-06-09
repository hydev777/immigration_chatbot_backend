import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import cors from 'cors';
import { OpenAI } from 'openai';

dotenv.config();
const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
app.use(cors());
app.use(express.json());

app.post('/ask', async (req, res) => {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required' });

    try {
        // Step 1: Query AutoRAG
        const autoragResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/vectorize/auto-rag/indexes/${process.env.R2_AUTORAG_INDEX_ID}/query`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: question }),
            }
        );

        const { result } = await autoragResponse.json();

        const context = result?.context || '';

        // Step 2: Ask GPT with the returned context
        const chatResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo-0125',
            messages: [
                {
                    role: 'system',
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
                    role: 'user',
                    content: `Context:\n${context}\n\nQuestion:\n${question}`,
                },
            ],
        });

        const answer = chatResponse.choices[0].message.content;
        res.json({ answer });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Something went wrong.' });
    }
});

app.listen(4000, () => console.log('Server running at http://localhost:4000'));