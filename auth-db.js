const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://kskivlhedvcdwohfhywh.supabase.co').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtza2l2bGhlZHZjZHdvaGZoeXdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDY0MTYsImV4cCI6MjA4ODc4MjQxNn0.tGUYv1LHW8oUN2zsTh4dWgqm48JwDxKr_FfP4GGPDZY').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtza2l2bGhlZHZjZHdvaGZoeXdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIwNjQxNiwiZXhwIjoyMDg4NzgyNDE2fQ.QAh9OLBDNI0ql7A4bs0tcNXM8qClfjAvRjSQEtF-qYE').trim();

const PAYEE_UPI_ID = (process.env.PAYEE_UPI_ID || 'amiete66@okicici').replace(/\s+/g, '').trim();
const PAYEE_NAME = (process.env.PAYEE_NAME || 'Abu Sazid Ahmed').replace(/\s+/g, ' ').trim();

// Free tier constraints
const FREE_DAILY_SOLVE_LIMIT = 2; // Free only 2 pro features per day

// Comprehensive Optimized Plan Catalog
const PLANS = {
  // === Std 1-12 (School) Plans ===
  school_daily: {
    id: 'school_daily',
    category: 'school',
    categoryName: 'বিদ্যালয় (Std 1–12)',
    name: 'দৈনিক পাছ (Std 1–12)',
    shortName: 'দৈনিক পাছ',
    amount: 10,
    days: 1,
    tag: 'পৰীক্ষাৰ দিনৰ বাবে',
    badge: '২৪ ঘণ্টা All Pro Unlimited',
    imageLimit: 999999,
    voiceLimit: 999999,
    features: [
      '২৪ ঘণ্টা সকলো Pro সুবিধা সীমাহীন (Unlimited)',
      'সীমাহীন ফটো OCR সমাধান',
      'সীমাহীন অসমীয়া ভইচ ইনপুট ও আউটপুট',
      'SEBA / AHSEC / CBSE Std 1-12 পাঠ্যক্ৰম'
    ]
  },
  school_monthly_basic: {
    id: 'school_monthly_basic',
    category: 'school',
    categoryName: 'বিদ্যালয় (Std 1–12)',
    name: 'ছাত্ৰ মাহেকীয়া বেচিক (Std 1–12)',
    shortName: 'মাহেকীয়া বেচিক',
    amount: 49,
    days: 30,
    tag: 'মিতব্যয়ী সঞ্চয়',
    badge: 'দৈনিক ২৫ ফটো, ১০ ভইচ',
    imageLimit: 25,
    voiceLimit: 10,
    features: [
      '৩০ দিনৰ Pro এক্সেছ',
      'দৈনিক ২৫ টা ফটো/ইমেজ আপলোড',
      'দৈনিক ১০ টা ভইচ ইনপুট ও ১০ টা ভইচ আউটপুট',
      'ধাপে-ধাপে সম্পূৰ্ণ গণিত সমাধান'
    ]
  },
  school_monthly_pro: {
    id: 'school_monthly_pro',
    category: 'school',
    categoryName: 'বিদ্যালয় (Std 1–12)',
    name: 'ছাত্ৰ মাহেকীয়া প্ৰিমিয়াম (Std 1–12)',
    shortName: 'মাহেকীয়া প্ৰিমিয়াম',
    amount: 99,
    days: 30,
    tag: 'সৰ্বাধিক জনপ্ৰিয়',
    badge: 'দৈনিক ৬০ ফটো, ৩০ ভইচ',
    imageLimit: 60,
    voiceLimit: 30,
    features: [
      '৩০ দিনৰ প্ৰিমিয়াম Pro সুবিধা',
      'দৈনিক ৬০ টা ফটো আপলোড',
      'দৈনিক ৩০ টা ভইচ ইনপুট ও ৩০ টা ভইচ আউটপুট',
      'প্ৰিন্টযোগ্য ৱাটাৰমাৰ্কবিহীন PDF ৱৰ্কশ্বীট'
    ]
  },
  school_6month: {
    id: 'school_6month',
    category: 'school',
    categoryName: 'বিদ্যালয় (Std 1–12)',
    name: 'ছাত্ৰ ৬-মহীয়া পাছ (Std 1–12)',
    shortName: '৬-মহীয়া ছেভাৰ',
    amount: 499,
    days: 180,
    tag: 'অৰ্ধবাৰ্ষিক মেগা ছেভাৰ',
    badge: 'দৈনিক ৬০ ফটো, ৩০ ভইচ',
    imageLimit: 60,
    voiceLimit: 30,
    features: [
      '১৮০ দিন (৬ মাহ) সম্পূৰ্ণ Pro সেৱা',
      'দৈনিক ৬০ টা ফটো আপলোড',
      'দৈনিক ৩০ টা ভইচ ইনপুট ও ৩০ টা ভইচ আউটপুট',
      'বোৰ্ড পৰীক্ষাৰ নিশ্চিত প্ৰস্তুতি'
    ]
  },

  // === Competitive Exam Plans (ADRE / APSC / TET / Assam Police) ===
  competitive_monthly: {
    id: 'competitive_monthly',
    category: 'competitive',
    categoryName: 'প্ৰতিযোগিতামূলক পৰীক্ষা',
    name: 'মাহেকীয়া Pro (ADRE / APSC / TET / Police)',
    shortName: 'মাহেকীয়া চাকৰি প্ৰাৰ্থী',
    amount: 99,
    days: 30,
    tag: 'চাকৰি প্ৰাৰ্থীৰ পচন্দ',
    badge: 'All Pro + ৬০ ফটো, ৩০ ভইচ',
    imageLimit: 60,
    voiceLimit: 30,
    features: [
      'All Pro সুবিধা + ৩০-ছেকেণ্ড চৰ্টকাট ট্ৰিক',
      'দৈনিক ৬০ টা ফটো আপলোড',
      'দৈনিক ৩০ টা ভইচ ইনপুট ও ৩০ টা ভইচ আউটপুট',
      'ADRE Gr III/IV, APSC, TET, Police PYQ কোষ'
    ]
  },
  competitive_3month: {
    id: 'competitive_3month',
    category: 'competitive',
    categoryName: 'প্ৰতিযোগিতামূলক পৰীক্ষা',
    name: '৩-মহীয়া ক্ৰাশ্ব কোৰ্চ (ADRE / APSC / TET / Police)',
    shortName: '৩-মহীয়া ক্ৰাশ্ব কোৰ্চ',
    amount: 249,
    days: 90,
    tag: 'সৰ্বোত্তম সঞ্চয়',
    badge: 'All Pro + ৬০ ফটো, ৩০ ভইচ',
    imageLimit: 60,
    voiceLimit: 30,
    features: [
      '৯০ দিনৰ সম্পূৰ্ণ পৰীক্ষা ক্ৰাশ্ব কোৰ্চ',
      'All Pro সুবিধা + অপচন এলিমিনেশ্বন ট্ৰিক',
      'দৈনিক ৬০ টা ফটো আপলোড',
      'দৈনিক ৩০ টা ভইচ ইনপুট ও ৩০ টা ভইচ আউটপুট',
      'সম্পূৰ্ণ বিগত বৰ্ষৰ প্ৰশ্নকোষ (PYQ Vault)'
    ]
  },

  // Legacy mappings for backwards compatibility
  pro_daily: {
    id: 'school_daily',
    category: 'school',
    name: 'দৈনিক পাছ (Std 1–12)',
    amount: 10,
    days: 1,
    imageLimit: 999999,
    voiceLimit: 999999
  },
  pro_monthly: {
    id: 'school_monthly_basic',
    category: 'school',
    name: 'ছাত্ৰ মাহেকীয়া বেচিক',
    amount: 49,
    days: 30,
    imageLimit: 25,
    voiceLimit: 10
  },
  pro_annual: {
    id: 'school_6month',
    category: 'school',
    name: '৬-মহীয়া পাছ',
    amount: 499,
    days: 180,
    imageLimit: 60,
    voiceLimit: 30
  }
};

// In-memory / file fallback store for local development and zero-setup deployment
const LOCAL_STORE_FILE = path.join(__dirname, '.user-store.json');
const PAYMENTS_STORE_FILE = path.join(__dirname, '.payments-store.json');

let localUsers = new Map();
let localPayments = new Map(); // key: utr, value: payment record

function loadLocalStores() {
  try {
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(LOCAL_STORE_FILE, 'utf8'));
      Object.entries(data).forEach(([id, user]) => localUsers.set(id, user));
    }
  } catch (e) {
    console.warn('Could not read .user-store.json:', e.message);
  }

  try {
    if (fs.existsSync(PAYMENTS_STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(PAYMENTS_STORE_FILE, 'utf8'));
      Object.entries(data).forEach(([utr, p]) => localPayments.set(utr, p));
    }
  } catch (e) {
    console.warn('Could not read .payments-store.json:', e.message);
  }
}

function saveLocalUsers() {
  try {
    const obj = {};
    for (const [id, user] of localUsers.entries()) {
      obj[id] = user;
    }
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    // Non-critical in serverless
  }
}

function saveLocalPayments() {
  try {
    const obj = {};
    for (const [utr, p] of localPayments.entries()) {
      obj[utr] = p;
    }
    fs.writeFileSync(PAYMENTS_STORE_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    // Non-critical in serverless
  }
}

loadLocalStores();

class AuthDatabase {
  constructor() {
    this.hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
    if (this.hasSupabase) {
      try {
        this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);
        console.log('✅ Supabase Client initialized successfully for Axomগণিত');
      } catch (err) {
        console.warn('⚠️ Supabase init failed, falling back to local user store:', err.message);
        this.hasSupabase = false;
      }
    } else {
      console.log('ℹ️ Supabase credentials not found in .env; using local-first user store with guest/demo mode.');
    }
  }

  getTodayDateString() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Get or create user profile
   */
  async getUserProfile(userId, fallbackInfo = {}) {
    const safeId = String(userId || 'guest_default').trim();

    if (this.hasSupabase && safeId.length > 20 && !safeId.startsWith('guest_')) {
      try {
        const { data, error } = await this.supabase
          .from('profiles')
          .select('*')
          .eq('id', safeId)
          .single();

        if (data && !error) {
          return this.sanitizeProfile(data);
        }

        // Fallback: Query Supabase Auth directly for user details if profile table is pending creation
        const { data: authUserData } = await this.supabase.auth.admin.getUserById(safeId);
        if (authUserData && authUserData.user) {
          const u = authUserData.user;
          fallbackInfo.email = fallbackInfo.email || u.email;
          fallbackInfo.full_name = fallbackInfo.full_name || u.user_metadata?.full_name || u.user_metadata?.name || u.email.split('@')[0];
          fallbackInfo.avatar_url = fallbackInfo.avatar_url || u.user_metadata?.avatar_url || u.user_metadata?.picture || '';
        }
      } catch (e) {
        console.warn('Supabase profile fetch error:', e.message);
      }
    }

    // Local Store Fallback
    const today = this.getTodayDateString();
    let user = localUsers.get(safeId);

    if (!user) {
      user = {
        id: safeId,
        email: fallbackInfo.email || (safeId.startsWith('guest_') ? 'guest@axomganit.local' : `${safeId}@axomganit.local`),
        full_name: fallbackInfo.full_name || (safeId.startsWith('guest_') ? 'অতিথি শিক্ষার্থী (Guest)' : 'মেধাৱী শিক্ষাৰ্থী'),
        avatar_url: fallbackInfo.avatar_url || '',
        plan: 'free',
        pro_valid_until: null,
        daily_solve_count: 0,
        last_solve_date: today,
        created_at: new Date().toISOString()
      };
      localUsers.set(safeId, user);
      saveLocalUsers();
    } else {
      // Reset solve count on new day
      if (user.last_solve_date !== today) {
        user.daily_solve_count = 0;
        user.last_solve_date = today;
        saveLocalUsers();
      }
    }

    return this.sanitizeProfile(user);
  }

  sanitizeProfile(profile, authUser = null) {
    const today = this.getTodayDateString();
    const isPro = this.isUserPro(profile);
    const count = (profile.last_solve_date === today) ? (profile.daily_solve_count || 0) : 0;
    const remaining = isPro ? 999999 : Math.max(0, FREE_DAILY_SOLVE_LIMIT - count);
    const meta = authUser?.user_metadata || {};
    const isBlocked = Boolean(profile.is_blocked || meta.is_blocked || false);
    const mobile = profile.mobile || meta.mobile || meta.phone || '';

    const planMeta = PLANS[profile.plan] || {};

    return {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      mobile: mobile,
      is_blocked: isBlocked,
      plan: isPro ? profile.plan : 'free',
      planName: isPro ? (planMeta.name || profile.plan) : 'বিনামূলীয়া (Free)',
      isPro: isPro,
      pro_valid_until: profile.pro_valid_until,
      daily_solve_count: count,
      daily_limit: FREE_DAILY_SOLVE_LIMIT,
      remaining_solves: remaining,
      image_limit: isPro ? (planMeta.imageLimit || 60) : 2,
      voice_limit: isPro ? (planMeta.voiceLimit || 30) : 2,
      hasServerSupabase: this.hasSupabase,
      created_at: profile.created_at
    };
  }

  isUserPro(profile) {
    if (!profile || !profile.plan || profile.plan === 'free') return false;
    if (!profile.pro_valid_until) return false;
    return new Date(profile.pro_valid_until) > new Date();
  }

  /**
   * Check if user is allowed to solve a problem
   */
  async checkUserQuota(userId, userApiKey) {
    const profile = await this.getUserProfile(userId);

    // Block check
    if (profile.is_blocked) {
      return {
        allowed: false,
        reason: 'blocked',
        error: '🚫 আপোনাৰ একাউণ্ট এডমিনে সাময়িকভাৱে স্থগিত (Block) কৰিছে। অনুগ্ৰহ কৰি সাহায্যৰ বাবে যোগাযোগ কৰক।'
      };
    }

    // 1. If user supplies their own API Key, quota is ALWAYS unlimited
    if (userApiKey && String(userApiKey).trim().length > 10) {
      return {
        allowed: true,
        reason: 'byok',
        isPro: true,
        remaining: 999999,
        plan: 'byok'
      };
    }

    if (profile.isPro) {
      return {
        allowed: true,
        reason: 'pro',
        isPro: true,
        remaining: profile.remaining_solves,
        plan: profile.plan
      };
    }

    if (profile.remaining_solves > 0) {
      return {
        allowed: true,
        reason: 'free_quota',
        isPro: false,
        remaining: profile.remaining_solves,
        plan: 'free'
      };
    }

    return {
      allowed: false,
      reason: 'quota_exceeded',
      isPro: false,
      remaining: 0,
      plan: 'free',
      daily_limit: FREE_DAILY_SOLVE_LIMIT
    };
  }

  /**
   * Record a problem solve against the user's daily count
   */
  async recordUserSolve(userId) {
    const safeId = String(userId || 'guest_default').trim();
    const today = this.getTodayDateString();

    let user = localUsers.get(safeId);
    if (!user) {
      await this.getUserProfile(safeId);
      user = localUsers.get(safeId);
    }

    if (user) {
      if (user.last_solve_date !== today) {
        user.daily_solve_count = 1;
        user.last_solve_date = today;
      } else {
        user.daily_solve_count = (user.daily_solve_count || 0) + 1;
      }
      saveLocalUsers();
    }

    if (this.hasSupabase && safeId.length > 20 && !safeId.startsWith('guest_')) {
      try {
        await this.supabase.rpc('increment_daily_solve', { user_id: safeId }).catch(async () => {
          // Direct update fallback
          await this.supabase
            .from('profiles')
            .update({
              daily_solve_count: user ? user.daily_solve_count : 1,
              last_solve_date: today
            })
            .eq('id', safeId);
        });
      } catch (e) {}
    }
  }

  /**
   * Upgrade user to Pro plan
   */
  async upgradeUser(userId, plan = 'pro_monthly', durationDays = 30) {
    const safeId = String(userId || 'guest_default').trim();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + (parseInt(durationDays, 10) || 30));

    let user = localUsers.get(safeId);
    if (!user) {
      await this.getUserProfile(safeId);
      user = localUsers.get(safeId);
    }

    if (user) {
      user.plan = plan;
      user.pro_valid_until = expiryDate.toISOString();
      saveLocalUsers();
    }

    if (this.hasSupabase && safeId.length > 20 && !safeId.startsWith('guest_')) {
      try {
        await this.supabase
          .from('profiles')
          .update({
            plan: plan,
            pro_valid_until: expiryDate.toISOString()
          })
          .eq('id', safeId);
      } catch (e) {
        console.warn('Supabase upgrade error:', e.message);
      }
    }

    return this.getUserProfile(safeId);
  }

  getPlans() {
    return PLANS;
  }

  getPayeeDetails() {
    return {
      payeeUpi: PAYEE_UPI_ID,
      payeeName: PAYEE_NAME
    };
  }

  /**
   * Create dynamic UPI payment order
   */
  createPaymentOrder(userId, planId = 'pro_monthly') {
    const plan = PLANS[planId] || PLANS.pro_monthly;
    const orderId = `AXOM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    // NPCI standard UPI payment intent URL
    const upiUrl = `upi://pay?pa=${encodeURIComponent(PAYEE_UPI_ID)}&pn=${encodeURIComponent(PAYEE_NAME)}&am=${plan.amount}&cu=INR&tn=${encodeURIComponent('Axomganit ' + plan.name + ' - ' + orderId)}`;

    return {
      success: true,
      orderId,
      upiUrl,
      payeeUpi: PAYEE_UPI_ID,
      payeeName: PAYEE_NAME,
      amount: plan.amount,
      plan: plan
    };
  }

  /**
   * Submit UTR for Admin Review (Pending Verification)
   * Prevents fraudulent access until admin verifies actual bank credit
   */
  async submitUtrForApproval(userId, orderId, utr, planId = 'pro_monthly', userEmail = '', userName = '', userMobile = '') {
    const cleanUtr = String(utr || '').replace(/\D/g, '').trim();
    const cleanMobile = String(userMobile || '').replace(/\D/g, '').trim();

    if (cleanUtr.length !== 12) {
      return {
        success: false,
        error: 'অনুগ্ৰহ কৰি ১২-ডিজিটৰ শুদ্ধ UPI Transaction ID (UTR) প্ৰদান কৰক।'
      };
    }

    const safeId = String(userId || 'guest_default').trim();
    const plan = PLANS[planId] || PLANS.pro_monthly;

    // Check if this UTR was already submitted in Supabase
    if (this.hasSupabase) {
      try {
        const { data: existing } = await this.supabase
          .from('payments')
          .select('*')
          .eq('utr', cleanUtr)
          .maybeSingle();

        if (existing) {
          if (existing.status === 'completed') {
            return { success: false, error: 'এই UTR / Transaction No. ইতিমধ্যে অনুমোদিত হৈছে!' };
          }
          if (existing.status === 'pending') {
            return {
              success: true,
              status: 'pending',
              orderId: existing.order_id,
              message: 'আপোনাৰ এই UTR টো ইতিমধ্যে পৰীক্ষাৰ বাবে জমা হৈছে। অনুগ্ৰহ কৰি অপেক্ষা কৰক।'
            };
          }
        }
      } catch (e) {}
    }

    // Save mobile to Supabase Auth metadata if user is logged in
    if (this.hasSupabase && safeId.length > 20 && !safeId.startsWith('guest_') && cleanMobile) {
      try {
        await this.supabase.auth.admin.updateUserById(safeId, {
          user_metadata: { mobile: cleanMobile }
        });
      } catch (e) {}
    }

    const generatedOrderId = orderId || `AXOM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Format user_email to preserve mobile number in payments table
    let emailToSave = userEmail || '';
    if (cleanMobile && !emailToSave.includes('| Mobile:')) {
      emailToSave = `${emailToSave || 'student@axomganit.local'} | Mobile: ${cleanMobile}`;
    }

    const paymentRecord = {
      orderId: generatedOrderId,
      utr: cleanUtr,
      userId: safeId,
      userEmail: emailToSave,
      userName: userName || 'মেধাৱী শিক্ষাৰ্থী',
      userMobile: cleanMobile,
      plan: plan.id,
      planName: plan.name,
      amount: plan.amount,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    localPayments.set(cleanUtr, paymentRecord);
    saveLocalPayments();

    // Persist in Supabase payments table
    if (this.hasSupabase) {
      try {
        await this.supabase.from('payments').insert({
          user_id: safeId.length > 20 && !safeId.startsWith('guest_') ? safeId : null,
          user_email: emailToSave,
          plan: plan.id,
          amount: plan.amount,
          order_id: generatedOrderId,
          utr: cleanUtr,
          status: 'pending',
          valid_until: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Error inserting pending payment to Supabase:', e.message);
      }
    }

    return {
      success: true,
      status: 'pending',
      orderId: generatedOrderId,
      utr: cleanUtr,
      message: 'আপোনাৰ UTR অনুৰোধ সফলতাৰে দাখিল কৰা হৈছে। এডমিনে পেমেণ্ট পৰীক্ষা কৰাৰ পিছতে আপোনাৰ Pro একাউণ্ট সক্ৰিয় হ’ব।'
    };
  }

  /**
   * Get payments grouped for admin review directly from Cloud Database
   */
  async getAdminPayments() {
    let paymentsList = [];

    if (this.hasSupabase) {
      try {
        const { data: dbPayments, error } = await this.supabase
          .from('payments')
          .select('*')
          .order('created_at', { ascending: false });

        if (dbPayments && !error) {
          const { data: profiles } = await this.supabase.from('profiles').select('*');
          const profMap = new Map((profiles || []).map(p => [p.id, p]));

          let authMap = new Map();
          try {
            const { data: authData } = await this.supabase.auth.admin.listUsers();
            authMap = new Map((authData?.users || []).map(u => [u.id, u]));
          } catch (e) {}

          paymentsList = dbPayments.map(p => {
            const u = profMap.get(p.user_id) || {};
            const authUser = authMap.get(p.user_id);
            const meta = authUser?.user_metadata || {};

            let cleanEmail = p.user_email || u.email || authUser?.email || '';
            let userMobile = u.mobile || meta.mobile || meta.phone || '';

            if (cleanEmail.includes('| Mobile:')) {
              const parts = cleanEmail.split('| Mobile:');
              cleanEmail = parts[0].trim();
              if (!userMobile) userMobile = parts[1].trim();
            }

            return {
              orderId: p.order_id,
              utr: p.utr,
              amount: p.amount,
              plan: p.plan,
              planName: PLANS[p.plan]?.name || p.plan,
              status: p.status,
              createdAt: p.created_at,
              validUntil: p.valid_until,
              userId: p.user_id,
              userEmail: cleanEmail,
              userName: u.full_name || meta.full_name || meta.name || 'শিক্ষাৰ্থী',
              userAvatar: u.avatar_url || meta.avatar_url || '',
              userMobile: userMobile
            };
          });
        }
      } catch (err) {
        console.warn('Supabase getAdminPayments query error:', err.message);
      }
    }

    // Merge in-memory local payments if any not in database
    const existingOrders = new Set(paymentsList.map(p => p.orderId));
    for (const p of localPayments.values()) {
      if (!existingOrders.has(p.orderId)) {
        paymentsList.push(p);
      }
    }

    const pending = paymentsList.filter(p => p.status === 'pending');
    const completed = paymentsList.filter(p => p.status === 'completed');
    const rejected = paymentsList.filter(p => p.status === 'rejected');
    const totalRevenue = completed.reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
      pending,
      completed,
      rejected,
      stats: {
        pendingCount: pending.length,
        completedCount: completed.length,
        rejectedCount: rejected.length,
        totalRevenue
      }
    };
  }

  /**
   * Get all registered users for Admin Management
   */
  async getAdminUsers() {
    let usersList = [];

    if (this.hasSupabase) {
      try {
        const { data: profiles, error } = await this.supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (profiles && !error) {
          const { data: authData } = await this.supabase.auth.admin.listUsers();
          const authMap = new Map((authData?.users || []).map(u => [u.id, u]));

          usersList = profiles.map(p => {
            const authUser = authMap.get(p.id);
            const meta = authUser?.user_metadata || {};
            const isPro = this.isUserPro(p);
            return {
              id: p.id,
              email: p.email || authUser?.email || '',
              full_name: p.full_name || meta.full_name || meta.name || 'শিক্ষাৰ্থী',
              avatar_url: p.avatar_url || meta.avatar_url || '',
              mobile: p.mobile || meta.mobile || meta.phone || '',
              plan: isPro ? p.plan : 'free',
              planName: PLANS[p.plan]?.name || (isPro ? p.plan : 'বিনামূলীয়া'),
              isPro: isPro,
              pro_valid_until: p.pro_valid_until,
              daily_solve_count: p.daily_solve_count || 0,
              is_blocked: Boolean(p.is_blocked || meta.is_blocked || false),
              created_at: p.created_at || authUser?.created_at,
              last_sign_in_at: authUser?.last_sign_in_at
            };
          });
        }
      } catch (err) {
        console.warn('Supabase getAdminUsers error:', err.message);
      }
    }

    // Include local users if not present
    const existingUserIds = new Set(usersList.map(u => u.id));
    for (const [id, u] of localUsers.entries()) {
      if (!existingUserIds.has(id)) {
        usersList.push(this.sanitizeProfile(u));
      }
    }

    return {
      success: true,
      totalUsers: usersList.length,
      users: usersList
    };
  }

  /**
   * Block or Unblock a user
   */
  async toggleUserBlock(userId, isBlocked) {
    const safeId = String(userId || '').trim();
    if (!safeId) return { success: false, error: 'User ID প্ৰয়োজন।' };

    const blockVal = Boolean(isBlocked);

    if (this.hasSupabase && safeId.length > 20 && !safeId.startsWith('guest_')) {
      try {
        await this.supabase.auth.admin.updateUserById(safeId, {
          user_metadata: { is_blocked: blockVal }
        });
        await this.supabase
          .from('profiles')
          .update({ is_blocked: blockVal })
          .eq('id', safeId)
          .catch(() => {});
      } catch (e) {
        console.warn('Supabase toggleUserBlock error:', e.message);
      }
    }

    const user = localUsers.get(safeId);
    if (user) {
      user.is_blocked = blockVal;
      saveLocalUsers();
    }

    return {
      success: true,
      userId: safeId,
      is_blocked: blockVal,
      message: blockVal ? 'ব্যৱহাৰকাৰীক সফলভাৱে Block কৰা হ’ল।' : 'ব্যৱহাৰকাৰীৰ Block সফলভাৱে আঁতৰোৱা হ’ল।'
    };
  }

  /**
   * Admin manually sets/overrides a user's subscription plan
   */
  async setUserPlanManually(userId, planId = 'pro_monthly', durationDays = 30) {
    const safeId = String(userId || '').trim();
    if (!safeId) return { success: false, error: 'User ID প্ৰয়োজন।' };

    const days = parseInt(durationDays, 10) || (PLANS[planId]?.days || 30);
    const profile = await this.upgradeUser(safeId, planId, days);

    return {
      success: true,
      profile,
      message: `ব্যৱহাৰকাৰীৰ প্লেন সফলভাৱে ${PLANS[planId]?.name || planId} লৈ উন্নীত কৰা হ’ল।`
    };
  }

  /**
   * Admin approves payment and unlocks Pro subscription
   */
  async approvePayment(orderId) {
    let target = null;
    let targetUtr = null;

    // First check Supabase
    if (this.hasSupabase) {
      try {
        const { data: dbPayment } = await this.supabase
          .from('payments')
          .select('*')
          .eq('order_id', orderId)
          .maybeSingle();

        if (dbPayment) {
          target = {
            orderId: dbPayment.order_id,
            userId: dbPayment.user_id,
            plan: dbPayment.plan,
            amount: dbPayment.amount,
            utr: dbPayment.utr
          };
        }
      } catch (e) {}
    }

    if (!target) {
      for (const [utr, p] of localPayments.entries()) {
        if (p.orderId === orderId || p.utr === orderId) {
          target = p;
          targetUtr = utr;
          break;
        }
      }
    }

    if (!target) {
      return { success: false, error: 'অৰ্ডাৰ বিচাৰি পোৱা নগ’ল।' };
    }

    const plan = PLANS[target.plan] || PLANS.pro_monthly;
    const durationDays = plan.days;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + durationDays);

    // 1. Upgrade user
    if (target.userId) {
      await this.upgradeUser(target.userId, plan.id, durationDays);
    }

    // 2. Mark order completed in Supabase
    if (this.hasSupabase) {
      try {
        await this.supabase
          .from('payments')
          .update({
            status: 'completed',
            valid_until: expiryDate.toISOString()
          })
          .eq('order_id', target.orderId);
      } catch (e) {
        console.warn('Supabase payment status update error:', e.message);
      }
    }

    // 3. Mark in local store
    if (targetUtr && localPayments.has(targetUtr)) {
      const p = localPayments.get(targetUtr);
      p.status = 'completed';
      p.validUntil = expiryDate.toISOString();
      p.approvedAt = new Date().toISOString();
      saveLocalPayments();
    }

    return {
      success: true,
      message: `অৰ্ডাৰ ${target.orderId} সফলভাৱে অনুমোদন কৰা হ’ল। ছাত্ৰৰ Pro একাউণ্ট এতিয়া সক্ৰিয়!`,
      order: target
    };
  }

  /**
   * Admin rejects payment (invalid UTR, unverified)
   */
  async rejectPayment(orderId, reason = 'টকা প্ৰাপ্ত হোৱা নাই') {
    if (this.hasSupabase) {
      try {
        await this.supabase
          .from('payments')
          .update({ status: 'rejected' })
          .eq('order_id', orderId);
      } catch (e) {}
    }

    for (const [utr, p] of localPayments.entries()) {
      if (p.orderId === orderId || p.utr === orderId) {
        p.status = 'rejected';
        p.rejectionReason = reason;
        p.rejectedAt = new Date().toISOString();
        saveLocalPayments();
        break;
      }
    }

    return {
      success: true,
      message: `অৰ্ডাৰ ${orderId} বাতিল কৰা হ’ল।`
    };
  }

  /**
   * Check order or user payment status
   */
  async checkPaymentStatus(orderId, userId) {
    if (this.hasSupabase) {
      try {
        const { data: dbPayment } = await this.supabase
          .from('payments')
          .select('*')
          .eq('order_id', orderId)
          .maybeSingle();

        if (dbPayment) {
          const profile = await this.getUserProfile(dbPayment.user_id || userId);
          return {
            order: dbPayment,
            isPro: profile.isPro,
            plan: profile.plan,
            status: dbPayment.status
          };
        }
      } catch (e) {}
    }

    let order = null;
    for (const p of localPayments.values()) {
      if (p.orderId === orderId || (userId && p.userId === userId && p.status === 'pending')) {
        order = p;
        break;
      }
    }

    const profile = await this.getUserProfile(userId);
    return {
      order,
      isPro: profile.isPro,
      plan: profile.plan,
      status: order ? order.status : (profile.isPro ? 'completed' : 'none')
    };
  }
}

module.exports = new AuthDatabase();
