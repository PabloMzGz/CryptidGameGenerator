/**
 * sound.js — Audio manager (BGM, SFX, clue reveal sounds).
 *
 * Wraps Howler.js instances for all game sounds.
 * BGM is toggled via the settings 'bgm' listener.
 * SFX gate is checked on every play call via settings.get('sfx').
 *
 * Depends on: howler.min.js, settings.js
 */

/** @class SoundManager */
const SoundManager = function () {
  this.BGM   = 'music';
  this.START = 'start';
  this.BTN   = 'button';
  this.CLUES = 'clues';
  this.CLICK = 'click';

  this.pSounds = {};

  this.pSounds[this.START] = new Howl({
    src: ['snd/start.mp3', 'snd/start.wav'],
  });

  this.pSounds[this.BGM] = new Howl({
    src: ['snd/music.mp3', 'snd/music.ogg'],
    html5: true,
    volume: 0.5,
    loop: true,
  });

  this.pSounds[this.BTN] = new Howl({
    src: ['snd/button.mp3', 'snd/button.wav'],
  });

  this.pSounds[this.CLUES] = new Howl({
    src: ['snd/twigs.mp3', 'snd/twigs.wav'],
    sprite: {
      clue1: [0, 300],
      clue2: [0, 600],
      clue3: [0, 900],
      clue4: [0, 1200],
      clue5: [0, 1600],
    },
  });

  this.pSounds[this.CLICK] = new Howl({
    src: ['snd/click.mp3', 'snd/click.wav'],
  });

  // Play click SFX on every button press
  const self = this;
  $('button').click(function () {
    self.playSound(self.CLICK);
  });
};

/**
 * Play a named sound effect if SFX is enabled.
 * @param {string} soundKey - One of this.BGM / START / BTN / CLUES / CLICK.
 */
SoundManager.prototype.playSound = function (soundKey) {
  if (window.cryptid.settings.get('sfx')) {
    this.pSounds[soundKey].play();
  }
};

/**
 * Play the clue-reveal sound sprite for a given clue number (1–5).
 * The sprite plays N beats to indicate player N's turn.
 * @param {number} clueNumber - Player index (1–5).
 */
SoundManager.prototype.playClue = function (clueNumber) {
  if (!window.cryptid.settings.get('sfx')) return;
  switch (clueNumber) {
    case 1: this.pSounds[this.CLUES].play('clue1'); break;
    case 2: this.pSounds[this.CLUES].play('clue2'); break;
    case 3: this.pSounds[this.CLUES].play('clue3'); break;
    case 4: this.pSounds[this.CLUES].play('clue4'); break;
    case 5: this.pSounds[this.CLUES].play('clue5'); break;
  }
};

/**
 * Start background music and attach a settings listener so it
 * starts/stops when the 'bgm' setting is toggled.
 */
SoundManager.prototype.playMusic = function () {
  if (window.cryptid.settings.get('bgm')) {
    this.pSounds[this.BGM].play();
  }
  const self = this;
  window.cryptid.settings.listen('bgm', function (enabled) {
    if (enabled) {
      self.pSounds[self.BGM].play();
    } else {
      self.pSounds[self.BGM].pause();
    }
  });
};
