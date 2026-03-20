/**
 * app.js — Main application entry point & orchestration.
 *
 * Bootstraps the Cryptid companion application on DOM ready:
 *   1. Creates the Settings singleton (window.cryptid.settings)
 *   2. Creates the Menu controller  (window.cryptid.menu)
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
 *  13. Attaches privacy policy expand/collapse handlers
 *
 * Depends on: jQuery, all other js/ modules, lang_settings.js
 */

// ---------------------------------------------------------------------------
// Menu controller (defined inline here — small enough not to warrant its own
// file but could be extracted to menu.js in a later phase)
// ---------------------------------------------------------------------------

/** @class MenuController */
const MenuController = function () {
  this.CHUNK_CLASS  = '.menu-chunk';
  this.MOBILE_MENU  = '#mobile_side_menu';
  this.MOBILE_OPEN  = '.mobile-burger';
  this.MOBILE_CLOSE = '#mobile_side_close';
  this.list         = this.buildList();
  this.attachHandlers();
};

/** Build the list of menu section descriptors from the DOM. */
MenuController.prototype.buildList = function () {
  const list = [];
  $(this.CHUNK_CLASS).each(function (idx, el) {
    list.push({ id: $(el).attr('id'), element: el });
  });
  return list;
};

/** Attach click handlers to menu items and burger buttons. */
MenuController.prototype.attachHandlers = function () {
  const self = this;
  $('[data-menuchunk]').click(function () {
    self.showSection($(this).data('menuchunk'));
  });
  $(this.MOBILE_OPEN).click(function () {
    self.showBurger();
  });
  $(this.MOBILE_CLOSE).click(function () {
    self.hideBurger();
  });
};

/**
 * Show the menu section identified by chunkId and hide all others.
 * @param {string} chunkId - The id of the section to show.
 */
MenuController.prototype.showSection = function (chunkId) {
  const match = this.list.filter(function (item) {
    return item.id === chunkId;
  });

  if (match.length > 0) {
    this.list.forEach(function (item) {
      let callback = null;
      if (item.id === chunkId) {
        $(item.element).show();
        callback = $(item.element).data('show');
      } else {
        $(item.element).hide();
        callback = $(item.element).data('hide');
      }
      if (typeof callback !== 'undefined') {
        try {
          callback();
        } catch (e) {
          console.log('Error running function on chunk display');
        }
      }
    });
    this.hideBurger();
  } else {
    console.log('Invalid menuchunk in link');
  }
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

// Register service worker / appcache update listener before DOM ready
window.addEventListener('load', function () {
  new ErrorManager();
  try {
    window.applicationCache.addEventListener('updateready', function () {
      if (window.applicationCache.status === window.applicationCache.UPDATEREADY) {
        window.location.reload();
      }
    }, false);
  } catch (e) {
    // No applicationCache in modern browsers — ignore
  }
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

  // 6. Language change listener
  window.cryptid.settings.listen('lang', function () {
    switchLanguage(window.cryptid.settings.get('lang'));
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

  // 13. Privacy policy expand/collapse
  $('.privacy-expand').click(function () {
    const target = $('#' + $(this).data('expandid'));
    const icon   = $(this).find('.privacy-expand-icon');
    $(target).slideToggle('slow', function () {
      const arrow = $(target).is(':visible') ? '[-]' : '[+]';
      $(icon).text(arrow);
    });
  });
});
