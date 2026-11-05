(function () {
  var app = document.getElementById('app');
  var messageEl = document.getElementById('message');
  Sched20.applyVersion(document.getElementById('versionLine'));

  function showLoading() {
    app.className = 'loading';
    app.textContent = 'Caricamento…';
  }

  function showApp() {
    app.className = '';
  }

  function setStage(wide) {
    document.getElementById('stage').className = wide ? 'stage stage-wide' : 'stage';
  }

  function uuidFromText(value) {
    var text = String(value || '').trim();
    if (!text) return '';
    var fromQuery = text.match(/[?&]c=([0-9a-fA-F-]{36})/);
    if (fromQuery) return fromQuery[1];
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(text)) {
      return text;
    }
    return '';
  }

  // Torna alla home senza lasciare schermate fantasma nella cronologia.
  function goHome() {
    try { history.replaceState({ s20: 0 }, '', window.location.href); } catch (e) { /* ignorato */ }
    renderChoice();
  }

  function renderChoice() {
    setStage(false);
    showApp();
    app.innerHTML =
      '<div class="card role-card">' +
        '<h1 class="wordmark"><img src="wordmark.png" alt="Sched20"></h1>' +
        '<p class="tagline">Organizza le sessioni della tua campagna</p>' +
        '<div class="role-list">' +
          '<button class="role-btn" id="btnAsMaster" type="button">' +
            '<strong>Master</strong>' +
            '<span>Entra con il tuo codice e gestisci le campagne.</span>' +
          '</button>' +
          '<button class="role-btn" id="btnAsPlayer" type="button">' +
            '<strong>Giocatore</strong>' +
            '<span>Apri il link della campagna e vota le date.</span>' +
          '</button>' +
        '</div>' +
        '<p class="subtitle account-line">' +
          (Sched20.getSessionToken()
            ? 'Sei connesso con la mail. <button class="text-back" id="btnLogout" type="button">Esci</button>'
            : 'Hai un account? <button class="text-back" id="btnLoginMail" type="button">Accedi con la mail</button>') +
        '</p>' +
      '</div>';

    var btnLoginMail = document.getElementById('btnLoginMail');
    if (btnLoginMail) btnLoginMail.addEventListener('click', function () { Sched20.navTo(renderLogin); });
    var btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', function () {
        Sched20.clearSessionToken();
        Sched20.showMessage(messageEl, 'Sei uscito dall\'account su questo dispositivo.', 'success');
        goHome();
      });
    }

    document.getElementById('btnAsMaster').addEventListener('click', function () { Sched20.navTo(enterMaster); });
    document.getElementById('btnAsPlayer').addEventListener('click', function () { Sched20.navTo(renderPlayer); });
  }

  function renderPlayer() {
    setStage(false);
    showApp();
    var recent = Sched20.recentCampaigns();
    var recentHtml = '';
    if (recent.length) {
      recentHtml =
        '<p class="section-label">Le tue campagne</p>' +
        '<ul class="recent-list">' + recent.map(function (item) {
          var href = 'campaign.html?c=' + encodeURIComponent(item.uuid);
          return '<li><a href="' + Sched20.escapeHtml(href) + '"><strong>' +
            Sched20.escapeHtml(item.name) + '</strong><span>Apri e vota</span></a></li>';
        }).join('') + '</ul>';
    }
    app.innerHTML =
      '<div class="card">' +
        '<button class="text-back" id="btnBack" type="button">← Indietro</button>' +
        '<h2>Giocatore</h2>' +
        '<p class="subtitle">Apri una campagna che hai già visitato, oppure incolla il link del master.</p>' +
        recentHtml +
        '<label for="campaignLink">Link della campagna</label>' +
        '<input type="text" id="campaignLink" placeholder="https://…/campaign.html?c=…" autocomplete="off">' +
        '<button class="btn btn-primary" id="btnOpenCampaign" type="button">Apri la campagna</button>' +
      '</div>';

    document.getElementById('btnBack').addEventListener('click', function () {
      Sched20.clearMessage(messageEl);
      Sched20.navBack(goHome);
    });
    loadAccountCampaigns();
    document.getElementById('btnOpenCampaign').addEventListener('click', function () {
      var uuid = uuidFromText(document.getElementById('campaignLink').value);
      Sched20.clearMessage(messageEl);
      if (!uuid) {
        Sched20.showMessage(messageEl, 'Quel link non è di una campagna. Chiedilo di nuovo al master.', 'error');
        return;
      }
      window.location.href = 'campaign.html?c=' + encodeURIComponent(uuid);
    });
  }

  function renderLogin() {
    setStage(false);
    showApp();
    app.innerHTML =
      '<div class="card">' +
        '<button class="text-back" id="btnBack" type="button">← Indietro</button>' +
        '<h2>Accedi con la mail</h2>' +
        '<p class="subtitle">Ti mandiamo un link che vale 15 minuti. Con l\'account ritrovi tutte le tue campagne da qualsiasi dispositivo.</p>' +
        '<label for="loginEmail">Mail</label>' +
        '<input type="email" id="loginEmail" maxlength="120" autocomplete="email">' +
        '<button class="btn btn-primary" id="btnSendLink" type="button">Mandami il link</button>' +
      '</div>';

    document.getElementById('btnBack').addEventListener('click', function () {
      Sched20.clearMessage(messageEl);
      Sched20.navBack(goHome);
    });
    document.getElementById('btnSendLink').addEventListener('click', function () {
      var btn = document.getElementById('btnSendLink');
      var email = document.getElementById('loginEmail').value;
      Sched20.clearMessage(messageEl);
      btn.disabled = true;
      Sched20.run('requestLogin', { email: email })
        .then(function () {
          Sched20.showMessage(messageEl, 'Se la mail è corretta, troverai il link nella tua casella tra poco.', 'success');
          btn.disabled = false;
        })
        .catch(function (err) {
          Sched20.showMessage(messageEl, err.message, 'error');
          btn.disabled = false;
        });
    });
  }

  function loadAccountCampaigns() {
    var token = Sched20.getSessionToken();
    if (!token) return;
    Sched20.run('listMyCampaigns', { sessionToken: token })
      .then(function (items) {
        if (!items || !items.length) return;
        var list = '<p class="section-label">Dal tuo account</p><ul class="recent-list">' + items.map(function (item) {
          var href = 'campaign.html?c=' + encodeURIComponent(item.campaignUuid);
          return '<li><a href="' + Sched20.escapeHtml(href) + '"><strong>' +
            Sched20.escapeHtml(item.campaignName) + '</strong><span>' +
            Sched20.escapeHtml(item.playerName) + (item.closed ? ' · chiusa' : ' · apri e vota') + '</span></a></li>';
        }).join('') + '</ul>';
        var label = document.querySelector('.card .subtitle');
        if (label) label.insertAdjacentHTML('afterend', list);
      })
      .catch(function () {
        Sched20.clearSessionToken();
      });
  }

  // Il link ricevuto via mail: ?login=TOKEN
  function handleLoginLink() {
    var params = new URLSearchParams(window.location.search);
    var token = params.get('login');
    if (!token) return;
    history.replaceState(null, '', window.location.pathname);
    Sched20.run('exchangeLogin', { token: token })
      .then(function (res) {
        Sched20.setSessionToken(res.sessionToken);
        goHome();
        Sched20.showMessage(messageEl, 'Accesso effettuato come ' + res.email + '.', 'success');
      })
      .catch(function (err) {
        Sched20.showMessage(messageEl, err.message, 'error');
      });
  }

  function enterMaster() {
    Sched20.clearMessage(messageEl);
    if (!Sched20.getMasterCode()) {
      renderGate();
      return;
    }
    showLoading();
    Sched20.run('getHomeState')
      .then(function (state) {
        if (!state || !state.isMaster) {
          Sched20.clearMasterCode();
          renderGate();
          return;
        }
        renderDashboard(state);
      })
      .catch(fail);
  }

  function fail(err) {
    if (Sched20.isAuthError(err)) {
      Sched20.clearMasterCode();
      renderGate();
      Sched20.showMessage(messageEl, err.message, 'error');
      return;
    }
    goHome();
    Sched20.showMessage(messageEl, err.message || 'Errore', 'error');
  }

  function renderGate() {
    setStage(false);
    showApp();
    app.innerHTML =
      '<div class="card">' +
        '<button class="text-back" id="btnBack" type="button">← Indietro</button>' +
        '<h2>Entra</h2>' +
        '<p class="subtitle">Ogni master ha un codice suo. Da qui vedi solo le tue campagne.</p>' +
        '<label for="masterCode">Codice</label>' +
        '<input type="password" id="masterCode" maxlength="80" autocomplete="current-password">' +
        '<button class="btn btn-primary" id="btnUnlock" type="button">Entra</button>' +
      '</div>' +
      '<div class="card">' +
        '<h2>Nuovo master</h2>' +
        '<p class="subtitle">Crea un accesso se non ne hai uno. Il codice non si può recuperare. Un altro master, con un altro codice, avrà altre campagne.</p>' +
        '<label for="displayName">Nome</label>' +
        '<input type="text" id="displayName" maxlength="80" placeholder="Es. Marco" autocomplete="nickname">' +
        '<label for="newCode">Codice</label>' +
        '<input type="password" id="newCode" maxlength="80" placeholder="Almeno 4 caratteri" autocomplete="new-password">' +
        '<label for="newCodeAgain">Ripeti il codice</label>' +
        '<input type="password" id="newCodeAgain" maxlength="80" autocomplete="new-password">' +
        '<button class="btn btn-secondary" id="btnRegister" type="button">Crea accesso master</button>' +
      '</div>';

    document.getElementById('btnBack').addEventListener('click', function () {
      Sched20.clearMessage(messageEl);
      Sched20.navBack(goHome);
    });

    document.getElementById('btnUnlock').addEventListener('click', function () {
      var code = document.getElementById('masterCode').value;
      var btn = document.getElementById('btnUnlock');
      btn.disabled = true;
      Sched20.clearMessage(messageEl);
      Sched20.run('getHomeState', { masterCode: code })
        .then(function (state) {
          if (!state || !state.isMaster) {
            Sched20.showMessage(messageEl, 'Codice master non valido.', 'error');
            btn.disabled = false;
            return;
          }
          Sched20.setMasterCode(code);
          renderDashboard(state);
        })
        .catch(function (err) {
          Sched20.showMessage(messageEl, err.message, 'error');
          btn.disabled = false;
        });
    });

    document.getElementById('btnRegister').addEventListener('click', function () {
      var name = document.getElementById('displayName').value;
      var code = document.getElementById('newCode').value;
      var again = document.getElementById('newCodeAgain').value;
      var btn = document.getElementById('btnRegister');
      Sched20.clearMessage(messageEl);
      if (String(code).trim().length < 4) {
        Sched20.showMessage(messageEl, 'Il codice deve avere almeno 4 caratteri.', 'error');
        return;
      }
      if (code !== again) {
        Sched20.showMessage(messageEl, 'I due codici non coincidono.', 'error');
        return;
      }
      btn.disabled = true;
      Sched20.run('registerMaster', { displayName: name, masterCode: code })
        .then(function () {
          Sched20.setMasterCode(code);
          enterMaster();
        })
        .catch(function (err) {
          Sched20.showMessage(messageEl, err.message, 'error');
          btn.disabled = false;
        });
    });
  }

  function renderDashboard(state) {
    setStage(true);
    showApp();
    var campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
    var campaignsHtml = '';
    if (!campaigns.length) {
      campaignsHtml = '<p class="empty">Nessuna campagna ancora. Creane una qui sotto.</p>';
    } else {
      campaignsHtml = '<ul class="campaign-list">' + campaigns.map(function (c) {
        var link = Sched20.buildCampaignLink(c.uuid);
        var proposed = Number(c.proposedCount) || 0;
        var confirmed = Number(c.confirmedCount) || 0;
        var summary = 'Nessuna data proposta';
        if (proposed || confirmed) {
          var parts = [];
          if (proposed) parts.push(proposed === 1 ? '1 data proposta' : proposed + ' date proposte');
          if (confirmed) parts.push(confirmed === 1 ? '1 confermata' : confirmed + ' confermate');
          summary = parts.join(' · ');
        }
        return (
          '<li class="campaign-item">' +
            '<span class="campaign-name">' + Sched20.escapeHtml(c.name) + '</span>' +
            '<p class="campaign-meta">' + Sched20.escapeHtml(summary) + '. I giocatori aprono il link e votano ogni data.</p>' +
            '<div class="link-row">' +
              '<input type="text" readonly value="' + Sched20.escapeHtml(link) + '">' +
              '<button class="btn btn-secondary btn-sm btn-copy" type="button" data-link="' + Sched20.escapeHtml(link) + '">Copia</button>' +
              '<a class="btn btn-primary btn-sm" href="' + Sched20.escapeHtml(link) + '">Apri</a>' +
            '</div>' +
          '</li>'
        );
      }).join('') + '</ul>';
    }

    app.innerHTML =
      '<div class="card">' +
        '<div class="header-row">' +
          '<h2>Ciao, ' + Sched20.escapeHtml(state.displayName || 'master') + '</h2>' +
          '<button class="btn btn-secondary btn-sm" id="btnSignOut" type="button">Esci</button>' +
        '</div>' +
        '<p class="section-label">Le tue campagne</p>' +
        campaignsHtml +
      '</div>' +
      '<div class="card">' +
        '<h2>Nuova campagna</h2>' +
        '<p class="subtitle">Una campagna è un tavolo. Dentro puoi proporre più date, finché non ne confermi una.</p>' +
        '<label for="campaignKind">Tipo</label>' +
        '<select id="campaignKind">' +
          '<option value="campaign">Campagna (più sessioni)</option>' +
          '<option value="oneshot">One-shot (una sola sessione)</option>' +
        '</select>' +
        '<label for="campaignName">Nome campagna</label>' +
        '<input type="text" id="campaignName" maxlength="120" placeholder="Es. La Compagnia dell\'Anello">' +
        '<button class="btn btn-primary" id="btnCreate" type="button">Crea campagna</button>' +
      '</div>';

    document.getElementById('btnSignOut').addEventListener('click', function () {
      Sched20.clearMasterCode();
      Sched20.clearMessage(messageEl);
      goHome();
    });

    app.querySelectorAll('.btn-copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Sched20.copyToClipboard(btn.getAttribute('data-link'))
          .then(function () {
            Sched20.showMessage(messageEl, 'Link copiato negli appunti.', 'success');
          })
          .catch(function () {
            Sched20.showMessage(messageEl, 'Impossibile copiare il link.', 'error');
          });
      });
    });

    document.getElementById('btnCreate').addEventListener('click', function () {
      var name = document.getElementById('campaignName').value;
      var btn = document.getElementById('btnCreate');
      btn.disabled = true;
      Sched20.clearMessage(messageEl);
      var kind = document.getElementById('campaignKind').value;
      Sched20.run('createCampaign', { name: name, kind: kind })
        .then(function () {
          Sched20.showMessage(messageEl, 'Campagna creata.', 'success');
          enterMaster();
        })
        .catch(function (err) {
          if (Sched20.isAuthError(err)) {
            fail(err);
            return;
          }
          Sched20.showMessage(messageEl, err.message, 'error');
          btn.disabled = false;
        });
    });
  }

  if (!Sched20.isConfigured()) {
    Sched20.renderSetup(app);
    return;
  }
  handleLoginLink();
  Sched20.initNav(renderChoice);
  renderChoice();
})();
