'use strict';

const mixinMethods = parser => {};

function stream() {
  mixinMethods(this);
  this.stream = true;
  return this
};

module.exports = stream;
