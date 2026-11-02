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
    res.json(storeData);
  } catch (err) {
    console.error('[API /api/store error]:', err.message);
    res.json({ success: false, message: err.message });
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
