'use strict';

const Parser = require('../');
const schemas = require('./schemas.js');

// Utils

const compare = (obj1, obj2) => {
  if (
    Object.keys(obj1).length !== Object.keys(obj2).length
  ) return false;

  for (const field in obj1) {
    if (obj1[field] !== obj2[field]) return false;
  }
  return true;
};

const check = (expected, got) => {
  const equal = compare(expected, got);
  if (!equal) throw new Error('Test failed');
};

// Test

const parser = new Parser(schemas);
parser.use('handshake');


const simple = () => {
  const handshake = {
    version: 1,
    status: 0,
    reserved: 0,
    token: 'abcdefghijklmnopqrstuvwxyz123456'
  };

  const handshakeBuffer = parser.parse(handshake);
  const handshakeParsed = parser.parse(handshakeBuffer);

  check(handshake, handshakeParsed);
  console.log('Simple: OK');
};

const withSchemaUpdate = () => {
  const newSchema = {
    version: 2,
    status: 1,
    reserved: 1,
    token: 4
  };

  parser.updateSchema('handshake', newSchema, 'minor');

  const handshake = {
    version: 1,
    status: 0,
    reserved: 0,
    token: 111
  };

  const handshakeBuffer = parser.parse(handshake);
  const handshakeParsed = parser.parse(handshakeBuffer);

  check(handshake, handshakeParsed);
  console.log('With schema update: OK');
};

const usingOlderSchema = () => {
  const handshake = {
    version: 1,
    status: 0,
    reserved: 0,
    token: 'abcdefghijklmnopqrstuvwxyz123456'
  };

  const handshakeBuffer = parser.parse(handshake, 'handshake', '1.0.0');
  const handshakeParsed = parser.parse(handshakeBuffer, 'handshake', '1.0.0');

  check(handshake, handshakeParsed);
  console.log('Using older schema: OK');
};

const withAddedSchema = () => {
  const schema = {
    id: 2,
    dataId: 4,
    length: 4
  };

  parser.addSchema('packet', schema, '0.0.1');

  const packet = {
    id: 1,
    dataId: 12,
    length: 41
  };

  const packetBuffer = parser.parse(packet, 'packet');
  const packetParsed = parser.parse(packetBuffer, 'packet');

  check(packet, packetParsed);
  console.log('With added schema: OK');
};

const withVariables = () => {
  const schema = {
    id: 4,
    length: 4,
    data: 'length'
  };

  parser.addSchema('data', schema);

  const data = {
    id: 12312,
    length: 10,
    data: 'Hello bro!'
  };

  const dataBuffer = parser.parse(data, 'data');
  const dataParsed = parser.parse(dataBuffer, 'data');

  check(data, dataParsed);
  console.log('Using schema with variables: OK');
};

const getUnknownSchema = () => {
  let schemaName = 'Unknown';
  let version = '1.0.0';

  try {
    parser.getSchema(schemaName, version);
    console.error('Get unknown schema error: Failed (Unknown schema)');
  } catch (error) {
    console.log('Get unknown schema error: Ok');
  }

  schemaName = 'handshake';
  version = '10.10.10';

  try {
    parser.getSchema(schemaName, version);
    console.error('Get unknown schema(error): Failed (Version not found)');
  } catch (error) {
    console.log('Get unknown schema(error): Ok');
  }
};

const addExistingSchema = () => {
  const schema = {
    version: 2,
    status: 1,
    reserved: 1,
    token: 4
  };

  try {
    parser.addSchema('handshake', schema);
    console.error('Add existing schema(error): Failed');
  } catch (error) {
    console.log('Add existing schema(error): OK');
  }
};

const usingOlderSchemaError = () => {
  const handshake = {
    version: 1,
    status: 0,
    reserved: 0,
    token: 'abcdefghijklmnopqrstuvwxyz123456'
  };

  const handshakeBuffer = parser.parse(handshake);
  const handshakeParsed = parser.parse(handshakeBuffer);

  try {
    check(handshake, handshakeParsed);
    console.error('Using older schema(error): Failed');
  } catch (error) {
    console.log('Using older schema(error): OK');
  }
};

simple();
withSchemaUpdate();
usingOlderSchema();
withAddedSchema();
withVariables();

getUnknownSchema();
addExistingSchema();
usingOlderSchemaError();
