require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Enable CORS and support high payload limits for photo uploads
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname)));

/**
 * Curated Question Bank & Previous Year Questions (PYQs)
 * Covers SEBA Class 9-10, AHSEC 11-12, and ADRE Grade III/IV
 */
const PYQ_BANK = [
  {
    id: "adre_01",
    category: "ADRE (Grade III/IV)",
    topic: "লাভ আৰু লোকচান (Profit & Loss)",
    question: "এজন মানুহে এটা বস্তু ₹৪৫০ টকাত বিক্ৰী কৰি ১০% লোকচান ভৰিলে। ২০% লাভ কৰিবলৈ তেওঁ বস্তুটো কিমান টকাত বিক্ৰী কৰিব লাগিব?",
    exam: "ADRE Grade III 2022",
    shortcut: "CP = SP / (1 - Loss%) = 450 / 0.9 = ₹500. New SP = 500 × 1.20 = ₹600. মাত্ৰ ৩০ ছেকেণ্ডত সূত্ৰ: SP₂ = SP₁ × (100 + P%) / (100 - L%) = 450 × 120 / 90 = ₹600."
  },
  {
    id: "adre_02",
    category: "ADRE (Grade III/IV)",
    topic: "সময় আৰু কাম (Time & Work)",
    question: "A-ই এটা কাম ১২ দিনত আৰু B-ই সেই কাম ১৮ দিনত কৰিব পাৰে। দুয়োজনে একেলগে কামটো কৰিলে কিমান দিন লাগিব?",
    exam: "ADRE Grade IV 2024",
    shortcut: "LCM নিয়ম: Total Work = LCM(12, 18) = 36 একক। A-ৰ দক্ষতা = 3 একক/দিন, B-ৰ দক্ষতা = 2 একক/দিন। মুঠ দক্ষতা = 5 একক/দিন। সময় = 36 / 5 = ৭.২ দিন (৭ ১/৫ দিন)।"
  },
  {
    id: "adre_03",
    category: "ADRE (Grade III/IV)",
    topic: "অনুপাত আৰু সমানুপাত (Ratio & Proportion)",
    question: "যদি A : B = 2 : 3 আৰু B : C = 4 : 5 হয়, তেন্তে A : B : C কিমান?",
    exam: "Assam Police SI / ADRE",
    shortcut: "A : B : C = (2×4) : (3×4) : (3×5) = 8 : 12 : 15. কোনো গণনা নকৰাকৈ পোনে পোনে অনুপাত গুণ কৰক।"
  },
  {
    id: "seba_01",
    category: "SEBA Class 10 (HSLC)",
    topic: "দ্বিঘাত সমীকৰণ (Quadratic Equations)",
    question: "দ্বিঘাত সমীকৰণ 2x^2 - 7x + 3 = 0 ৰ মূলসমূহ নিৰূপকৰ দ্বাৰা উলিওৱা।",
    exam: "SEBA HSLC 2020",
    shortcut: "D = b^2 - 4ac = (-7)^2 - 4(2)(3) = 49 - 24 = 25 > 0. x = (7 ± 5)/4 => x = 3 বা x = 1/2."
  },
  {
    id: "seba_02",
    category: "SEBA Class 10 (উচ্চ গণিত / Adv Maths)",
    topic: "দ্বিপদ প্ৰমেয় (Binomial Theorem)",
    question: "(x + 2/x)^6 ৰ বিস্তাৰত মধ্য পদটো নিৰ্ণয় কৰা।",
    exam: "SEBA Class 10 Adv Maths",
    shortcut: "n = 6 (যুগ্ম)। মধ্য পদ হ'ব (6/2 + 1) = 4th পদ। T₄ = ⁶C₃ (x)³ (2/x)³ = 20 × 8 = 160."
  },
  {
    id: "ahsec_01",
    category: "AHSEC Class 12",
    topic: "অৱকলন আৰু কলনবিদ্যা (Calculus)",
    question: "যদি y = sin(x^2 + 5), dy/dx নিৰ্ণয় কৰক।",
    exam: "AHSEC Class 12 Board Exam",
    shortcut: "চেইন নিয়ম (Chain Rule): dy/dx = cos(x^2 + 5) × d/dx(x^2 + 5) = 2x cos(x^2 + 5)."
  }
];

// System Prompts for Different Modes
function getSystemPrompt(mode = 'school') {
  if (mode === 'competitive') {
    return `You are Axomগণিত AI - Expert Competitive Exam Mentor for Assam Govt Exams (ADRE Grade III/IV, APSC, Assam Police, Banking, SSC).
Your objective:
1. Provide the FASTEST SHORTCUT TRICK (৩০ ছেকেণ্ডৰ চৰ্টকাট ট্ৰিক), Mental Math method, or Option Elimination technique in student-friendly Assamese.
2. Structure your response as:
   - **পদ্ধতি (Method / Trick)**: [Show the shortcut or LCM/Ratio formula]
   - **গণনা (Calculation)**: Use LaTeX formatted KaTeX ($$ ... $$) for exact math.
   - **সঠিক উত্তৰ (Final Answer)**: Bolded final answer with exam tips.
3. Keep it crisp, highly practical, and exam-focused. Avoid long school-style derivations.
4. Response language MUST be Assamese (অসমীয়া).`;
  }

  // School Mode (Default: SEBA / AHSEC / CBSE Std 1-12)
  return `You are Axomগণিত AI - Senior Mathematics Teacher for SEBA (HSLC) and AHSEC Assam Board students (Std 1 to 12).
Your objective:
1. Provide comprehensive STEP-BY-STEP solutions (ধাপ-ধাপে ব্যাখ্যা) according to SEBA/AHSEC exam marking schemes.
2. Structure your response as:
   - **প্ৰশ্নৰ বিশ্লেষণ (Given Data & Problem Statement)**
   - **ব্যৱহৃত সূত্ৰ (Formulas Used)**
   - **ধাপ-ধাপে সমাধান ([ধাপ ১], [ধাপ ২], [ধাপ ৩]...)**: All math formulas formatted in standard KaTeX ($$ ... $$ or $ ... $).
   - **উত্তৰ (Final Result)**
3. Tone: Encouraging, pedagogically sound, and easy to understand for young learners.
4. Response language MUST be Assamese (অসমীয়া).`;
}

/**
 * Health Check Endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    serverTime: new Date().toISOString(),
    hasServerApiKey: Boolean(GEMINI_API_KEY)
  });
});

/**
 * Curated Previous Year Questions
 */
app.get('/api/pyqs', (req, res) => {
  const category = req.query.category;
  if (category) {
    const filtered = PYQ_BANK.filter(q => q.category.toLowerCase().includes(category.toLowerCase()));
    return res.json({ pyqs: filtered });
  }
  res.json({ pyqs: PYQ_BANK });
});

/**
 * Gemini API Multi-Model Call with Fallback
 */
const GEMINI_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite'
];

async function callGeminiWithFallback(apiKey, requestBody) {
  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return { text, model };
      } else {
        const errJson = await response.json().catch(() => ({}));
        lastError = new Error(errJson?.error?.message || `Gemini API Error (${response.status}) on ${model}`);
        console.warn(`Model ${model} returned error:`, lastError.message);
      }
    } catch (err) {
      lastError = err;
      console.warn(`Model ${model} fetch failed:`, err.message);
    }
  }
  throw lastError || new Error('সকলো Gemini মডেলে সঁহাৰি দিবলৈ ব্যৰ্থ হৈছে।');
}

/**
 * Text Problem Solver Endpoint
 */
app.post('/api/solve', async (req, res) => {
  try {
    const { prompt, mode = 'school', userApiKey } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'প্ৰশ্নটো খালী হ’ব নোৱাৰে।' });
    }

    const apiKey = userApiKey || GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'কোনো Gemini API Key পোৱা নগ’ল। অনুগ্ৰহ কৰি ছাৰ্ভাৰৰ .env-ত GEMINI_API_KEY সংহতি কৰক বা এপৰ ছেটিংছত আপোনাৰ নিজা Key যোগ কৰক।'
      });
    }

    const systemPrompt = getSystemPrompt(mode);
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            { text: `শিক্ষাৰ্থীৰ প্ৰশ্ন:\n${prompt}` }
          ]
        }
      ],
      generationConfig: {
        temperature: mode === 'competitive' ? 0.1 : 0.2,
        maxOutputTokens: 2000
      }
    };

    const { text: solution, model } = await callGeminiWithFallback(apiKey, requestBody);
    res.json({
      success: true,
      solution,
      model,
      mode
    });
  } catch (error) {
    console.error('Error in /api/solve:', error);
    res.status(500).json({ error: error.message || 'ছাৰ্ভাৰত ত্ৰুটি হৈছে।' });
  }
});

/**
 * Multimodal Photo / OCR Math Solver Endpoint
 * Accepts base64 image and solves it with Gemini Vision
 */
app.post('/api/solve-photo', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', mode = 'school', userApiKey } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'কোনো ছবি প্ৰদান কৰা হোৱা নাই।' });
    }

    const apiKey = userApiKey || GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'কোনো Gemini API Key পোৱা নগ’ল। অনুগ্ৰহ কৰি API Key যোগ কৰক।'
      });
    }

    // Strip data URL prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const systemPrompt = getSystemPrompt(mode);

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            {
              text: "Please inspect this image carefully. Transcribe the math problem (whether written in Assamese, Bengali, or English script) and provide a step-by-step mathematical solution in Assamese with proper KaTeX LaTeX formatting ($$ ... $$)."
            },
            {
              inlineData: {
                mimeType: mimeType,
                data: cleanBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens: 2000
      }
    };

    const { text: solution, model } = await callGeminiWithFallback(apiKey, requestBody);
    res.json({
      success: true,
      solution,
      model,
      mode
    });
  } catch (error) {
    console.error('Error in /api/solve-photo:', error);
    res.status(500).json({ error: error.message || 'ছবি বিশ্লেষণত সমস্যা হৈছে।' });
  }
});

// Fallback for SPA routing
app.use((req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'), (err) => {
    if (err && !res.headersSent) {
      res.status(404).send('File Not Found');
    }
  });
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Axomগণিত বাণিজ্যিক ছাৰ্ভাৰ চলি আছে: http://localhost:${PORT}`);
  console.log(`⚡ অফলাইন ইঞ্জিন + Gemini AI + Photo OCR + ADRE/SEBA মোড প্ৰস্তুত!`);
  console.log(`===============================================`);
});
