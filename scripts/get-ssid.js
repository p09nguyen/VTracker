/**
 * VTracker - Tự động mở đăng nhập Riot Games và trích xuất mã Cookie SSID (30 ngày)
 * Sử dụng Microsoft Edge có sẵn trên Windows và Node.js v24 (Không cần cài thêm thư viện)
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const readline = require('readline');

const RIOT_AUTH_URL = 'https://auth.riotgames.com/authorize?client_id=play-valorant-web-prod&response_type=token%20id_token&redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&scope=account%20openid&nonce=1';
const CDP_PORT = 9333;

function findBrowserPath() {
  const possiblePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function copyToClipboard(text) {
  try {
    const proc = spawn('clip');
    proc.stdin.end(text);
    return true;
  } catch (e) {
    return false;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.clear();
  console.log('================================================================');
  console.log('🚀 VTRACKER - CÔNG CỤ TỰ ĐỘNG LẤY COOKIE SSID RIOT GAMES');
  console.log('================================================================\n');

  const browserPath = findBrowserPath();
  if (!browserPath) {
    console.error('❌ Không tìm thấy Microsoft Edge hoặc Chrome trên máy tính.');
    console.log('Vui lòng cài đặt Microsoft Edge hoặc Google Chrome để tiếp tục.');
    return;
  }

  const profileDir = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'VTracker', 'BrowserProfile');
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  console.log('🌐 Đang khởi động trình duyệt để đăng nhập Riot Games...');
  console.log('👉 Một cửa sổ trình duyệt sẽ mở ra. Nếu bạn chưa đăng nhập,');
  console.log('   vui lòng nhập tài khoản / mật khẩu Riot của bạn tại đó.');
  console.log('👉 Nếu đã đăng nhập sẵn, hệ thống sẽ tự động quét mã trong vài giây!\n');

  const browserProc = spawn(browserPath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    RIOT_AUTH_URL
  ], { detached: false });

  let foundSsid = null;
  let fullCookieString = '';
  let connectedWs = null;

  // Poll for CDP readiness
  let retries = 20;
  let targetWsUrl = null;

  while (retries > 0) {
    await sleep(1000);
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
      if (res.ok) {
        const tabs = await res.json();
        const tab = tabs.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        if (tab) {
          targetWsUrl = tab.webSocketDebuggerUrl;
          break;
        }
      }
    } catch (e) {
      // Waiting for browser to open
    }
    retries--;
  }

  if (!targetWsUrl) {
    console.error('❌ Không thể kết nối với cổng điều khiển trình duyệt.');
    try { browserProc.kill(); } catch (e) {}
    return;
  }

  console.log('⚡ Đã kết nối với trình duyệt! Đang theo dõi phiên đăng nhập...');

  const ws = new WebSocket(targetWsUrl);
  connectedWs = ws;

  let msgId = 1;
  const pendingCallbacks = new Map();

  function sendCdp(method, params = {}) {
    return new Promise((resolve) => {
      const id = ++msgId;
      pendingCallbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onopen = async () => {
    await sendCdp('Network.enable');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.id && pendingCallbacks.has(data.id)) {
        const resolve = pendingCallbacks.get(data.id);
        pendingCallbacks.delete(data.id);
        resolve(data.result);
      }
    } catch (e) {}
  };

  // Check cookies periodically
  console.log('⏳ Đang chờ xác thực tài khoản từ Riot Games (Vui lòng đăng nhập nếu chưa)...');

  let checkCount = 0;
  const maxChecks = 120; // 2 minutes timeout

  while (!foundSsid && checkCount < maxChecks) {
    await sleep(1500);
    checkCount++;

    if (ws.readyState === WebSocket.OPEN) {
      try {
        const cookiesRes = await sendCdp('Network.getCookies', {
          urls: [
            'https://auth.riotgames.com',
            'https://authenticate.riotgames.com',
            'https://playvalorant.com'
          ]
        });

        if (cookiesRes && cookiesRes.cookies) {
          const ssidCookie = cookiesRes.cookies.find(c => c.name === 'ssid');
          if (ssidCookie && ssidCookie.value) {
            foundSsid = ssidCookie.value;

            // Also build full cookie string
            fullCookieString = cookiesRes.cookies
              .map(c => `${c.name}=${c.value}`)
              .join('; ');
            break;
          }
        }
      } catch (e) {}
    }
  }

  if (foundSsid) {
    console.log('\n================================================================');
    console.log('🎉 THÀNH CÔNG RỰC RỠ! ĐÃ LẤY ĐƯỢC COOKIE SSID (30 NGÀY)!');
    console.log('================================================================\n');

    console.log('🔑 Mã SSID của bạn:\n');
    console.log(foundSsid);
    console.log('\n----------------------------------------------------------------');

    // Copy to clipboard
    const copied = copyToClipboard(foundSsid);
    if (copied) {
      console.log('📋 ĐÃ TỰ ĐỘNG SAO CHÉP MÃ SSID VÀO BỘ NHỚ TẠM (CLIPBOARD)!');
      console.log('   Bạn chỉ cần mở VTracker trên máy hoặc điện thoại và ấn Dán (Ctrl + V).');
    }

    // Save to backup file
    const backupFile = path.join(__dirname, '..', 'vtracker_ssid.txt');
    fs.writeFileSync(backupFile, foundSsid, 'utf8');
    console.log(`💾 Đã lưu dự phòng vào file: ${path.basename(backupFile)}`);
    console.log('----------------------------------------------------------------\n');

    // Close browser cleanly
    try {
      await sendCdp('Browser.close');
    } catch (e) {
      try { browserProc.kill(); } catch (err) {}
    }

    // Optional direct sync to Render URL
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('🌐 Bạn có muốn tự động gửi mã SSID này lên web Render của bạn không?\n   (Dán link web Render ví dụ: https://vtracker-xxxx.onrender.com hoặc ấn Enter để hoàn tất): ', async (answer) => {
      const targetUrl = answer.trim().replace(/\/+$/, '');
      if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
        console.log(`\nĐang đồng bộ trực tiếp lên: ${targetUrl}...`);
        try {
          const syncRes = await fetch(`${targetUrl}/api/auth/cookie`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookie: foundSsid, region: 'ap' })
          });
          const syncData = await syncRes.json();
          if (syncData.success) {
            console.log(`✅ ĐỒNG BỘ THÀNH CÔNG!`);
            console.log(`   Tài khoản: ${syncData.auth?.gameName} #${syncData.auth?.tagLine}`);
            console.log(`   Từ nay trang web Render của bạn sẽ tự động chạy liên tục suốt 30 ngày!`);
          } else {
            console.log(`❌ Đồng bộ thất bại: ${syncData.message}`);
          }
        } catch (err) {
          console.log(`❌ Lỗi kết nối đến web Render: ${err.message}`);
        }
      }
      console.log('\nNhấn Enter để thoát...');
      rl.question('', () => {
        rl.close();
        process.exit(0);
      });
    });

  } else {
    console.log('\n❌ Quá thời gian chờ đăng nhập (2 phút) mà chưa phát hiện mã SSID.');
    console.log('Vui lòng thử chạy lại script và hoàn thành đăng nhập trên cửa sổ trình duyệt.');
    try { browserProc.kill(); } catch (e) {}
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Lỗi ngoài ý muốn:', err);
});

