'use strict';

const Parser = require('./lib/parser.js');

const extensions = {
  versions: require('./lib/versions.js'),
  stream: require('./lib/stream.js')
};

Parser.prototype.extend = function(
  extensionName
) {
  const extension = extensions[extensionName];
  extension(this);
  return this;
};

module.exports = Parser;
