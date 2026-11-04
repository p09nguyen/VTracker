/**
 * VTracker - Valorant Daily Store & Night Market Tracker Server
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const skinCache = require('./services/skinCache');
const riotAuth = require('./services/riotAuth');
const storeService = require('./services/storeService');
const notificationService = require('./services/notificationService');

const app = express();
const PORT = process.env.PORT || 3888;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory active session
let currentActiveSession = null;

// Helper to get local network IP
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168.')) {
        return iface.address;
      }
    }
  }
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254')) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// ================= API ROUTES =================

/**
 * Lightweight Health-check endpoint for 24/7 Keep-Alive (UptimeRobot / Cron-job.org)
 */
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: 'VTracker'
  });
});

/**
 * Health & Status check
 */
app.get('/api/status', (req, res) => {
  const isRunning = riotAuth.isRiotClientRunning();
  const localIp = getLocalIp();
  res.json({
    status: 'ok',
    riotClientRunning: isRunning,
    localIp,
    port: PORT,
    localUrl: `http://${localIp}:${PORT}`,
    cacheReady: skinCache.isReady,
    totalSkins: skinCache.skins.size,
    totalSearchable: skinCache.searchList.length,
    clientVersion: skinCache.clientVersion,
    hasActiveSession: !!currentActiveSession,
    activeUser: currentActiveSession ? {
      gameName: currentActiveSession.gameName,
      tagLine: currentActiveSession.tagLine,
      region: currentActiveSession.region
    } : null
  });
});

/**
 * Mobile / iPhone QR Connection endpoint
 */
app.get('/api/connect-mobile', async (req, res) => {
  try {
    const ip = getLocalIp();
    const url = `http://${ip}:${PORT}`;
    const qrDataUrl = await QRCode.toDataURL(url, {
      margin: 2,
      width: 280,
      color: {
        dark: '#ff4655',
        light: '#0f172a'
      }
    });
    res.json({ success: true, localIp: ip, port: PORT, url, qrDataUrl });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

/**
 * 1-Click Lockfile Auto-Login
 */
app.post('/api/auth/lockfile', async (req, res) => {
  try {
    const authData = await riotAuth.loginViaLockfile();
    currentActiveSession = authData;
    res.json({ success: true, auth: authData });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

/**
 * Official Web Token / URL Login (100% Reliable & Captcha-free)
 */
app.post('/api/auth/token', async (req, res) => {
  try {
    const { token, region = 'ap' } = req.body;
    if (!token) {
      return res.json({ success: false, message: 'Vui lòng dán đường link hoặc Access Token.' });
    }
    const authData = await riotAuth.loginWithToken(token, region);
    currentActiveSession = authData;
    res.json({ success: true, auth: authData });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

/**
 * Cookie (ssid) Login (Persistent 7-30 days session with auto-refresh)
 */
app.post('/api/auth/cookie', async (req, res) => {
  try {
    const { cookie, region = 'ap' } = req.body;
    if (!cookie) {
      return res.json({ success: false, message: 'Vui lòng nhập cookie hoặc mã ssid của tài khoản Riot.' });
    }
    const authData = await riotAuth.loginWithCookie(cookie, region);
    currentActiveSession = authData;
    res.json({ success: true, auth: authData });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

/**
 * Username / Password Login (RSO)
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, region = 'ap' } = req.body;
    const result = await riotAuth.loginWithCredentials(username, password, region);

    if (result.mfaRequired) {
      return res.json({
        success: true,
        mfaRequired: true,
        sessionKey: result.sessionKey,
        email: result.email,
        method: result.method
      });
    }

    currentActiveSession = result;
    res.json({ success: true, auth: result });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

/**
 * Submit 2FA Code
 */
app.post('/api/auth/mfa', async (req, res) => {
  try {
    const { sessionKey, code } = req.body;
    if (!sessionKey || !code) {
      return res.json({ success: false, message: 'Thiếu mã xác thực 2FA.' });
    }

    const authData = await riotAuth.submitMfaCode(sessionKey, code);
    currentActiveSession = authData;
    res.json({ success: true, auth: authData });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

/**
 * Logout
 */
app.post('/api/auth/logout', (req, res) => {
  currentActiveSession = null;
  res.json({ success: true });
});

/**
 * Fetch Store (Live or Demo)
 */
app.post('/api/store', async (req, res) => {
  try {
    const { mode, auth } = req.body;

    if (mode === 'demo') {
      const demoData = storeService.getDemoStore();
      return res.json(demoData);
    }

    const activeAuth = auth || currentActiveSession;
    if (!activeAuth || !activeAuth.accessToken) {
      return res.json({
        success: false,
        message: 'Chưa đăng nhập. Vui lòng kết nối Riot Client hoặc đăng nhập tài khoản.'
      });
    }

    const storeData = await storeService.fetchLiveStore(activeAuth);
    if (storeData.refreshedAuth) {
      currentActiveSession = storeData.refreshedAuth;
    }
    res.json(storeData);
  } catch (err) {
    console.error('[API /api/store error]:', err.message);
    const isExpired = err.message.includes('hết hạn') || err.message.includes('Status 400') || err.message.includes('Status 401');
    res.json({
      success: false,
      sessionExpired: isExpired,
      message: err.message
    });
  }
});

/**
 * Search Skins for Wishlist
 */
app.get('/api/skins/search', (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase();
  if (!query) {
    return res.json({ results: skinCache.searchList.slice(0, 30) });
  }

  const results = skinCache.searchList
    .filter(s => s.displayName.toLowerCase().includes(query))
    .slice(0, 40);

  res.json({ results });
});

/**
 * All Searchable Skins for Wishlist Browser
 */
app.get('/api/skins/all', (req, res) => {
  res.json({ total: skinCache.searchList.length, skins: skinCache.searchList });
});

/**
 * Web Push Notification Endpoints (iPhone / Android / Desktop)
 */
app.get('/api/push/public-key', (req, res) => {
  res.json({ publicKey: notificationService.publicKey });
});

app.post('/api/push/subscribe', (req, res) => {
  const { subscription, auth, wishlist } = req.body;
  if (!subscription) {
    return res.json({ success: false, message: 'Thiếu thông tin đăng ký subscription.' });
  }
  const result = notificationService.addSubscription(subscription, auth || currentActiveSession, wishlist);
  res.json(result);
});

app.post('/api/push/test', async (req, res) => {
  try {
    const { subscription, delaySeconds = 0 } = req.body;
    if (!subscription) {
      return res.json({ success: false, message: 'Thiếu thông tin subscription để test.' });
    }
    if (delaySeconds > 0) {
      setTimeout(() => {
        notificationService.sendTestPush(subscription).catch(err => {
          console.error('[Delayed test push failed]:', err.statusCode, err.body || err.message);
        });
      }, delaySeconds * 1000);
      return res.json({ success: true, delayed: true, delaySeconds });
    }
    const result = await notificationService.sendTestPush(subscription);
    res.json({ success: true, statusCode: result?.statusCode });
  } catch (err) {
    console.error('[API /api/push/test error]:', err.statusCode, err.body || err.message);
    res.json({ 
      success: false, 
      statusCode: err.statusCode,
      message: err.body ? `${err.message}: ${err.body}` : err.message 
    });
  }
});

/**
 * Store Summary API (Ideal for Apple Shortcuts / Siri on iOS)
 */
app.get('/api/store/summary', async (req, res) => {
  const summary = await notificationService.getSummaryText(currentActiveSession);
  res.json(summary);
});

// Start Server & Initialize Skin Cache
async function startServer() {
  await skinCache.init();
  const localIp = getLocalIp();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🎯 VTracker - Valorant Daily Store Tracker is RUNNING!`);
    console.log(`🌐 Máy tính (Local PC):   http://localhost:${PORT}`);
    console.log(`📱 iPhone / Điện thoại:   http://${localIp}:${PORT}`);
    console.log(`======================================================\n`);
  });
}

startServer();
