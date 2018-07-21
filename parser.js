'use strict';

const INT_32 = 4; // 4 bytes
const LATEST = 'latest';
const DEFAULT_VERSION = '1.0.0';

const UPDATE_TYPES = {
  major: 0,
  minor: 1,
  patch: 2
};

const updateVersion = (version, updateType) => {
  const bytes = version
    .split('.')
    .map(byte => parseInt(byte, '10'));

  const index = UPDATE_TYPES[updateType];
  ++bytes[index];

  for (let i = index + 1; i < bytes.length; ++i) bytes[i] = 0;

  return bytes.join('.');
};

const Parser = function(schemas) {
  this.latest = new Map();
  this.schemas = this.buildSchemasIndex(schemas);
};

module.exports = Parser;

Parser.prototype.buildSchemasIndex = function(schemas) {
  const entries = Object.entries(schemas);

  schemas = entries.map(([name, schema]) => {
    const version = DEFAULT_VERSION;
    const versions = new Map([[version, schema]]);
    versions.set(LATEST, schema);
    this.latest.set(name, version);
    return [name, versions];
  });

  return new Map(schemas);
};

Parser.prototype.getSchema = function(
  schemaName,
  version
) {
  const schema = this.schemas.get(schemaName);
  if (!schema) throw new Error('Unknown schema');

  const versionedSchema = schema.get(version);
  if (!versionedSchema) throw new Error('Schema version not found');

  return versionedSchema;
};

Parser.prototype.updateSchema = function(
  schemaName,
  newSchema,
  updateType // major, minor or patch
) {
  const schema = this.schemas.get(schemaName);
  if (!schema) throw new Error('Unknown schema');

  const latest = this.latest.get(schemaName);
  const newVersion = updateVersion(latest, updateType);

  this.latest.set(schemaName, newVersion);

  schema.set(newVersion, newSchema);
  schema.set(LATEST, newSchema);
};

Parser.prototype.use = function(
  schemaName,
  version = LATEST
) {
  const schema = this.getSchema(schemaName, version);
  this.currentSchema = schema;
};

Parser.prototype.parse = function(
  data,
  schemaName,
  version = LATEST
) {
  let schema = null;

  if (!schemaName) {
    schema = this.currentSchema;
  } else {
    schema = this.getSchema(schemaName, version);
  }

  return data instanceof Buffer
    ? this._parseBuffer(schema, data)
    : this._parseObject(schema, data);
};

Parser.prototype._parseBuffer = function(
  schema,
  buffer
) {
  const obj = {};
  let offset = 0;

  for (const field in schema) {
    const size = schema[field];

    if (typeof size === 'string') {
      const len = obj[size];
      const data = buffer.slice(offset, offset + len);
      obj[field] = data.toString();
      offset += len;
    } else if (size > INT_32) {
      const data = buffer.slice(offset, offset + size);
      obj[field] = data.toString();
      offset += size;
    } else {
      const data = buffer.readIntLE(offset, size);
      obj[field] = data;
      offset += size;
    }
  }

  return obj;
};

Parser.prototype._parseObject = function(
  schema,
  data
) {
  const bytes = Object
    .entries(schema)
    .map(([field, size]) => typeof size === 'string'
      ? data[size]
      : size
    );

  const minLength = bytes.reduce((acc, cur) => acc += cur, 0);
  const buffer = Buffer.alloc(minLength);
  let offset = 0;

  for (const field in data) {
    const value = data[field];
    const size = schema[field];

    if (typeof size === 'string' || size > INT_32) {
      const string = value.toString();
      offset = buffer.write(string, offset);
    } else {
      offset = buffer.writeIntLE(value, offset, size);
    }
  }

  return buffer;
};
