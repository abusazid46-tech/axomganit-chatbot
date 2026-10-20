const crypto = require('crypto');

/**
 * Enterprise In-Memory LRU Cache & Canonical Math Vault
 * Provides sub-millisecond responses for repeated questions, textbook exercises, and PYQs.
 * Drastically reduces Gemini API token costs and circumvents rate limits.
 */
class MathSolutionCache {
  constructor(maxSize = 1000, defaultTtlMs = 7 * 24 * 60 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
    this.map = new Map();
    this.vault = [];
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Normalizes math query text:
   * - Maps Assamese numerals (০-৯) to English numerals (0-9)
   * - Removes punctuation (।, ?, !, commas)
   * - Strips redundant whitespace and lowercases
   */
  normalizePrompt(text) {
    if (!text || typeof text !== 'string') return '';
    const assameseDigits = { '০':'0', '১':'1', '২':'2', '৩':'3', '৪':'4', '৫':'5', '৬':'6', '৭':'7', '৮':'8', '৯':'9' };
    return text
      .replace(/[০-৯]/g, d => assameseDigits[d] || d)
      .toLowerCase()
      .replace(/[।,?!;:।\-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Deterministic cache key generation
   */
  generateKey(prompt, mode = 'school', lang = 'as', imageBase64 = null) {
    if (imageBase64) {
      const imgFingerprint = imageBase64.slice(0, 2048) + '_' + imageBase64.length;
      const hash = crypto.createHash('md5').update(imgFingerprint + '_' + (prompt || '')).digest('hex');
      return `img:${hash}:${mode}:${lang}`;
    }
    const cleanPrompt = this.normalizePrompt(prompt);
    const hash = crypto.createHash('md5').update(cleanPrompt).digest('hex');
    return `txt:${hash}:${mode}:${lang}`;
  }

  get(prompt, mode = 'school', lang = 'as', imageBase64 = null) {
    const key = this.generateKey(prompt, mode, lang, imageBase64);
    const entry = this.map.get(key);
    if (entry) {
      if (Date.now() > entry.expiresAt) {
        this.map.delete(key);
      } else {
        // Move to end (LRU behavior)
        this.map.delete(key);
        this.map.set(key, entry);
        this.hits++;
        return entry;
      }
    }

    // 2. Fallback: Fuzzy / Canonical Vault Match for textbook & PYQ problems
    if (!imageBase64 && prompt && typeof prompt === 'string') {
      const cleanPrompt = this.normalizePrompt(prompt);
      if (cleanPrompt.length >= 25) {
        for (const item of this.vault) {
          if (item.mode === mode && (item.lang === lang || lang === 'as')) {
            if (item.cleanQuestion.includes(cleanPrompt) || cleanPrompt.includes(item.cleanQuestion)) {
              this.hits++;
              return {
                solution: item.solution,
                model: item.model,
                cachedAt: item.cachedAt,
                expiresAt: Date.now() + this.defaultTtlMs,
                canonicalMatch: true
              };
            }
          }
        }
      }
    }

    this.misses++;
    return null;
  }

  set(prompt, mode = 'school', lang = 'as', solution, model = 'gemini', imageBase64 = null, ttlMs = null) {
    if (!solution || typeof solution !== 'string') return;
    const key = this.generateKey(prompt, mode, lang, imageBase64);

    if (this.map.size >= this.maxSize) {
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }

    this.map.set(key, {
      solution,
      model,
      cachedAt: new Date().toISOString(),
      expiresAt: Date.now() + (ttlMs || this.defaultTtlMs)
    });
  }

  /**
   * Pre-seed permanent textbook/PYQ solutions
   */
  setVault(prompt, mode = 'school', lang = 'as', solution, model = 'axomganit-pyq-vault') {
    this.set(prompt, mode, lang, solution, model);
    const cleanQuestion = this.normalizePrompt(prompt);
    this.vault.push({
      cleanQuestion,
      mode,
      lang,
      solution,
      model,
      cachedAt: new Date().toISOString()
    });
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.map.size,
      vaultSize: this.vault.length,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : '0%'
    };
  }

  clear() {
    this.map.clear();
    this.vault = [];
    this.hits = 0;
    this.misses = 0;
  }
}

module.exports = new MathSolutionCache();
