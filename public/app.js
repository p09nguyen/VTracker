/**
 * VTracker // Valorant Daily Store Tracker Frontend Application
 */

// Application State
const state = {
  auth: null,
  storeData: null,
  allSkins: [],
  wishlist: new Set(),
  currentTab: 'daily',
  isDemoMode: false,
  countdownInterval: null,
  currentInspectingSkin: null,
  currentLevelIndex: 0,
  currentChromaIndex: 0,
  status: null,
  mfaSessionKey: null
};

// DOM Elements
const DOM = {
  riotClientBadge: document.getElementById('riotClientBadge'),
  cdHours: document.getElementById('cdHours'),
  cdMinutes: document.getElementById('cdMinutes'),
  cdSeconds: document.getElementById('cdSeconds'),
  rankCard: document.getElementById('rankCard'),
  rankTierIcon: document.getElementById('rankTierIcon'),
  rankTierName: document.getElementById('rankTierName'),
  rankRR: document.getElementById('rankRR'),
  rankProgressFill: document.getElementById('rankProgressFill'),
  valVP: document.getElementById('valVP'),
  valRP: document.getElementById('valRP'),
  valKC: document.getElementById('valKC'),
  userName: document.getElementById('userName'),
  userRegion: document.getElementById('userRegion'),
  userAvatar: document.getElementById('userAvatar'),
  btnLoginModal: document.getElementById('btnLoginModal'),
  wishlistAlertBanner: document.getElementById('wishlistAlertBanner'),
  wishlistAlertDesc: document.getElementById('wishlistAlertDesc'),
  btnScrollToShop: document.getElementById('btnScrollToShop'),
  btnCloseAlert: document.getElementById('btnCloseAlert'),
  dailyCounter: document.getElementById('dailyCounter'),
  wishlistCount: document.getElementById('wishlistCount'),
  btnRefreshStore: document.getElementById('btnRefreshStore'),
  btnDemoToggle: document.getElementById('btnDemoToggle'),
  btnPushNotify: document.getElementById('btnPushNotify'),
  pushNotifyText: document.getElementById('pushNotifyText'),
  loadingState: document.getElementById('loadingState'),
  sessionExpiredBanner: document.getElementById('sessionExpiredBanner'),
  sessionExpiredDesc: document.getElementById('sessionExpiredDesc'),
  btnRenewToken: document.getElementById('btnRenewToken'),
  btnCloseExpired: document.getElementById('btnCloseExpired'),
  
  // Tabs & Sections
  tabs: document.querySelectorAll('.nav-tab'),
  sections: document.querySelectorAll('.tab-section'),
  dailyGrid: document.getElementById('dailyGrid'),
  metaRegion: document.getElementById('metaRegion'),
  metaEndTime: document.getElementById('metaEndTime'),
  nightMarketGrid: document.getElementById('nightMarketGrid'),
  nightMarketBadge: document.getElementById('nightMarketBadge'),
  nmTimer: document.getElementById('nmTimer'),
  bundlesContainer: document.getElementById('bundlesContainer'),
  accessoriesGrid: document.getElementById('accessoriesGrid'),

  // Wishlist Tab
  skinSearchInput: document.getElementById('skinSearchInput'),
  btnClearSearch: document.getElementById('btnClearSearch'),
  filterTiers: document.getElementById('filterTiers'),
  myWishlistGrid: document.getElementById('myWishlistGrid'),
  catalogGrid: document.getElementById('catalogGrid'),
  wlCountDisplay: document.getElementById('wlCountDisplay'),
  savedWishlistCount: document.getElementById('savedWishlistCount'),

  // Modals
  loginModal: document.getElementById('loginModal'),
  btnCloseLoginModal: document.getElementById('btnCloseLoginModal'),
  modalTabs: document.querySelectorAll('.modal-tab'),
  authTabToken: document.getElementById('authTabToken'),
  authTabCookie: document.getElementById('authTabCookie'),
  authTabLockfile: document.getElementById('authTabLockfile'),
  authTabCredentials: document.getElementById('authTabCredentials'),
  formCookieLogin: document.getElementById('formCookieLogin'),
  inputCookieValue: document.getElementById('inputCookieValue'),
  selectCookieRegion: document.getElementById('selectCookieRegion'),
  btnCookieSubmit: document.getElementById('btnCookieSubmit'),
  detectStatus: document.getElementById('detectStatus'),
  btnAutoLogin: document.getElementById('btnAutoLogin'),
  formTokenLogin: document.getElementById('formTokenLogin'),
  inputTokenUrl: document.getElementById('inputTokenUrl'),
  selectTokenRegion: document.getElementById('selectTokenRegion'),
  btnAutoPasteClipboard: document.getElementById('btnAutoPasteClipboard'),
  btnTokenSubmit: document.getElementById('btnTokenSubmit'),
  formCredentials: document.getElementById('formCredentials'),
  inputUsername: document.getElementById('inputUsername'),
  inputPassword: document.getElementById('inputPassword'),
  selectRegion: document.getElementById('selectRegion'),
  formMfa: document.getElementById('formMfa'),
  mfaDesc: document.getElementById('mfaDesc'),
  inputMfaCode: document.getElementById('inputMfaCode'),
  btnBackToLogin: document.getElementById('btnBackToLogin'),
  authErrorBox: document.getElementById('authErrorBox'),

  // Skin Modal
  skinModal: document.getElementById('skinModal'),
  btnCloseSkinModal: document.getElementById('btnCloseSkinModal'),
  modalSkinName: document.getElementById('modalSkinName'),
  modalTierName: document.getElementById('modalTierName'),
  modalTierIcon: document.getElementById('modalTierIcon'),
  modalSkinImg: document.getElementById('modalSkinImg'),
  modalSkinVideo: document.getElementById('modalSkinVideo'),
  stageRenderWrapper: document.getElementById('stageRenderWrapper'),
  stageVideoWrapper: document.getElementById('stageVideoWrapper'),
  stageControls: document.getElementById('stageControls'),
  btnShowPhoto: document.getElementById('btnShowPhoto'),
  btnShowVideo: document.getElementById('btnShowVideo'),
  modalPriceVal: document.getElementById('modalPriceVal'),
  chromaSection: document.getElementById('chromaSection'),
  chromaList: document.getElementById('chromaList'),
  levelSection: document.getElementById('levelSection'),
  levelList: document.getElementById('levelList'),
  btnModalWishlistToggle: document.getElementById('btnModalWishlistToggle'),
  modalWishlistBtnText: document.getElementById('modalWishlistBtnText'),

  // Audio FX
  audioFlip: document.getElementById('audioFlip'),
  audioAlert: document.getElementById('audioAlert'),

  // Mobile / iPhone Modal
  btnOpenMobileModal: document.getElementById('btnOpenMobileModal'),
  mobileModal: document.getElementById('mobileModal'),
  btnCloseMobileModal: document.getElementById('btnCloseMobileModal'),
  mobileQrImg: document.getElementById('mobileQrImg'),
  mobileUrlDisplay: document.getElementById('mobileUrlDisplay')
};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', async () => {
  initStorage();
  bindEvents();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
    checkPushSubscriptionStatus();
  }

  const hasUrlToken = await checkUrlForToken();

  checkServerStatus().then(() => {
    if (state.auth) {
      loadStore(false);
    } else if (!hasUrlToken) {
      // Load demo view initially so the user immediately sees a functioning store
      state.isDemoMode = true;
      updateDemoButtonState();
      loadStore(true);
    }
  });
  loadAllSkinsCatalog();
});

// Auto-detect Token from URL hash (from Bookmarklet or direct redirect)
async function checkUrlForToken() {
  const hash = window.location.hash;
  if (hash && (hash.includes('access_token=') || hash.includes('id_token='))) {
    const rawHash = hash.startsWith('#') ? hash.substring(1) : hash;
    const params = new URLSearchParams(rawHash);
    const token = params.get('access_token');
    if (token) {
      window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
      showLoading(true);
      try {
        const res = await fetch('/api/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, region: state.auth?.region || 'ap' })
        });
        const data = await res.json();
        if (data.success) {
          saveAuth(data.auth);
          state.isDemoMode = false;
          updateDemoButtonState();
          await loadStore(false);
          return true;
        }
      } catch (e) {
        console.warn('Auto token login from hash failed:', e);
      } finally {
        showLoading(false);
      }
    }
  }
  return false;
}

// Load persistent storage
function initStorage() {
  try {
    const savedWl = localStorage.getItem('vtracker_wishlist');
    if (savedWl) {
      state.wishlist = new Set(JSON.parse(savedWl));
    }
    const savedAuth = localStorage.getItem('vtracker_auth');
    if (savedAuth) {
      state.auth = JSON.parse(savedAuth);
      updateUserUI(state.auth);
    }
  } catch (e) {
    console.warn('Could not read localStorage:', e);
  }
  updateWishlistCounters();
}

function saveWishlist() {
  localStorage.setItem('vtracker_wishlist', JSON.stringify(Array.from(state.wishlist)));
  updateWishlistCounters();
  renderMyWishlist();
  checkWishlistInStore();
}

function saveAuth(auth) {
  state.auth = auth;
  if (auth) {
    auth.savedAt = Date.now();
    localStorage.setItem('vtracker_auth', JSON.stringify(auth));
    updateUserUI(auth);
    showSessionExpiredBanner(false);
  } else {
    localStorage.removeItem('vtracker_auth');
    resetUserUI();
    showSessionExpiredBanner(false);
  }
}

// ================= SERVER STATUS & AUTH =================
async function checkServerStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state.status = data;

    if (data.riotClientRunning) {
      DOM.riotClientBadge.className = 'riot-client-status-badge online';
      DOM.riotClientBadge.innerHTML = `<span class="status-dot"></span><span>Riot Client: Đang mở (Sẵn sàng)</span>`;
      DOM.detectStatus.textContent = 'Đã phát hiện Riot Client đang chạy trên máy tính!';
      DOM.detectStatus.style.color = 'var(--rad-cyan)';
    } else {
      DOM.riotClientBadge.className = 'riot-client-status-badge offline';
      DOM.riotClientBadge.innerHTML = `<span class="status-dot"></span><span>Riot Client: Chưa mở</span>`;
      DOM.detectStatus.textContent = 'Riot Client chưa chạy hoặc chưa đăng nhập. Vui lòng mở game hoặc dùng tab Riot Web.';
      DOM.detectStatus.style.color = '#fb7185';
    }
  } catch (e) {
    console.error('Server status check failed:', e);
    DOM.riotClientBadge.className = 'riot-client-status-badge offline';
    DOM.riotClientBadge.innerHTML = `<span class="status-dot"></span><span>Mất kết nối máy chủ</span>`;
  }
}

// 1. Token / Redirect URL Login
async function handleTokenLogin(e) {
  e.preventDefault();
  showError('');
  const tokenUrl = DOM.inputTokenUrl.value.trim();
  const region = DOM.selectTokenRegion.value;

  if (!tokenUrl) return;

  DOM.btnTokenSubmit.disabled = true;
  DOM.btnTokenSubmit.textContent = 'ĐANG XÁC THỰC TOKEN...';

  try {
    const res = await fetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenUrl, region })
    });
    const data = await res.json();

    if (!data.success) {
      showError(data.message || 'Xác thực token thất bại.');
      return;
    }

    saveAuth(data.auth);
    state.isDemoMode = false;
    updateDemoButtonState();
    closeLoginModal();
    await loadStore(false);
  } catch (err) {
    showError(err.message);
  } finally {
    DOM.btnTokenSubmit.disabled = false;
    DOM.btnTokenSubmit.textContent = 'XÁC NHẬN & TẢI CỬA HÀNG CỦA BẠN';
  }
}

// 1b. 1-Tap Auto-Paste from Clipboard
async function handleAutoPasteClipboard() {
  showError('');
  try {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      alert('Trình duyệt của bạn không hỗ trợ đọc tự động clipboard. Bạn vui lòng ấn giữ vào ô nhập và chọn Dán (Paste).');
      return;
    }
    const text = await navigator.clipboard.readText();
    if (!text || (!text.includes('access_token=') && !text.includes('opt_in') && text.length < 40)) {
      showError('Chưa tìm thấy link đăng nhập trong bộ nhớ tạm. Hãy copy link trên trang Riot rồi quay lại bấm nút này nhé!');
      return;
    }
    DOM.inputTokenUrl.value = text.trim();
    DOM.formTokenLogin.dispatchEvent(new Event('submit'));
  } catch (err) {
    console.warn('Clipboard read error:', err);
    showError('Cần cấp quyền truy cập bộ nhớ tạm. Hoặc bạn có thể chạm giữ vào ô bên dưới và chọn Dán (Paste).');
  }
}

// 2. Cookie (ssid) Login (Persistent 7-30 days)
async function handleCookieLogin(e) {
  e.preventDefault();
  showError('');
  const cookieVal = DOM.inputCookieValue.value.trim();
  const region = DOM.selectCookieRegion.value;

  if (!cookieVal) return;

  DOM.btnCookieSubmit.disabled = true;
  DOM.btnCookieSubmit.textContent = 'ĐANG XÁC THỰC COOKIE...';

  try {
    const res = await fetch('/api/auth/cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie: cookieVal, region })
    });
    const data = await res.json();

    if (!data.success) {
      showError(data.message || 'Xác thực cookie thất bại.');
      return;
    }

    saveAuth(data.auth);
    state.isDemoMode = false;
    updateDemoButtonState();
    closeLoginModal();
    await loadStore(false);
  } catch (err) {
    showError(err.message);
  } finally {
    DOM.btnCookieSubmit.disabled = false;
    DOM.btnCookieSubmit.textContent = 'XÁC NHẬN & DUY TRÌ ĐĂNG NHẬP 30 NGÀY';
  }
}

// 2. Lockfile Auto Login
async function handleAutoLogin(silent = false) {
  showError('');
  if (!silent) showLoading(true);
  try {
    const res = await fetch('/api/auth/lockfile', { method: 'POST' });
    const data = await res.json();
    if (!data.success) {
      if (!silent) showError(data.message || 'Không thể đồng bộ với Riot Client.');
      return;
    }
    saveAuth(data.auth);
    state.isDemoMode = false;
    updateDemoButtonState();
    closeLoginModal();
    await loadStore(false);
  } catch (err) {
    if (!silent) {
      showError(err.message);
    }
  } finally {
    if (!silent) showLoading(false);
  }
}

// 3. Username / Password Login
async function handleCredentialsLogin(e) {
  e.preventDefault();
  showError('');
  const username = DOM.inputUsername.value.trim();
  const password = DOM.inputPassword.value;
  const region = DOM.selectRegion.value;

  if (!username || !password) return;

  const btn = document.getElementById('btnLoginSubmit');
  btn.disabled = true;
  btn.textContent = 'ĐANG ĐĂNG NHẬP...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, region })
    });
    const data = await res.json();

    if (!data.success) {
      showError(data.message || 'Đăng nhập thất bại.');
      return;
    }

    if (data.mfaRequired) {
      state.mfaSessionKey = data.sessionKey;
      DOM.formCredentials.style.display = 'none';
      DOM.formMfa.style.display = 'flex';
      DOM.mfaDesc.textContent = `Riot Games đã gửi mã xác thực 6 số đến email (${data.email}).`;
      DOM.inputMfaCode.focus();
      return;
    }

    saveAuth(data.auth);
    state.isDemoMode = false;
    updateDemoButtonState();
    closeLoginModal();
    await loadStore(false);
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'ĐĂNG NHẬP RIOT GAMES';
  }
}

async function handleMfaSubmit(e) {
  e.preventDefault();
  showError('');
  const code = DOM.inputMfaCode.value.trim();
  if (!code || !state.mfaSessionKey) return;

  const btn = document.getElementById('btnMfaSubmit');
  btn.disabled = true;
  btn.textContent = 'ĐANG XÁC THỰC...';

  try {
    const res = await fetch('/api/auth/mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionKey: state.mfaSessionKey, code })
    });
    const data = await res.json();

    if (!data.success) {
      showError(data.message || 'Mã xác thực không hợp lệ.');
      return;
    }

    saveAuth(data.auth);
    state.isDemoMode = false;
    updateDemoButtonState();
    closeLoginModal();
    await loadStore(false);
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'XÁC NHẬN MÃ 2FA';
  }
}

function handleLogout() {
  saveAuth(null);
  state.isDemoMode = true;
  updateDemoButtonState();
  loadStore(true);
}

// ================= STORE DATA LOADING =================
async function loadStore(demo = false) {
  showLoading(true);
  try {
    const res = await fetch('/api/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: demo ? 'demo' : 'live',
        auth: state.auth
      })
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || 'Không thể tải dữ liệu cửa hàng.');
    }

    // Auto-update storage if token was refreshed via cookie in background
    if (data.refreshedAuth) {
      console.log('[Auth] Token automatically refreshed via cookie in background!');
      saveAuth(data.refreshedAuth);
    }

    state.storeData = data;
    renderStoreData(data);
    showSessionExpiredBanner(false);
    startCountdown(data.dailyOffers.endsAt || data.dailyOffers.remainingSeconds);
    checkWishlistInStore();
  } catch (err) {
    console.warn('Failed to load store:', err);
    if (!demo) {
      // Live session expired or failed
      state.isDemoMode = true;
      updateDemoButtonState();
      showSessionExpiredBanner(true, err.message || 'Phiên đăng nhập Riot của bạn đã hết hạn (Token 1 giờ). Vui lòng bấm Lấy Token mới để xem cửa hàng hôm nay.');
      if (state.auth) {
        DOM.userRegion.textContent = `${state.auth.region?.toUpperCase()} // HẾT HẠN TOKEN`;
        DOM.userRegion.style.color = '#fb7185';
        DOM.btnLoginModal.querySelector('.btn-text').textContent = 'Đăng nhập lại';
      }
      loadStore(true);
    }
  } finally {
    showLoading(false);
  }
}

// ================= RENDERING =================
function renderStoreData(store) {
  DOM.valVP.textContent = (store.wallet?.vp || 0).toLocaleString();
  DOM.valRP.textContent = (store.wallet?.rp || 0).toLocaleString();
  DOM.valKC.textContent = (store.wallet?.kc || 0).toLocaleString();

  if (store.player) {
    DOM.userName.textContent = `${store.player.gameName} #${store.player.tagLine}`;
    DOM.userRegion.textContent = `${store.player.region?.toUpperCase()} // ${store.mode === 'demo' ? 'DEMO' : 'LIVE'}`;
    DOM.userAvatar.textContent = store.player.gameName.slice(0, 2).toUpperCase();
    DOM.metaRegion.textContent = store.player.region?.toUpperCase();
  }

  // Render Rank and RR
  if (store.rank) {
    const isUnranked = !store.rank.tier || store.rank.tier <= 2;
    if (DOM.rankTierName) {
      DOM.rankTierName.textContent = isUnranked ? 'UNRANKED' : store.rank.tierName;
    }
    if (DOM.rankRR) {
      DOM.rankRR.textContent = isUnranked ? 'Chưa xếp hạng' : `${store.rank.rankedRating ?? 0} RR`;
    }
    if (DOM.rankTierIcon && store.rank.largeIcon) {
      DOM.rankTierIcon.src = store.rank.largeIcon;
      DOM.rankTierIcon.alt = store.rank.tierName || 'Rank Tier';
    }
    if (DOM.rankProgressFill) {
      const pct = isUnranked ? 0 : Math.min(100, Math.max(0, store.rank.rankedRating || 0));
      DOM.rankProgressFill.style.width = `${pct}%`;
    }
  }

  renderDailyOffers(store.dailyOffers?.items || []);
  renderNightMarket(store.nightMarket);
  renderFeaturedBundles(store.featuredBundles);
  renderAccessoryStore(store.accessoryStore);
}

// TAB 1: DAILY OFFERS
function renderDailyOffers(items) {
  DOM.dailyGrid.innerHTML = '';
  DOM.dailyCounter.textContent = items.length;

  if (items.length === 0) {
    DOM.dailyGrid.innerHTML = `<div class="empty-notice">Không có vật phẩm nào được tìm thấy.</div>`;
    return;
  }

  items.forEach(skin => {
    const isWished = state.wishlist.has(skin.uuid);
    const tierColor = skin.tier?.color || '#94a3b8';
    const card = document.createElement('div');
    card.className = `skin-card ${isWished ? 'in-wishlist' : ''}`;
    card.style.setProperty('--tier-color', tierColor);
    card.style.setProperty('--tier-glow', `${tierColor}44`);

    card.innerHTML = `
      <div class="card-header">
        <div class="tier-badge">
          ${skin.tier?.icon ? `<img src="${skin.tier.icon}" class="tier-icon-img" alt="${skin.tier.name}">` : ''}
          <span>${skin.tier?.name || 'Standard'}</span>
        </div>
        <button class="btn-card-wishlist ${isWished ? 'active' : ''}" data-uuid="${skin.uuid}" title="${isWished ? 'Bỏ theo dõi' : 'Thêm vào Wishlist'}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="${isWished ? '#ff4655' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        </button>
      </div>

      <div class="card-visual">
        <div class="card-bg-gradient"></div>
        <img src="${skin.displayIcon || ''}" alt="${skin.displayName}" class="weapon-img">
        ${skin.streamedVideo ? `<div class="has-video-badge"><span class="play-icon"></span><span>VFX Video</span></div>` : ''}
      </div>

      <div class="card-info">
        <h3 class="skin-title">${skin.displayName}</h3>
        <div class="card-footer">
          <div class="price-display">
            <span class="curr-icon vp-icon"></span>
            <span>${(skin.cost || 0).toLocaleString()}</span>
          </div>
          <button class="btn-inspect" data-uuid="${skin.uuid}">Chi tiết</button>
        </div>
      </div>
    `;

    card.querySelector('.btn-card-wishlist').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleWishlist(skin.uuid);
    });

    card.querySelector('.btn-inspect').addEventListener('click', () => {
      openSkinModal(skin);
    });

    card.addEventListener('click', () => {
      openSkinModal(skin);
    });

    DOM.dailyGrid.appendChild(card);
  });
}

// TAB 2: NIGHT MARKET
function renderNightMarket(nm) {
  DOM.nightMarketGrid.innerHTML = '';

  if (!nm || (!nm.isActive && (!nm.items || nm.items.length === 0))) {
    DOM.nightMarketBadge.textContent = 'Inactive';
    DOM.nightMarketBadge.style.background = '#64748b';
    DOM.nightMarketGrid.innerHTML = `
      <div class="empty-wishlist-notice">
        <h3>CHỢ ĐÊM HIỆN CHƯA MỞ TRÊN MÁY CHỦ RIOT</h3>
        <p style="margin-top: 8px;">Sự kiện Chợ Đêm Valorant diễn ra theo từng đợt mùa giải. Hãy bật <strong>Demo Mode</strong> để trải nghiệm tính năng lật thẻ Chợ Đêm!</p>
      </div>
    `;
    return;
  }

  DOM.nightMarketBadge.textContent = 'Active';
  DOM.nightMarketBadge.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';

  const daysLeft = Math.floor((nm.remainingSeconds || 86400 * 10) / 86400);
  DOM.nmTimer.textContent = `${daysLeft} Ngày còn lại`;

  nm.items.forEach((item, idx) => {
    const isWished = state.wishlist.has(item.uuid);
    const tierColor = item.tier?.color || '#d1548d';
    const container = document.createElement('div');
    container.className = 'nm-card-container';
    container.dataset.index = idx;

    container.innerHTML = `
      <div class="nm-card-inner">
        <!-- Face Down / Tarot Card -->
        <div class="nm-card-back">
          <div class="nm-tarot-pattern">
            <span class="nm-moon-icon">🌙</span>
          </div>
          <div class="nm-card-hint">CHỢ ĐÊM // #${idx + 1}</div>
          <div class="nm-click-to-flip">Nhấn để mở thẻ</div>
        </div>

        <!-- Face Up / Revealed Offer -->
        <div class="nm-card-front" style="--tier-glow: ${tierColor}44;">
          <div class="nm-discount-badge">-${item.discountPercent}%</div>
          <div class="card-header">
            <div class="tier-badge" style="color: ${tierColor};">
              ${item.tier?.icon ? `<img src="${item.tier.icon}" class="tier-icon-img" alt="${item.tier.name}">` : ''}
              <span>${item.tier?.name || 'Edition'}</span>
            </div>
            <button class="btn-card-wishlist ${isWished ? 'active' : ''}" data-uuid="${item.uuid}">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="${isWished ? '#ff4655' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </button>
          </div>

          <div class="card-visual">
            <img src="${item.displayIcon || ''}" alt="${item.displayName}" class="weapon-img">
          </div>

          <div class="card-info">
            <h3 class="skin-title">${item.displayName}</h3>
            <div class="card-footer">
              <div class="nm-price-row">
                <span class="nm-original-price">${(item.originalCost || 0).toLocaleString()}</span>
                <div class="nm-discounted-price">
                  <span class="curr-icon vp-icon"></span>
                  <span>${(item.discountedCost || 0).toLocaleString()}</span>
                </div>
              </div>
              <button class="btn-inspect" data-uuid="${item.uuid}">Xem</button>
            </div>
          </div>
        </div>
      </div>
    `;

    container.addEventListener('click', (e) => {
      if (e.target.closest('.btn-card-wishlist')) {
        toggleWishlist(item.uuid);
        return;
      }
      if (e.target.closest('.btn-inspect')) {
        openSkinModal(item);
        return;
      }

      const isRevealed = container.classList.contains('revealed');
      if (!isRevealed) {
        container.classList.add('revealed');
        playAudio(DOM.audioFlip);
      } else {
        openSkinModal(item);
      }
    });

    DOM.nightMarketGrid.appendChild(container);
  });
}

// TAB 3: FEATURED BUNDLES
function renderFeaturedBundles(fb) {
  DOM.bundlesContainer.innerHTML = '';
  const bundles = fb?.bundles || [];

  if (bundles.length === 0) {
    DOM.bundlesContainer.innerHTML = `<div class="empty-notice">Không có bộ sưu tập nào đang mở bán.</div>`;
    return;
  }

  bundles.forEach(bundle => {
    const card = document.createElement('div');
    card.className = 'bundle-card';

    const daysLeft = Math.floor((bundle.remainingSeconds || 86400 * 7) / 86400);

    card.innerHTML = `
      <div class="bundle-hero" style="background-image: url('${bundle.displayIcon || ''}');">
        <div class="bundle-hero-overlay"></div>
        <div class="bundle-hero-content">
          <div>
            <h2 class="bundle-name">${bundle.displayName}</h2>
            <div class="bundle-timer-tag">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span>Còn lại ${daysLeft} ngày</span>
            </div>
          </div>

          <div class="bundle-price-box">
            ${bundle.discountPercent > 0 ? `<div class="bundle-discount-pill">-${bundle.discountPercent}%</div>` : ''}
            <div class="price-display">
              <span class="curr-icon vp-icon-lg"></span>
              <span style="font-size: 1.8rem;">${(bundle.totalDiscountedCost || bundle.totalBaseCost).toLocaleString()}</span>
              <span style="font-size: 0.9rem; color: var(--val-red); font-weight: 800;">VP</span>
            </div>
          </div>
        </div>
      </div>

      <div class="bundle-items-shelf">
        <h3 class="bundle-shelf-title">CÁC VẬT PHẨM TRONG GÓI (${bundle.items?.length || 0})</h3>
        <div class="bundle-items-grid">
          ${(bundle.items || []).map(item => `
            <div class="skin-card mini-card" data-uuid="${item.uuid}" style="cursor: pointer;">
              <div class="card-visual" style="height: 140px;">
                <img src="${item.displayIcon || ''}" class="weapon-img" alt="${item.displayName}">
              </div>
              <div class="card-info" style="padding: 10px 14px;">
                <h4 class="skin-title" style="font-size: 1.05rem;">${item.displayName}</h4>
                <div class="price-display" style="font-size: 1.1rem;">
                  <span class="curr-icon vp-icon"></span>
                  <span>${(item.cost || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    card.querySelectorAll('.mini-card').forEach(mc => {
      mc.addEventListener('click', () => {
        const uuid = mc.dataset.uuid;
        const item = bundle.items.find(i => i.uuid === uuid);
        if (item) openSkinModal(item);
      });
    });

    DOM.bundlesContainer.appendChild(card);
  });
}

// TAB 4: ACCESSORY STORE
function renderAccessoryStore(accStore) {
  DOM.accessoriesGrid.innerHTML = '';
  const items = accStore?.items || [];

  if (items.length === 0) {
    DOM.accessoriesGrid.innerHTML = `<div class="empty-notice">Cửa hàng phụ kiện trống hoặc chưa mở.</div>`;
    return;
  }

  items.forEach(acc => {
    const card = document.createElement('div');
    card.className = 'accessory-card';

    card.innerHTML = `
      <div class="accessory-visual">
        <img src="${acc.displayIcon || ''}" alt="${acc.displayName}" class="accessory-img">
      </div>
      <div class="accessory-info">
        <div>
          <span class="accessory-type-badge">${acc.typeName || 'Accessory'}</span>
          <h3 class="accessory-title">${acc.displayName}</h3>
        </div>
        <div class="accessory-cost">
          <span class="curr-icon kc-icon"></span>
          <span>${(acc.cost || 0).toLocaleString()} KC</span>
        </div>
      </div>
    `;

    DOM.accessoriesGrid.appendChild(card);
  });
}

// ================= WISHLIST SYSTEM =================
async function loadAllSkinsCatalog() {
  try {
    const res = await fetch('/api/skins/all');
    const data = await res.json();
    state.allSkins = data.skins || [];
    renderCatalogGrid(state.allSkins.slice(0, 30));
  } catch (e) {
    console.error('Failed to load all skins catalog:', e);
  }
}

function renderMyWishlist() {
  DOM.myWishlistGrid.innerHTML = '';
  const wishlistArr = Array.from(state.wishlist);
  DOM.savedWishlistCount.textContent = wishlistArr.length;
  DOM.wlCountDisplay.textContent = wishlistArr.length;

  if (wishlistArr.length === 0) {
    DOM.myWishlistGrid.innerHTML = `
      <div class="empty-wishlist-notice">
        <h3>Bạn chưa thêm skin nào vào danh sách mong muốn.</h3>
        <p style="margin-top: 8px;">Duyệt kho vũ khí bên dưới hoặc bấm biểu tượng trái tim (❤️) tại cửa hàng hằng ngày để lưu skin.</p>
      </div>
    `;
    return;
  }

  wishlistArr.forEach(uuid => {
    const skin = state.allSkins.find(s => s.uuid === uuid);
    if (!skin) return;

    const tierColor = skin.tier?.color || '#94a3b8';
    const card = document.createElement('div');
    card.className = 'skin-card';
    card.style.setProperty('--tier-color', tierColor);
    card.style.setProperty('--tier-glow', `${tierColor}44`);

    card.innerHTML = `
      <div class="card-header">
        <div class="tier-badge">
          <span>${skin.tier?.name || 'Edition'}</span>
        </div>
        <button class="btn-card-wishlist active" data-uuid="${skin.uuid}" title="Xóa khỏi Wishlist">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#ff4655" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        </button>
      </div>
      <div class="card-visual" style="height: 160px;">
        <img src="${skin.displayIcon || ''}" class="weapon-img" alt="${skin.displayName}">
      </div>
      <div class="card-info">
        <h4 class="skin-title" style="font-size: 1.15rem;">${skin.displayName}</h4>
        <div class="card-footer">
          <span style="font-size: 0.8rem; color: var(--rad-cyan); font-weight: 700;">Đang theo dõi</span>
          <button class="btn-inspect" data-uuid="${skin.uuid}">Xem</button>
        </div>
      </div>
    `;

    card.querySelector('.btn-card-wishlist').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleWishlist(skin.uuid);
    });

    card.addEventListener('click', () => {
      openSkinModal(skin);
    });

    DOM.myWishlistGrid.appendChild(card);
  });
}

function renderCatalogGrid(skins) {
  DOM.catalogGrid.innerHTML = '';
  skins.forEach(skin => {
    const isWished = state.wishlist.has(skin.uuid);
    const tierColor = skin.tier?.color || '#94a3b8';
    const card = document.createElement('div');
    card.className = 'skin-card';
    card.style.setProperty('--tier-color', tierColor);
    card.style.setProperty('--tier-glow', `${tierColor}44`);

    card.innerHTML = `
      <div class="card-header">
        <div class="tier-badge">
          <span>${skin.tier?.name || 'Edition'}</span>
        </div>
        <button class="btn-card-wishlist ${isWished ? 'active' : ''}" data-uuid="${skin.uuid}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="${isWished ? '#ff4655' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        </button>
      </div>
      <div class="card-visual" style="height: 150px;">
        <img src="${skin.displayIcon || ''}" class="weapon-img" alt="${skin.displayName}">
      </div>
      <div class="card-info">
        <h4 class="skin-title" style="font-size: 1.1rem;">${skin.displayName}</h4>
        <div class="card-footer">
          <button class="btn-inspect" data-uuid="${skin.uuid}">Chi tiết</button>
        </div>
      </div>
    `;

    card.querySelector('.btn-card-wishlist').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleWishlist(skin.uuid);
    });

    card.addEventListener('click', () => {
      openSkinModal(skin);
    });

    DOM.catalogGrid.appendChild(card);
  });
}

function toggleWishlist(uuid) {
  if (state.wishlist.has(uuid)) {
    state.wishlist.delete(uuid);
  } else {
    state.wishlist.add(uuid);
    playAudio(DOM.audioAlert);
  }
  saveWishlist();
  if (state.storeData) {
    renderDailyOffers(state.storeData.dailyOffers?.items || []);
  }
}

function updateWishlistCounters() {
  const c = state.wishlist.size;
  DOM.wishlistCount.textContent = c;
  DOM.wlCountDisplay.textContent = c;
  DOM.savedWishlistCount.textContent = c;
}

// Real-time Wishlist Alert Detection
function checkWishlistInStore() {
  if (!state.storeData) return;
  const dailyItems = state.storeData.dailyOffers?.items || [];
  const nmItems = state.storeData.nightMarket?.items || [];

  const matched = [];
  dailyItems.forEach(item => {
    if (state.wishlist.has(item.uuid)) {
      matched.push(item.displayName);
    }
  });
  nmItems.forEach(item => {
    if (state.wishlist.has(item.uuid)) {
      matched.push(`${item.displayName} (Chợ Đêm)`);
    }
  });

  if (matched.length > 0) {
    DOM.wishlistAlertBanner.style.display = 'flex';
    DOM.wishlistAlertDesc.innerHTML = `Vật phẩm mơ ước của bạn: <strong>${matched.join(', ')}</strong> đang có mặt trong cửa hàng hôm nay!`;
    playAudio(DOM.audioAlert);
  } else {
    DOM.wishlistAlertBanner.style.display = 'none';
  }
}

// ================= COUNTDOWN TIMER =================
function startCountdown(endsAtOrSeconds) {
  if (state.countdownInterval) clearInterval(state.countdownInterval);

  let targetTime;
  if (typeof endsAtOrSeconds === 'number') {
    targetTime = Date.now() + endsAtOrSeconds * 1000;
  } else {
    targetTime = new Date(endsAtOrSeconds).getTime();
  }

  function update() {
    const now = Date.now();
    const diff = Math.max(0, Math.floor((targetTime - now) / 1000));

    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    DOM.cdHours.textContent = String(hours).padStart(2, '0');
    DOM.cdMinutes.textContent = String(minutes).padStart(2, '0');
    DOM.cdSeconds.textContent = String(seconds).padStart(2, '0');

    if (diff <= 0) {
      clearInterval(state.countdownInterval);
      loadStore(state.isDemoMode);
    }
  }

  update();
  state.countdownInterval = setInterval(update, 1000);
}

// ================= SKIN DETAIL & VIDEO MODAL =================
function openSkinModal(skin) {
  state.currentInspectingSkin = skin;
  state.currentLevelIndex = 0;
  state.currentChromaIndex = 0;

  DOM.modalSkinName.textContent = skin.displayName;
  DOM.modalTierName.textContent = skin.tier?.name || 'Standard Edition';
  DOM.modalTierName.style.color = skin.tier?.color || '#94a3b8';
  DOM.modalPriceVal.textContent = (skin.cost || 1775).toLocaleString();

  if (skin.tier?.icon) {
    DOM.modalTierIcon.innerHTML = `<img src="${skin.tier.icon}" style="width: 24px; height: 24px;" alt="tier">`;
  } else {
    DOM.modalTierIcon.innerHTML = '';
  }

  DOM.modalSkinImg.src = skin.displayIcon || '';

  const videoUrl = skin.streamedVideo;
  if (videoUrl) {
    DOM.stageControls.style.display = 'flex';
    DOM.modalSkinVideo.querySelector('source').src = videoUrl;
    DOM.modalSkinVideo.load();
    showPhotoStage();
  } else {
    DOM.stageControls.style.display = 'none';
    showPhotoStage();
  }

  if (skin.chromas && skin.chromas.length > 1) {
    DOM.chromaSection.style.display = 'block';
    DOM.chromaList.innerHTML = '';
    skin.chromas.forEach((chroma, idx) => {
      const swatch = document.createElement('div');
      swatch.className = `chroma-swatch ${idx === 0 ? 'active' : ''}`;
      swatch.title = chroma.displayName || 'Màu sắc biến thể';
      swatch.innerHTML = chroma.swatch ? `<img src="${chroma.swatch}" alt="swatch">` : `<img src="${chroma.displayIcon}" alt="icon">`;

      swatch.addEventListener('click', () => {
        DOM.chromaList.querySelectorAll('.chroma-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        if (chroma.fullRender || chroma.displayIcon) {
          DOM.modalSkinImg.src = chroma.fullRender || chroma.displayIcon;
        }
        if (chroma.streamedVideo) {
          DOM.modalSkinVideo.querySelector('source').src = chroma.streamedVideo;
          DOM.modalSkinVideo.load();
          DOM.stageControls.style.display = 'flex';
        }
      });
      DOM.chromaList.appendChild(swatch);
    });
  } else {
    DOM.chromaSection.style.display = 'none';
  }

  if (skin.levels && skin.levels.length > 1) {
    DOM.levelSection.style.display = 'block';
    DOM.levelList.innerHTML = '';
    skin.levels.forEach((lvl, idx) => {
      const item = document.createElement('div');
      item.className = `level-item ${idx === 0 ? 'active' : ''}`;
      item.innerHTML = `
        <span>${lvl.displayName || `Level ${idx + 1}`}</span>
        ${lvl.streamedVideo ? `<span style="color: var(--rad-cyan); font-size: 0.75rem;">▶ Video</span>` : ''}
      `;

      item.addEventListener('click', () => {
        DOM.levelList.querySelectorAll('.level-item').forEach(l => l.classList.remove('active'));
        item.classList.add('active');
        if (lvl.streamedVideo) {
          DOM.modalSkinVideo.querySelector('source').src = lvl.streamedVideo;
          DOM.modalSkinVideo.load();
          showVideoStage();
        }
      });
      DOM.levelList.appendChild(item);
    });
  } else {
    DOM.levelSection.style.display = 'none';
  }

  updateModalWishlistBtn(skin.uuid);
  DOM.skinModal.style.display = 'flex';
}

function showPhotoStage() {
  DOM.stageRenderWrapper.style.display = 'flex';
  DOM.stageVideoWrapper.style.display = 'none';
  DOM.modalSkinVideo.pause();
  DOM.btnShowPhoto.classList.add('active');
  DOM.btnShowVideo.classList.remove('active');
}

function showVideoStage() {
  DOM.stageRenderWrapper.style.display = 'none';
  DOM.stageVideoWrapper.style.display = 'block';
  DOM.modalSkinVideo.play().catch(() => {});
  DOM.btnShowVideo.classList.add('active');
  DOM.btnShowPhoto.classList.remove('active');
}

function updateModalWishlistBtn(uuid) {
  const isWished = state.wishlist.has(uuid);
  if (isWished) {
    DOM.btnModalWishlistToggle.className = 'btn-wishlist-toggle in-wishlist';
    DOM.modalWishlistBtnText.textContent = 'Đã có trong Wishlist (Bấm để xóa)';
  } else {
    DOM.btnModalWishlistToggle.className = 'btn-wishlist-toggle';
    DOM.modalWishlistBtnText.textContent = 'Thêm vào Wishlist';
  }
}

// ================= UI HELPERS & EVENTS =================
function bindEvents() {
  // Navigation Tabs
  DOM.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      switchTab(target);
    });
  });

  // Modal Auth Tabs
  DOM.modalTabs.forEach(mt => {
    mt.addEventListener('click', () => {
      DOM.modalTabs.forEach(t => t.classList.remove('active'));
      mt.classList.add('active');
      const target = mt.dataset.authtab;
      
      DOM.authTabToken.style.display = target === 'token' ? 'block' : 'none';
      if (DOM.authTabCookie) DOM.authTabCookie.style.display = target === 'cookie' ? 'block' : 'none';
      DOM.authTabLockfile.style.display = target === 'lockfile' ? 'block' : 'none';
      DOM.authTabCredentials.style.display = target === 'credentials' ? 'block' : 'none';
      showError('');
    });
  });

  // Demo Mode Toggle
  DOM.btnDemoToggle.addEventListener('click', () => {
    state.isDemoMode = !state.isDemoMode;
    updateDemoButtonState();
    loadStore(state.isDemoMode);
  });

  // Refresh Store Button
  DOM.btnRefreshStore.addEventListener('click', () => {
    loadStore(state.isDemoMode);
  });

  // Push Notification Toggle Button
  DOM.btnPushNotify?.addEventListener('click', handlePushNotificationToggle);

  // Session Expired Banner actions
  DOM.btnRenewToken?.addEventListener('click', () => {
    openLoginModal();
  });
  DOM.btnCloseExpired?.addEventListener('click', () => {
    showSessionExpiredBanner(false);
  });

  // Login Modal
  DOM.btnLoginModal.addEventListener('click', () => {
    if (state.auth) {
      if (confirm(`Bạn đang đăng nhập với tài khoản ${state.auth.gameName}. Bạn có muốn đăng xuất?`)) {
        handleLogout();
      }
    } else {
      openLoginModal();
    }
  });

  DOM.btnCloseLoginModal.addEventListener('click', closeLoginModal);
  
  // Mobile / iPhone Connect Modal
  DOM.btnOpenMobileModal?.addEventListener('click', async () => {
    try {
      DOM.mobileModal.style.display = 'flex';
      const res = await fetch('/api/connect-mobile');
      const data = await res.json();
      if (data.success) {
        DOM.mobileQrImg.src = data.qrDataUrl;
        DOM.mobileUrlDisplay.textContent = data.url;
      }
    } catch(e) {
      console.warn('Error loading mobile QR:', e);
    }
  });
  DOM.btnCloseMobileModal?.addEventListener('click', () => {
    DOM.mobileModal.style.display = 'none';
  });
  
  // Submit handlers
  DOM.btnAutoPasteClipboard?.addEventListener('click', handleAutoPasteClipboard);
  DOM.formTokenLogin.addEventListener('submit', handleTokenLogin);
  DOM.formCookieLogin?.addEventListener('submit', handleCookieLogin);
  DOM.btnAutoLogin.addEventListener('click', () => handleAutoLogin(false));
  DOM.formCredentials.addEventListener('submit', handleCredentialsLogin);
  DOM.formMfa.addEventListener('submit', handleMfaSubmit);
  DOM.btnBackToLogin.addEventListener('click', () => {
    DOM.formMfa.style.display = 'none';
    DOM.formCredentials.style.display = 'flex';
  });

  // Skin Modal
  DOM.btnCloseSkinModal.addEventListener('click', () => {
    DOM.skinModal.style.display = 'none';
    DOM.modalSkinVideo.pause();
  });
  DOM.btnShowPhoto.addEventListener('click', showPhotoStage);
  DOM.btnShowVideo.addEventListener('click', showVideoStage);
  DOM.btnModalWishlistToggle.addEventListener('click', () => {
    if (state.currentInspectingSkin) {
      toggleWishlist(state.currentInspectingSkin.uuid);
      updateModalWishlistBtn(state.currentInspectingSkin.uuid);
    }
  });

  // Wishlist Search Input
  let searchTimeout = null;
  DOM.skinSearchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    DOM.btnClearSearch.style.display = val ? 'block' : 'none';
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterCatalog();
    }, 200);
  });

  DOM.btnClearSearch.addEventListener('click', () => {
    DOM.skinSearchInput.value = '';
    DOM.btnClearSearch.style.display = 'none';
    filterCatalog();
  });

  // Tier Filter Pills
  DOM.filterTiers.querySelectorAll('.tier-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      DOM.filterTiers.querySelectorAll('.tier-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      filterCatalog();
    });
  });

  // Wishlist Banner actions
  DOM.btnScrollToShop.addEventListener('click', () => {
    switchTab('daily');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  DOM.btnCloseAlert.addEventListener('click', () => {
    DOM.wishlistAlertBanner.style.display = 'none';
  });
}

function switchTab(tabId) {
  state.currentTab = tabId;
  DOM.tabs.forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabId);
  });
  DOM.sections.forEach(s => {
    s.classList.remove('active');
  });

  if (tabId === 'daily') document.getElementById('tabDaily').classList.add('active');
  if (tabId === 'nightmarket') document.getElementById('tabNightMarket').classList.add('active');
  if (tabId === 'bundles') document.getElementById('tabBundles').classList.add('active');
  if (tabId === 'accessories') document.getElementById('tabAccessories').classList.add('active');
  if (tabId === 'wishlist') {
    document.getElementById('tabWishlist').classList.add('active');
    renderMyWishlist();
  }
}

function filterCatalog() {
  const query = DOM.skinSearchInput.value.trim().toLowerCase();
  const activeTier = DOM.filterTiers.querySelector('.tier-pill.active')?.dataset.tier || 'all';

  let filtered = state.allSkins;
  if (query) {
    filtered = filtered.filter(s => s.displayName.toLowerCase().includes(query));
  }
  if (activeTier !== 'all') {
    filtered = filtered.filter(s => s.tier?.name === activeTier);
  }

  renderCatalogGrid(filtered.slice(0, 40));
}

function updateDemoButtonState() {
  DOM.btnDemoToggle.classList.toggle('active', state.isDemoMode);
}

function updateUserUI(auth) {
  DOM.userName.textContent = `${auth.gameName} #${auth.tagLine}`;
  DOM.userRegion.textContent = `${auth.region?.toUpperCase()} // LIVE`;
  DOM.userAvatar.textContent = auth.gameName.slice(0, 2).toUpperCase();
  DOM.btnLoginModal.querySelector('.btn-text').textContent = 'Đăng xuất';
}

function resetUserUI() {
  DOM.userName.textContent = 'Chưa đăng nhập';
  DOM.userRegion.textContent = 'DEMO // CHẾ ĐỘ THỬ';
  DOM.userAvatar.textContent = 'VA';
  DOM.btnLoginModal.querySelector('.btn-text').textContent = 'Đăng nhập';
}

function openLoginModal() {
  checkServerStatus();
  const authLink = document.getElementById('btnOpenRiotAuth');
  if (authLink) {
    authLink.href = `https://auth.riotgames.com/authorize?client_id=play-valorant-web-prod&response_type=token%20id_token&redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&scope=account%20openid&nonce=${Date.now()}`;
  }
  DOM.loginModal.style.display = 'flex';
}

function closeLoginModal() {
  DOM.loginModal.style.display = 'none';
  showError('');
}

function showError(msg) {
  if (msg) {
    DOM.authErrorBox.textContent = msg;
    DOM.authErrorBox.style.display = 'block';
  } else {
    DOM.authErrorBox.style.display = 'none';
  }
}

function showLoading(show) {
  DOM.loadingState.style.display = show ? 'flex' : 'none';
}

function showSessionExpiredBanner(show, msg = '') {
  if (!DOM.sessionExpiredBanner) return;
  DOM.sessionExpiredBanner.style.display = show ? 'flex' : 'none';
  if (show && msg && DOM.sessionExpiredDesc) {
    DOM.sessionExpiredDesc.textContent = msg;
  }
}

function playAudio(el) {
  try {
    if (el) {
      el.currentTime = 0;
      el.play().catch(() => {});
    }
  } catch (e) {}
}

// ================= WEB PUSH NOTIFICATIONS (IPHONE / ANDROID / DESKTOP) =================
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function checkPushSubscriptionStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub && Notification.permission === 'granted') {
      DOM.btnPushNotify.classList.add('subscribed');
      DOM.pushNotifyText.textContent = 'Đã bật thông báo 7h';
      DOM.btnPushNotify.title = 'Thông báo đang hoạt động lúc 07:00 sáng mỗi ngày!';
    }
  } catch (e) {
    console.warn('[Push] Error checking subscription:', e);
  }
}

async function handlePushNotificationToggle() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('Trình duyệt hoặc thiết bị này không hỗ trợ Web Push Notifications.');
    return;
  }

  // iOS Safari check: If on iPhone/iPad and not added to Home Screen yet
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

  if (isIOS && !isStandalone) {
    alert('📱 Trên iPhone, bạn cần bấm nút Chia sẻ (Share) -> chọn "Thêm vào Màn hình chính" trước, sau đó mở app từ màn hình chính để bật thông báo đẩy 07:00 sáng!');
    return;
  }

  // If already subscribed, offer to test notification with a 3-second delay
  try {
    const reg = await navigator.serviceWorker.ready;
    const existingSub = await reg.pushManager.getSubscription();
    if (existingSub && DOM.btnPushNotify.classList.contains('subscribed')) {
      const doTest = confirm('Thông báo 7:00 sáng của bạn đang HOẠT ĐỘNG!\n\nBạn có muốn gửi một thông báo thử nghiệm sau 3 giây không? (Bấm OK rồi KHÓA MÀN HÌNH iPhone hoặc gạt về Home để thấy thông báo nổ chuông)');
      if (doTest) {
        await fetch('/api/push/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: existingSub, delaySeconds: 3 })
        });
        alert('Đã gửi thông báo sau 3 giây! Bạn hãy KHÓA MÀN HÌNH iPhone ngay bây giờ nhé!');
      }
      return;
    }
  } catch (e) {}

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Bạn đã từ chối cấp quyền thông báo. Vui lòng cho phép quyền thông báo trong Cài đặt iPhone/Trình duyệt để nhận tin lúc 07:00 sáng.');
      return;
    }

    DOM.pushNotifyText.textContent = 'Đang kích hoạt...';

    // 1. Fetch public key
    const keyRes = await fetch('/api/push/public-key');
    const keyData = await keyRes.json();
    if (!keyData.publicKey) {
      throw new Error('Không thể lấy VAPID Public Key từ máy chủ.');
    }

    // 2. Subscribe via Service Worker
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
      });
    }

    // 3. Save subscription on server
    const saveRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub,
        auth: state.auth,
        wishlist: Array.from(state.wishlist)
      })
    });
    const saveData = await saveRes.json();

    if (!saveData.success) {
      throw new Error(saveData.message || 'Lỗi lưu thông tin thiết bị.');
    }

    DOM.btnPushNotify.classList.add('subscribed');
    DOM.pushNotifyText.textContent = 'Đã bật thông báo 7h';
    DOM.btnPushNotify.title = 'Thông báo đang hoạt động lúc 07:00 sáng mỗi ngày!';

    // 4. Send test push notification with 3s delay so user can lock screen
    await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub, delaySeconds: 3 })
    });

    alert('🎉 ĐÃ BẬT THÔNG BÁO ĐẨY 07:00 SÁNG THÀNH CÔNG!\n\n💡 LƯU Ý QUAN TRỌNG TRÊN IPHONE:\niOS KHÔNG hiện biểu ngữ khi bạn đang mở sẵn màn hình app này.\n\n👉 Hãy bấm OK rồi KHÓA MÀN HÌNH iPhone lại (hoặc gạt về Home), sau 3 giây thông báo sẽ nổ chuông và hiện trên Màn hình khóa!');
  } catch (err) {
    console.error('[Push error]:', err);
    alert('Không thể kích hoạt thông báo: ' + err.message);
    DOM.pushNotifyText.textContent = 'Thông báo 7h sáng';
  }
}
