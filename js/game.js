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
  this.init = async function (players, advanced, hint, keep) {
    const modeStr = advanced ? 'normal' : 'intro';

    this.setPlayers(players);
    this.setIntro(!advanced);
    this.setKeepMap(keep);
    this.setHint(hint);

    gameStore = new GameStore();

    window.cryptid.settings.listen('store', function () {
      if (window.cryptid.settings.get('store')) {
        gameStore.commitToStorage();
      } else {
        gameStore.removeFromStorage();
      }
    });

    gameStore.setMode(modeStr);

    let restoredLocal  = false;
    let fetchedRemote  = false;
    const errorKeys    = [];

    // Try local storage first
    try {
      restoredLocal = await gameStore.restoreFromLocal();
    } catch (err) {
      restoredLocal = false;
      errorKeys.push(err);
    }

    // If local data exists but lacks two-player variant, reset
    if (restoredLocal && !gameStore.hasTwoPlayer()) {
      gameStore.resetStore();
      restoredLocal = false;
    }

    // If local restore failed, try server
    if (!restoredLocal) {
      $(SEL_LOADING_CONTENT).data('tkey', 'loading_remote');
      translateElement($(SEL_LOADING_CONTENT));
      try {
        fetchedRemote = await gameStore.fetchFromServer();
      } catch (err) {
        fetchedRemote = false;
        errorKeys.push(err);
      }
    }

    const self = this;

    if (restoredLocal || fetchedRemote) {
      this.showDiv('#newGameDialog');
      this.hideDiv('#loadingDialog');
    } else {
      // Both sources failed — show error UI
      $(SEL_LOADING_CONTENT).empty();
      $(SEL_LOADING_CONTENT).append('<div class="load_error w3-margin-bottom" data-tkey="loading_err_intro"></div>');
      errorKeys.forEach(function (key) {
        $(SEL_LOADING_CONTENT).append('<div class="load_error w3-margin-bottom" data-tkey="' + key + '"></div>');
      });
      $('<button class="w3-button w3-block cryptid-highlight cryptid-hover-highlight load_error" data-tkey="general_retry"></button>')
        .appendTo(SEL_LOADING_CONTENT)
        .click(function () {
          self.init(players, advanced, hint, keep);
        });
      $('.load_error').each(function (idx, el) {
        translateElement($(el));
      });
    }

    gameStore.fillGameStore();
    gameStore.replaceEmpty();

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

    // Get a new game unless keepMap is set and the current game is still valid
    if (
      !this.getKeepMap() ||
      currentGame === undefined ||
      currentGame.mode !== this.getMode() ||
      currentGame.players[this.getPlayers()].length < 1
    ) {
      if (currentGame !== undefined) {
        errMgr.addError(translateString('error_map_change', null));
        try {
          currentGame.save();
        } catch (e) {}
      }
      currentGame = gameStore.getRandomGame(this.getMode(), this.getPlayers());
    }

    currentSetup = currentGame.popRandomSetup(this.getMode(), this.getPlayers());
    currentGame.save();

    window.cryptid.soundMngr.playSound(window.cryptid.soundMngr.START);

    $('.game-gameplay').show();
    $('.game-start').hide();

    window.cryptid.map.newMapSettings(currentGame.key, isIntro, currentSetup.target);
    window.cryptid.map.expandMap();

    $(SEL_REMINDER_DIV).slideUp();
    $(SEL_REVEAL_DIV).slideUp();
    $(SEL_TARGET_DIV).slideUp();
    $(SEL_CLUE_TEXT).fadeOut();

    clueReminderState = 0;
    this.resetReminder();

    $(SEL_HINT_DIV).slideUp();
    this.clueDisplaying = 0;
    this.showClue();

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
          translateString(currentSetup[0].rules[ruleIndex], null) +
          '<br><br>' +
          translateString(currentSetup[0].rules[ruleIndex + 1], null);
        $(SEL_CLUE_TEXT).html(clueHtml);
        this.clueDisplaying += 2;
      } else {
        const ruleKey = currentSetup[0].rules[ruleIndex];
        $(SEL_CLUE_TEXT).data('tkey', ruleKey);
        $(SEL_CLUE_TEXT).html(translateString(ruleKey, null));
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

      let html = "<div id='remindTextTemp' class='w3-block w3-margin-bottom cryptid-hide'>" +
        translateString(currentSetup[0].rules[ruleIdx - 1], null);
      if (playerCount === 2) {
        html += '<br><br>' + translateString(currentSetup[0].rules[ruleIdx], null);
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
    $(SEL_REMINDER_DIV + ' button').each(function (idx, el) {
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

    window.cryptid.map.drawTarget(row, col);
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
      items[0] = translateString(currentSetup[0].rules[0], null) + '<br>' +
                 translateString(currentSetup[0].rules[1], null);
      items[1] = translateString(currentSetup[0].rules[2], null) + '<br>' +
                 translateString(currentSetup[0].rules[3], null);
    } else {
      for (let p = 0; p < playerCount; p++) {
        items[p] = currentSetup[0].rules[p];
      }
    }

    $(SEL_REVEAL_LIST).empty();
    for (let p = 0; p < playerCount; p++) {
      const html = '<li><span>' +
        (playerCount === 2 ? items[p] : translateString(items[p], null)) +
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
    $('#keepMapToggle').show();
    window.cryptid.myTut.showStep(0);
    gameActive = false;
  };

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  /** @param {string} selector */
  this.showDiv = function (selector) { $(selector).show(); };

  /** @param {string} selector */
  this.hideDiv = function (selector) { $(selector).hide(); };
}
