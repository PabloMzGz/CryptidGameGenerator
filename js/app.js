/**
 * app.js — Main application entry point & orchestration.
 *
 * Bootstraps the Cryptid companion application on DOM ready:
 *   1. Creates the Settings singleton (window.cryptid.settings)
 *   2. Creates the Menu controller  (window.cryptid.menu) — burger open/close only
 *   3. Creates the SoundManager     (window.cryptid.soundMngr) and starts BGM
 *   4. Creates the GameController   (window.cryptid.game) and calls init()
 *   5. Populates language dropdowns
 *   6. Attaches language change listener
 *   7. Attaches mobile top-flag click handler
 *   8. Performs initial language render
 *   9. Builds and starts the Tutorial
 *  10. Creates the MapRenderer       (window.cryptid.map) and auto-sizes it
 *  11. Attaches window resize handler
 *  12. Enables the Start button
 *
 * Depends on: jQuery, all other js/ modules, lang_settings.js
 */

// ---------------------------------------------------------------------------
// Menu controller (defined inline here — small enough not to warrant its own
// file but could be extracted to menu.js in a later phase)
// ---------------------------------------------------------------------------

/** @class MenuController */
const MenuController = function () {
  this.MOBILE_MENU  = '#mobile_side_menu';
  this.MOBILE_OPEN  = '.mobile-burger';
  this.MOBILE_CLOSE = '#mobile_side_close';
  this.attachHandlers();
};

/** Attach burger open/close handlers. */
MenuController.prototype.attachHandlers = function () {
  const self = this;
  $(this.MOBILE_OPEN).click(function () {
    self.showBurger();
  });
  $(this.MOBILE_CLOSE).click(function () {
    self.hideBurger();
  });
};

/** Show the mobile side menu. */
MenuController.prototype.showBurger = function () {
  $(this.MOBILE_MENU).show();
};

/** Hide the mobile side menu. */
MenuController.prototype.hideBurger = function () {
  $(this.MOBILE_MENU).hide();
};

// ---------------------------------------------------------------------------
// Application bootstrap
// ---------------------------------------------------------------------------

window.addEventListener('load', function () {
  new ErrorManager();
}, false);

$(document).ready(function () {

  // Warn before leaving if a game is in progress
  window.onbeforeunload = function () {
    if (window.cryptid.game.getGameActive() === true) {
      return 'Leaving the page will end any games in progress. Are you sure you want to leave?';
    }
  };

  // 1. Settings
  window.cryptid.settings = new Settings();

  // 2. Menu
  window.cryptid.menu = new MenuController();

  // 3. Sound
  window.cryptid.soundMngr = new SoundManager();
  window.cryptid.soundMngr.playMusic();

  // 4. Game controller
  window.cryptid.game = new GameController();
  window.cryptid.game.init(4, false, false, true);

  // 5. Populate language dropdowns
  $('select[data-setting=lang]').each(function () {
    const select = this;
    for (const code in langs) {
      const option = $('<option value="' + code + '">\n                ' + langs[code].lang_name + '</option>');
      $(select).append(option);
    }
  });

  // 6. Language change listener — persists choice in URL, refreshes share links
  window.cryptid.settings.listen('lang', function () {
    const lang = window.cryptid.settings.get('lang');
    switchLanguage(lang);
    window.cryptid.sharing.setUrlParam('lang', lang);
    window.cryptid.game.refreshSharePanel();
  });

  // 7. Mobile flag click: open burger and briefly highlight the language selector
  $('#topFlag').click(function () {
    window.cryptid.menu.showBurger();
    setTimeout(function () {
      $('.lang-highlight').toggleClass('cryptid-tut');
      setTimeout(function () {
        $('.lang-highlight').toggleClass('cryptid-tut');
      }, 1500);
    }, 600);
  });

  // 8. Initial language render
  const detectedLang =
    window.cryptid.settings.get('lang') ||
    window.navigator.userLanguage ||
    window.navigator.language;
  switchLanguage(detectedLang);

  // 9. Tutorial
  const tutSteps = [];
  tutSteps.push(new TutorialNode('tut_node_0', 0, 1, false, true));
  tutSteps.push(new TutorialNode('tut_node_1', 0, 2, false, true));
  tutSteps.push(new TutorialNode('tut_node_2', 1, 0, true,  false));
  tutSteps.push(new TutorialNode('tut_node_3', 2, 4, false, true));
  tutSteps.push(new TutorialNode('tut_node_4', 3, 5, false, false));
  tutSteps.push(new TutorialNode('tut_node_5', 4, 6, true,  false));
  tutSteps.push(new TutorialNode('tut_node_6', 0, 6, true,  true));
  tutSteps.push(new TutorialNode('tut_node_7', 0, 8, false, true));
  tutSteps.push(new TutorialNode('tut_node_8', 7, 0, true,  false));

  window.cryptid.myTut = new TutorialController(
    tutSteps,
    $('#tut_container'),
    $('#tut_body'),
    $('#tut_next'),
    $('#tut_prev'),
    $('#tut_close')
  );

  // Trigger players setting to sync tutorial visibility
  window.cryptid.settings.set('players', window.cryptid.settings.get('players'));

  // 10. Map renderer
  window.cryptid.map = new MapRenderer(
    'mapCanvas',
    'B312CA1A2A8A517A207306',
    false,
    'mobile'
  );
  window.cryptid.map.autoWidthAdjust();
  window.cryptid.map.loadAndDraw();
  window.cryptid.map.autoSetMapArrow();

  // 11. Window resize handler
  $(window).on('resize', function () {
    window.cryptid.map.autoWidthAdjust();
    window.cryptid.map.autoSetMapArrow();
  });

  // 12. Enable start button (was disabled while loading)
  $('#ngfStart').prop('disabled', false);

  // 13. Apply URL parameters (?lang, ?game, ?player)
  window.cryptid.sharing.applyUrlParams();

});
