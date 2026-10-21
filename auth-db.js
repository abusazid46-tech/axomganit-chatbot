const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://kskivlhedvcdwohfhywh.supabase.co').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtza2l2bGhlZHZjZHdvaGZoeXdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDY0MTYsImV4cCI6MjA4ODc4MjQxNn0.tGUYv1LHW8oUN2zsTh4dWgqm48JwDxKr_FfP4GGPDZY').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtza2l2bGhlZHZjZHdvaGZoeXdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIwNjQxNiwiZXhwIjoyMDg4NzgyNDE2fQ.QAh9OLBDNI0ql7A4bs0tcNXM8qClfjAvRjSQEtF-qYE').trim();

const PAYEE_UPI_ID = (process.env.PAYEE_UPI_ID || 'amiete66@okicici').trim();
const PAYEE_NAME = (process.env.PAYEE_NAME || 'Abu Sazid Ahmed').trim();

// Free tier constraints
const FREE_DAILY_SOLVE_LIMIT = 5;

// Plan Catalog
const PLANS = {
  pro_daily: {
    id: 'pro_daily',
    name: 'দৈনিক Pro (1-Day Pass)',
    amount: 9,
    days: 1,
    tag: 'পৰীক্ষাৰ দিনৰ বাবে',
    badge: '২৪ ঘণ্টা সীমাহীন'
  },
  pro_monthly: {
    id: 'pro_monthly',
    name: 'মাহিলী Pro (Monthly)',
    amount: 39,
    days: 30,
    tag: 'আটাইতকৈ জনপ্ৰিয়',
    badge: 'SEBA / AHSEC / ADRE'
  },
  pro_annual: {
    id: 'pro_annual',
    name: 'বাৰ্ষিক Pro (Annual)',
    amount: 199,
    days: 365,
    tag: 'সৰ্বোত্তম সঞ্চয় (৮০% ৰেহাই)',
    badge: '৩৬৫ দিন সীমাহীন'
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

  sanitizeProfile(profile) {
    const today = this.getTodayDateString();
    const isPro = this.isUserPro(profile);
    const count = (profile.last_solve_date === today) ? (profile.daily_solve_count || 0) : 0;
    const remaining = isPro ? 999999 : Math.max(0, FREE_DAILY_SOLVE_LIMIT - count);

    return {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      plan: isPro ? profile.plan : 'free',
      isPro: isPro,
      pro_valid_until: profile.pro_valid_until,
      daily_solve_count: count,
      daily_limit: FREE_DAILY_SOLVE_LIMIT,
      remaining_solves: remaining,
      hasServerSupabase: this.hasSupabase
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

    const profile = await this.getUserProfile(userId);
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
   * Verify 12-digit UTR and activate Pro subscription
   */
  async verifyUtrAndActivate(userId, orderId, utr, planId = 'pro_monthly', userEmail = '') {
    const cleanUtr = String(utr || '').replace(/\D/g, '').trim();

    if (cleanUtr.length !== 12) {
      return {
        success: false,
        error: 'অনুগ্ৰহ কৰি ১২-ডিজিটৰ শুদ্ধ UPI Transaction ID (UTR) প্ৰদান কৰক।'
      };
    }

    // Anti-fraud: Check local memory store for duplicate UTR
    if (localPayments.has(cleanUtr)) {
      return {
        success: false,
        error: 'এই UTR / Transaction No. ইতিমধ্যে আন এটা অৰ্ডাৰত ব্যৱহাৰ কৰা হৈছে!'
      };
    }

    const safeId = String(userId || 'guest_default').trim();
    const plan = PLANS[planId] || PLANS.pro_monthly;
    const durationDays = plan.days;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + durationDays);

    // Check Supabase payments table if exists
    if (this.hasSupabase) {
      try {
        const { data: existingPayment } = await this.supabase
          .from('payments')
          .select('utr')
          .eq('utr', cleanUtr)
          .maybeSingle();

        if (existingPayment) {
          return {
            success: false,
            error: 'এই UTR / Transaction No. ইতিমধ্যে আন এজন ব্যৱহাৰকাৰীয়ে ব্যৱহাৰ কৰিছে!'
          };
        }
      } catch (e) {
        // Table might not exist yet, continue with local tracking
      }
    }

    // 1. Upgrade user profile in Supabase & local
    const updatedProfile = await this.upgradeUser(safeId, plan.id, durationDays);

    // 2. Record payment in local store
    const paymentRecord = {
      orderId,
      utr: cleanUtr,
      userId: safeId,
      userEmail: userEmail || updatedProfile.email,
      plan: plan.id,
      amount: plan.amount,
      validUntil: expiryDate.toISOString(),
      createdAt: new Date().toISOString(),
      status: 'completed'
    };
    localPayments.set(cleanUtr, paymentRecord);
    saveLocalPayments();

    // 3. Record in Supabase payments table (if table exists)
    if (this.hasSupabase) {
      try {
        await this.supabase.from('payments').insert({
          user_id: safeId.length > 20 && !safeId.startsWith('guest_') ? safeId : null,
          user_email: userEmail || updatedProfile.email,
          plan: plan.id,
          amount: plan.amount,
          order_id: orderId,
          utr: cleanUtr,
          status: 'completed',
          valid_until: expiryDate.toISOString()
        });
      } catch (e) {
        console.warn('Note: payments table insert skipped (create table via schema.sql):', e.message);
      }
    }

    return {
      success: true,
      message: `অভিনন্দন! আপোনাৰ ${plan.name} সফলভাৱে সক্ৰিয় হ’ল। এতিয়াৰ পৰা সকলো সমাধান আৰু ফটো স্কেন সীমাহীন!`,
      plan: plan.id,
      validUntil: expiryDate.toISOString(),
      profile: updatedProfile
    };
  }
}

module.exports = new AuthDatabase();
