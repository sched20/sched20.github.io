(function () {
  var app = document.getElementById('app');
  var messageEl = document.getElementById('message');
  Sched20.applyVersion(document.getElementById('versionLine'));

  function fail(err) {
    if (Sched20.isAuthError(err)) {
      Sched20.clearMasterCode();
      renderUnlock();
      Sched20.showMessage(messageEl, err.message, 'error');
      return;
    }
    app.innerHTML = '';
    Sched20.showMessage(messageEl, err.message || 'Errore', 'error');
  }

  function renderCreate() {
    app.innerHTML =
      '<div class="card">' +
        '<h2>Crea l\'accesso master</h2>' +
        '<p class="subtitle">Scegli un nome e un codice. Il codice apre questa pagina da qualsiasi browser. Conservalo: non si può recuperare.</p>' +
        '<label for="displayName">Nome</label>' +
        '<input type="text" id="displayName" maxlength="80" placeholder="Es. Marco" autocomplete="nickname">' +
        '<label for="masterCode">Codice</label>' +
        '<input type="password" id="masterCode" maxlength="80" placeholder="Almeno 4 caratteri" autocomplete="new-password">' +
        '<label for="masterCodeAgain">Ripeti il codice</label>' +
        '<input type="password" id="masterCodeAgain" maxlength="80" autocomplete="new-password">' +
        '<button class="btn btn-primary" id="btnRegister" type="button">Crea accesso master</button>' +
      '</div>';

    document.getElementById('btnRegister').addEventListener('click', function () {
      var name = document.getElementById('displayName').value;
      var code = document.getElementById('masterCode').value;
      var again = document.getElementById('masterCodeAgain').value;
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
          load();
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

  function renderUnlock() {
    app.innerHTML =
      '<div class="card">' +
        '<h2>Accesso master</h2>' +
        '<p class="subtitle">I giocatori non passano da qui: aprono il link della campagna e scrivono il proprio nome.</p>' +
        '<label for="masterCode">Codice</label>' +
        '<input type="password" id="masterCode" maxlength="80" autocomplete="current-password">' +
        '<button class="btn btn-primary" id="btnUnlock" type="button">Entra</button>' +
      '</div>';

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
  }

  function renderDashboard(state) {
    var campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
    var campaignsHtml = '';
    if (!campaigns.length) {
      campaignsHtml = '<p class="empty">Nessuna campagna ancora. Creane una qui sotto.</p>';
    } else {
      campaignsHtml = '<ul class="campaign-list">' + campaigns.map(function (c) {
        var link = Sched20.buildCampaignLink(c.uuid);
        return (
          '<li class="campaign-item">' +
            '<span class="campaign-name">' + Sched20.escapeHtml(c.name) + '</span>' +
            '<p class="subtitle" style="margin:0.25rem 0 0.5rem;font-size:0.85rem">I giocatori aprono il link e scrivono il proprio nome</p>' +
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
        '<p class="subtitle" style="margin-bottom:0">Le tue campagne</p>' +
        campaignsHtml +
      '</div>' +
      '<div class="card">' +
        '<h2>Nuova campagna</h2>' +
        '<label for="campaignName">Nome campagna</label>' +
        '<input type="text" id="campaignName" maxlength="120" placeholder="Es. La Compagnia dell\'Anello">' +
        '<button class="btn btn-primary" id="btnCreate" type="button">Crea campagna</button>' +
      '</div>';

    document.getElementById('btnSignOut').addEventListener('click', function () {
      Sched20.clearMasterCode();
      Sched20.clearMessage(messageEl);
      renderUnlock();
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
      Sched20.run('createCampaign', { name: name })
        .then(function () {
          Sched20.showMessage(messageEl, 'Campagna creata.', 'success');
          load();
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

  function load() {
    Sched20.clearMessage(messageEl);
    app.innerHTML = '<div class="loading">Caricamento…</div>';
    Sched20.run('getHomeState')
      .then(function (state) {
        if (!state || state.needsSetup) {
          renderCreate();
          return;
        }
        if (!state.isMaster) {
          renderUnlock();
          return;
        }
        renderDashboard(state);
      })
      .catch(fail);
  }

  if (!Sched20.isConfigured()) {
    Sched20.renderSetup(app);
    return;
  }
  load();
})();
