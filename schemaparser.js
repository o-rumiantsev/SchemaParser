'use strict';

const Parser = require('./lib/parser.js');

const extensions = {
  versions: require('./lib/versions.js'),
  stream: require('./lib/stream.js')
};

Object.assign(Parser.prototype, extensions);

module.exports = Parser;
