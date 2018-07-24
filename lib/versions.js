'use strict';

const LATEST = 'latest';
const DEFAULT_VERSION = '0.1.0';

const UPDATE_TYPES = {
  // version.split('.') -> [minor, major, patch]
  major: 0,
  minor: 1,
  patch: 2
};

const updateVersion = (version, updateType = 'patch') => {
  const bytes = version
    .split('.')
    .map(byte => parseInt(byte, '10'));

  const index = UPDATE_TYPES[updateType];
  ++bytes[index];

  for (let i = index + 1; i < bytes.length; ++i) bytes[i] = 0;

  return bytes.join('.');
};

function versions() {
  const oldProto = this.constructor.prototype;
  const newProto = { ...oldProto };

  Object.assign(newProto, {
    buildSchemasIndex,
    getSchema,
    addSchema,
    updateSchema,
    use,
    parse
  });

  let parser = {};
  parser.latest = new Map();

  const name = this.currentSchema;
  const version = LATEST;
  parser.currentSchema = [name, version];

  const newInstance = Object.create(newProto);
  parser = Object.assign(newInstance, parser);

  parser.buildSchemasIndex(this.schemas);
  return parser;
};

// Build schemas index from existing one
// - schemas - Map { name => schema, ... } or
//             Array [[schemaName, schema], ...]
//
function buildSchemasIndex(schemas) {
  const index = new Map();
  schemas = Array.from(schemas);

  schemas.forEach(([name, schema]) => {
    const versions = new Map([
      [DEFAULT_VERSION, schema],
      [LATEST, schema]
    ]);

    this.latest.set(name, DEFAULT_VERSION);
    index.set(name, versions);
  });

  this.schemas = index;
};

function getSchema(
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

function addSchema(
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

function updateSchema(
  schemaName,
  newSchema,
  updateType // 'major', 'minor' or 'patch'
) {
  const schema = this.schemas.get(schemaName);
  if (!schema) throw new Error('Unknown schema');

  const latest = this.latest.get(schemaName);
  const newVersion = updateVersion(latest, updateType);

  const parsedSchema = this.parseSchema(newSchema);

  schema.set(newVersion, parsedSchema);
  schema.set(LATEST, parsedSchema);

  this.latest.set(schemaName, newVersion);

  if (schemaName === this.currentSchema[0]) {
    // If update current schema
    this.currentSchema = [schemaName, newVersion];
  }
};
function use(
  schemaName,
  version = LATEST
) {
  const schema = this.schemas.get(schemaName);
  if (!schema) throw new Error('Unknown schema');

  const hasVersion = schema.has(version);
  if (!hasVersion) throw new Error('Schema version not found');

  this.currentSchema = [schemaName, version];
};

function parse(
  data,
  schemaName = this.currentSchema[0], // current schema name
  version = LATEST // current schema version
) {
  if (!schemaName) throw new Error('Schema name not specified');

  const isCurrent = schemaName === this.currentSchema[0];

  if (isCurrent && !version) {
    // If it is a current schema
    version = this.currentSchema[1];
  }

  const schema = this.getSchema(schemaName, version);

  return data instanceof Buffer
    ? this._parseBuffer(schema, data)
    : this._parseObject(schema, data);
};

module.exports = versions;
