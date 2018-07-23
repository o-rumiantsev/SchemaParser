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
  this.currentSchema = null;
};

module.exports = Parser;

Parser.prototype.parseSchema = function(schema) {
  const byteUnit = /[0-9]*b$/;
  const parsedSchema = {};

  for (const field in schema) {
    const value = schema[field];
    if (typeof value !== 'string') continue;

    if (value.match(byteUnit)) {
      parsedSchema[field] = parseInt(value, '10');
    }
  }
  return parsedSchema;
};

Parser.prototype.buildSchemasIndex = function(schemas) {
  const entries = Object.entries(schemas); // TODO: entries value name

  schemas = entries.map(([name, schema]) => {
    this.parseSchema(schema);
    this.latest.set(name, DEFAULT_VERSION);

    const versions = new Map([
      [DEFAULT_VERSION, schema],
      [LATEST, schema]
    ]);
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

Parser.prototype.addSchema = function(
  schemaName,
  schema,
  version = DEFAULT_VERSION
) {
  const exists = this.schemas.has(schemaName);
  if (exists) throw new Error(`Schema ${schemaName} already exists`);

  const parsedSchema = this.parseSchema(schema);
  const versions = new Map([
    [version, parsedSchema],
    [LATEST, parsedSchema]
  ]);

  this.schemas.set(schemaName, versions);
  this.latest.set(schemaName, version);
};

Parser.prototype.updateSchema = function(
  schemaName,
  newSchema,
  previousVersion,
  updateType // major, minor or patch
) {
  const schema = this.schemas.get(schemaName);
  if (!schema) throw new Error('Unknown schema');
  const parsedNewSchema = this.parseSchema(newSchema);
  const latestVersion = this.latest.get(schemaName);
  if (!updateType) {
    updateType = previousVersion;
    const newVersion = updateVersion(latestVersion, updateType);
    schema.set(LATEST, parsedNewSchema);
    schema.set(newVersion, parsedNewSchema);
    this.latest.set(schemaName, newVersion);
  } else if (previousVersion === latestVersion) {
    const newVersion = updateVersion(previousVersion, updateType);
    schema.set(LATEST, parsedNewSchema);
    schema.set(newVersion, parsedNewSchema);
    this.latest.set(schemaName, newVersion);
  } else if (!schema.has(previousVersion)) {
    throw new Error('Unknown version');
  } else {
    const newVersion = updateVersion(previousVersion, updateType);
    if (schema.has(newVersion)) {
      throw new Error('This version already exists');
      // TODO: Perhaps we should not throw out the error,
      // but overwrite the old scheme
    }
    schema.set(newVersion, parsedNewSchema);
    const newVersionMajor = newVersion.split('.')[0];
    const newVersionMinor = newVersion.split('.')[1];
    const latestMajor = latestVersion.split('.')[0];
    const latestMinor = latestVersion.split('.')[1];
    if (
      newVersionMajor > latestMajor ||
      newVersionMajor === latestMajor && newVersionMinor > latestMinor
    ) {
      this.latest.set(schemaName, newVersion);
      schema.set(LATEST, parsedNewSchema);
    }
  }

  // this.currentSchema = parsedNewSchema; // TODO: what for?
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
    // TODO: if (!version) {...}
    schema = this.getSchema(schemaName, version);
  }

  return data instanceof Buffer ? this._parseBuffer(schema, data) :
    this._parseObject(schema, data);
};

Parser.prototype._parseBuffer = function(
  schema,
  buffer
) {
  const obj = {}; // TODO: name
  let offset = 0;

  for (const field in schema) {
    const size = schema[field];

    if (typeof size === 'function') {
      // TODO: we can do it in Parser.prototype.parseSchema
      const fn = size;
      const len = fn(obj); // FIXME: may not be a number (parse)
      const data = buffer.slice(offset, offset + len); // TODO: len < INT_32
      obj[field] = data.toString();
      offset += len;
    } else if (typeof size === 'string') {
      const len = obj[size];
      // FIXME: if (!len) {...}
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
  const getSize = ([_, size]) => {
    // TODO: Validation!
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

  const length = bytes.reduce((acc, cur) => acc += cur);
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

Parser.prototype.getVersions = function(
  schemaName
) {
  const multiVersionSchemas = this.schemas.get(schemaName);
  if (!multiVersionSchemas) throw new Error('Unknown schema');
  const versionsIterator = multiVersionSchemas.keys();
  const versionsArray = [...versionsIterator].filter(
    version => version !== 'latest'
  );
  return versionsArray;
}
