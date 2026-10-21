const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://kskivlhedvcdwohfhywh.supabase.co').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtza2l2bGhlZHZjZHdvaGZoeXdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDY0MTYsImV4cCI6MjA4ODc4MjQxNn0.tGUYv1LHW8oUN2zsTh4dWgqm48JwDxKr_FfP4GGPDZY').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtza2l2bGhlZHZjZHdvaGZoeXdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIwNjQxNiwiZXhwIjoyMDg4NzgyNDE2fQ.QAh9OLBDNI0ql7A4bs0tcNXM8qClfjAvRjSQEtF-qYE').trim();

const PAYEE_UPI_ID = (process.env.PAYEE_UPI_ID || 'amiete66@okicici').replace(/\s+/g, '').trim();
const PAYEE_NAME = (process.env.PAYEE_NAME || 'Abu Sazid Ahmed').replace(/\s+/g, ' ').trim();

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
   * Submit UTR for Admin Review (Pending Verification)
   * Prevents fraudulent access until admin verifies actual bank credit
   */
  async submitUtrForApproval(userId, orderId, utr, planId = 'pro_monthly', userEmail = '', userName = '') {
    const cleanUtr = String(utr || '').replace(/\D/g, '').trim();

    if (cleanUtr.length !== 12) {
      return {
        success: false,
        error: 'অনুগ্ৰহ কৰি ১২-ডিজিটৰ শুদ্ধ UPI Transaction ID (UTR) প্ৰদান কৰক।'
      };
    }

    // Check if this UTR was already approved
    if (localPayments.has(cleanUtr)) {
      const existing = localPayments.get(cleanUtr);
      if (existing.status === 'completed') {
        return {
          success: false,
          error: 'এই UTR / Transaction No. ইতিমধ্যে অনুমোদিত হৈছে!'
        };
      }
      if (existing.status === 'pending') {
        return {
          success: true,
          status: 'pending',
          orderId: existing.orderId,
          message: 'আপোনাৰ এই UTR টো ইতিমধ্যে পৰীক্ষাৰ বাবে জমা হৈছে। অনুগ্ৰহ কৰি অপেক্ষা কৰক।'
        };
      }
    }

    const safeId = String(userId || 'guest_default').trim();
    const plan = PLANS[planId] || PLANS.pro_monthly;

    const paymentRecord = {
      orderId: orderId || `AXOM-${Date.now().toString(36).toUpperCase()}`,
      utr: cleanUtr,
      userId: safeId,
      userEmail: userEmail || '',
      userName: userName || 'মেধাৱী শিক্ষাৰ্থী',
      plan: plan.id,
      planName: plan.name,
      amount: plan.amount,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    localPayments.set(cleanUtr, paymentRecord);
    saveLocalPayments();

    // If Supabase payments table is available, store record
    if (this.hasSupabase) {
      try {
        await this.supabase.from('payments').insert({
          user_id: safeId.length > 20 && !safeId.startsWith('guest_') ? safeId : null,
          user_email: userEmail,
          plan: plan.id,
          amount: plan.amount,
          order_id: paymentRecord.orderId,
          utr: cleanUtr,
          status: 'pending',
          valid_until: new Date().toISOString()
        });
      } catch (e) {
        // Table fallback
      }
    }

    return {
      success: true,
      status: 'pending',
      orderId: paymentRecord.orderId,
      utr: cleanUtr,
      message: 'আপোনাৰ UTR অনুৰোধ সফলতাৰে দাখিল কৰা হৈছে। এডমিনে পেমেণ্ট পৰীক্ষা কৰাৰ পিছতে আপোনাৰ Pro একাউণ্ট সক্ৰিয় হ’ব।'
    };
  }

  /**
   * Get payments grouped for admin review
   */
  getAdminPayments() {
    const list = Array.from(localPayments.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const pending = list.filter(p => p.status === 'pending');
    const completed = list.filter(p => p.status === 'completed');
    const rejected = list.filter(p => p.status === 'rejected');

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
   * Admin approves payment and unlocks Pro subscription
   */
  async approvePayment(orderId) {
    let target = null;
    let targetUtr = null;

    for (const [utr, p] of localPayments.entries()) {
      if (p.orderId === orderId || p.utr === orderId) {
        target = p;
        targetUtr = utr;
        break;
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
    await this.upgradeUser(target.userId, plan.id, durationDays);

    // 2. Mark order completed
    target.status = 'completed';
    target.validUntil = expiryDate.toISOString();
    target.approvedAt = new Date().toISOString();
    localPayments.set(targetUtr, target);
    saveLocalPayments();

    // 3. Supabase update if available
    if (this.hasSupabase) {
      try {
        await this.supabase
          .from('payments')
          .update({
            status: 'completed',
            valid_until: expiryDate.toISOString()
          })
          .eq('order_id', target.orderId);
      } catch (e) {}
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
    let target = null;
    let targetUtr = null;

    for (const [utr, p] of localPayments.entries()) {
      if (p.orderId === orderId || p.utr === orderId) {
        target = p;
        targetUtr = utr;
        break;
      }
    }

    if (!target) {
      return { success: false, error: 'অৰ্ডাৰ বিচাৰি পোৱা নগ’ল।' };
    }

    target.status = 'rejected';
    target.rejectionReason = reason;
    target.rejectedAt = new Date().toISOString();
    localPayments.set(targetUtr, target);
    saveLocalPayments();

    if (this.hasSupabase) {
      try {
        await this.supabase
          .from('payments')
          .update({ status: 'rejected' })
          .eq('order_id', target.orderId);
      } catch (e) {}
    }

    return {
      success: true,
      message: `অৰ্ডাৰ ${target.orderId} বাতিল কৰা হ’ল।`,
      order: target
    };
  }

  /**
   * Check order or user payment status
   */
  async checkPaymentStatus(orderId, userId) {
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
