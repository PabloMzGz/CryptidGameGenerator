/**
 * tutorial.js — Tutorial step controller.
 *
 * Provides:
 *   TutorialNode  — data object for one tutorial step
 *   TutorialController — manages a sequence of TutorialNodes, driving the
 *                        tutorial panel (show/hide, prev/next navigation).
 *
 * Depends on: jQuery, i18n.js (translateElement), settings.js
 */

/**
 * Data object representing a single tutorial step.
 *
 * @param {string}  innerHTML  - data-tkey value for the step body text.
 * @param {number}  prevNode   - Index of the previous step (0 = stay).
 * @param {number}  nextNode   - Index of the next step.
 * @param {boolean} hideNext   - Whether to hide the Next button on this step.
 * @param {boolean} hidePrev   - Whether to hide the Prev button on this step.
 * @param {*}       [scrollTo] - jQuery selector or element to scroll to (optional).
 */
const TutorialNode = function (innerHTML, prevNode, nextNode, hideNext, hidePrev, scrollTo) {
  this.innerHTML = innerHTML;
  this.prevNode   = prevNode;
  this.nextNode   = nextNode;
  this.hideNext   = hideNext;
  this.hidePrev   = hidePrev;
  this.scrollTo   = scrollTo;
};

/**
 * Controls the tutorial panel.
 *
 * @param {TutorialNode[]} steps        - Ordered array of tutorial steps.
 * @param {jQuery}         container    - The tutorial panel wrapper element.
 * @param {jQuery}         bodyEl       - Element that receives step body text.
 * @param {jQuery}         nextBtn      - Next button element.
 * @param {jQuery}         prevBtn      - Previous button element.
 * @param {jQuery}         closeBtn     - Close button element.
 */
const TutorialController = function (steps, container, bodyEl, nextBtn, prevBtn, closeBtn) {
  this.div       = bodyEl;
  this.container = container;
  this.steps     = steps;
  this.show      = true;
  this.currStep  = 0;
  this.next      = nextBtn;
  this.prev      = prevBtn;
  this.close     = closeBtn;

  if (!window.cryptid.settings.get('tutorial')) {
    this.show = false;
  }
  this.showTutorial(this.show);

  this.next.click({ obj: this }, this.nextStep);
  this.prev.click({ obj: this }, this.prevStep);
  this.close.click({ obj: this }, this.clickClose);

  const self = this;
  window.cryptid.settings.listen('tutorial', function (enabled) {
    self.show = enabled;
    self.showTutorial(enabled);
  });

  this.showStep(0);
};

/**
 * Display a tutorial step by index.
 * @param {number} stepIndex
 * @returns {boolean} False if index is out of bounds.
 */
TutorialController.prototype.showStep = function (stepIndex) {
  if (this.steps.length <= stepIndex) {
    return false;
  }

  $(this.div).data('tkey', this.steps[stepIndex].innerHTML);
  $(this.div).attr('data-tkey', this.steps[stepIndex].innerHTML);
  translateElement(this.div);

  if (this.steps[stepIndex].hideNext) {
    this.next.hide();
  } else {
    this.next.show();
  }

  if (this.steps[stepIndex].hidePrev) {
    this.prev.hide();
  } else {
    this.prev.show();
  }

  this.currStep = stepIndex;

  const scrollOffset = $('html').width() <= 600 ? 60 : 0;
  const scrollTarget = this.steps[stepIndex].scrollTo || '#tut_container';
  $('html, body').animate(
    { scrollTop: $(scrollTarget).offset().top - scrollOffset },
    500
  );
};

/** Advance to the next step (determined by current step's nextNode). */
TutorialController.prototype.nextStep = function (event) {
  const ctrl = event.data.obj;
  const next = ctrl.steps[ctrl.currStep].nextNode;
  ctrl.showStep(next);
};

/** Go back to the previous step (determined by current step's prevNode). */
TutorialController.prototype.prevStep = function (event) {
  const ctrl = event.data.obj;
  const prev = ctrl.steps[ctrl.currStep].prevNode;
  ctrl.showStep(prev);
};

/**
 * Show or hide the tutorial container.
 * @param {boolean} visible
 */
TutorialController.prototype.showTutorial = function (visible) {
  if (visible) {
    this.container.show();
  } else {
    this.container.hide();
  }
};

/** Handle close button click: hide tutorial and persist preference. */
TutorialController.prototype.clickClose = function (event) {
  const ctrl = event.data.obj;
  ctrl.show = false;
  ctrl.showTutorial(false);
  $(ctrl.container).hide();
  window.cryptid.settings.set('tutorial', false);
};
