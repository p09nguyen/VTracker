/**
 * Push Notification Service
 * Handles Web Push notifications for iPhone (iOS 16.4+) and desktop/Android devices
 * Schedules daily 7:00 AM shop alerts
 */

const webpush = require('web-push');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const storeService = require('./storeService');

const DATA_DIR = path.join(__dirname, '..', 'data');
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'subscriptions.json');

class NotificationService {
  constructor() {
    this.publicKey = '';
    this.privateKey = '';
    this.subscriptions = [];
    this.supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    this.supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.supabaseConfigIncomplete = Boolean(this.supabaseUrl) !== Boolean(this.supabaseSecretKey);
    this.useSupabase = Boolean(this.supabaseUrl && this.supabaseSecretKey);
    this.initError = null;
    this.ready = this.init().catch(err => {
      this.initError = err;
      console.error('[NotificationService] Initialization failed:', err.message);
    });

    cron.schedule('15 0 7 * * *', () => {
      console.log('[NotificationService] ⏰ 07:00 AM VN Time! Triggering daily shop notification...');
      this.checkAndNotifyAll().catch(err => {
        console.error('[NotificationService] Daily notification run failed:', err.message);
      });
    }, {
      timezone: 'Asia/Ho_Chi_Minh'
    });
  }

  async init() {
    if (this.supabaseConfigIncomplete) {
      throw new Error('Cần cấu hình đồng thời SUPABASE_URL và SUPABASE_SECRET_KEY.');
    }

    if (this.useSupabase) {
      await this.initSupabaseStorage();
    } else {
      this.initLocalStorage();
      console.warn('[NotificationService] Supabase is not configured; using local JSON storage. On Render Free this data can be lost after a restart or spin-down.');
    }

    webpush.setVapidDetails(
      'mailto:vtracker.app@gmail.com',
      this.publicKey,
      this.privateKey
    );

    console.log(`[NotificationService] Initialized with ${this.useSupabase ? 'Supabase' : 'local'} storage. Total push subscribers: ${this.subscriptions.length}`);
  }

  initLocalStorage() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(VAPID_FILE)) {
      try {
        const keys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
        this.publicKey = keys.publicKey;
        this.privateKey = keys.privateKey;
      } catch (e) {
        this.generateKeys();
      }
    } else {
      this.generateKeys();
    }

    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      try {
        this.subscriptions = JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8'));
      } catch (e) {
        this.subscriptions = [];
      }
    }
  }

  async initSupabaseStorage() {
    const configRows = await this.supabaseRequest('vtracker_push_config', {
      select: 'id,public_key,private_key',
      id: 'eq.1',
      limit: '1'
    });

    if (configRows?.[0]?.public_key && configRows?.[0]?.private_key) {
      this.publicKey = configRows[0].public_key;
      this.privateKey = configRows[0].private_key;
    } else {
      const keys = this.createKeys();
      await this.supabaseRequest('vtracker_push_config?on_conflict=id', null, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ id: 1, public_key: keys.publicKey, private_key: keys.privateKey })
      });
      this.publicKey = keys.publicKey;
      this.privateKey = keys.privateKey;
    }

    const loaded = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await this.supabaseRequest('vtracker_push_subscriptions', {
        select: 'endpoint,subscription,auth_data,wishlist,updated_at',
        order: 'updated_at.asc'
      }, {
        headers: {
          Range: `${offset}-${offset + 999}`,
          'Range-Unit': 'items'
        }
      });

      for (const row of page || []) {
        loaded.push({
          subscription: row.subscription,
          auth: row.auth_data,
          wishlist: row.wishlist || [],
          updatedAt: row.updated_at
        });
      }
      if (!page || page.length < 1000) break;
    }
    this.subscriptions = loaded;
  }

  async supabaseRequest(resource, query = null, options = {}) {
    if (!this.supabaseUrl || !this.supabaseSecretKey) {
      throw new Error('Thiếu SUPABASE_URL hoặc SUPABASE_SECRET_KEY.');
    }

    const url = new URL(`/rest/v1/${resource}`, `${this.supabaseUrl}/`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
    }

    const isNewSecretKey = this.supabaseSecretKey.startsWith('sb_secret_');
    const response = await fetch(url, {
      ...options,
      headers: {
        apikey: this.supabaseSecretKey,
        ...(!isNewSecretKey ? { Authorization: `Bearer ${this.supabaseSecretKey}` } : {}),
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`Supabase returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    if (response.status === 204) return null;

    const responseText = await response.text();
    return responseText ? JSON.parse(responseText) : null;
  }

  createKeys() {
    const keys = webpush.generateVAPIDKeys();
    this.publicKey = keys.publicKey;
    this.privateKey = keys.privateKey;
    return keys;
  }

  generateKeys() {
    const keys = this.createKeys();
    fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2));
    console.log('[NotificationService] Generated fresh VAPID keys.');
  }

  async saveSubscriptions() {
    try {
      if (this.useSupabase) {
        for (const record of this.subscriptions) {
          await this.saveSubscriptionRecord(record);
        }
        return;
      }
      fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(this.subscriptions, null, 2));
    } catch (e) {
      console.error('[NotificationService] Error saving subscriptions:', e.message);
    }
  }

  /**
   * Save or update client push subscription
   */
  async saveSubscriptionRecord(record) {
    if (!this.useSupabase) {
      await this.saveSubscriptions();
      return;
    }

    await this.supabaseRequest('vtracker_push_subscriptions?on_conflict=endpoint', null, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        endpoint: record.subscription.endpoint,
        subscription: record.subscription,
        auth_data: record.auth,
        wishlist: record.wishlist || [],
        updated_at: record.updatedAt || new Date().toISOString()
      })
    });
  }

  async deleteSubscriptionRecord(endpoint) {
    if (!this.useSupabase) {
      this.subscriptions = this.subscriptions.filter(s => s.subscription.endpoint !== endpoint);
      await this.saveSubscriptions();
      return;
    }

    const query = new URLSearchParams({ endpoint: `eq.${endpoint}` });
    await this.supabaseRequest(`vtracker_push_subscriptions?${query.toString()}`, null, { method: 'DELETE' });
    this.subscriptions = this.subscriptions.filter(s => s.subscription.endpoint !== endpoint);
  }

  async addSubscription(subscription, authData = null, wishlist = []) {
    await this.ensureReady();
    // Check if endpoint already exists
    const idx = this.subscriptions.findIndex(s => s.subscription.endpoint === subscription.endpoint);
    const subRecord = {
      subscription,
      auth: authData,
      wishlist: wishlist || [],
      updatedAt: new Date().toISOString()
    };

    if (idx >= 0) {
      this.subscriptions[idx] = subRecord;
    } else {
      this.subscriptions.push(subRecord);
    }

    await this.saveSubscriptionRecord(subRecord);
    console.log(`[NotificationService] Saved subscription. Total subscribers: ${this.subscriptions.length}`);
    return { success: true };
  }

  async ensureReady() {
    await this.ready;
    if (this.initError) throw this.initError;
  }

  /**
   * Send test push notification
   */
  async sendTestPush(subscription) {
    await this.ensureReady();
    const payload = {
      title: '🎯 VTracker // Thông Báo Thử Nghiệm',
      body: 'Kết nối iPhone thành công! Hằng ngày lúc 07:00 sáng, VTracker sẽ gửi danh sách 4 skin hôm nay đến màn hình khóa của bạn.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      url: '/'
    };

    console.log('[NotificationService] Sending push notification to endpoint:', subscription.endpoint ? subscription.endpoint.slice(0, 60) + '...' : 'unknown');
    const result = await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 60,
      urgency: 'high'
    });
    console.log('[NotificationService] Push delivery response statusCode:', result?.statusCode);
    return result;
  }

  /**
   * Check daily shop for all subscribers and send notifications
   */
  async checkAndNotifyAll() {
    await this.ensureReady();
    console.log(`[NotificationService] Running daily alert for ${this.subscriptions.length} devices...`);
    const activeSubs = [...this.subscriptions];

    for (const record of activeSubs) {
      try {
        let store;
        if (record.auth && record.auth.accessToken) {
          store = await storeService.fetchLiveStore(record.auth);
        } else {
          store = storeService.getDemoStore();
        }

        const items = store.dailyOffers?.items || [];
        if (items.length === 0) continue;

        // Check for knives or melees
        const knifeItems = items.filter(i => 
          i.displayName.toLowerCase().includes('knife') ||
          i.displayName.toLowerCase().includes('karambit') ||
          i.displayName.toLowerCase().includes('blade') ||
          i.displayName.toLowerCase().includes('sword') ||
          i.displayName.toLowerCase().includes('axe') ||
          i.displayName.toLowerCase().includes('scythe') ||
          i.displayName.toLowerCase().includes('dagger') ||
          i.displayName.toLowerCase().includes('baton') ||
          i.displayName.toLowerCase().includes('kunai')
        );

        // Check wishlist matches
        const wishSet = new Set(record.wishlist || []);
        const matched = items.filter(i => wishSet.has(i.uuid));

        // Format push text
        let title = '🎯 VALORANT SHOP HÔM NAY (07:00)';
        if (matched.length > 0) {
          title = `🔥 WISHLIST: [${matched[0].displayName}] ĐANG BÁN!`;
        } else if (knifeItems.length > 0) {
          title = `🔪 SHOP HÔM NAY CÓ CẬN CHIẾN: ${knifeItems[0].displayName}!`;
        }

        const itemLines = items.map((item, idx) => {
          const isWish = wishSet.has(item.uuid) ? ' ⭐' : '';
          return `${idx + 1}. ${item.displayName} (${(item.cost || 0).toLocaleString()} VP)${isWish}`;
        }).join('\n');

        let body = `${itemLines}`;
        if (matched.length > 0) {
          body += `\n\n🎉 Có ${matched.length} skin trong Wishlist của bạn!`;
        }

        const payload = {
          title,
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          url: '/'
        };

        await webpush.sendNotification(record.subscription, JSON.stringify(payload), {
          TTL: 86400,
          urgency: 'high'
        });
        console.log(`[NotificationService] Sent notification to device successfully.`);
      } catch (err) {
        console.error(`[NotificationService] Failed to notify device:`, err.message);
        // If subscription is 410 Gone or 404, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          try {
            await this.deleteSubscriptionRecord(record.subscription.endpoint);
          } catch (deleteErr) {
            console.error('[NotificationService] Could not remove expired subscription:', deleteErr.message);
          }
        }
      }
    }
  }

  /**
   * Summary text formatted for Apple iOS Shortcuts (Phím tắt)
   */
  async getSummaryText(auth = null) {
    let store;
    try {
      if (auth && auth.accessToken) {
        store = await storeService.fetchLiveStore(auth);
      } else {
        store = storeService.getDemoStore();
      }
    } catch (e) {
      store = storeService.getDemoStore();
    }

    const items = store.dailyOffers?.items || [];
    const itemLines = items.map((i, idx) => `• ${i.displayName} (${(i.cost || 0).toLocaleString()} VP)`).join('\n');
    return {
      date: new Date().toLocaleDateString('vi-VN'),
      items: items.map(i => ({ name: i.displayName, cost: i.cost, tier: i.tier?.name })),
      displayText: `🎯 CỬA HÀNG VALORANT HÔM NAY:\n${itemLines}`
    };
  }
}

const notificationService = new NotificationService();
module.exports = notificationService;
