(function () {
  var app = document.getElementById('app');
  var messageEl = document.getElementById('message');
  Sched20.applyVersion(document.getElementById('versionLine'));

  function fail(err) {
    if (Sched20.isAuthError(err)) {
      Sched20.renderSignIn(app, messageEl, load);
      Sched20.showMessage(messageEl, err.message, 'error');
      return;
    }
    app.innerHTML = '';
    Sched20.showMessage(messageEl, err.message || 'Errore', 'error');
  }

  function renderRegister(state) {
    var local = state.email.split('@')[0];
    app.innerHTML =
      '<div class="card">' +
        '<h2>Crea account master</h2>' +
        '<p class="subtitle" style="margin-bottom:1rem">Connesso come <strong>' + Sched20.escapeHtml(state.email) + '</strong></p>' +
        '<label for="displayName">Nome visualizzato</label>' +
        '<input type="text" id="displayName" maxlength="80" placeholder="Es. Marco" value="' + Sched20.escapeHtml(local) + '">' +
        '<button class="btn btn-primary" id="btnRegister" type="button">Crea account master</button>' +
      '</div>';

    document.getElementById('btnRegister').addEventListener('click', function () {
      var name = document.getElementById('displayName').value;
      var btn = document.getElementById('btnRegister');
      btn.disabled = true;
      Sched20.clearMessage(messageEl);
      Sched20.run('registerMaster', { displayName: name })
        .then(function () { load(); })
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
            '<p class="subtitle" style="margin:0.25rem 0 0.5rem;font-size:0.85rem">I giocatori aprono il link e accedono con Google</p>' +
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
          '<h2>Ciao, ' + Sched20.escapeHtml(state.displayName || state.email) + '</h2>' +
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
      Sched20.signOut().then(function () {
        Sched20.clearMessage(messageEl);
        Sched20.renderSignIn(app, messageEl, load);
      });
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
        if (!state || !state.email) {
          Sched20.clearSession();
          Sched20.renderSignIn(app, messageEl, load);
          return;
        }
        if (!state.isMaster) {
          renderRegister(state);
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
  if (!Sched20.hasValidToken()) {
    Sched20.renderSignIn(app, messageEl, load);
    return;
  }
  load();
})();
