var Sched20 = (function () {
  var TOKEN_KEY = 'sched20.accessToken';
  var EXP_KEY = 'sched20.accessTokenExp';
  var GOOGLE_SCOPE = 'openid email profile https://www.googleapis.com/auth/calendar.freebusy';

  function getConfig_() {
    var cfg = window.SCHED20_CONFIG || {};
    return {
      apiUrl: String(cfg.apiUrl || '').trim(),
      googleClientId: String(cfg.googleClientId || '').trim(),
      apiVersion: cfg.apiVersion || 1,
      uiVersion: String(cfg.uiVersion || '')
    };
  }

  function isConfigured() {
    var cfg = getConfig_();
    return !!(cfg.apiUrl && cfg.googleClientId);
  }

  function storageGet_(key) {
    try {
      return sessionStorage.getItem(key) || '';
    } catch (err) {
      return '';
    }
  }

  function storageSet_(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (err) {}
  }

  function storageRemove_(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (err) {}
  }

  function authError_(message) {
    var err = new Error(message || 'Accedi con Google per continuare.');
    err.code = 'auth';
    return err;
  }

  function isAuthError(err) {
    return !!(err && err.code === 'auth');
  }

  function hasValidToken() {
    var token = storageGet_(TOKEN_KEY);
    var exp = Number(storageGet_(EXP_KEY) || 0);
    return !!(token && exp > Date.now());
  }

  function saveToken_(token, expiresIn) {
    var seconds = Number(expiresIn) || 3600;
    var exp = Date.now() + Math.max(30, seconds - 60) * 1000;
    storageSet_(TOKEN_KEY, token);
    storageSet_(EXP_KEY, String(exp));
  }

  function clearSession() {
    storageRemove_(TOKEN_KEY);
    storageRemove_(EXP_KEY);
  }

  function whenGoogleReady_() {
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      (function tick() {
        if (window.google && google.accounts && google.accounts.oauth2) {
          resolve();
          return;
        }
        if (Date.now() - start > 8000) {
          reject(new Error('Login Google non disponibile. Controlla la rete e ricarica la pagina.'));
          return;
        }
        setTimeout(tick, 50);
      })();
    });
  }

  function signIn() {
    var cfg = getConfig_();
    if (!cfg.googleClientId) {
      return Promise.reject(new Error('Manca googleClientId in config.js.'));
    }
    if (!window.google || !google.accounts || !google.accounts.oauth2) {
      return Promise.reject(new Error('Login Google non ancora pronto. Riprova tra un istante.'));
    }
    return new Promise(function (resolve, reject) {
      var client = google.accounts.oauth2.initTokenClient({
        client_id: cfg.googleClientId,
        scope: GOOGLE_SCOPE,
        callback: function (resp) {
          if (!resp || resp.error) {
            var cancelled = resp && (resp.error === 'access_denied' || resp.error === 'popup_closed');
            reject(new Error(cancelled ? 'Accesso annullato.' : 'Accesso Google non riuscito.'));
            return;
          }
          saveToken_(resp.access_token, resp.expires_in);
          resolve(resp.access_token);
        }
      });
      client.requestAccessToken({
        prompt: 'select_account',
        include_granted_scopes: true
      });
    });
  }

  function signOut() {
    var token = storageGet_(TOKEN_KEY);
    clearSession();
    if (token && window.google && google.accounts && google.accounts.oauth2 && google.accounts.oauth2.revoke) {
      try {
        google.accounts.oauth2.revoke(token, function () {});
      } catch (err) {}
    }
    return Promise.resolve();
  }

  function run(action, params) {
    var cfg = getConfig_();
    if (!cfg.apiUrl) {
      return Promise.reject(new Error('Manca apiUrl in config.js.'));
    }
    var token = storageGet_(TOKEN_KEY);
    if (!hasValidToken()) {
      clearSession();
      return Promise.reject(authError_());
    }
    return fetch(cfg.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        v: cfg.apiVersion,
        action: action,
        accessToken: token,
        params: params || {}
      })
    }).then(function (res) {
      return res.text();
    }, function () {
      throw new Error('Connessione all\'API non riuscita. Controlla apiUrl e la pubblicazione della web app.');
    }).then(function (text) {
      var body;
      try {
        body = JSON.parse(text);
      } catch (err) {
        throw new Error('Risposta API non valida. apiUrl deve essere l\'URL /exec della web app.');
      }
      if (!body || body.ok !== true) {
        var error = new Error(body && body.error ? body.error : 'Errore API');
        error.code = body && body.code ? body.code : '';
        if (error.code === 'auth') clearSession();
        throw error;
      }
      return body.data;
    });
  }

  function pageUrl_(file, search) {
    var url = new URL(file, window.location.href);
    url.search = search || '';
    url.hash = '';
    return url.href;
  }

  function buildHomeLink() {
    return pageUrl_('index.html', '');
  }

  function buildCampaignLink(uuid) {
    return pageUrl_('campaign.html', '?c=' + encodeURIComponent(uuid));
  }

  function getCampaignUuidFromUrl() {
    return new URLSearchParams(window.location.search).get('c') || '';
  }

  function formatDateIt(dateStr) {
    if (!dateStr) return '';
    var parts = String(dateStr).split('-');
    if (parts.length !== 3) return dateStr;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (err) {
        document.body.removeChild(ta);
        reject(err);
      }
    });
  }

  function showMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = type === 'success' ? 'success' : 'error';
    el.hidden = !text;
  }

  function clearMessage(el) {
    if (!el) return;
    el.hidden = true;
    el.textContent = '';
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function applyVersion(el) {
    if (!el) return;
    var cfg = getConfig_();
    el.textContent = 'Interfaccia ' + (cfg.uiVersion || '—') + ' · API v' + cfg.apiVersion;
  }

  function renderSetup(el) {
    el.innerHTML =
      '<div class="card setup-card">' +
        '<h2>Configurazione mancante</h2>' +
        '<p>Apri <strong>web/config.js</strong> e imposta i due valori pubblici:</p>' +
        '<ul>' +
          '<li><strong>apiUrl</strong>: URL della web app, quello che termina con /exec</li>' +
          '<li><strong>googleClientId</strong>: Client ID OAuth dell\'applicazione web</li>' +
        '</ul>' +
        '<p>Poi pubblica la cartella web sul repo GitHub Pages.</p>' +
      '</div>';
  }

  function renderSignIn(el, messageEl, onSignedIn) {
    el.innerHTML =
      '<div class="card card-muted">' +
        '<h2>Accedi con Google</h2>' +
        '<p>Per organizzare o votare le sessioni serve un account Google.</p>' +
        '<p>Al primo accesso accetta identità e lettura degli orari occupati del calendario. L\'app non legge titoli, invitati o descrizioni degli eventi.</p>' +
        '<button class="btn btn-primary" id="btnSignIn" type="button">Accedi con Google</button>' +
      '</div>';
    var btn = document.getElementById('btnSignIn');
    btn.disabled = true;
    whenGoogleReady_().then(function () {
      btn.disabled = false;
    }).catch(function (err) {
      btn.disabled = false;
      showMessage(messageEl, err.message, 'error');
    });
    btn.addEventListener('click', function () {
      btn.disabled = true;
      clearMessage(messageEl);
      signIn().then(function () {
        onSignedIn();
      }).catch(function (err) {
        btn.disabled = false;
        showMessage(messageEl, err.message, 'error');
      });
    });
  }

  return {
    isConfigured: isConfigured,
    hasValidToken: hasValidToken,
    isAuthError: isAuthError,
    signIn: signIn,
    signOut: signOut,
    clearSession: clearSession,
    run: run,
    buildHomeLink: buildHomeLink,
    buildCampaignLink: buildCampaignLink,
    getCampaignUuidFromUrl: getCampaignUuidFromUrl,
    formatDateIt: formatDateIt,
    copyToClipboard: copyToClipboard,
    showMessage: showMessage,
    clearMessage: clearMessage,
    escapeHtml: escapeHtml,
    applyVersion: applyVersion,
    renderSetup: renderSetup,
    renderSignIn: renderSignIn
  };
})();
