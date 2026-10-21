const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

// Free tier constraints
const FREE_DAILY_SOLVE_LIMIT = 5;

// In-memory / file fallback store for local development and zero-setup deployment
const LOCAL_STORE_FILE = path.join(__dirname, '.user-store.json');
let localUsers = new Map();

function loadLocalUsers() {
  try {
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(LOCAL_STORE_FILE, 'utf8'));
      Object.entries(data).forEach(([id, user]) => localUsers.set(id, user));
    }
  } catch (e) {
    console.warn('Could not read .user-store.json, using in-memory store:', e.message);
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

loadLocalUsers();

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
}

module.exports = new AuthDatabase();
