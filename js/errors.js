/**
 * errors.js — Error queue / toast display
 *
 * Manages a queue of error messages displayed in the #errorBox modal.
 * Errors can optionally have a callback executed after dismissal.
 */

/** @class ErrorManager */
const ErrorManager = function () {
  this.DIV_ERROR = '#errorBox';
  this.DIV_ERROR_TEXT = '#errorText';
  this.errorQueue = [];
  this.currentError = null;
};

/**
 * Show the next error from the queue, if the modal is not already visible.
 */
ErrorManager.prototype.showError = function () {
  if (!$(this.DIV_ERROR).is(':visible') && this.errorQueue.length > 0) {
    this.currentError = this.getNextError();
    $(this.DIV_ERROR_TEXT).html(this.currentError.message);
    $(this.DIV_ERROR).show();
  }
};

/**
 * Close the currently displayed error and invoke its callback if any.
 * Then show the next queued error.
 */
ErrorManager.prototype.close = function () {
  $(this.DIV_ERROR).hide();
  try {
    this.currentError.callback();
  } catch (t) {}
  this.showError();
};

/**
 * Add an error message to the queue and display it immediately if idle.
 * @param {string} message - The error message HTML/text.
 * @param {Function} [callback] - Optional callback on dismissal.
 */
ErrorManager.prototype.addError = function (message, callback) {
  this.errorQueue.push({ message, callback });
  this.showError();
};

/**
 * Dequeue and return the next error.
 * @returns {{ message: string, callback: Function }}
 */
ErrorManager.prototype.getNextError = function () {
  const error = this.errorQueue[0];
  this.errorQueue.shift();
  return error;
};
