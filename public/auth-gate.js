/**
 * Blocks the demo shell until a Riot account is connected.
 * The login dialog remains dismissible during normal authenticated use.
 */
(() => {
  const modal = document.getElementById('loginModal');
  const closeButton = document.getElementById('btnCloseLoginModal');

  function requireLogin() {
    document.body.classList.add('auth-required');
    if (modal) {
      modal.dataset.required = 'true';
      modal.style.display = 'flex';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'authGateTitle');
    }
    if (closeButton) closeButton.hidden = true;
  }

  function release() {
    document.body.classList.remove('auth-required');
    if (modal) {
      modal.dataset.required = 'false';
      modal.removeAttribute('aria-modal');
      modal.removeAttribute('aria-labelledby');
    }
    if (closeButton) closeButton.hidden = false;
  }

  window.AuthGate = { requireLogin, release };
})();
