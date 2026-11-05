var Sched20 = (function () {
  var MASTER_CODE_KEY = 'sched20.masterCode';
  var PLAYER_NAME_KEY = 'sched20.playerName';

  function getConfig_() {
    var cfg = window.SCHED20_CONFIG || {};
    return {
      apiUrl: String(cfg.apiUrl || '').trim(),
      apiVersion: cfg.apiVersion || 2,
      uiVersion: String(cfg.uiVersion || '')
    };
  }

  function isConfigured() {
    return !!getConfig_().apiUrl;
  }

  function storageGet_(key) {
    try {
      return localStorage.getItem(key) || '';
    } catch (err) {
      return '';
    }
  }

  function storageSet_(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (err) {}
  }

  function storageRemove_(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {}
  }

  function getMasterCode() {
    return storageGet_(MASTER_CODE_KEY);
  }

  function setMasterCode(code) {
    storageSet_(MASTER_CODE_KEY, String(code || ''));
  }

  function clearMasterCode() {
    storageRemove_(MASTER_CODE_KEY);
  }

  function getPlayerName() {
    return storageGet_(PLAYER_NAME_KEY);
  }

  function setPlayerName(name) {
    var value = String(name || '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
    if (value) storageSet_(PLAYER_NAME_KEY, value);
    else storageRemove_(PLAYER_NAME_KEY);
    return value;
  }

  function isAuthError(err) {
    return !!(err && err.code === 'auth');
  }

  function withIdentity_(params) {
    var source = params || {};
    var out = {};
    Object.keys(source).forEach(function (key) {
      out[key] = source[key];
    });
    if (!out.masterCode) {
      var code = getMasterCode();
      if (code) out.masterCode = code;
    }
    if (!out.playerName) {
      var name = getPlayerName();
      if (name) out.playerName = name;
    }
    return out;
  }

  function run(action, params) {
    var cfg = getConfig_();
    if (!cfg.apiUrl) {
      return Promise.reject(new Error('Manca apiUrl in config.js.'));
    }
    return fetch(cfg.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        v: cfg.apiVersion,
        action: action,
        params: withIdentity_(params)
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
        '<p>Apri <strong>web/config.js</strong> e imposta <strong>apiUrl</strong>: l\'URL della web app, quello che termina con /exec.</p>' +
        '<p>Poi pubblica la cartella web sul repo GitHub Pages.</p>' +
      '</div>';
  }

  return {
    isConfigured: isConfigured,
    isAuthError: isAuthError,
    getMasterCode: getMasterCode,
    setMasterCode: setMasterCode,
    clearMasterCode: clearMasterCode,
    getPlayerName: getPlayerName,
    setPlayerName: setPlayerName,
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
    renderSetup: renderSetup
  };
})();
