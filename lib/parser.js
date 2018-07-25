'use strict';

const INT_32 = 4; // 4 bytes

const copySchema = schema => {
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

const Parser = function(schemas = {}) {
  this.schemas = this.buildSchemasIndex(schemas);
  this.currentSchema = '';
};

module.exports = Parser;

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

Parser.prototype.buildSchemasIndex = function(schemas) {
  const schemasEntries = Object.entries(schemas);

  schemas = schemasEntries.map(([name, schema]) => {
    const parsedSchema = this.parseSchema(schema);
    return [name, parsedSchema];
  });

  return new Map(schemas);
};

Parser.prototype.getSchema = function(
  schemaName
) {
  const schema = this.schemas.get(schemaName);
  if (!schema) throw new Error('Unknown schema');
  return copySchema(schema);
};

Parser.prototype.addSchema = function(
  schemaName,
  schema
) {
  const exists = this.schemas.has(schemaName);
  if (exists) throw new Error(`Schema ${schemaName} already exists`);

  const parsedSchema = this.parseSchema(schema);
  this.schemas.set(schemaName, parsedSchema);
};

Parser.prototype.use = function(
  schemaName
) {
  this.currentSchema = schemaName;
};

Parser.prototype.deleteSchema = function(
  schemaName
) {
  this.schemas.delete(schemaName);
};

Parser.prototype.parse = function(
  data,
  schemaName = this.currentSchema
) {
  const schema = this.getSchema(schemaName);

  return data instanceof Buffer
    ? this._parseBuffer(schema, data)
    : this._parseObject(schema, data);
};

Parser.prototype._parseBuffer = function(
  schema,
  buffer
) {
  const parsedObject = {};
  let offset = 0;

  for (const field in schema) {
    const size = schema[field];

    if (typeof size === 'function') {
      const fn = size;
      const len = fn(parsedObject);
      const data = buffer.slice(offset, offset + len);
      parsedObject[field] = data.toString();
      offset += len;
    } else if (typeof size === 'string') {
      if (!(size in parsedObject)) {
        throw new Error(`Unknown schema field ${size}`);
      }
      const len = parsedObject[size];
      const data = buffer.slice(offset, offset + len);
      parsedObject[field] = data.toString();
      offset += len;
    } else if (size > INT_32) {
      const data = buffer.slice(offset, offset + size);
      parsedObject[field] = data.toString();
      offset += size;
    } else {
      const data = buffer.readIntLE(offset, size);
      parsedObject[field] = data;
      offset += size;
    }
  }

  return parsedObject;
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
