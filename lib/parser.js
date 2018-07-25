'use strict';

const INT_32 = 4; // 4 bytes

const Parser = function(schemas = {}) {
  this.currentSchema = null;
  this.schemas = this.buildSchemasIndex(schemas);
};

module.exports = Parser;

Parser.prototype.buildSchemasIndex = function(schemas) {
  const schemasEntries = Object.entries(schemas);

  schemas = schemasEntries.map(([name, schema]) => {
    const parsedSchema = this.parseSchema(schema);
    return [name, parsedSchema];
  });

  return new Map(schemas);
};

Parser.prototype.parseSchema = function(schema) {
  const byteUnit = /[0-9]*b$/;
  const parsedSchema = {};

  for (const field in schema) {
    const value = schema[field];

    if (typeof value === 'object') {
      parsedSchema[field] = this.parseSchema(value);
    } else if (
      typeof value === 'string' &&
      value.match(byteUnit)
    ) {
      parsedSchema[field] = parseInt(value, '10');
    } else {
      parsedSchema[field] = value;
    }
  }

  return parsedSchema;
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

Parser.prototype.addSchema = function(
  schemaName,
  schema,
) {
  const exists = this.schemas.has(schemaName);
  if (exists) throw new Error(`Schema ${schemaName} already exists`);

  const parsedSchema = this.parseSchema(schema);
  this.schemas.set(schemaName, parsedSchema);
};

Parser.prototype.getSchema = function(
  schemaName,
  version
) {
  const schema = this.schemas.get(schemaName);
  if (!schema) throw new Error('Unknown schema');

  return this.copySchema(schema);
};

Parser.prototype.use = function(
  schemaName
) {
  const schema = this.getSchema(schemaName);
  this.currentSchema = schemaName;
};

Parser.prototype.parse = function(
  data,
  schemaName = this.currentSchema,
) {
  const schema = this.getSchema(schemaName);

  return data instanceof Buffer
    ? this._parseBuffer(schema, data)
    : this._parseObject(schema, data);
};

Parser.prototype._parseBuffer = (schema, buffer) => {
  const parsed = {};
  let offset = 0;

  const getSize = (schema, field) => {
    let size = schema[field];

    if (typeof size === 'function') {
      const fn = size;
      size = fn(parsed);
    } else if (typeof size === 'string') {
      size = parsed[size];
    }

    return size;
  }

  for (const field in schema) {
    const size = getSize(schema, field);
    let data = null;

    if (size <= INT_32) {
      data = buffer.readIntLE(offset, size);
      parsed[field] = data;
    } else {
      data = buffer.slice(offset, offset + size);
      parsed[field] = data.toString();
    }

    offset += size;
  }

  return parsed;
};

Parser.prototype._parseObject = (schema, data) => {
  const sizes = {};

  const getSize = ([field, size]) => {
    if (typeof size === 'function') {
      const fn = size;
      size = fn(data);
    } else if (typeof size === 'string') {
      size = data[size];
    }

    sizes[field] = size;
    return size;
  };

  const bytes = Object
    .entries(schema)
    .map(getSize);

  const length = bytes.reduce((acc, cur) => acc += cur);
  const buffer = Buffer.alloc(length);
  let offset = 0;

  for (const field in data) {
    const value = data[field];
    const size = sizes[field];

    if (size > INT_32) {
      const string = value.toString();
      buffer.write(string, offset, size);
    } else {
      buffer.writeIntLE(value, offset, size);
    }

    offset += size;
  }

  return buffer;
};
