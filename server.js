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
  // --- ADRE Grade III / IV ---
  {
    id: "adre_01",
    categoryKey: "adre",
    category: "ADRE Grade III/IV",
    topic: "লাভ আৰু লোকচান (Profit & Loss)",
    question: "এজন ব্যৱসায়ীয়ে এটা সামগ্ৰী ₹৪৫০ টকাত বিক্ৰী কৰি ১০% লোকচান ভৰিলে। ২০% লাভ কৰিবলৈ তেওঁ সামগ্ৰীটো কিমান টকাত বিক্ৰী কৰিব লাগিব?",
    options: ["₹৫৫০", "₹৫৮০", "₹৬০০", "₹৬২০"],
    correctIndex: 2,
    exam: "ADRE Grade III 2022",
    formula: "SP₂ = SP₁ × (100 + P%) / (100 - L%)",
    shortcut: "ক্ৰয়মূল্য (CP) = 450 / 0.9 = ₹500। ২০% লাভত বিক্ৰীমূল্য (SP) = 500 × 1.20 = ₹600। পোনে পোনে: 450 × (120 / 90) = ₹600।"
  },
  {
    id: "adre_02",
    categoryKey: "adre",
    category: "ADRE Grade III/IV",
    topic: "সময় আৰু কাম (Time & Work)",
    question: "A-ই এটা কাম ১২ দিনত আৰু B-ই সেই কাম ১৮ দিনত সম্পূৰ্ণ কৰিব পাৰে। দুয়োজনে একেলগে কামটো আৰম্ভ কৰিলে কামটো শেষ হ'বলৈ কিমান দিন লাগিব?",
    options: ["৬ দিন", "৭.২ দিন (৭ ১/৫ দিন)", "৮ দিন", "১০ দিন"],
    correctIndex: 1,
    exam: "ADRE Grade IV 2024",
    formula: "মুঠ সময় = (A × B) / (A + B) বা LCM পদ্ধতি",
    shortcut: "মুঠ কাম = LCM(12, 18) = 36 একক। A-ৰ ক্ষমতা = 3, B-ৰ ক্ষমতা = 2। মুঠ ক্ষমতা = 5 একক/দিন। দিন = 36 / 5 = ৭.২ দিন।"
  },
  {
    id: "adre_03",
    categoryKey: "adre",
    category: "ADRE Grade III/IV",
    topic: "অনুপাত আৰু সমানুপাত (Ratio & Proportion)",
    question: "যদি A : B = 2 : 3 আৰু B : C = 4 : 5 হয়, তেন্তে A : B : C-ৰ অনুপাত কিমান হ'ব?",
    options: ["8 : 12 : 15", "6 : 9 : 15", "8 : 10 : 15", "2 : 4 : 5"],
    correctIndex: 0,
    exam: "Assam Police SI / ADRE",
    formula: "A : B : C = (A×B₁) : (B×B₁) : (B×C₁)",
    shortcut: "A : B = 2 : 3 আৰু B : C = 4 : 5। B-ক সমান কৰক: (2×4) : (3×4) : (3×5) = 8 : 12 : 15।"
  },
  {
    id: "adre_04",
    categoryKey: "adre",
    category: "ADRE Grade III/IV",
    topic: "চক্ৰবৃদ্ধি আৰু সৰল সূত (CI & SI Difference)",
    question: "₹৮,০০০ টকাৰ ওপৰত বাৰ্ষিক ১০% হাৰত ২ বছৰৰ চক্ৰবৃদ্ধি সূত (CI) আৰু সৰল সূত (SI)-ৰ পাৰ্থক্য কিমান?",
    options: ["₹৬০", "₹৭০", "₹৮০", "₹১০০"],
    correctIndex: 2,
    exam: "ADRE Grade III Exam",
    formula: "২ বছৰৰ পাৰ্থক্য = P × (R / 100)²",
    shortcut: "পাৰ্থক্য = 8000 × (10/100)² = 8000 × (1/100) = ₹৮০।"
  },
  {
    id: "adre_05",
    categoryKey: "adre",
    category: "ADRE Grade III/IV",
    topic: "গতি আৰু দূৰত্ব (Speed, Distance & Train)",
    question: "১৫০ মিটাৰ দীঘল এখন ৰে'লগাড়ী ৫৪ কিমি/ঘণ্টা বেগত গৈ থকা অৱস্থাত এটা টেলিগ্ৰাফ খুটি অতিক্ৰম কৰিবলৈ কিমান সময় ল'ব?",
    options: ["৮ ছেকেণ্ড", "১০ ছেকেণ্ড", "১২ ছেকেণ্ড", "১৫ ছেকেণ্ড"],
    correctIndex: 1,
    exam: "Assam Direct Recruitment Examination",
    formula: "সময় = দূৰত্ব / বেগ ; km/h ক m/s কৰিবলৈ 5/18 ৰে গুণ কৰক",
    shortcut: "বেগ = 54 × (5/18) = 15 m/s। সময় = 150 / 15 = ১০ ছেকেণ্ড।"
  },
  {
    id: "adre_06",
    categoryKey: "adre",
    category: "ADRE Grade III/IV",
    topic: "শতাংশ আৰু মিশ্ৰণ (Percentage & Mixture)",
    question: "কেঁচা ফলত ৬৮% পানী থাকে আৰু শুকান ফলত ২০% পানী থাকে। ১০০ কিলোগ্ৰাম কেঁচা ফলৰ পৰা কিমান কিলোগ্ৰাম শুকান ফল প্ৰস্তুত কৰিব পৰা যাব?",
    options: ["৩২ কিগ্ৰা", "৩৬ কিগ্ৰা", "৪০ কিগ্ৰা", "৪৮ কিগ্ৰা"],
    correctIndex: 2,
    exam: "Assam Comm. Exam (ADRE / Banking)",
    formula: "ফলৰ আঁহ (Pulp) অপৰিৱৰ্তিত থাকে: Pulp in Fresh = Pulp in Dry",
    shortcut: "কেঁচা ফলৰ আঁহ = 100 × (100 - 68)% = 32 kg। শুকান ফলৰ আঁহ = (100 - 20)% = 80%। শুকান ফল = 32 / 0.8 = ৪০ কিলোগ্ৰাম।"
  },

  // --- APSC CCE Prelims (CSAT / General Mental Ability) ---
  {
    id: "apsc_01",
    categoryKey: "apsc",
    category: "APSC CCE CSAT",
    topic: "বিন্যাস আৰু সমাবেশ (Permutation & Combination)",
    question: "'ASSAM' শব্দটোৰ আখৰসমূহ ব্যৱহাৰ কৰি মুঠ কিমানটা ভিন্ন শব্দ গঠন কৰিব পাৰি?",
    options: ["৩০ টা", "৬০ টা", "১২০ টা", "২৪০ টা"],
    correctIndex: 1,
    exam: "APSC CCE Prelims CSAT",
    formula: "মুঠ বিন্যাস = n! / (p! × q!...)",
    shortcut: "মুঠ আখৰ n = 5 (A আহিছে দুবাৰ, S আহিছে দুবাৰ, M এবাৰ)। বিন্যাস = 5! / (2! × 2!) = 120 / 4 = ৬০ টা।"
  },
  {
    id: "apsc_02",
    categoryKey: "apsc",
    category: "APSC CCE CSAT",
    topic: "সংখ্যা তত্ত্ব (Number System - Remainder Theorem)",
    question: "2^31 ক 5 ৰে হৰণ কৰিলে ভাগশেষ (Remainder) কিমান থাকিব?",
    options: ["১", "২", "৩", "৪"],
    correctIndex: 2,
    exam: "APSC Prelims GS Paper II (CSAT)",
    formula: "চক্ৰীয়তা (Cyclicity of powers): 2¹=2, 2²=4, 2³=8≡3, 2⁴=16≡1 (mod 5)",
    shortcut: "2⁴ ≡ 1 (mod 5)। 31 = 4 × 7 + 3। সেয়েহে 2³¹ ≡ 2³ = 8 ≡ 3 (mod 5)। ভাগশেষ হ'ব ৩।"
  },
  {
    id: "apsc_03",
    categoryKey: "apsc",
    category: "APSC CCE CSAT",
    topic: "পৰিমিতি (Geometry & Mensuration)",
    question: "এটা বৃত্তৰ ব্যাসাৰ্ধ ২০% বৃদ্ধি কৰা হ'ল। বৃত্তটোৰ কালি (Area) কিমান শতাংশ বৃদ্ধি পাব?",
    options: ["২০%", "৪০%", "৪৪%", "৪৮%"],
    correctIndex: 2,
    exam: "APSC CCE / UPSC Prelims",
    formula: "শতাংশ বৃদ্ধি = 2r + (r² / 100) %",
    shortcut: "বৃদ্ধি = 20 + 20 + (20 × 20) / 100 = 40 + 4 = ৪৪%।"
  },

  // --- SEBA Class 10 (HSLC) ---
  {
    id: "seba_01",
    categoryKey: "seba",
    category: "SEBA Class 10 (HSLC)",
    topic: "দ্বিঘাত সমীকৰণ (Quadratic Equations)",
    question: "দ্বিঘাত সমীকৰণ 2x² - 7x + 3 = 0 ৰ মূলদ্বয় নিৰূপকৰ দ্বাৰা নিৰ্ণয় কৰক।",
    options: ["x = 3, 1/2", "x = -3, -1/2", "x = 2, 3/2", "x = 1, 3"],
    correctIndex: 0,
    exam: "SEBA HSLC Board Exam",
    formula: "নিৰূপক D = b² - 4ac ; x = (-b ± √D) / 2a",
    shortcut: "D = (-7)² - 4(2)(3) = 49 - 24 = 25 > 0। x = (7 ± 5) / 4 ⇒ x = 12/4 = 3 অথবা x = 2/4 = 1/2।"
  },
  {
    id: "seba_02",
    categoryKey: "seba",
    category: "SEBA Class 10 (HSLC)",
    topic: "সমান্তৰ প্ৰগতি (Arithmetic Progression)",
    question: "সমান্তৰ প্ৰগতি 2, 7, 12, ... ৰ ১০ম পদটো (10th term) কিমান?",
    options: ["৪৫", "৪৭", "৪৯", "৫২"],
    correctIndex: 1,
    exam: "SEBA Class 10 HSLC",
    formula: "a_n = a + (n - 1)d",
    shortcut: "প্ৰথম পদ a = 2, সাধাৰণ অন্তৰ d = 5। 10ম পদ T₁₀ = 2 + (10 - 1) × 5 = 2 + 45 = ৪৭।"
  },
  {
    id: "seba_03",
    categoryKey: "seba",
    category: "SEBA Class 10 (HSLC)",
    topic: "ত্ৰিকোণমিতি (Trigonometry)",
    question: "যদি sin θ = 3/5 হয়, তেন্তে tan θ ৰ মান কিমান?",
    options: ["3/4", "4/3", "4/5", "5/3"],
    correctIndex: 0,
    exam: "SEBA HSLC Board Question",
    formula: "sin θ = P/H, cos θ = B/H, tan θ = P/B",
    shortcut: "পাইথাগোৰাছ ত্ৰয়ী (3, 4, 5): লম্ব P = 3, অতিভুজ H = 5 ⇒ ভূমি B = √(5² - 3²) = 4। অতএব tan θ = 3/4।"
  },
  {
    id: "seba_04",
    categoryKey: "seba",
    category: "SEBA Class 10 (HSLC)",
    topic: "স্থানাংক জ্যামিতি (Coordinate Geometry)",
    question: "বিন্দু A(2, 3) আৰু B(4, 1) ৰ মাজৰ দূৰত্ব নিৰ্ণয় কৰক।",
    options: ["2", "2√2", "4", "√6"],
    correctIndex: 1,
    exam: "SEBA Class 10 Board Exam",
    formula: "দূৰত্ব = √[(x₂ - x₁)² + (y₂ - y₁)²]",
    shortcut: "দূৰত্ব = √[(4 - 2)² + (1 - 3)²] = √[2² + (-2)²] = √[4 + 4] = √8 = 2√2।"
  },

  // --- AHSEC Class 12 ---
  {
    id: "ahsec_01",
    categoryKey: "ahsec",
    category: "AHSEC Class 12",
    topic: "অৱকলন (Calculus - Differentiation)",
    question: "যদি y = sin(x² + 5), তেন্তে dy/dx কিমান?",
    options: ["cos(x² + 5)", "2x cos(x² + 5)", "-2x cos(x² + 5)", "2x sin(x² + 5)"],
    correctIndex: 1,
    exam: "AHSEC Class 12 Board Exam",
    formula: "চেইন নিয়ম: d/dx[f(g(x))] = f'(g(x)) × g'(x)",
    shortcut: "dy/dx = cos(x² + 5) × d/dx(x² + 5) = 2x cos(x² + 5)।"
  },
  {
    id: "ahsec_02",
    categoryKey: "ahsec",
    category: "AHSEC Class 12",
    topic: "সমাকলন (Calculus - Integration)",
    question: "সমাকলন নিৰ্ণয় কৰক: ∫ [ 2x / (x² + 1) ] dx",
    options: ["log|x² + 1| + C", "2 log|x² + 1| + C", "tan⁻¹(x) + C", "1/(x² + 1) + C"],
    correctIndex: 0,
    exam: "AHSEC Class 12 Mathematics",
    formula: "∫ [ f'(x) / f(x) ] dx = log|f(x)| + C",
    shortcut: "ধৰা হ'ল t = x² + 1 ⇒ dt = 2x dx। সমাকলন হ'ব ∫ dt/t = log|t| + C = log|x² + 1| + C।"
  }
];

// System Prompts for Different Modes & Languages
function getSystemPrompt(mode = 'school', lang = 'as') {
  let langInstruction = "Response language MUST be Assamese (অসমীয়া). Use native Assamese mathematical terms.";
  if (lang === 'en') {
    langInstruction = "Response language MUST be clear, fluent English. Use standard English mathematical terms and notations.";
  } else if (lang === 'bilingual') {
    langInstruction = "Response language MUST be Bilingual (দ্বিভাষিক - Assamese + English). Explain concepts in Assamese while providing key mathematical terms and formulas in English side-by-side in parentheses (e.g., 'চক্ৰবৃদ্ধি সূত (Compound Interest)', 'অতিভুজ (Hypotenuse)', 'ভগ্নাংশ (Fraction)').";
  }

  if (mode === 'competitive') {
    const headings = (lang === 'en') ? {
      method: "Method / Shortcut Trick (30-Sec Exam Shortcut)",
      calc: "Calculation",
      ans: "Correct Answer & Exam Tip"
    } : (lang === 'bilingual') ? {
      method: "পদ্ধতি / Shortcut Trick (৩০ ছেকেণ্ডৰ চৰ্টকাট)",
      calc: "গণনা / Step Calculation",
      ans: "সঠিক উত্তৰ / Final Answer & Exam Tip"
    } : {
      method: "পদ্ধতি (Method / Trick)",
      calc: "গণনা (Calculation)",
      ans: "সঠিক উত্তৰ (Final Answer)"
    };

    return `You are Axomগণিত AI - Expert Competitive Exam Mentor for Assam Govt Exams (ADRE Grade III/IV, APSC, Assam Police, Banking, SSC).
Your objective:
1. Provide the FASTEST SHORTCUT TRICK (30-second shortcut), Mental Math method, or Option Elimination technique.
2. Structure your response as:
   - **${headings.method}**: [Show the shortcut or LCM/Ratio formula]
   - **${headings.calc}**: Use LaTeX formatted KaTeX ($$ ... $$) for exact math.
   - **${headings.ans}**: Bolded final answer with high-yield exam tips.
3. Keep it crisp, highly practical, and exam-focused. Avoid long school-style derivations.
4. ${langInstruction}`;
  }

  // School Mode (Default: SEBA / AHSEC / CBSE Std 1-12)
  const headings = (lang === 'en') ? {
    given: "Given Data & Problem Analysis",
    formula: "Formulas Used",
    steps: "Step-by-Step Solution ([Step 1], [Step 2]...)",
    ans: "Final Answer"
  } : (lang === 'bilingual') ? {
    given: "প্ৰশ্নৰ বিশ্লেষণ / Problem Analysis (Given Data)",
    formula: "ব্যৱহৃত সূত্ৰ / Formulas Used",
    steps: "ধাপ-ধাপে সমাধান / Step-by-Step Solution ([ধাপ ১ / Step 1], [ধাপ ২ / Step 2]...)",
    ans: "উত্তৰ / Final Answer"
  } : {
    given: "প্ৰশ্নৰ বিশ্লেষণ (Given Data & Problem Statement)",
    formula: "ব্যৱহৃত সূত্ৰ (Formulas Used)",
    steps: "ধাপ-ধাপে সমাধান ([ধাপ ১], [ধাপ ২], [ধাপ ৩]...)",
    ans: "উত্তৰ (Final Result)"
  };

  return `You are Axomগণিত AI - Senior Mathematics Teacher for SEBA (HSLC), AHSEC Assam Board, and CBSE students (Std 1 to 12).
Your objective:
1. Provide comprehensive STEP-BY-STEP solutions according to board exam marking schemes.
2. Structure your response as:
   - **${headings.given}**
   - **${headings.formula}**
   - **${headings.steps}**: All math formulas formatted in standard KaTeX ($$ ... $$ or $ ... $).
   - **${headings.ans}**
3. Tone: Encouraging, pedagogically sound, and easy to understand for young learners.
4. ${langInstruction}`;
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
 * Curated Previous Year Questions (PYQs) & Mock Quiz Generator
 */
app.get('/api/pyqs', (req, res) => {
  const { category, quiz, count = 5 } = req.query;
  let list = PYQ_BANK;

  if (category && category !== 'all') {
    const catLower = category.toLowerCase();
    list = PYQ_BANK.filter(q => 
      (q.categoryKey && q.categoryKey.toLowerCase() === catLower) ||
      (q.category && q.category.toLowerCase().includes(catLower))
    );
  }

  if (quiz === 'true' || quiz === true) {
    // Return randomized questions for 5-minute mock test
    const shuffled = [...list].sort(() => 0.5 - Math.random());
    const limit = Math.min(parseInt(count, 10) || 5, shuffled.length);
    return res.json({
      success: true,
      quiz: true,
      category: category || 'all',
      count: limit,
      pyqs: shuffled.slice(0, limit)
    });
  }

  res.json({
    success: true,
    total: list.length,
    pyqs: list
  });
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
    const { prompt, mode = 'school', lang = 'as', userApiKey } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'প্ৰশ্নটো খালী হ’ব নোৱাৰে।' });
    }

    const apiKey = userApiKey || GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'কোনো Gemini API Key পোৱা নগ’ল। অনুগ্ৰহ কৰি ছাৰ্ভাৰৰ .env-ত GEMINI_API_KEY সংহতি কৰক বা এপৰ ছেটিংছত আপোনাৰ নিজা Key যোগ কৰক।'
      });
    }

    const systemPrompt = getSystemPrompt(mode, lang);
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
      mode,
      lang
    });
  } catch (error) {
    console.error('Error in /api/solve:', error);
    res.status(500).json({ error: error.message || 'ছাৰ্ভাৰত ত্ৰুটি হৈছে।' });
  }
});

/**
 * Dedicated OCR Transcription Endpoint
 * Extracts text and mathematical formulas from an image without solving
 */
app.post('/api/ocr', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', userApiKey } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'কোনো ছবি প্ৰদান কৰা হোৱা নাই।' });
    }

    const apiKey = userApiKey || GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'কোনো Gemini API Key পোৱা নগ’ল।' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "You are an expert OCR transcription engine for Assamese, Bengali, and English mathematics. Transcribe all text, numbers, and mathematical formulas from this image accurately. Format mathematical symbols as standard LaTeX ($$...$$ or $...$). Output ONLY the transcribed text and formula without solving it."
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
        temperature: 0.1,
        maxOutputTokens: 2000
      }
    };

    const { text: transcription, model } = await callGeminiWithFallback(apiKey, requestBody);
    res.json({
      success: true,
      transcription,
      model
    });
  } catch (error) {
    console.error('Error in /api/ocr:', error);
    res.status(500).json({ error: error.message || 'OCR বিশ্লেষণত সমস্যা হৈছে।' });
  }
});

/**
 * Multimodal Voice Speech-to-Text Transcription Endpoint (Powered by Gemini)
 * Accurately transcribes spoken Assamese, Bengali, and English mathematics
 */
app.post('/api/voice-transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm', lang = 'as', userApiKey } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'কোনো অডিঅ’ তথ্য পোৱা নগ’ল।' });
    }

    const apiKey = userApiKey || GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'কোনো Gemini API Key পোৱা নগ’ল।' });
    }

    const cleanBase64 = audioBase64.replace(/^data:audio\/[^;]+;base64,/, '');
    const cleanMime = (mimeType || 'audio/webm').split(';')[0];

    const targetLangDesc = (lang === 'en')
      ? "Transcribe the audio accurately in English with mathematical notation."
      : (lang === 'bilingual')
      ? "Transcribe the audio in Assamese script with key mathematical terms or notations in standard symbols."
      : "Transcribe the audio accurately into native Assamese script (অসমীয়া লিপি).";

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are Axomগণিত AI's state-of-the-art Speech Recognition engine for Assamese & Mathematics.
${targetLangDesc}
Guidelines:
1. Output ONLY the transcribed mathematical question or problem statement.
2. Convert spoken math keywords into standard symbols:
   - "প্লাছ" / "প্লাস" -> "+"
   - "মাইনাস" / "বিয়োগ" -> "-"
   - "পূৰণ" / "গুণ" -> "×"
   - "হৰণ" / "ভাগ" -> "÷"
   - "বৰ্গ" / "স্কুৱাৰ" -> "²"
   - "ঘন" / "কিউব" -> "³"
   - "ঘাঁত" / "পাৱাৰ" -> "^"
   - "সমান" -> "="
   - "বৰ্গমূল" / "ৰূট" -> "√"
3. Do NOT include any filler, greeting, quotation marks, or conversational notes. Output strictly the transcribed text.`
            },
            {
              inlineData: {
                mimeType: cleanMime,
                data: cleanBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 500
      }
    };

    const { text: transcription, model } = await callGeminiWithFallback(apiKey, requestBody);
    res.json({
      success: true,
      transcription: transcription.trim(),
      model
    });
  } catch (error) {
    console.error('Error in /api/voice-transcribe:', error);
    res.status(500).json({ error: error.message || 'কণ্ঠস্বৰ বিশ্লেষণত সমস্যা হৈছে।' });
  }
});

/**
 * Multimodal Photo / OCR Math Solver Endpoint
 * Accepts base64 image, extracts question via Vision OCR, and solves it
 */
app.post('/api/solve-photo', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', mode = 'school', lang = 'as', userApiKey } = req.body;
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
    const systemPrompt = getSystemPrompt(mode, lang);

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            {
              text: `Please inspect this image carefully.
1. First, provide the Vision OCR transcription of the problem:
📷 **চিনাক্ত কৰা প্ৰশ্ন (Transcribed Problem):**
[Transcribe the exact problem in Assamese/English with KaTeX math notation]

2. Then, provide the complete solution:
📝 **সমাধান:**
[Provide the step-by-step mathematical solution with KaTeX]`
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
      mode,
      lang
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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 Axomগণিত বাণিজ্যিক ছাৰ্ভাৰ চলি আছে: http://localhost:${PORT}`);
    console.log(`⚡ অফলাইন ইঞ্জিন + Gemini AI + Photo OCR + ADRE/SEBA মোড প্ৰস্তুত!`);
    console.log(`===============================================`);
  });
}

module.exports = app;
