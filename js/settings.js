/**
 * settings.js — User settings (localStorage/cookie wrapper + event listeners).
 *
 * Wraps application settings persisted in a cookie via js.cookies.
 * Provides get/set/listen API and syncs all [data-setting] elements in the DOM.
 *
 * Depends on: jQuery, js.cookies.js, i18n.js (switchLanguage), lang_settings.js
 */

/** @class Settings */
const Settings = function () {
  this.defaults = {
    gameLimit: 20,
    tutorial: false,
    players: 4,
    advanced: false,
    bgm: false,
    sfx: false,
    keep: true,
    lang: langCode,
  };

  this.settings = Cookies.getJSON('cryptid-settings') || this.defaults;
  this.listeners = {};

  const self = this;

  // Sync all UI elements on load
  Object.keys(this.settings).forEach(function (key) {
    self.updateUI(key, self.settings[key]);
  });

  this.setHandlers();

  // Show/hide two-player warning and tutorial panel on player count change
  this.listen('players', function () {
    if (self.get('players') == 2) {
      $('#twoPlayerWarn').slideDown();
      $('#tut_container').slideUp();
    } else {
      $('#twoPlayerWarn').hide();
      if (self.get('tutorial')) {
        $('#tut_container').slideDown();
      }
    }
  });

  // Trigger player and language listeners with current values on init
  const initialPlayers = this.get('players');
  this.set('players', initialPlayers);
  this.set('lang', this.get('lang'));
};

/**
 * Retrieve a setting value.
 * @param {string} key
 * @returns {*}
 */
Settings.prototype.get = function (key) {
  if (this.settings.hasOwnProperty(key)) {
    return this.settings[key];
  }
  if (this.defaults.hasOwnProperty(key)) {
    return this.defaults[key];
  }
  throw 'Setting key not recognised';
};

/**
 * Update a setting value, persist it if storage is enabled, and notify listeners.
 * @param {string} key
 * @param {*} value
 */
Settings.prototype.set = function (key, value) {
  if (!this.settings.hasOwnProperty(key)) {
    this.settings[key] = null;
  }
  this.settings[key] = value;
  if (key === 'gameLimit') {
    value = Math.min(Math.max(Math.round(value), 0), 100);
  }
  this.notify(key, value);
  this.updateUI(key, value);
  Cookies.set('cryptid-settings', this.settings, { expires: 730 });
};

/**
 * Register a listener callback for a setting key.
 * @param {string} key
 * @param {Function} callback - Called with the new value whenever the setting changes.
 */
Settings.prototype.listen = function (key, callback) {
  if (!this.defaults.hasOwnProperty(key)) {
    throw 'Setting key not recognised';
  }
  if (!this.listeners.hasOwnProperty(key)) {
    this.listeners[key] = [];
  }
  this.listeners[key].push(callback);
};

/**
 * Invoke all listeners registered for a key.
 * @param {string} key
 * @param {*} value
 */
Settings.prototype.notify = function (key, value) {
  if (this.listeners.hasOwnProperty(key)) {
    this.listeners[key].forEach(function (cb) {
      cb(value);
    });
  }
};

/**
 * Update every [data-setting="key"] element in the DOM to reflect value.
 * @param {string} key
 * @param {*} value
 */
Settings.prototype.updateUI = function (key, value) {
  const selector = "[data-setting='" + key + "']";
  $(selector).each(function (idx, el) {
    if ($(el).attr('type') === 'checkbox') {
      if ($(el).prop('checked') !== value) {
        $(el).prop('checked', value);
      }
    } else {
      if ($(el).val() !== value) {
        $(el).val(value);
      }
    }
  });
};

/**
 * Attach change handlers to all [data-setting] elements.
 */
Settings.prototype.setHandlers = function () {
  const self = this;
  $('[data-setting]').change(function () {
    if ($(this).attr('type') === 'checkbox') {
      self.set($(this).data('setting'), $(this).prop('checked'));
    } else {
      self.set($(this).data('setting'), $(this).val());
    }
  });
};

