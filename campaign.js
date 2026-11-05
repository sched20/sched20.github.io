(function () {
  var campaignUuid = Sched20.getCampaignUuidFromUrl();
  var app = document.getElementById('app');
  var messageEl = document.getElementById('message');
  var playerBar = document.getElementById('playerBar');
  var isOwner = false;
  var userEmail = '';

  Sched20.applyVersion(document.getElementById('versionLine'));
  document.getElementById('homeLink').href = Sched20.buildHomeLink();

  function fail(err) {
    if (Sched20.isAuthError(err)) {
      playerBar.hidden = true;
      document.getElementById('topLink').hidden = true;
      Sched20.renderSignIn(app, messageEl, init);
      Sched20.showMessage(messageEl, err.message, 'error');
      return;
    }
    document.getElementById('campaignSubtitle').textContent = 'Errore';
    app.innerHTML = '<div class="card card-muted"><p>' + Sched20.escapeHtml(err.message || 'Errore') + '</p></div>';
  }

  function showActionError(err) {
    if (Sched20.isAuthError(err)) {
      fail(err);
      return;
    }
    Sched20.showMessage(messageEl, err.message || 'Errore', 'error');
  }

  function renderMasterPanel() {
    if (!isOwner) return '';
    return (
      '<div class="card">' +
        '<h2>Proponi una data</h2>' +
        '<div class="form-row">' +
          '<div><label for="sessionDate">Data</label><input type="date" id="sessionDate"></div>' +
          '<div><label for="sessionTime">Orario</label><input type="time" id="sessionTime" value="20:30"></div>' +
        '</div>' +
        '<label for="sessionNotes">Note (opzionale)</label>' +
        '<textarea id="sessionNotes" maxlength="500" placeholder="Es. Sessione principale, portate i dadi"></textarea>' +
        '<button class="btn btn-primary" id="btnPropose" type="button">Proponi sessione</button>' +
      '</div>'
    );
  }

  function renderSession(session) {
    var counts = session.voteCounts || { yes: 0, maybe: 0, no: 0 };
    var statusBadge = session.status === 'confirmed'
      ? '<span class="badge badge-confirmed">Confermata</span>'
      : '<span class="badge badge-proposed">Proposta</span>';
        var notes = session.notes
          ? '<p class="session-notes">' + Sched20.escapeHtml(session.notes) + '</p>'
          : '';
    var masterActions = '';
    if (isOwner && session.status === 'proposed') {
      masterActions =
        '<div class="master-actions">' +
          '<button class="btn btn-success btn-sm btn-confirm" type="button" data-uuid="' + Sched20.escapeHtml(session.uuid) + '">Conferma</button>' +
          '<button class="btn btn-danger btn-sm btn-cancel" type="button" data-uuid="' + Sched20.escapeHtml(session.uuid) + '">Annulla</button>' +
        '</div>';
    }
    var voteClass = function (vote) {
      return session.myVote === vote ? ' active-' + vote : '';
    };
    return (
      '<div class="session-card' + (session.status === 'confirmed' ? ' confirmed' : '') + '">' +
        '<div class="session-header">' +
          '<div>' +
            '<div class="session-date">' + Sched20.escapeHtml(Sched20.formatDateIt(session.date)) + ' · ' + Sched20.escapeHtml(session.startTime) + '</div>' +
            notes +
          '</div>' +
          statusBadge +
        '</div>' +
        '<div class="vote-counts">' +
          '<span>Sì: <strong>' + Sched20.escapeHtml(counts.yes) + '</strong></span>' +
          '<span>Forse: <strong>' + Sched20.escapeHtml(counts.maybe) + '</strong></span>' +
          '<span>No: <strong>' + Sched20.escapeHtml(counts.no) + '</strong></span>' +
        '</div>' +
        '<div class="vote-row">' +
          '<button class="btn-vote' + voteClass('yes') + '" type="button" data-uuid="' + Sched20.escapeHtml(session.uuid) + '" data-vote="yes">Sì</button>' +
          '<button class="btn-vote' + voteClass('maybe') + '" type="button" data-uuid="' + Sched20.escapeHtml(session.uuid) + '" data-vote="maybe">Forse</button>' +
          '<button class="btn-vote' + voteClass('no') + '" type="button" data-uuid="' + Sched20.escapeHtml(session.uuid) + '" data-vote="no">No</button>' +
        '</div>' +
        '<div class="cal-hint" data-session="' + Sched20.escapeHtml(session.uuid) + '" hidden></div>' +
        masterActions +
      '</div>'
    );
  }

  function bindEvents() {
    if (isOwner) {
      var btnPropose = document.getElementById('btnPropose');
      if (btnPropose) {
        btnPropose.addEventListener('click', function () {
          var date = document.getElementById('sessionDate').value;
          var time = document.getElementById('sessionTime').value;
          var notes = document.getElementById('sessionNotes').value;
          btnPropose.disabled = true;
          Sched20.clearMessage(messageEl);
          Sched20.run('proposeSession', {
            campaignUuid: campaignUuid,
            date: date,
            startTime: time,
            notes: notes
          }).then(function () {
            Sched20.showMessage(messageEl, 'Sessione proposta.', 'success');
            return loadSessions();
          }).catch(function (err) {
            if (Sched20.isAuthError(err)) {
              fail(err);
              return;
            }
            Sched20.showMessage(messageEl, err.message, 'error');
            if (btnPropose.isConnected) btnPropose.disabled = false;
          });
        });
      }

      app.querySelectorAll('.btn-confirm').forEach(function (btn) {
        btn.addEventListener('click', function () {
          Sched20.run('confirmSession', { sessionUuid: btn.getAttribute('data-uuid') })
            .then(function () { return loadSessions(); })
            .catch(showActionError);
        });
      });

      app.querySelectorAll('.btn-cancel').forEach(function (btn) {
        btn.addEventListener('click', function () {
          Sched20.run('cancelSession', { sessionUuid: btn.getAttribute('data-uuid') })
            .then(function () { return loadSessions(); })
            .catch(showActionError);
        });
      });
    }

    app.querySelectorAll('.btn-vote').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Sched20.run('setAvailability', {
          sessionUuid: btn.getAttribute('data-uuid'),
          vote: btn.getAttribute('data-vote')
        }).then(function () {
          return loadSessions();
        }).catch(showActionError);
      });
    });
  }

  function renderSessions(sessions) {
    var list = Array.isArray(sessions) ? sessions : [];
    var listHtml = list.length
      ? list.map(renderSession).join('')
      : '<p class="empty">Nessuna sessione proposta. ' + (isOwner ? 'Aggiungine una sopra.' : 'Il master proporrà le date a breve.') + '</p>';

    app.innerHTML =
      renderMasterPanel() +
      '<div class="card">' +
        '<h2>Sessioni</h2>' +
        listHtml +
      '</div>';
    bindEvents();
  }

  function loadSuggestions() {
    var labels = {
      free: 'Il tuo calendario risulta libero',
      partial: 'Hai un impegno in parte sovrapposto',
      busy: 'Hai un impegno in questo orario'
    };
    Sched20.run('getCalendarSuggestions', { campaignUuid: campaignUuid })
      .then(function (res) {
        if (!res || res.status !== 'ok') return;
        app.querySelectorAll('.cal-hint').forEach(function (el) {
          var hint = res.suggestions && res.suggestions[el.getAttribute('data-session')];
          if (!hint || !labels[hint]) return;
          el.textContent = labels[hint];
          el.className = 'cal-hint cal-' + hint;
          el.hidden = false;
        });
      })
      .catch(function (err) {
        if (Sched20.isAuthError(err)) fail(err);
      });
  }

  function loadSessions() {
    return Sched20.run('getCampaignSessions', { campaignUuid: campaignUuid })
      .then(function (sessions) {
        renderSessions(sessions);
        loadSuggestions();
      });
  }

  function renderPlayerBar() {
    playerBar.hidden = false;
    playerBar.innerHTML =
      '<span>Connesso come <strong>' + Sched20.escapeHtml(userEmail) + '</strong></span>' +
      '<button class="btn btn-secondary btn-sm" id="btnSignOut" type="button">Esci</button>';
    document.getElementById('btnSignOut').addEventListener('click', function () {
      Sched20.signOut().then(function () {
        playerBar.hidden = true;
        document.getElementById('topLink').hidden = true;
        Sched20.clearMessage(messageEl);
        Sched20.renderSignIn(app, messageEl, init);
      });
    });
  }

  function init() {
    Sched20.clearMessage(messageEl);
    document.getElementById('campaignSubtitle').textContent = 'Caricamento…';
    app.innerHTML = '<div class="loading">Caricamento…</div>';
    Sched20.run('getCampaign', { campaignUuid: campaignUuid })
      .then(function (data) {
        var campaign = data && data.campaign ? data.campaign : {};
        document.getElementById('campaignTitle').textContent = campaign.name || 'Campagna';
        document.title = (campaign.name || 'Campagna') + ' · Sched20';
        if (!data || !data.email) {
          Sched20.clearSession();
          playerBar.hidden = true;
          Sched20.renderSignIn(app, messageEl, init);
          return;
        }
        userEmail = data.email;
        isOwner = !!data.isOwner;
        document.getElementById('campaignSubtitle').textContent = isOwner
          ? 'Sei il master di questa campagna'
          : 'Indica la tua disponibilità per ogni data';
        document.getElementById('homeLink').textContent = isOwner ? '← Torna alla home master' : '← Home';
        document.getElementById('topLink').hidden = false;
        renderPlayerBar();
        return loadSessions();
      })
      .catch(fail);
  }

  if (!campaignUuid) {
    document.getElementById('campaignSubtitle').textContent = 'Errore';
    app.innerHTML = '<div class="card card-muted"><p>Link campagna non valido: parametro <strong>c</strong> mancante.</p></div>';
    return;
  }
  if (!Sched20.isConfigured()) {
    document.getElementById('campaignSubtitle').textContent = 'Configurazione richiesta';
    Sched20.renderSetup(app);
    return;
  }
  if (!Sched20.hasValidToken()) {
    document.getElementById('campaignSubtitle').textContent = 'Accesso richiesto';
    Sched20.renderSignIn(app, messageEl, init);
    return;
  }
  init();
})();
