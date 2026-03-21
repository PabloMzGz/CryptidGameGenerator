/**
 * game.js — Game state machine.
 *
 * Manages the full game lifecycle:
 *   - Initialisation (loading games from store or server)
 *   - Starting a new game
 *   - Clue display (show/hide per player, two-player variant)
 *   - Clue reminders
 *   - Hint display
 *   - Target (habitat) reveal
 *   - Clue list reveal
 *   - End game
 *
 * Depends on: jQuery, gameStore.js, settings.js, sound.js, tutorial.js,
 *             i18n.js (translateElement, translateString), errors.js (ErrorManager)
 */

/**
 * Return an HTML badge showing the player's color and Greek letter.
 * @param {number} p - Player number (1–5).
 * @returns {string} HTML string.
 */
function playerBadge(p) {
  const LETTERS = ['α', 'β', 'γ', 'δ', 'ε'];
  const letter = LETTERS[p - 1] || '';
  return '<span class="player-badge player-badge-' + p + '">' + letter + '</span>';
}

/** @class GameController */
function GameController() {
  // Private state
  let currentSetup    = undefined;  // Array returned from GameRecord.popRandomSetup()
  let currentGame     = undefined;  // GameRecord currently in play
  let playerCount;
  let isIntro;
  let showHints;
  let keepMap;
  let gameStore;
  let gameActive      = false;
  let storeFilled     = false;
  let clueReminderState = 0;        // Tracks reminder FSM state

  const errMgr = new ErrorManager();

  // DOM selectors (kept as constants for readability)
  const SEL_LOADING_CONTENT = '#loadingDialogContent';
  const SEL_CLUE_DIV        = '#clueDiv';
  const SEL_CLUE_HEADER     = '#clueHeader';
  const SEL_CLUE_TEXT       = '#clueText';
  const SEL_CLUE_BUTTON     = '#clueButton';
  const SEL_REMINDER_PREFIX = '#reminder';
  const SEL_REMINDER_DIV    = '#clueReminderDiv';
  const SEL_REMINDER_TEXT   = '#reminderClueText';
  const SEL_HINT_DIV        = '#hintDiv';
  const SEL_HINT_TEXT       = '#hintText';
  const SEL_TARGET_DIV      = '#targetDisp';
  const SEL_REVEAL_DIV      = '#clueReveal';
  const SEL_REVEAL_LIST     = '#revealList';

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  this.getPlayers    = function () { return playerCount; };
  this.setPlayers    = function (n) {
    n = Number(n);
    if (n >= 2 && n <= 5) playerCount = n;
  };
  this.getIntro      = function () { return isIntro; };
  this.setIntro      = function (v) { if (typeof v === 'boolean') isIntro = v; };
  this.toggleIntro   = function () { isIntro = !isIntro; };
  this.getHint       = function () { return showHints; };
  this.setHint       = function (v) { if (typeof v === 'boolean') showHints = v; };
  this.toggleHint    = function () { showHints = !showHints; };
  this.getKeepMap    = function () { return keepMap; };
  this.setKeepMap    = function (v) { if (typeof v === 'boolean') keepMap = v; };
  this.toggleKeepMap = function () { keepMap = !keepMap; };

  this.getCurrentGame  = function () { return currentGame; };
  this.getCurrentSetup = function () { return currentSetup; };
  this.getGameStore    = function () { return gameStore; };
  this.error           = function () { return errMgr; };
  this.getGameActive   = function () { return gameActive; };

  this.getMode = function () {
    return isIntro ? 'intro' : 'normal';
  };

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------

  /**
   * Initialise the game controller: set options, create a game store, and
   * attempt to load games from local storage then from the server.
   *
   * @param {number}  players  - Default player count.
   * @param {boolean} advanced - Advanced mode flag (true = normal/advanced).
   * @param {boolean} hint     - Whether hints are enabled.
   * @param {boolean} keep     - Whether to keep the same map across games.
   */
  this.init = function (players, advanced, hint, keep) {
    const modeStr = advanced ? 'normal' : 'intro';
    const self = this;

    this.setPlayers(players);
    this.setIntro(!advanced);
    this.setKeepMap(keep);
    this.setHint(hint);

    gameStore = new GameStore();
    gameStore.setMode(modeStr);

    let success = false;
    try {
      gameStore.generateInitialGames();
      success = true;
    } catch (err) {
      success = false;
    }

    if (success) {
      if (!gameActive) {
        this.showDiv('#newGameDialog');
        this.hideDiv('#loadingDialog');
      }
    } else if (!gameActive) {
      // Generation failed — show error UI with retry
      $(SEL_LOADING_CONTENT).empty();
      $(SEL_LOADING_CONTENT).append('<div class="load_error w3-margin-bottom" data-tkey="loading_err_intro"></div>');
      $('<button class="w3-button w3-block cryptid-highlight cryptid-hover-highlight load_error" data-tkey="general_retry"></button>')
        .appendTo(SEL_LOADING_CONTENT)
        .click(function () {
          self.init(players, advanced, hint, keep);
        });
      $('.load_error').each(function (idx, el) {
        translateElement($(el));
      });
    }

    // Fill the store in the background, unless the page was loaded in
    // player-view mode (?game=X&player=N) — in that case the user won't
    // reach the new-game dialog from this session, so defer generation
    // until end() is called.
    const urlParams = window.cryptid.sharing.parseUrlParams();
    if (!urlParams.game) {
      storeFilled = true;
      gameStore.fillGameStore();
      gameStore.replaceEmpty();
    }

    // Attach clue and reminder button handlers
    $('#clueButton').click(function () {
      self.showClue();
    });
    $('[data-pnum]').click(function () {
      self.remindClue($(this).data('pnum'));
    });
    $('#ngfStart').click(function () {
      self.startGame();
    });
  };

  // -------------------------------------------------------------------------
  // Settings harvest
  // -------------------------------------------------------------------------

  /** Read current settings into the controller state. */
  this.harvestSettings = function () {
    this.setPlayers(window.cryptid.settings.get('players'));
    this.setHint(true);
    this.setIntro(!window.cryptid.settings.get('advanced'));
    this.setKeepMap(window.cryptid.settings.get('keep'));
  };

  // -------------------------------------------------------------------------
  // Start game
  // -------------------------------------------------------------------------

  /** Start a new game using the current settings. */
  this.startGame = function () {
    this.harvestSettings();

    // Get a new game unless keepMap is set and the current game is still valid.
    // currentGame.players may be absent when it was a synthetic shared-game object.
    const needNewGame = (
      !this.getKeepMap() ||
      currentGame === undefined ||
      !currentGame.players ||
      currentGame.mode !== this.getMode() ||
      currentGame.players[this.getPlayers()].length < 1
    );

    if (needNewGame) {
      let newGame = null;

      // If keepMap is on and the current map code is known, try to generate
      // a new game with the same tile layout but fresh structure positions.
      if (this.getKeepMap() && currentGame !== undefined && currentGame.mapCode) {
        newGame = gameStore.generateWithTileKey(
          currentGame.mapCode.substring(0, 6),
          this.getMode()
        );
      }

      if (!newGame) {
        // Completely different map — notify the user and fall back to the store.
        if (currentGame !== undefined) {
          errMgr.addError(translateString('error_map_change', null));
        }
        newGame = gameStore.getRandomGame(this.getMode(), this.getPlayers());
      }

      currentGame = newGame;
    }

    currentSetup = currentGame.popRandomSetup(this.getMode(), this.getPlayers());

    window.cryptid.soundMngr.playSound(window.cryptid.soundMngr.START);

    $('.game-gameplay').show();
    $('.game-start').hide();

    window.cryptid.map.newMapSettings(currentGame.key, !isIntro, currentSetup.target);
    window.cryptid.map.expandMap();

    $(SEL_REMINDER_DIV).hide();
    $(SEL_REVEAL_DIV).hide();
    $(SEL_TARGET_DIV).hide();
    $(SEL_CLUE_DIV).hide();
    $(SEL_CLUE_TEXT).hide();
    $(SEL_HINT_DIV).hide();
    $('#playerClueDiv').hide();

    clueReminderState = 0;
    this.clueDisplaying = 0;
    this.startReminderMode();

    // Collapse share options from any prior game (sharingDiv is always visible in gameplay)
    $('#shareOptions').hide();
    $('#shareBtn').data('tkey', 'share_show_options');
    translateElement($('#shareBtn'));

    // Add game code to URL so the game can be shared or reloaded
    const gameCode = window.cryptid.sharing.encodeGame(
      currentGame.key,
      currentGame.mode,
      playerCount,
      currentSetup[0].rules
    );
    window.cryptid.sharing.setUrlParam('game', gameCode);

    window.cryptid.myTut.showStep(3);
    gameActive = true;
  };

  // -------------------------------------------------------------------------
  // Clue display
  // -------------------------------------------------------------------------

  /** Show the next clue or advance to the reminder/reveal phase. */
  this.showClue = function () {
    const isPlural         = playerCount == 2;
    const showBtnKey       = isPlural ? 'clue_button_show_plural' : 'clue_button_show';
    const hideBtnKey       = isPlural ? 'clue_button_hide_plural' : 'clue_button_hide';
    const titleKey         = isPlural ? 'clue_title_plural' : 'clue_title';

    $(SEL_CLUE_HEADER).data('tkey', titleKey);

    if (!$(SEL_CLUE_DIV).is(':visible')) {
      $(SEL_CLUE_DIV).slideDown('slow');
    }

    const showingHide  = this.clueDisplaying % 2 === 0;
    const ruleIndex    = Math.floor(this.clueDisplaying / 2);
    let playerNum      = ruleIndex + 1;

    if (playerCount === 2) {
      playerNum = Math.floor(this.clueDisplaying / 3) + 1;
    }

    if (playerNum > playerCount) {
      // All clues have been shown — transition to reminders / hint
      $(SEL_CLUE_DIV).slideUp();
      $(SEL_TARGET_DIV).slideDown();
      this.createClueReminders();
      this.showHint();
      window.cryptid.myTut.showStep(7);
      return;
    }

    if (showingHide) {
      // Show the "show clue" button (clue text is hidden)
      $(SEL_CLUE_TEXT).fadeOut();
      $(SEL_CLUE_BUTTON).data('tkey', showBtnKey);
      $(SEL_CLUE_BUTTON).data('tpnum', playerNum);
      translateElement($(SEL_CLUE_BUTTON).first());
      $(SEL_CLUE_HEADER).data('tpnum', playerNum);
      translateElement($(SEL_CLUE_HEADER).first());
      window.cryptid.myTut.showStep(5);
    } else {
      // Reveal the clue text
      if (playerCount === 2) {
        const clueHtml =
          playerBadge(ruleIndex + 1) + translateString(currentSetup[0].rules[ruleIndex], null) +
          '<br><br>' +
          playerBadge(ruleIndex + 2) + translateString(currentSetup[0].rules[ruleIndex + 1], null);
        $(SEL_CLUE_TEXT).html(clueHtml);
        this.clueDisplaying += 2;
      } else {
        const ruleKey = currentSetup[0].rules[ruleIndex];
        $(SEL_CLUE_TEXT).data('tkey', ruleKey);
        $(SEL_CLUE_TEXT).html(playerBadge(playerNum) + translateString(ruleKey, null));
      }
      $(SEL_CLUE_TEXT).fadeIn();
      $(SEL_CLUE_BUTTON).data('tkey', hideBtnKey);
      $(SEL_CLUE_BUTTON).data('data-tkey', hideBtnKey);
      $(SEL_CLUE_BUTTON).data('tpnum', playerNum);
      translateElement($(SEL_CLUE_BUTTON).first());
      window.cryptid.myTut.showStep(6);
    }

    this.clueDisplaying++;
  };

  // -------------------------------------------------------------------------
  // Clue reminders
  // -------------------------------------------------------------------------

  /** Show reminder buttons for each active player. */
  this.createClueReminders = function () {
    for (let p = 1; p <= 5; p++) {
      const sel = SEL_REMINDER_PREFIX + p;
      if (p > playerCount) {
        $(sel).hide();
      } else {
        $(sel).show();
      }
    }
    $(SEL_REMINDER_DIV).slideDown();
  };

  /**
   * Handle a reminder button click for player pnum.
   * @param {number} pnum - Player number (1–5).
   */
  this.remindClue = function (pnum) {
    const isPlural  = playerCount === 2;
    const pluralSuf = isPlural ? '_plural' : '';
    let btnSel      = SEL_REMINDER_PREFIX + pnum;
    const ruleIdx   = playerCount === 2 ? 2 * (pnum - 1) + 1 : pnum;

    let btnKey;
    let instructKey;

    if (clueReminderState === 0) {
      // First click: confirm which player
      btnKey      = 'reminder_button_show';
      instructKey = 'reminder_instruction_confirm' + pluralSuf;
      clueReminderState = pnum;
    } else if (clueReminderState < 10 && pnum === clueReminderState) {
      // Second click on same player: reveal clue
      btnKey      = 'reminder_button_hide';
      instructKey = 'reminder_instruction_hide' + pluralSuf;

      const firstBadge = playerCount === 2 ? playerBadge(ruleIdx) : playerBadge(pnum);
      let html = "<div id='remindTextTemp' class='w3-block w3-margin-bottom cryptid-hide'>" +
        firstBadge + translateString(currentSetup[0].rules[ruleIdx - 1], null);
      if (playerCount === 2) {
        html += '<br><br>' + playerBadge(ruleIdx + 1) + translateString(currentSetup[0].rules[ruleIdx], null);
      }
      html += '</div>';
      $(btnSel).before(html);
      $('#remindTextTemp').slideDown();

      try {
        const vibePattern = [];
        for (let v = 0; v < clueReminderState; v++) {
          vibePattern.push(50, 50);
        }
        navigator.vibrate(vibePattern);
      } catch (e) {}

      window.cryptid.soundMngr.playClue(ruleIdx);
      clueReminderState += 10;
    } else if (clueReminderState > 10) {
      // Click after reveal: hide reminder text
      const shownPlayer = clueReminderState - 10;
      btnSel      = SEL_REMINDER_PREFIX + shownPlayer;
      instructKey = 'reminder_instruction' + pluralSuf;
      btnKey      = 'player_' + shownPlayer;
      $('#remindTextTemp').slideUp(400, function () {
        $('#remindTextTemp').remove();
      });
      clueReminderState = 0;
    } else {
      // Different player clicked while waiting
      instructKey = 'reminder_instruction' + pluralSuf;
      btnSel      = SEL_REMINDER_PREFIX + clueReminderState;
      btnKey      = 'player_' + clueReminderState;
      clueReminderState = 0;
    }

    $(btnSel).data('tkey', btnKey);
    $(btnSel).data('tpnum', pnum);
    $(SEL_REMINDER_TEXT).data('tpnum', pnum);
    $(SEL_REMINDER_TEXT).data('tkey', instructKey);
    translateElement($(SEL_REMINDER_TEXT));
    translateElement($(btnSel));
  };

  /** Reset the reminder UI to its initial state. */
  this.resetReminder = function () {
    $('#remindTextTemp').remove();
    const isPlural  = playerCount === 2;
    const pluralSuf = isPlural ? '_plural' : '';
    translateElement($(SEL_REMINDER_TEXT).data('tkey', 'reminder_instruction' + pluralSuf));
    $(SEL_REMINDER_DIV + ' button[id^="reminder"]').each(function (idx, el) {
      $(el).data('tkey', 'player_' + (idx + 1));
      translateElement(el);
    });
    clueReminderState = 0;
  };

  // -------------------------------------------------------------------------
  // Hint
  // -------------------------------------------------------------------------

  /** Show the hint reveal button (does not yet show the actual hint). */
  this.showHint = function () {
    if (!showHints) return;

    $(SEL_HINT_TEXT).empty();
    const self = this;
    const btn = $('<button class="w3-block w3-button cryptid-highlight cryptid-hover-highlight w3-margin-bottom" id="btnHint" data-tkey="hint_show_hint">Reveal Hint</button>')
      .appendTo(SEL_HINT_TEXT);
    translateElement(btn);
    btn.click(function () {
      $('#hintConfirm').show();
    });
    $(SEL_HINT_DIV).slideDown();
  };

  /** Reveal the hint text (called after confirmation). */
  this.hintShow = function () {
    $(SEL_HINT_TEXT).data('tkey', currentSetup[0].hint);
    translateElement($(SEL_HINT_TEXT));
    $(SEL_HINT_DIV).slideDown();
  };

  // -------------------------------------------------------------------------
  // Target confirm / reveal
  // -------------------------------------------------------------------------

  /** Show the target confirmation modal. */
  this.targetConfirm = function () {
    $('#targetConfirm').show();
  };

  /** Reveal the target on the map and show all clues. */
  this.targetShow = function () {
    const parts = currentSetup[0].destination.split(',');
    const col   = parseInt(parts[0]);
    const row   = parseInt(parts[1]);

    window.cryptid.map.drawTarget(col, row);
    $(SEL_TARGET_DIV).slideUp();
    $(SEL_REMINDER_DIV).slideUp();
    this.revealClues();
    window.cryptid.map.expandMap();
    $('html, body').animate(
      { scrollTop: $('#mapDiv').offset().top },
      1000
    );
    this.hintShow();
  };

  // -------------------------------------------------------------------------
  // End game / clue reveal
  // -------------------------------------------------------------------------

  /** Build and display the clue reveal list. */
  this.revealClues = function () {
    const items = [];
    if (playerCount === 2) {
      items[0] = playerBadge(1) + translateString(currentSetup[0].rules[0], null) + '<br>' +
                 playerBadge(2) + translateString(currentSetup[0].rules[1], null);
      items[1] = playerBadge(3) + translateString(currentSetup[0].rules[2], null) + '<br>' +
                 playerBadge(4) + translateString(currentSetup[0].rules[3], null);
    } else {
      for (let p = 0; p < playerCount; p++) {
        items[p] = currentSetup[0].rules[p];
      }
    }

    $(SEL_REVEAL_LIST).empty();
    for (let p = 0; p < playerCount; p++) {
      const html = '<li><span>' +
        (playerCount === 2 ? items[p] : playerBadge(p + 1) + translateString(items[p], null)) +
        '</span></li>';
      $(SEL_REVEAL_LIST).append(html);
    }
    $(SEL_REVEAL_DIV).slideDown();
  };

  /** Show the end-game confirmation if clues haven't been revealed yet. */
  this.endConfirm = function () {
    if ($(SEL_REVEAL_DIV).is(':visible')) {
      this.end();
    } else {
      $('#quitConfirm').show();
    }
  };

  /** End the current game and return to the start screen. */
  this.end = function () {
    $('.game-gameplay').hide();
    $('.game-start').show();
    this.showDiv('#newGameDialog');
    this.hideDiv('#loadingDialog');
    if (!storeFilled) {
      storeFilled = true;
      gameStore.fillGameStore();
      gameStore.replaceEmpty();
    }
    $('#keepMapToggle').show();
    window.cryptid.myTut.showStep(0);
    gameActive = false;

    // Remove ?game and ?player from the URL (keeps ?lang intact).
    window.cryptid.sharing.setUrlParam('game', null);
    window.cryptid.sharing.setUrlParam('player', null);
  };

  // -------------------------------------------------------------------------
  // Shared-game loading (URL ?game= parameter)
  // -------------------------------------------------------------------------

  /**
   * Load a game from a decoded sharing code.
   * Sets up currentGame / currentSetup and renders the appropriate UI.
   *
   * @param {{mapKey:string, mode:string, playerCount:number, rules:string[], hint:string}} decoded
   * @param {string|null} playerSpec - '1'–'5', '12', '34', or null (reminder mode).
   */
  this.loadFromSharedCode = function (decoded, playerSpec) {
    playerCount = decoded.playerCount;
    isIntro     = (decoded.mode === 'intro');
    showHints   = true;
    keepMap     = false;

    currentGame  = { key: decoded.mapKey, mode: decoded.mode };
    currentSetup = [{
      rules:       decoded.rules,
      destination: window.cryptid.sharing.findTarget(decoded.mapKey, decoded.rules),
      hint:        decoded.hint,
    }];

    this.hideDiv('#loadingDialog');
    this.hideDiv('#newGameDialog');
    $('.game-gameplay').show();
    $('.game-start').hide();

    window.cryptid.map.newMapSettings(decoded.mapKey, !isIntro, null);
    window.cryptid.map.expandMap();

    $(SEL_REMINDER_DIV).hide();
    $(SEL_REVEAL_DIV).hide();
    $(SEL_TARGET_DIV).hide();
    $(SEL_CLUE_DIV).hide();
    $(SEL_CLUE_TEXT).hide();
    $(SEL_HINT_DIV).hide();
    $('#playerClueDiv').hide();
    $('#shareOptions').hide();
    $('#shareBtn').data('tkey', 'share_show_options');
    translateElement($('#shareBtn'));

    clueReminderState = 0;
    gameActive = true;

    if (playerSpec) {
      this.showPlayerView(playerSpec);
    } else {
      this.startReminderMode();
    }
  };

  /**
   * Show only a single player's clue (URL ?player= parameter).
   * Supports individual players (1–5) and paired specifiers (12, 34).
   *
   * @param {string|number} playerSpec
   */
  this.showPlayerView = function (playerSpec) {
    const spec = String(playerSpec);
    let clueHtml;
    let headerKey;
    let headerPnum;

    if (spec === '12') {
      clueHtml   = playerBadge(1) + translateString(currentSetup[0].rules[0], null) +
                   '<br><br>' +
                   playerBadge(2) + translateString(currentSetup[0].rules[1], null);
      headerKey  = 'share_players_12';
      headerPnum = '12';
    } else if (spec === '34') {
      clueHtml   = playerBadge(3) + translateString(currentSetup[0].rules[2], null) +
                   '<br><br>' +
                   playerBadge(4) + translateString(currentSetup[0].rules[3], null);
      headerKey  = 'share_players_34';
      headerPnum = '34';
    } else {
      const p = parseInt(spec, 10);
      if (isNaN(p) || p < 1 || p > playerCount) return;
      clueHtml   = playerBadge(p) + translateString(currentSetup[0].rules[p - 1], null);
      headerKey  = playerCount === 2 ? 'clue_title_plural' : 'clue_title';
      headerPnum = p;
    }

    const isPlural = (spec === '12' || spec === '34');

    const header = $('#playerClueHeader');
    header.data('tkey', headerKey);
    if (headerPnum !== null) {
      header.data('tpnum', headerPnum);
    } else {
      header.removeData('tpnum');
    }
    translateElement(header);

    // Populate clue text but keep it hidden — button reveals it
    $('#playerClueText').html(clueHtml).hide();

    const btn = $('#playerClueBtn');
    btn.data('tkey', isPlural ? 'clue_button_show_plural' : 'clue_button_show')
       .data('playerIsPlural', isPlural);
    if (headerPnum !== null) {
      btn.data('tpnum', headerPnum);
    } else {
      btn.removeData('tpnum');
    }
    translateElement(btn);

    $('#playerClueDiv').slideDown('slow');
  };

  /**
   * Toggle the player-view clue text shown/hidden.
   * Called by the onclick of #playerClueBtn.
   */
  this.togglePlayerClue = function () {
    const text     = $('#playerClueText');
    const btn      = $('#playerClueBtn');
    const isPlural = btn.data('playerIsPlural');

    if (text.is(':visible')) {
      text.fadeOut();
      btn.data('tkey', isPlural ? 'clue_button_show_plural' : 'clue_button_show');
    } else {
      text.fadeIn();
      btn.data('tkey', isPlural ? 'clue_button_hide_plural' : 'clue_button_hide');
    }
    translateElement(btn);
  };

  /**
   * Show the clue-reminder UI immediately (used when a game is loaded
   * via URL without a player specifier).
   * Includes a button to switch to pass-the-device mode.
   */
  this.startReminderMode = function () {
    this.resetReminder();
    this.createClueReminders();
    $(SEL_TARGET_DIV).slideDown();
    this.showHint();
    $('#passTheDeviceBtn').show();
  };

  /**
   * Switch from reminder mode to the sequential pass-the-device clue flow.
   * Called when the user clicks the "Use pass-the-device mode" button.
   */
  this.enablePassTheDevice = function () {
    $(SEL_REMINDER_DIV).slideUp();
    $(SEL_TARGET_DIV).slideUp();
    $(SEL_HINT_DIV).slideUp();
    clueReminderState  = 0;
    this.clueDisplaying = 0;
    $(SEL_CLUE_DIV).slideDown('slow');
    this.showClue();
  };

  // -------------------------------------------------------------------------
  // Sharing UI
  // -------------------------------------------------------------------------

  /**
   * Populate the sharing panel content (code + player links) without changing visibility.
   * @private
   */
  this._populateSharePanel = function () {
    const code    = window.cryptid.sharing.encodeGame(
      currentGame.key,
      currentGame.mode,
      playerCount,
      currentSetup[0].rules
    );
    const gameUrl = window.cryptid.sharing.buildGameUrl(code);

    // Code div — clicking it copies the raw code text
    $('#shareCode').text(code);

    // Main copy button — copies the full game URL
    $('#shareCodeCopy')
      .attr('data-copyurl', gameUrl)
      .data('tkey', 'share_copy_link');
    translateElement($('#shareCodeCopy'));

    // Per-player links
    const entries = window.cryptid.sharing.buildPlayerUrls(code);
    const list    = $('#sharePlayerLinks').empty();

    entries.forEach(function (entry) {
      const label = $('<span>').data('tkey', entry.label);
      if (entry.tpnum !== null) label.data('tpnum', entry.tpnum);
      translateElement(label);

      const btn = $('<button>')
        .addClass('w3-button w3-small cryptid-highlight cryptid-hover-highlight w3-margin-left')
        .data('tkey', 'share_copy_link')
        .attr('data-copyurl', entry.url);
      translateElement(btn);
      btn.on('click', function () {
        const url  = $(this).attr('data-copyurl');
        const self = this;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function () {
            $(self).data('tkey', 'share_copied');
            translateElement($(self));
            setTimeout(function () {
              $(self).data('tkey', 'share_copy_link');
              translateElement($(self));
            }, 2000);
          });
        } else {
          window.prompt(translateString('share_code_label', null), url);
        }
      });

      list.append($('<li>').addClass('w3-margin-bottom').append(label).append(btn));
    });
  };

  /**
   * Toggle the share options panel open/closed.
   * Populates content before opening; collapses on second press.
   */
  this.toggleSharePanel = function () {
    if (!currentGame || !currentSetup) return;

    if ($('#shareOptions').is(':visible')) {
      $('#shareOptions').slideUp('slow');
      $('#shareBtn').data('tkey', 'share_show_options');
      translateElement($('#shareBtn'));
    } else {
      this._populateSharePanel();
      $('#shareOptions').slideDown('slow');
      $('#shareBtn').data('tkey', 'share_hide_options');
      translateElement($('#shareBtn'));
    }
  };

  /**
   * Refresh the sharing panel URLs (e.g. after a language change).
   * No-op if the share options are not currently expanded.
   */
  this.refreshSharePanel = function () {
    if ($('#shareOptions').is(':visible')) {
      this._populateSharePanel();
    }
  };

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  /** @param {string} selector */
  this.showDiv = function (selector) { $(selector).show(); };

  /** @param {string} selector */
  this.hideDiv = function (selector) { $(selector).hide(); };
}
