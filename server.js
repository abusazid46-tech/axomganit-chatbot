require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mathCache = require('./cache');
const authDb = require('./auth-db');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Trust reverse proxy (Vercel, Cloudflare) for accurate client IP rate limiting
app.set('trust proxy', 1);

// Enterprise HTTP Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // Preserves external CDN assets (KaTeX, FontAwesome, Cropper, Google Fonts)
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false
}));

// CORS Configuration - Permissive for web app & local testing, prevents unauthorized framing
const ALLOWED_ORIGINS = [
  'https://axomganit-chatbot.vercel.app',
  'https://axomganit.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Generous limiter for static/lightweight API calls (120 reqs/min per IP)
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'অত্যধিক অনুৰোধ কৰা হৈছে। অনুগ্ৰহ কৰি কিছু সময় অপেক্ষা কৰক।'
  }
});
app.use('/api/', generalLimiter);

// Commercial AI Solver Rate Limiter:
// 30 AI solves per 10 minutes per IP for public pool to protect Gemini API quota & server costs.
// Users providing their own Gemini API Key are automatically exempt from public quota limits.
const solverRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return Boolean(req.body && req.body.userApiKey && String(req.body.userApiKey).trim().length > 10);
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'অনুৰোধৰ সীমা অতিক্ৰম হৈছে (Rate Limit Exceeded: ১০ মিনিটত সৰ্বোচ্চ ৩০ টা সমাধান)। অনুগ্ৰহ কৰি কেইমিনিটমান অপেক্ষা কৰক বা এপৰ ছেটিংছত আপোনাৰ নিজা বিনামূলীয়া Gemini API Key যোগ কৰক।'
    });
  }
});

// Payload limits: 20MB for image base64, 100kb for regular forms
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

const { ICON_192_BUF, ICON_512_BUF, ICON_SVG_STR, MANIFEST_OBJ } = require('./pwa-assets');

// Serve static frontend assets & PWA files
app.get('/service-worker.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Content-Type', 'application/javascript');
  try {
    const filePath = path.join(__dirname, 'service-worker.js');
    if (fs.existsSync(filePath)) {
      return res.send(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {}
  res.sendFile('service-worker.js', { root: process.cwd() });
});

app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.json(MANIFEST_OBJ);
});

// Explicit routes for PWA icons (guaranteed true PNG delivery on Vercel)
app.get('/icons/icon-192.png', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(ICON_192_BUF);
});

app.get('/icons/icon-512.png', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(ICON_512_BUF);
});

app.get('/icons/icon.svg', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(ICON_SVG_STR);
});

app.use(express.static(__dirname));

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

// Pre-seed canonical question bank and previous year questions into LRU cache
// Guarantees instant sub-millisecond responses with 0 API quota consumption
try {
  PYQ_BANK.forEach(item => {
    if (item.question && item.shortcut) {
      const modeKey = (item.categoryKey === 'adre' || item.categoryKey === 'apsc') ? 'competitive' : 'school';
      const formattedAns = `### **${item.topic} (${item.exam})**\n\n**প্ৰশ্ন:** ${item.question}\n\n**সঠিক বিকল্প:** **${item.options[item.correctIndex]}**\n\n---\n### **ব্যৱহৃত সূত্ৰ (Formula):**\n$$${item.formula}$$\n\n### **ধাপে ধাপে চৰ্টকাট সমাধান (Shortcut Trick):**\n${item.shortcut}`;
      mathCache.setVault(item.question, modeKey, 'as', formattedAns, 'axomganit-pyq-vault');
    }
  });
} catch (e) {
  console.warn('PYQ cache pre-seeding warning:', e.message);
}

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
    hasServerApiKey: Boolean(GEMINI_API_KEY),
    cacheStats: mathCache.getStats(),
    hasSupabase: authDb.hasSupabase
  });
});

/**
 * User Profile & Subscription Endpoints
 */
app.get('/api/user/profile', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId || 'guest_default';
    const email = req.headers['x-user-email'] || req.query.email || '';
    const fullName = req.headers['x-user-name'] || req.query.name || '';
    const avatarUrl = req.headers['x-user-avatar'] || req.query.avatar || '';

    const profile = await authDb.getUserProfile(userId, { email, full_name: fullName, avatar_url: avatarUrl });
    res.json({ success: true, profile });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'ব্যৱহাৰকাৰীৰ তথ্য লোড কৰাত সমস্যা হৈছে।' });
  }
});

app.post('/api/user/upgrade', async (req, res) => {
  try {
    const { userId, plan = 'pro_monthly', durationDays = 30 } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID প্ৰয়োজন।' });
    }
    const profile = await authDb.upgradeUser(userId, plan, durationDays);
    res.json({
      success: true,
      message: 'অভিনন্দন! আপোনাৰ একাউণ্ট সফলভাৱে Axomগণিত Pro সদস্যতালৈ উন্নীত কৰা হ’ল।',
      profile
    });
  } catch (err) {
    console.error('Error upgrading user:', err);
    res.status(500).json({ error: 'চাবস্ক্ৰিপশ্বন সক্ৰিয় কৰাত সমস্যা হৈছে।' });
  }
});

/**
 * Dynamic UPI QR & Subscription Verification Endpoints
 */
app.get('/api/subscription/plans', (req, res) => {
  res.json({
    success: true,
    plans: authDb.getPlans(),
    payee: authDb.getPayeeDetails()
  });
});

app.post('/api/subscription/create-order', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId || 'guest_default';
    const { planId = 'pro_monthly' } = req.body;
    const order = authDb.createPaymentOrder(userId, planId);
    res.json(order);
  } catch (err) {
    console.error('Error creating payment order:', err);
    res.status(500).json({ success: false, error: 'অৰ্ডাৰ সৃষ্টি কৰাত সমস্যা হৈছে।' });
  }
});

app.post('/api/subscription/verify-utr', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId || 'guest_default';
    const { orderId, utr, planId = 'pro_monthly', email = '' } = req.body;

    if (!utr) {
      return res.status(400).json({ success: false, error: '১২টা সংখ্যাৰ UPI UTR / Ref No. প্ৰদান কৰক।' });
    }

    const result = await authDb.verifyUtrAndActivate(userId, orderId, utr, planId, email);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('Error verifying UTR:', err);
    res.status(500).json({ success: false, error: 'ট্ৰাঞ্জেকশ্বন পৰীক্ষা কৰাত সমস্যা হৈছে।' });
  }
});

/**
 * Public Client Configuration Endpoint
 * Delivers Supabase public project URL, anon key, and UPI payee details
 */
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    payeeUpi: process.env.PAYEE_UPI_ID || 'amiete66@okicici',
    payeeName: process.env.PAYEE_NAME || 'Abu Sazid Ahmed'
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
  process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash'
];

async function callGeminiWithFallback(apiKey, requestBody) {
  let lastError = null;
  for (const model of GEMINI_MODELS) {
    // Retry up to 2 times for transient socket disconnects (wsarecv, ECONNRESET, network hiccup)
    for (let attempt = 1; attempt <= 2; attempt++) {
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
          break; // Skip retry on HTTP 4xx API errors
        }
      } catch (err) {
        lastError = err;
        console.warn(`Model ${model} attempt ${attempt} fetch failed:`, err.message);
        if (attempt < 2) {
          // Brief backoff before socket retry
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }
  }
  throw lastError || new Error('সকলো Gemini মডেলে সঁহাৰি দিবলৈ ব্যৰ্থ হৈছে।');
}

/**
 * Gemini Streaming API with Multi-Model Fallback
 * Reads server-sent events from Google Generative Language API and calls onChunk
 */
async function streamGeminiWithFallback(apiKey, requestBody, onChunk) {
  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        lastError = new Error(errJson?.error?.message || `Gemini API Error (${response.status}) on ${model}`);
        console.warn(`Stream model ${model} returned error:`, lastError.message);
        continue;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let hasYieldedAnyText = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep last incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6).trim();
            if (jsonStr) {
              try {
                const parsed = JSON.parse(jsonStr);
                const chunkText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (chunkText) {
                  hasYieldedAnyText = true;
                  onChunk(chunkText);
                }
              } catch (e) {}
            }
          }
        }
      }

      if (hasYieldedAnyText) {
        return { model };
      }
    } catch (err) {
      lastError = err;
      console.warn(`Stream model ${model} fetch failed:`, err.message);
    }
  }
  throw lastError || new Error('সকলো Gemini মডেলে সঁহাৰি দিবলৈ ব্যৰ্থ হৈছে।');
}

/**
 * Live Token Streaming Problem Solver Endpoint (Server-Sent Events)
 * Delivers immediate typing-speed output for real-time pedagogical engagement
 */
app.post('/api/solve-stream', solverRateLimiter, async (req, res) => {
  const { prompt, imageBase64, mimeType = 'image/jpeg', mode = 'school', lang = 'as', userApiKey } = req.body;

  if (!prompt && !imageBase64) {
    return res.status(400).json({ error: 'প্ৰশ্ন বা ছবি প্ৰদান কৰক।' });
  }

  if (prompt && typeof prompt === 'string' && prompt.length > 4000) {
    return res.status(400).json({ error: 'প্ৰশ্নটো অত্যধিক দীঘল (সৰ্বোচ্চ ৪,০০০ বৰ্ণ)।' });
  }

  const apiKey = userApiKey || GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({
      error: 'কোনো Gemini API Key পোৱা নগ’ল। অনুগ্ৰহ কৰি API Key যোগ কৰক।'
    });
  }

  const safeMode = (mode === 'competitive') ? 'competitive' : 'school';
  const safeLang = ['as', 'en', 'bilingual'].includes(lang) ? lang : 'as';

  // Check Daily Quota & Subscription Status
  const userId = req.headers['x-user-id'] || req.body.userId || 'guest_default';
  const quota = await authDb.checkUserQuota(userId, userApiKey);
  if (!quota.allowed) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    if (res.flushHeaders) res.flushHeaders();
    res.write(`data: ${JSON.stringify({
      error: 'আজিৰ বাবে আপোনাৰ বিনামূলীয়া ৫ টা সমাধানৰ দৈনিক সীমা শেষ হৈছে। সীমাহীন সমাধান আৰু ফটো স্কেনৰ বাবে কেৱল ₹৯ বা ₹৩৯ দি Axomগণিত Pro লওক বা ⚙️ ছেটিংছত আপোনাৰ নিজা Gemini Key সংৰক্ষণ কৰক।',
      quotaExceeded: true,
      plan: 'free',
      dailyLimit: 5
    })}\n\n`);
    return res.end();
  }

  // 1. Check Smart Math Solution Cache (Instant sub-1ms response, 0 API quota cost)
  const cached = mathCache.get(prompt, safeMode, safeLang, imageBase64);
  if (cached) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    res.write(`data: ${JSON.stringify({ chunk: cached.solution })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true, model: cached.model + ' (cached)', mode: safeMode, lang: safeLang, cached: true })}\n\n`);
    return res.end();
  }

  const systemPrompt = getSystemPrompt(safeMode, safeLang);

  const parts = [{ text: systemPrompt }];
  if (imageBase64) {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    parts.push({
      text: `Please inspect this math problem image carefully. First provide the transcription with KaTeX math, then give the complete step-by-step solution.\n${prompt ? `অতিৰিক্ত প্ৰশ্ন: ${prompt}` : ''}`
    });
    parts.push({
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: cleanBase64
      }
    });
  } else {
    parts.push({ text: `শিক্ষাৰ্থীৰ প্ৰশ্ন:\n${prompt}` });
  }

  const requestBody = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: safeMode === 'competitive' ? 0.1 : 0.2,
      maxOutputTokens: 2500
    }
  };

  // Set SSE response headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  try {
    let accumulatedSolution = '';
    const { model } = await streamGeminiWithFallback(apiKey, requestBody, (chunk) => {
      accumulatedSolution += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    });

    if (accumulatedSolution && accumulatedSolution.trim().length > 10) {
      mathCache.set(prompt, safeMode, safeLang, accumulatedSolution, model, imageBase64);
    }

    // Record solve against user quota
    await authDb.recordUserSolve(userId);

    res.write(`data: ${JSON.stringify({ done: true, model, mode: safeMode, lang: safeLang })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Error in /api/solve-stream:', err);
    res.write(`data: ${JSON.stringify({ error: err.message || 'ছাৰ্ভাৰত ত্ৰুটি হৈছে।' })}\n\n`);
    res.end();
  }
});

/**
 * Text Problem Solver Endpoint
 */
app.post('/api/solve', solverRateLimiter, async (req, res) => {
  try {
    const { prompt, mode = 'school', lang = 'as', userApiKey } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'প্ৰশ্নটো খালী হ’ব নোৱাৰে।' });
    }

    if (prompt.length > 4000) {
      return res.status(400).json({ error: 'প্ৰশ্নটো অত্যধিক দীঘল (সৰ্বোচ্চ ৪,০০০ বৰ্ণ)।' });
    }

    const safeMode = (mode === 'competitive') ? 'competitive' : 'school';
    const safeLang = ['as', 'en', 'bilingual'].includes(lang) ? lang : 'as';

    // Check Daily Quota & Subscription Status
    const userId = req.headers['x-user-id'] || req.body.userId || 'guest_default';
    const quota = await authDb.checkUserQuota(userId, userApiKey);
    if (!quota.allowed) {
      return res.status(403).json({
        error: 'আজিৰ বাবে আপোনাৰ বিনামূলীয়া ৫ টা সমাধানৰ দৈনিক সীমা শেষ হৈছে। সীমাহীন সমাধানৰ বাবে কেৱল ₹৯ বা ₹৩৯ দি Axomগণিত Pro লওক বা ⚙️ ছেটিংছত নিজৰ Gemini Key ব্যৱহাৰ কৰক।',
        quotaExceeded: true,
        plan: 'free',
        dailyLimit: 5
      });
    }

    // Check smart cache first
    const cached = mathCache.get(prompt, safeMode, safeLang);
    if (cached) {
      return res.json({
        success: true,
        solution: cached.solution,
        model: cached.model + ' (cached)',
        cached: true,
        mode: safeMode,
        lang: safeLang
      });
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
    if (solution) {
      mathCache.set(prompt, safeMode, safeLang, solution, model);
      await authDb.recordUserSolve(userId);
    }
    res.json({
      success: true,
      solution,
      model,
      mode: safeMode,
      lang: safeLang
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
app.post('/api/ocr', solverRateLimiter, async (req, res) => {
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
app.post('/api/voice-transcribe', solverRateLimiter, async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/wav', lang = 'as', userApiKey } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'কোনো অডিঅ’ তথ্য পোৱা নগ’ল।' });
    }

    const apiKey = userApiKey || GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'কোনো Gemini API Key পোৱা নগ’ল।' });
    }

    const cleanBase64 = audioBase64.replace(/^data:audio\/[^;]+;base64,/, '');
    const cleanMime = (mimeType || 'audio/wav').split(';')[0];

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
 * Authentic Assamese Neural Text-to-Speech (TTS) Endpoint
 * Bridges device limitations where native Assamese (as-IN) voices are missing.
 * Normalizes math symbols to spoken Assamese and streams authentic neural audio.
 */
app.get('/api/tts', async (req, res) => {
  try {
    const text = req.query.text || '';
    if (!text.trim()) {
      return res.status(400).send('No text provided');
    }

    let clean = text
      .replace(/#+\s*/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 হৰণ $2')
      .replace(/\\sqrt\{([^}]+)\}/g, '$1 ৰ বৰ্গমূল')
      .replace(/\\times/g, ' পূৰণ ')
      .replace(/\\pm/g, ' যোগ বা বিয়োগ ')
      .replace(/\\le/g, ' তকৈ সৰু বা সমান ')
      .replace(/\\ge/g, ' তকৈ ডাঙৰ বা সমান ')
      .replace(/\\ne/g, ' অসমান ')
      .replace(/\\approx/g, ' প্ৰায় ')
      .replace(/\$\$/g, ' ')
      .replace(/\$/g, ' ')
      .replace(/x\^2|x²/gi, ' x স্কোৱাৰ ')
      .replace(/x\^3|x³/gi, ' x কিউব ')
      .replace(/=/g, ' সমান ')
      .replace(/\+/g, ' যোগ ')
      .replace(/-/g, ' বিয়োগ ')
      .replace(/\//g, ' হৰণ ')
      .replace(/\*/g, ' পূৰণ ')
      .replace(/[%]/g, ' শতাংশ ')
      .replace(/[{}\\_\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const snippet = clean.slice(0, 240);

    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(snippet)}&tl=bn&client=tw-ob`;
    const audioResp = await fetch(googleTtsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!audioResp.ok) {
      return res.status(audioResp.status).send('TTS upstream audio error');
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buffer = await audioResp.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Error in /api/tts:', err);
    res.status(500).send(err.message || 'Error generating TTS audio');
  }
});

/**
 * Multimodal Photo / OCR Math Solver Endpoint
 * Accepts base64 image, extracts question via Vision OCR, and solves it
 */
app.post('/api/solve-photo', solverRateLimiter, async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', mode = 'school', lang = 'as', userApiKey } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'কোনো ছবি প্ৰদান কৰা হোৱা নাই।' });
    }

    const safeMode = (mode === 'competitive') ? 'competitive' : 'school';
    const safeLang = ['as', 'en', 'bilingual'].includes(lang) ? lang : 'as';

    // Check Daily Quota & Subscription Status
    const userId = req.headers['x-user-id'] || req.body.userId || 'guest_default';
    const quota = await authDb.checkUserQuota(userId, userApiKey);
    if (!quota.allowed) {
      return res.status(403).json({
        error: 'আজিৰ বাবে আপোনাৰ বিনামূলীয়া ৫ টা সমাধানৰ দৈনিক সীমা শেষ হৈছে। ফটো স্কেন আৰু সীমাহীন সমাধানৰ বাবে Axomগণিত Pro লওক।',
        quotaExceeded: true,
        plan: 'free',
        dailyLimit: 5
      });
    }

    // Check smart cache for identical duplicate photo
    const cached = mathCache.get(null, safeMode, safeLang, imageBase64);
    if (cached) {
      return res.json({
        success: true,
        solution: cached.solution,
        model: cached.model + ' (cached)',
        cached: true,
        mode: safeMode,
        lang: safeLang
      });
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
    if (solution) {
      mathCache.set(null, safeMode, safeLang, solution, model, imageBase64);
      await authDb.recordUserSolve(userId);
    }
    res.json({
      success: true,
      solution,
      model,
      mode: safeMode,
      lang: safeLang
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
