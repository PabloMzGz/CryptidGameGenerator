/**
 * i18n.js — Translation system
 *
 * Renders data-tkey attributes on DOM elements using the global `langs`
 * translation table (from lang_settings.js).  Also handles language
 * switching, flag/logo image updates, and cookie-consent text.
 *
 * Depends on globals: langs, langCode, langForce, prevCode (set in
 * lang_settings.js and mutated here).
 */

/**
 * Translate a single element by reading its data-tkey and data-tpnum
 * attributes and setting its content.
 *
 * @param {jQuery} $el - jQuery-wrapped DOM element.
 */
function translateElement($el) {
  const key = $($el).data('tkey');
  let translated = '';

  if ('tpnum' in $($el).data()) {
    const pnum = $($el).data('tpnum');
    translated = translateString(key, pnum);
  } else {
    translated = translateString(key, undefined);
  }

  if ($($el).is('input')) {
    $($el).val(translated);
  } else if ($($el).is('a')) {
    $($el).attr('href', translated);
  } else {
    $($el).html(translated);
  }
}

/**
 * Look up a translation key in the current langData, substituting the
 * player name placeholder `?p?` when a player number is supplied.
 *
 * @param {string} key - Translation key (e.g. 'within_forest').
 * @param {number|undefined} playerNum - Player number for ?p? substitution.
 * @returns {string} Translated string.
 */
function translateString(key, playerNum) {
  let result = langData[key] || ('Missing key for ' + key);
  if (typeof playerNum !== 'undefined') {
    const playerName = langData['player_' + playerNum];
    result = result.replace('?p?', playerName);
  }
  return result;
}

/**
 * Alias used by the cookie consent block in index.html.
 * @param {string} key - Translation key.
 * @returns {string}
 */
function translate_string(key) {
  return translateString(key, undefined);
}

/**
 * Switch the active language and re-render all data-tkey elements.
 *
 * @param {string} langCodeInput - BCP-47 language code (e.g. 'fr').
 */
function switchLanguage(langCodeInput) {
  langCode = langCodeInput.substring(0, 2);
  if (langForce !== false) {
    langCode = langForce;
  }

  if (langCode !== prevCode) {
    const effectiveCode = langCode in langs ? langCode : 'en';
    let r;
    langData = langs[effectiveCode];
    r = langData;
    langData = r;

    $('[data-tkey]').each(function (_idx, el) {
      translateElement($(el));
    });

    $('#lang_list').val(langCode);
    $('.lang-flag').attr('src', 'img/flags/' + effectiveCode + '.png');

    $('.logo').each(function () {
      const size = $(this).data('size');
      $(this).attr('src', 'img/logos/' + effectiveCode + '.' + size + '.png');
    });

    $('.lang-drop').val(effectiveCode);

    // Update cookie consent text if it has been rendered
    $('.cc-message').html(translateString('cookie_consent_message'));
    $('.cc-dismiss').text(translateString('cookie_consent_deny'));
    $('.cc-allow').text(translateString('cookie_consent_allow'));

    prevCode = langCode;
  }
}
