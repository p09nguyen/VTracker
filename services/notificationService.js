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
    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // 1. Load or Generate VAPID Keys
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

    webpush.setVapidDetails(
      'mailto:vtracker.app@gmail.com',
      this.publicKey,
      this.privateKey
    );

    // 2. Load Subscriptions
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      try {
        this.subscriptions = JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8'));
      } catch (e) {
        this.subscriptions = [];
      }
    }

    // 3. Schedule Daily 7:00:15 AM Notification (Vietnam Time / 00:00:15 UTC)
    cron.schedule('15 0 7 * * *', () => {
      console.log('[NotificationService] ⏰ 07:00 AM VN Time! Triggering daily shop notification...');
      this.checkAndNotifyAll();
    }, {
      timezone: 'Asia/Ho_Chi_Minh'
    });

    console.log(`[NotificationService] Initialized! Total push subscribers: ${this.subscriptions.length}`);
  }

  generateKeys() {
    const keys = webpush.generateVAPIDKeys();
    this.publicKey = keys.publicKey;
    this.privateKey = keys.privateKey;
    fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2));
    console.log('[NotificationService] Generated fresh VAPID keys.');
  }

  saveSubscriptions() {
    try {
      fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(this.subscriptions, null, 2));
    } catch (e) {
      console.error('[NotificationService] Error saving subscriptions:', e.message);
    }
  }

  /**
   * Save or update client push subscription
   */
  addSubscription(subscription, authData = null, wishlist = []) {
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

    this.saveSubscriptions();
    console.log(`[NotificationService] Saved subscription. Total subscribers: ${this.subscriptions.length}`);
    return { success: true };
  }

  /**
   * Send test push notification
   */
  async sendTestPush(subscription) {
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
          this.subscriptions = this.subscriptions.filter(s => s.subscription.endpoint !== record.subscription.endpoint);
          this.saveSubscriptions();
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
