(function () {
  var app = document.getElementById('app');
  var messageEl = document.getElementById('message');
  Sched20.applyVersion(document.getElementById('versionLine'));

  function fail(err) {
    if (Sched20.isAuthError(err)) {
      Sched20.clearMasterCode();
      renderGate();
      Sched20.showMessage(messageEl, err.message, 'error');
      return;
    }
    app.innerHTML = '';
    Sched20.showMessage(messageEl, err.message || 'Errore', 'error');
  }

  function renderGate() {
    app.innerHTML =
      '<div class="card">' +
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
          load();
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
            '<p class="subtitle" style="margin:0.25rem 0 0.5rem;font-size:0.85rem">' + Sched20.escapeHtml(summary) + '. I giocatori aprono il link e votano ogni data.</p>' +
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
        '<p class="subtitle">Una campagna è un tavolo. Dentro puoi proporre più date, finché non ne confermi una.</p>' +
        '<label for="campaignName">Nome campagna</label>' +
        '<input type="text" id="campaignName" maxlength="120" placeholder="Es. La Compagnia dell\'Anello">' +
        '<button class="btn btn-primary" id="btnCreate" type="button">Crea campagna</button>' +
      '</div>';

    document.getElementById('btnSignOut').addEventListener('click', function () {
      Sched20.clearMasterCode();
      Sched20.clearMessage(messageEl);
      renderGate();
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
        if (!state || !state.isMaster) {
          renderGate();
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
