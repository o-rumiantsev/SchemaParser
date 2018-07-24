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

const Parser = function(schemas = {}) {
  this.latest = new Map();
  this.schemas = this.buildSchemasIndex(schemas);
};

module.exports = Parser;

Parser.prototype.parseSchema = function(schema) {
  const byteUnit = new RegExp(/[0-9]*b$/);

  for (const field in schema) {
    const value = schema[field];

    if (typeof value === 'object') {
      this.parseSchema(value);
    } else if (
      typeof value === 'string' &&
      value.match(byteUnit)
    ) {
      schema[field] = parseInt(value, '10');
    } else {
      schema[field] = value;
    }
  }
};

Parser.prototype.buildSchemasIndex = function(schemas) {
  const entries = Object.entries(schemas);

  schemas = entries.map(([name, schema]) => {
    this.parseSchema(schema);
    const version = DEFAULT_VERSION;
    const versions = new Map([[version, schema]]);
    versions.set(LATEST, schema);
    this.latest.set(name, version);
    return [name, versions];
  });

  return new Map(schemas);
};

Parser.prototype.copySchema = function(schema) {
  const copy = {};

  for (const field in schema) {
    const value = schema[field];

    if (typeof value === 'object') {
      copy[field] = this.copySchema(value);
    } else {
      copy[field] = value;
    }
  }

  return copy;
};

Parser.prototype.getSchema = function(
  schemaName,
  version
) {
  const schema = this.schemas.get(schemaName);
  if (!schema) throw new Error('Unknown schema');

  const versionedSchema = schema.get(version);
  if (!versionedSchema) throw new Error('Schema version not found');

  const copy = this.copySchema(versionedSchema);
  return copy;
};

Parser.prototype.addSchema = function(
  schemaName,
  schema,
  version = DEFAULT_VERSION
) {
  const exists = this.schemas.has(schemaName);
  if (exists) throw new Error(`Schema ${schemaName} already exists`);

  const versions = new Map();
  this.parseSchema(schema);

  const copy = this.copySchema(schema);
  versions.set(version, copy);
  versions.set(LATEST, copy);

  this.schemas.set(schemaName, versions);
  this.latest.set(schemaName, version);
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

  this.parseSchema(newSchema);

  const copy = this.copySchema(newSchema);
  schema.set(newVersion, copy);
  schema.set(LATEST, copy);

  this.latest.set(schemaName, newVersion);


  this.currentSchema = copy;
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

Parser.prototype._parseBuffer = (schema, buffer) => {
  const obj = {};
  let offset = 0;

  for (const field in schema) {
    const size = schema[field];

    if (typeof size === 'function') {
      const fn = size;
      const len = fn(obj);
      const data = buffer.slice(offset, offset + len);
      obj[field] = data.toString();
      offset += len;
    } else if (typeof size === 'string') {
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

Parser.prototype._parseObject = (schema, data) => {
  const getSize = ([field, size]) => {
    if (typeof size === 'function') {
      const fn = size;
      return fn(data);
    } else if (typeof size === 'string') {
      return data[size];
    } else {
      return size;
    }
  };

  const bytes = Object
    .entries(schema)
    .map(getSize);

  const length = bytes.reduce((acc, cur) => acc += cur, 0);
  const buffer = Buffer.alloc(length);
  let offset = 0;

  for (const field in data) {
    const value = data[field];
    let size = schema[field];

    if (typeof size === 'function') {
      const fn = size;
      size = fn(data);
    }

    if (typeof size === 'string' || size > INT_32) {
      const string = value.toString();
      offset += buffer.write(string, offset);
    } else {
      offset = buffer.writeIntLE(value, offset, size);
    }
  }

  return buffer;
};
