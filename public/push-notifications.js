/**
 * Web Push subscription lifecycle: reconcile VAPID keys, persist subscriptions,
 * and send a user-requested test notification.
 */
(() => {
  const button = document.getElementById('btnPushNotify');
  const label = document.getElementById('pushNotifyText');
  const ACTIVE_TEXT = 'Đã bật thông báo 7h';
  const INACTIVE_TEXT = 'Thông báo 7h sáng';

  function setActive(active) {
    if (!button || !label) return;
    button.classList.toggle('subscribed', active);
    label.textContent = active ? ACTIVE_TEXT : INACTIVE_TEXT;
    button.title = active
      ? 'Thông báo đang hoạt động lúc 07:00 sáng mỗi ngày!'
      : 'Nhận thông báo cửa hàng Valorant lúc 07:00 sáng.';
  }

  function supportsPush() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function decodeVapidKey(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    return Uint8Array.from(raw, char => char.charCodeAt(0));
  }

  async function getPublicKey() {
    const response = await fetch('/api/push/public-key');
    const data = await response.json();
    if (!response.ok || !data.publicKey) {
      throw new Error(data.message || 'Không thể lấy VAPID Public Key từ máy chủ.');
    }
    return data.publicKey;
  }

  function subscriptionMatchesKey(subscription, publicKey) {
    const currentKey = subscription?.options?.applicationServerKey;
    if (!currentKey) return true;
    const current = new Uint8Array(currentKey);
    const expected = decodeVapidKey(publicKey);
    return current.length === expected.length && current.every((value, index) => value === expected[index]);
  }

  async function saveSubscription(subscription, auth, wishlist) {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, auth, wishlist })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Không thể lưu đăng ký thông báo.');
    }
  }

  async function sendTest(subscription) {
    const response = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, delaySeconds: 3 })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Không gửi được thông báo thử nghiệm.');
    }
  }

  async function syncOnLoad({ auth, wishlist }) {
    if (!supportsPush() || Notification.permission !== 'granted') return;

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;

      const publicKey = await getPublicKey();
      if (!subscriptionMatchesKey(subscription, publicKey)) {
        await subscription.unsubscribe();
        setActive(false);
        console.info('[Push] VAPID key changed; enable notifications again to create a fresh subscription.');
        return;
      }

      await saveSubscription(subscription, auth, wishlist);
      setActive(true);
    } catch (error) {
      setActive(false);
      console.warn('[Push] Could not restore saved subscription:', error.message);
    }
  }

  async function handleToggle({ auth, wishlist }) {
    if (!supportsPush()) {
      alert('Trình duyệt hoặc thiết bị này không hỗ trợ Web Push Notifications.');
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    if (isIOS && !isStandalone) {
      alert('📱 Trên iPhone, hãy chọn Chia sẻ → Thêm vào Màn hình chính, rồi mở VTracker từ biểu tượng đó để bật thông báo.');
      return;
    }

    try {
      if (label) label.textContent = 'Đang kích hoạt...';
      const publicKey = await getPublicKey();
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (subscription && !subscriptionMatchesKey(subscription, publicKey)) {
        await subscription.unsubscribe();
        subscription = null;
      }

      if (subscription && button?.classList.contains('subscribed')) {
        await saveSubscription(subscription, auth, wishlist);
        const shouldTest = confirm('Thông báo 7:00 sáng đang bật trên máy này.\n\nBạn có muốn gửi một thông báo thử nghiệm sau 3 giây không?');
        if (shouldTest) {
          await sendTest(subscription);
          alert('Đã hẹn gửi thử. Hãy khóa màn hình iPhone để kiểm tra thông báo.');
        }
        setActive(true);
        return;
      }

      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (permission !== 'granted') {
        setActive(false);
        alert('Bạn chưa cấp quyền thông báo. Hãy cho phép thông báo trong Cài đặt iPhone rồi thử lại.');
        return;
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(publicKey)
        });
      }

      await saveSubscription(subscription, auth, wishlist);
      setActive(true);
      await sendTest(subscription);
      alert('🎉 Đã bật thông báo 07:00 sáng. Thông báo thử sẽ đến sau vài giây; hãy khóa màn hình để kiểm tra.');
    } catch (error) {
      console.error('[Push error]:', error);
      setActive(false);
      alert('Không thể kích hoạt thông báo: ' + error.message);
    }
  }

  window.PushNotifications = { syncOnLoad, handleToggle };
})();
