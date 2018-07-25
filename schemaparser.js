'use strict';

const Parser = require(__dirname + '/lib/parser.js');

const extensions = {
  versions: require(__dirname + '/lib/versions.js'),
  stream: require(__dirname + '/lib/streams.js')
};
const prototype = Object.assign(Parser.prototype, extensions);
Parser.prototype = prototype;

module.exports = Parser;
