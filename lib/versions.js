'use strict';

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

function versions() {

  const schemas = [...this.schemas.entries()].slice();
  this.schemas = new Map();
  this.latest = new Map();
  this.currentSchema = this.currentSchema
    ? [this.currentSchema, DEFAULT_VERSION]
    : [];
  schemas.forEach(([name, schema]) => {
    const versions = new Map([
      [DEFAULT_VERSION, schema],
      [LATEST, schema]
    ]);
    this.latest.set(name, DEFAULT_VERSION);
    this.schemas.set(name, versions);
  });

  const prototype = Object.assign({}, this.prototype);

  prototype.updateSchema = function(
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
  };

  prototype.buildSchemasIndex = function(schemas) {
    const schemasEntries = Object.entries(schemas);

    schemas = schemasEntries.map(([name, schema]) => {
      const parsedSchema = this.parseSchema(schema);
      this.latest.set(name, DEFAULT_VERSION);

      const versions = new Map([
        [DEFAULT_VERSION, parsedSchema],
        [LATEST, parsedSchema]
      ]);
      return [name, versions];
    });

    return new Map(schemas);
  };

  prototype.getSchema = function(
    schemaName,
    version
  ) {
    const schema = this.schemas.get(schemaName);
    if (!schema) throw new Error('Unknown schema');

    const versionedSchema = schema.get(version);
    if (!versionedSchema) throw new Error('Schema version not found');

    return versionedSchema;
  };

  prototype.addSchema = function(
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

  prototype.use = function(
    schemaName,
    version = LATEST
  ) {
    this.currentSchema = [schemaName, version];
  };

  prototype.getVersions = function(
    schemaName
  ) {
    const multiVersionSchemas = this.schemas.get(schemaName);
    if (!multiVersionSchemas) throw new Error('Unknown schema');
    const versionsIterator = multiVersionSchemas.keys();
    const versionsArray = [...versionsIterator].filter(
      version => version !== 'latest'
    );
    return versionsArray;
  };

  prototype.deleteSchema = function(
    schemaName,
    versions
  ) {
    const schema = this.schemas.get(schemaName);
    const latestVersion = this.latest.get(schemaName);
    if (!versions) {
      this.latest.delete(schemaName);
      this.schemas.delete(schemaName);
      if (this.currentSchema[0] === schemaName) {
        this.currentSchema = [];
      }
    } else if (Array.isArray(versions)) {
      versions.forEach(version => {
        if (!schema.has(version)) {
          throw new Error(`Unknown version ${version}`);
        }
        schema.delete(version);
        if (latestVersion === version) {
          const newLastVersion = this
            .getVersions(schemaName)
            .sort()
            .pop();
          this.latest.set(schemaName, newLastVersion);
          const newLastSchema = this.getVersions(schemaName, newLastVersion);
          this.schemas.get(schemaName).set(LATEST, newLastSchema);
        }
        if (
          this.currentSchema[0] === schemaName &&
          this.currentSchema[1] === version
        ) {
          this.currentSchema = [];
        }
      });
    } else {
      if (!schema.has(versions)) {
        throw new Error(`Unknown version ${versions}`);
      }
      schema.delete(versions);
      if (latestVersion === versions) {
        const newLastVersion = this
          .getVersions(schemaName)
          .sort()
          .pop();
        this.latest.set(schemaName, newLastVersion);
        const newLastSchema = this.getVersions(schemaName, newLastVersion);
        this.schemas.get(schemaName).set(LATEST, newLastSchema);
      }
      if (
        this.currentSchema[0] === schemaName &&
        this.currentSchema[1] === versions
      ) {
        this.currentSchema = [];
      }
    }
  };

  prototype.parse = function(
    data,
    schemaName,
    version = LATEST
  ) {
    let schema = null;

    if (!schemaName) {
      schema = this.getSchema(...this.currentSchema);
    } else {
      schema = this.getSchema(schemaName, version);
    }

    return data instanceof Buffer
      ? this._parseBuffer(schema, data)
      : this._parseObject(schema, data);
  };
  this.__proto__ = prototype;
}

module.exports = versions;
