/**
 * Riot Authentication Service
 * Supports:
 * 1. Automatic local Riot Client Lockfile detection (Windows) - 1-Click
 * 2. Official Riot Web Token / URL Login (Passwordless & Captcha-free, 100% reliable)
 * 3. Remote Riot Sign-On (RSO) credentials flow
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// In-memory store for pending 2FA authentication sessions
const pendingMfaSessions = new Map();

class RiotAuth {
  /**
   * Helper to make HTTPS requests to local Riot Client (ignoring self-signed cert)
   */
  requestLocalRiotClient(port, endpoint, method = 'GET', authHeader, body = null) {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: '127.0.0.1',
        port: parseInt(port),
        path: endpoint,
        method,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        rejectUnauthorized: false,
        timeout: 4000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = data ? JSON.parse(data) : {};
            resolve({ statusCode: res.statusCode, data: json });
          } catch (err) {
            resolve({ statusCode: res.statusCode, raw: data });
          }
        });
      });

      req.on('error', err => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Yêu cầu đến Riot Client bị quá hạn (timeout).'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  getLockfilePath() {
    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData) return null;
    return path.join(localAppData, 'Riot Games', 'Riot Client', 'Config', 'lockfile');
  }

  isRiotClientRunning() {
    const lockfilePath = this.getLockfilePath();
    return lockfilePath && fs.existsSync(lockfilePath);
  }

  /**
   * 1-Click Auto-Login via Riot Client Lockfile
   */
  async loginViaLockfile() {
    const lockfilePath = this.getLockfilePath();
    if (!lockfilePath || !fs.existsSync(lockfilePath)) {
      throw new Error('Riot Client chưa được mở trên máy tính này. Vui lòng mở Riot Client hoặc Valorant trước khi đồng bộ.');
    }

    const lockContent = fs.readFileSync(lockfilePath, 'utf8').trim().split(':');
    if (lockContent.length < 5) {
      throw new Error('Không thể đọc file cấu hình Lockfile của Riot Client.');
    }

    const [name, pid, port, password, protocol] = lockContent;
    const authHeader = 'Basic ' + Buffer.from(`riot:${password}`).toString('base64');

    // Fetch entitlements from local client
    let tokenRes;
    try {
      tokenRes = await this.requestLocalRiotClient(port, '/entitlements/v1/token', 'GET', authHeader);
    } catch (err) {
      throw new Error('Không thể kết nối đến cổng Riot Client cục bộ. Vui lòng kiểm tra Riot Client đã khởi động xong chưa.');
    }

    if (tokenRes.statusCode === 404 || !tokenRes.data || !tokenRes.data.accessToken) {
      throw new Error('Riot Client trên máy tính chưa được đăng nhập tài khoản. Vui lòng mở Riot Client và đăng nhập vào tài khoản của bạn trước khi bấm Đồng bộ!');
    }

    const accessToken = tokenRes.data.accessToken;
    let entitlementsToken = tokenRes.data.token;
    const puuid = tokenRes.data.subject;

    // Refresh entitlementsToken if needed
    if (!entitlementsToken || entitlementsToken.length < 10) {
      const entRes = await fetch('https://entitlements.auth.riotgames.com/api/token/v1', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        },
        body: '{}'
      }).then(r => r.json()).catch(() => null);

      if (entRes?.entitlements_token) {
        entitlementsToken = entRes.entitlements_token;
      }
    }

    // Fetch Player In-Game Name & Tag
    let gameName = 'Agent';
    let tagLine = 'VAL';
    let country = 'vnm';

    try {
      const chatRes = await this.requestLocalRiotClient(port, '/chat/v1/session', 'GET', authHeader);
      if (chatRes.data?.game_name) {
        gameName = chatRes.data.game_name;
        tagLine = chatRes.data.game_tag || 'VAL';
      } else {
        const userInfoRes = await this.requestLocalRiotClient(port, '/rso-auth/v1/authorization/userinfo', 'GET', authHeader);
        if (userInfoRes.data?.userInfo) {
          const uInfo = typeof userInfoRes.data.userInfo === 'string' ? JSON.parse(userInfoRes.data.userInfo) : userInfoRes.data.userInfo;
          gameName = uInfo.acct?.game_name || uInfo.preferred_username || gameName;
          tagLine = uInfo.acct?.tag_line || tagLine;
          country = uInfo.country || country;
        }
      }
    } catch (e) {
      console.warn('[RiotAuth] Could not read userinfo from chat session:', e.message);
    }

    return {
      success: true,
      authMethod: 'lockfile',
      puuid,
      gameName,
      tagLine,
      region: 'ap',
      country,
      accessToken,
      entitlementsToken,
      tokenIssuedAt: Date.now(),
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Token / Redirect URL Login (Passwordless & Captcha-free)
   * Accepts:
   * 1. Full redirect URL: https://playvalorant.com/opt_in#access_token=...&id_token=...
   * 2. Raw access_token string
   */
  async loginWithToken(tokenOrUrl, region = 'ap') {
    let accessToken = tokenOrUrl.trim();

    // If full URL provided, extract access_token from hash fragment
    if (accessToken.includes('#') || accessToken.startsWith('http')) {
      try {
        const hash = accessToken.includes('#') ? accessToken.split('#')[1] : accessToken.split('?')[1];
        const params = new URLSearchParams(hash);
        const extracted = params.get('access_token');
        if (extracted) {
          accessToken = extracted;
        }
      } catch (e) {
        console.warn('[RiotAuth] Error parsing token URL:', e.message);
      }
    }

    if (!accessToken || accessToken.length < 20) {
      throw new Error('Access Token không hợp lệ. Vui lòng copy toàn bộ đường link hoặc token kết quả.');
    }

    // 1. Fetch Entitlements Token
    const entRes = await fetch('https://entitlements.auth.riotgames.com/api/token/v1', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });

    if (!entRes.ok) {
      throw new Error('Token đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại trên trang Riot để lấy token mới.');
    }

    const entData = await entRes.json();
    const entitlementsToken = entData.entitlements_token;

    // 2. Fetch User Profile
    const userRes = await fetch('https://auth.riotgames.com/userinfo', {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    const userInfo = await userRes.json();

    const puuid = userInfo.sub;
    const gameName = userInfo.acct?.game_name || userInfo.preferred_username || 'Agent';
    const tagLine = userInfo.acct?.tag_line || 'VAL';
    const country = userInfo.country || 'vnm';

    return {
      success: true,
      authMethod: 'token',
      puuid,
      gameName,
      tagLine,
      region,
      country,
      accessToken,
      entitlementsToken,
      tokenIssuedAt: Date.now(),
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Long-lived Cookie (ssid) Login (Valid for 7 - 30 days)
   * Automatically refreshes access_token in background whenever it expires!
   */
  async loginWithCookie(cookieOrSsid, region = 'ap') {
    let cookie = (cookieOrSsid || '').replace(/[\r\n]+/g, ' ').trim();
    if (!cookie.includes('=')) {
      cookie = `ssid=${cookie};`;
    } else if (!cookie.includes('ssid=')) {
      cookie = `ssid=${cookie}; ${cookie}`;
    }

    const authRes = await fetch('https://auth.riotgames.com/api/v1/authorization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        client_id: 'play-valorant-web-prod',
        nonce: Date.now().toString(),
        redirect_uri: 'https://playvalorant.com/opt_in',
        response_type: 'token id_token',
        scope: 'account openid'
      })
    });

    const data = await authRes.json();
    if (data.type === 'response' && data.response?.parameters?.uri) {
      const uri = data.response.parameters.uri;
      const hash = uri.includes('#') ? uri.split('#')[1] : '';
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      if (accessToken) {
        const tokenAuth = await this.loginWithToken(accessToken, region);
        return {
          ...tokenAuth,
          authMethod: 'cookie',
          cookie,
          tokenIssuedAt: Date.now(),
          lastUpdated: new Date().toISOString()
        };
      }
    }

    throw new Error('Cookie ssid không hợp lệ hoặc đã hết hạn trên máy chủ Riot Games. Vui lòng lấy cookie mới.');
  }

  /**
   * Log in with Riot Games Username & Password (RSO Flow)
   */
  async loginWithCredentials(username, password, region = 'ap') {
    if (!username || !password) {
      throw new Error('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
    }

    const userAgent = 'RiotClient/63.0.9.4909983.4789131 rso-auth (Windows;10;;Professional, x64)';

    // Step 1: Initial Authorization Request
    const initRes = await fetch('https://auth.riotgames.com/api/v1/authorization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent
      },
      body: JSON.stringify({
        client_id: 'play-valorant-web-prod',
        nonce: '1',
        redirect_uri: 'https://playvalorant.com/opt_in',
        response_type: 'token id_token',
        scope: 'account openid'
      })
    });

    const setCookies = initRes.headers.getSetCookie ? initRes.headers.getSetCookie() : [];
    const cookieHeader = setCookies.length > 0 
      ? setCookies.map(c => c.split(';')[0]).join('; ')
      : (initRes.headers.get('set-cookie') || '');

    // Step 2: Submit Credentials
    const authRes = await fetch('https://auth.riotgames.com/api/v1/authorization', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
        'Cookie': cookieHeader
      },
      body: JSON.stringify({
        type: 'auth',
        username,
        password,
        remember: true,
        language: 'en_US'
      })
    });

    const authData = await authRes.json().catch(() => ({}));

    if (authData.error) {
      if (authData.error === 'auth_failure') {
        throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác.');
      } else if (authData.error === 'rate_limited') {
        throw new Error('Tài khoản bị giới hạn tạm thời từ Riot. Vui lòng thử lại sau vài phút hoặc dùng phương thức Token Login.');
      } else if (authData.error === 'invalid_request') {
        throw new Error('Riot Games đã kích hoạt xác thực Captcha/Cloudflare. Vui lòng chuyển sang tab "Đăng nhập bằng Riot Web (Token)" để đăng nhập 100% thành công không bị chặn!');
      }
      throw new Error(`Đăng nhập thất bại: ${authData.error}`);
    }

    // Check for Multi-Factor Authentication (2FA)
    if (authData.type === 'multifactor') {
      const sessionKey = crypto.randomBytes(16).toString('hex');
      const authSetCookies = authRes.headers.getSetCookie ? authRes.headers.getSetCookie() : [];
      const updatedCookieHeader = authSetCookies.length > 0
        ? authSetCookies.map(c => c.split(';')[0]).join('; ')
        : cookieHeader;

      pendingMfaSessions.set(sessionKey, {
        cookies: updatedCookieHeader,
        region,
        createdAt: Date.now()
      });

      return {
        mfaRequired: true,
        sessionKey,
        method: authData.multifactor?.method || 'email',
        email: authData.multifactor?.email || 'email của bạn'
      };
    }

    if (authData.type === 'response' && authData.response?.parameters?.uri) {
      return await this.processSuccessfulAuth(authData.response.parameters.uri, region);
    }

    throw new Error('Riot Games yêu cầu xác thực web. Vui lòng dùng tab "Đăng nhập bằng Riot Web (Token)"');
  }

  /**
   * Submit 2FA / MFA Code
   */
  async submitMfaCode(sessionKey, code) {
    const session = pendingMfaSessions.get(sessionKey);
    if (!session) {
      throw new Error('Phiên xác thực 2FA đã hết hạn. Vui lòng đăng nhập lại.');
    }

    const userAgent = 'RiotClient/63.0.9.4909983.4789131 rso-auth (Windows;10;;Professional, x64)';

    const res = await fetch('https://auth.riotgames.com/api/v1/authorization', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
        'Cookie': session.cookies
      },
      body: JSON.stringify({
        type: 'multifactor',
        code: code.trim(),
        rememberDevice: true
      })
    });

    const data = await res.json().catch(() => ({}));

    if (data.error) {
      if (data.error === 'multifactor_attempt_failed') {
        throw new Error('Mã xác thực 2FA không chính xác. Vui lòng thử lại.');
      }
      throw new Error(`Xác thực 2FA thất bại: ${data.error}`);
    }

    if (data.type === 'response' && data.response?.parameters?.uri) {
      pendingMfaSessions.delete(sessionKey);
      return await this.processSuccessfulAuth(data.response.parameters.uri, session.region);
    }

    throw new Error('Không thể hoàn tất xác thực 2FA.');
  }

  async processSuccessfulAuth(uri, region = 'ap') {
    const url = new URL(uri);
    const hashParams = new URLSearchParams(url.hash.substring(1));
    const accessToken = hashParams.get('access_token');

    if (!accessToken) {
      throw new Error('Không tìm thấy Access Token trong phản hồi của Riot.');
    }

    return await this.loginWithToken(accessToken, region);
  }
}

const riotAuth = new RiotAuth();
module.exports = riotAuth;
