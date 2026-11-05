(function () {
  var campaignUuid = Sched20.getCampaignUuidFromUrl();
  var app = document.getElementById('app');
  var messageEl = document.getElementById('message');
  var playerBar = document.getElementById('playerBar');
  var campaignData = null;
  var isOwner = false;
  var VOTE_LABEL = { yes: 'Sì', maybe: 'Forse', no: 'No' };

  Sched20.applyVersion(document.getElementById('versionLine'));
  document.getElementById('homeLink').href = Sched20.buildHomeLink();

  function esc(value) {
    return Sched20.escapeHtml(value);
  }

  function showLoading() {
    app.className = 'loading';
    app.textContent = 'Caricamento…';
  }

  function showBody(html) {
    app.className = '';
    app.innerHTML = html;
  }

  function explain(err) {
    Sched20.showMessage(messageEl, err && err.message ? err.message : 'Errore', 'error');
  }

  function fail(err) {
    document.getElementById('campaignSubtitle').textContent = 'Errore';
    showBody('<div class="card card-muted"><p>' + esc(err && err.message ? err.message : 'Errore') + '</p></div>');
  }

  function subtitleFor() {
    var kind = campaignData.campaign.kind === 'oneshot' ? 'One-shot' : 'Campagna';
    return isOwner ? kind + ' · sei il master' : kind + ' · scrivi il tuo nome e vota le fasce';
  }

  function reload() {
    showLoading();
    return isOwner ? loadMaster() : loadPlayer();
  }

  // ---------- master ----------

  function loadMaster() {
    return Sched20.run('getCampaignSessions', { campaignUuid: campaignUuid }).then(renderMaster);
  }

  function renderMaster(board) {
    playerBar.hidden = true;
    var closed = board.campaign.status === 'closed';
    var top = closed
      ? '<div class="card"><h2>Campagna chiusa</h2>' +
          '<p class="subtitle">È stata confermata una data. Se serve, riapri le votazioni.</p>' +
          '<button class="btn btn-secondary" id="btnReopen" type="button">Riapri votazioni</button></div>'
      : '<div class="card"><h2>Le tue disponibilità</h2>' +
          '<p class="subtitle">Indica quando puoi: ogni giorno dell\'intervallo diventa una fascia votabile dai giocatori.</p>' +
          '<div class="form-row">' +
            '<div><label for="fromDate">Dal</label><input type="date" id="fromDate"></div>' +
            '<div><label for="toDate">Al</label><input type="date" id="toDate"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div><label for="startTime">Dalle</label><input type="time" id="startTime" value="20:00"></div>' +
            '<div><label for="endTime">Alle</label><input type="time" id="endTime" value="23:00"></div>' +
          '</div>' +
          '<label for="slotNotes">Note (opzionale)</label>' +
          '<textarea id="slotNotes" maxlength="500" placeholder="Es. Sessione principale, portate i dadi"></textarea>' +
          '<button class="btn btn-primary" id="btnPropose" type="button">Proponi le fasce</button></div>';

    showBody(
      top +
      '<div class="card"><h2>Fasce</h2>' + slotsHtml(board, true) + '</div>' +
      '<div class="card"><h2>Nuova chiave per un giocatore</h2>' +
        '<p class="subtitle">Se un giocatore ha perso la sua chiave, gliene generi una nuova. La vecchia smette di funzionare.</p>' +
        '<label for="resetName">Nome del giocatore</label>' +
        '<input type="text" id="resetName" maxlength="40">' +
        '<button class="btn btn-secondary" id="btnReset" type="button">Genera nuova chiave</button></div>'
    );
    bindMaster();
  }

  function bindMaster() {
    var btnReopen = document.getElementById('btnReopen');
    if (btnReopen) {
      btnReopen.addEventListener('click', function () {
        Sched20.clearMessage(messageEl);
        Sched20.run('reopenCampaign', { campaignUuid: campaignUuid })
          .then(function () { Sched20.showMessage(messageEl, 'Votazioni riaperte.', 'success'); return reload(); })
          .catch(explain);
      });
    }

    var btnPropose = document.getElementById('btnPropose');
    if (btnPropose) {
      btnPropose.addEventListener('click', function () {
        Sched20.clearMessage(messageEl);
        btnPropose.disabled = true;
        Sched20.run('proposeSession', {
          campaignUuid: campaignUuid,
          fromDate: document.getElementById('fromDate').value,
          toDate: document.getElementById('toDate').value,
          startTime: document.getElementById('startTime').value,
          endTime: document.getElementById('endTime').value,
          notes: document.getElementById('slotNotes').value
        }).then(function (res) {
          var text = 'Fasce create: ' + res.created + '.';
          if (res.skipped) text += ' Saltate ' + res.skipped + ' già presenti.';
          Sched20.showMessage(messageEl, text, 'success');
          return reload();
        }).catch(function (err) {
          explain(err);
          btnPropose.disabled = false;
        });
      });
    }

    bindSlotActions();

    var btnReset = document.getElementById('btnReset');
    if (btnReset) {
      btnReset.addEventListener('click', function () {
        Sched20.clearMessage(messageEl);
        var name = document.getElementById('resetName').value;
        Sched20.run('resetPlayerKey', { campaignUuid: campaignUuid, playerName: name })
          .then(function (res) {
            showKeyCard(res.playerName, res.playerKey, function () { return reload(); }, 'Chiave nuova per ' + res.playerName + '. Mandagliela tu: è l\'unico modo per rientrare.');
          })
          .catch(explain);
      });
    }
  }

  // ---------- fasce e voti ----------

  function slotsHtml(board, asMaster) {
    var list = board.sessions || [];
    if (!list.length) {
      return '<p class="empty">' + (asMaster
        ? 'Nessuna fascia ancora. Indica le tue disponibilità sopra.'
        : 'Il master non ha ancora indicato le disponibilità.') + '</p>';
    }
    return list.map(function (s) {
      return slotHtml(s, board, asMaster);
    }).join('');
  }

  function slotHtml(s, board, asMaster) {
    var c = s.voteCounts;
    var total = board.playerCount;
    var sugg = board.suggestion;
    var isBest = !!sugg && sugg.sessionUuid === s.uuid && s.status === 'proposed';

    var badge = s.status === 'confirmed'
      ? '<span class="badge badge-confirmed">Confermata</span>'
      : s.status === 'cancelled'
        ? '<span class="badge">Annullata</span>'
        : '<span class="badge badge-proposed">Proposta</span>';

    var hint = '';
    if (isBest) {
      hint = '<p class="suggest">' + (sugg.everyone
        ? 'Consigliata: va bene a tutti.'
        : 'Consigliata: ' + c.yes + ' Sì su ' + total + (sugg.missing ? ', mancano ' + sugg.missing : '') + '.') + '</p>';
    }

    var notes = s.notes ? '<p class="session-notes">' + esc(s.notes) + '</p>' : '';
    var time = esc(s.startTime) + (s.endTime ? '–' + esc(s.endTime) : '');

    var voters = (s.voters || []).length
      ? '<ul class="voter-list">' + s.voters.map(function (v) {
          return '<li><span>' + esc(v.playerName) + '</span> <strong>' + esc(VOTE_LABEL[v.vote] || v.vote) + '</strong></li>';
        }).join('') + '</ul>'
      : '<p class="voter-empty">Nessun voto ancora.</p>';

    var votes = '';
    if (!asMaster && s.status === 'proposed' && board.campaign.status !== 'closed') {
      votes = '<div class="vote-row">' + ['yes', 'maybe', 'no'].map(function (v) {
        return '<button class="btn-vote' + (s.myVote === v ? ' active-' + v : '') + '" type="button" data-uuid="' +
          esc(s.uuid) + '" data-vote="' + v + '">' + VOTE_LABEL[v] + '</button>';
      }).join('') + '</div>';
    }

    var actions = '';
    if (asMaster && s.status === 'proposed') {
      actions = '<div class="master-actions">' +
        '<button class="btn btn-success btn-sm btn-confirm" type="button" data-uuid="' + esc(s.uuid) + '">Conferma</button>' +
        '<button class="btn btn-danger btn-sm btn-cancel" type="button" data-uuid="' + esc(s.uuid) + '">Annulla</button>' +
        '</div>';
    }

    return '<div class="session-card' + (s.status === 'confirmed' ? ' confirmed' : '') + '">' +
      '<div class="session-header"><div>' +
        '<div class="session-date">' + esc(Sched20.formatDateIt(s.date)) + ' · ' + time + '</div>' + notes +
      '</div>' + badge + '</div>' +
      hint + voters +
      '<div class="vote-counts">' +
        '<span>Sì: <strong>' + c.yes + '</strong></span>' +
        '<span>Forse: <strong>' + c.maybe + '</strong></span>' +
        '<span>No: <strong>' + c.no + '</strong></span>' +
      '</div>' + votes + actions +
    '</div>';
  }

  function bindSlotActions() {
    app.querySelectorAll('.btn-confirm').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Sched20.clearMessage(messageEl);
        Sched20.run('confirmSession', { sessionUuid: btn.getAttribute('data-uuid') })
          .then(function () { return reload(); })
          .catch(explain);
      });
    });
    app.querySelectorAll('.btn-cancel').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Sched20.clearMessage(messageEl);
        Sched20.run('cancelSession', { sessionUuid: btn.getAttribute('data-uuid') })
          .then(function () { return reload(); })
          .catch(explain);
      });
    });
    app.querySelectorAll('.btn-vote').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Sched20.clearMessage(messageEl);
        Sched20.run('setAvailability', {
          sessionUuid: btn.getAttribute('data-uuid'),
          vote: btn.getAttribute('data-vote'),
          playerKey: Sched20.getPlayerKey(campaignUuid),
          sessionToken: Sched20.getSessionToken()
        }).then(function () { return reload(); }).catch(explain);
      });
    });
  }

  // ---------- giocatore ----------

  function loadPlayer() {
    var key = Sched20.getPlayerKey(campaignUuid);
    return Sched20.run('getCampaignSessions', {
      campaignUuid: campaignUuid,
      playerKey: key,
      sessionToken: Sched20.getSessionToken()
    }).then(function (board) {
      if (!board.me) {
        if (key) Sched20.clearPlayerKey(campaignUuid);
        renderJoin();
        return;
      }
      setPlayerBar(board.me);
      renderPlayerBoard(board);
    });
  }

  function renderJoin() {
    playerBar.hidden = true;
    showBody(
      '<div class="card">' +
        '<h2>Entra nella campagna</h2>' +
        '<p class="subtitle">Scrivi il nome o il nick con cui ti conosce il gruppo. Deve essere unico in questa campagna.</p>' +
        '<label for="joinName">Nome o nick</label>' +
        '<input type="text" id="joinName" maxlength="40" autocomplete="nickname">' +
        '<button class="btn btn-primary" id="btnJoin" type="button">Entra</button>' +
      '</div>'
    );
    document.getElementById('btnJoin').addEventListener('click', function () {
      var btn = document.getElementById('btnJoin');
      var name = document.getElementById('joinName').value;
      Sched20.clearMessage(messageEl);
      btn.disabled = true;
      Sched20.run('joinCampaign', {
        campaignUuid: campaignUuid,
        playerName: name,
        sessionToken: Sched20.getSessionToken()
      }).then(function (res) {
        Sched20.setPlayerKey(campaignUuid, res.playerKey);
        showKeyCard(res.playerName, res.playerKey, function () { return reload(); },
          'Ecco la tua chiave. Su questo dispositivo è già salvata. Copiala e tienila: è l\'unico modo per rientrare da un altro browser, se non hai un account.');
      }).catch(function (err) {
        explain(err);
        btn.disabled = false;
      });
    });
  }

  function showKeyCard(name, key, onContinue, text) {
    showBody(
      '<div class="card">' +
        '<h2>' + esc(name) + ', ci sei</h2>' +
        '<p class="subtitle">' + esc(text) + '</p>' +
        '<input type="text" id="playerKey" readonly value="' + esc(key) + '">' +
        '<button class="btn btn-secondary" id="btnCopyKey" type="button">Copia la chiave</button>' +
        '<button class="btn btn-primary" id="btnKeyDone" type="button">Ho salvato la chiave, continua</button>' +
      '</div>'
    );
    document.getElementById('btnCopyKey').addEventListener('click', function () {
      Sched20.copyToClipboard(key).then(function () {
        Sched20.showMessage(messageEl, 'Chiave copiata.', 'success');
      }).catch(function () {
        Sched20.showMessage(messageEl, 'Copia la chiave a mano dal campo.', 'error');
      });
    });
    document.getElementById('btnKeyDone').addEventListener('click', function () {
      Sched20.clearMessage(messageEl);
      onContinue();
    });
  }

  function setPlayerBar(name) {
    playerBar.hidden = false;
    var claim = Sched20.getSessionToken() && Sched20.getPlayerKey(campaignUuid)
      ? '<button class="text-back" id="btnClaim" type="button">Collega al mio account</button> · '
      : '';
    playerBar.innerHTML = 'Connesso come <strong>' + esc(name) + '</strong> · ' + claim +
      '<button class="text-back" id="btnForget" type="button">Dimentica la chiave su questo dispositivo</button>';

    var btnClaim = document.getElementById('btnClaim');
    if (btnClaim) {
      btnClaim.addEventListener('click', function () {
        Sched20.clearMessage(messageEl);
        Sched20.run('claimPlayer', {
          campaignUuid: campaignUuid,
          playerKey: Sched20.getPlayerKey(campaignUuid),
          sessionToken: Sched20.getSessionToken()
        }).then(function () {
          Sched20.showMessage(messageEl, 'Partecipazione collegata al tuo account.', 'success');
        }).catch(explain);
      });
    }
    document.getElementById('btnForget').addEventListener('click', function () {
      Sched20.clearPlayerKey(campaignUuid);
      Sched20.showMessage(messageEl, 'Chiave dimenticata su questo dispositivo. Per rientrare ti serve la chiave o l\'account.', 'success');
      reload();
    });
  }

  function renderPlayerBoard(board) {
    showBody(
      '<div class="card"><h2>Fasce</h2>' +
      (board.campaign.status === 'closed'
        ? '<p class="confirmed-line">La campagna è chiusa: le votazioni sono terminate.</p>'
        : '') +
      slotsHtml(board, false) + '</div>'
    );
    bindSlotActions();
  }

  // ---------- avvio ----------

  function start() {
    showLoading();
    Sched20.run('getCampaign', { campaignUuid: campaignUuid })
      .then(function (data) {
        campaignData = data;
        isOwner = !!data.isOwner;
        document.getElementById('campaignTitle').textContent = data.campaign.name;
        document.title = data.campaign.name + ' · Sched20';
        Sched20.rememberCampaign(data.campaign.uuid, data.campaign.name);
        document.getElementById('topLink').hidden = !isOwner;
        document.getElementById('campaignSubtitle').textContent = subtitleFor();
        return reload();
      })
      .catch(fail);
  }

  if (!campaignUuid) {
    document.getElementById('campaignSubtitle').textContent = 'Errore';
    showBody('<div class="card card-muted"><p>Link campagna non valido: parametro <strong>c</strong> mancante.</p></div>');
    return;
  }
  if (!Sched20.isConfigured()) {
    document.getElementById('campaignSubtitle').textContent = 'Configurazione richiesta';
    Sched20.renderSetup(app);
    return;
  }
  start();
})();
