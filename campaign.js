(function () {
  var campaignUuid = Sched20.getCampaignUuidFromUrl();
  var app = document.getElementById('app');
  var messageEl = document.getElementById('message');
  var playerBar = document.getElementById('playerBar');
  var isOwner = false;

  Sched20.applyVersion(document.getElementById('versionLine'));
  document.getElementById('homeLink').href = Sched20.buildHomeLink();

  function fail(err) {
    document.getElementById('campaignSubtitle').textContent = 'Errore';
    app.innerHTML = '<div class="card card-muted"><p>' + Sched20.escapeHtml(err.message || 'Errore') + '</p></div>';
  }

  function showActionError(err) {
    if (Sched20.isAuthError(err)) {
      Sched20.clearMasterCode();
      isOwner = false;
      document.getElementById('topLink').hidden = true;
      document.getElementById('campaignSubtitle').textContent = 'Scrivi il tuo nome e indica se ci sei';
      Sched20.showMessage(messageEl, err.message || 'Codice master non valido.', 'error');
      loadSessions();
      return;
    }
    Sched20.showMessage(messageEl, err.message || 'Errore', 'error');
  }

  function currentPlayerName() {
    var input = document.getElementById('playerName');
    var name = input ? input.value : Sched20.getPlayerName();
    return Sched20.setPlayerName(name);
  }

  function renderMasterPanel() {
    if (!isOwner) return '';
    return (
      '<div class="card">' +
        '<h2>Proponi una data</h2>' +
        '<p class="subtitle">Puoi proporne più di una. I giocatori votano ciascuna, poi confermi quella giusta.</p>' +
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
    var voteLabel = { yes: 'Sì', maybe: 'Forse', no: 'No' };
    var voters = Array.isArray(session.voters) ? session.voters : [];
    var votersHtml = voters.length
      ? '<ul class="voter-list">' + voters.map(function (voter) {
          return '<li><span>' + Sched20.escapeHtml(voter.playerName) + '</span> <strong>' +
            Sched20.escapeHtml(voteLabel[voter.vote] || voter.vote) + '</strong></li>';
        }).join('') + '</ul>'
      : '<p class="voter-empty">Nessun voto ancora.</p>';
    return (
      '<div class="session-card' + (session.status === 'confirmed' ? ' confirmed' : '') + '">' +
        '<div class="session-header">' +
          '<div>' +
            '<div class="session-date">' + Sched20.escapeHtml(Sched20.formatDateIt(session.date)) + ' · ' + Sched20.escapeHtml(session.startTime) + '</div>' +
            notes +
          '</div>' +
          statusBadge +
        '</div>' +
        votersHtml +
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
            showActionError(err);
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
        var name = currentPlayerName();
        if (!name) {
          Sched20.showMessage(messageEl, 'Inserisci il tuo nome per votare.', 'error');
          var input = document.getElementById('playerName');
          if (input) input.focus();
          return;
        }
        Sched20.clearMessage(messageEl);
        Sched20.run('setAvailability', {
          sessionUuid: btn.getAttribute('data-uuid'),
          vote: btn.getAttribute('data-vote'),
          playerName: name
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

  function loadSessions() {
    return Sched20.run('getCampaignSessions', {
      campaignUuid: campaignUuid,
      playerName: currentPlayerName()
    }).then(function (sessions) {
      renderSessions(sessions);
    });
  }

  function renderPlayerBar() {
    playerBar.hidden = false;
    playerBar.innerHTML =
      '<label for="playerName">Il tuo nome</label>' +
      '<input type="text" id="playerName" maxlength="80" placeholder="Es. Marco" autocomplete="nickname" value="' + Sched20.escapeHtml(Sched20.getPlayerName()) + '">';
    document.getElementById('playerName').addEventListener('change', function () {
      Sched20.setPlayerName(this.value);
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
        isOwner = !!(data && data.isOwner);
        document.getElementById('campaignSubtitle').textContent = isOwner
          ? 'Sei il master di questa campagna'
          : 'Scrivi il tuo nome e indica se ci sei';
        document.getElementById('homeLink').textContent = '← Torna alla home master';
        document.getElementById('topLink').hidden = !isOwner;
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
  init();
})();
