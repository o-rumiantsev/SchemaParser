# SchemaParser

[![NPM VERSION](https://badge.fury.io/js/schemaparser.svg)](https://badge.fury.io/js/schemaparser)
[![NPM DOWNLOADS](https://img.shields.io/npm/dt/schemaparser.svg)](https://www.npmjs.com/package/schemaparser)

Parse data into buffer and back using multiversional binary schema
___
# Example
#### Intro
To start working with parser use the constructor:
```javascript
const parser = new Parser({
  schema1,
  schema2,
  ...
  schemaN
});
```

#### Simple parsing
Just pass object or buffer to `parse` method, and specify schema name:
```javascript
const buffer = parser.parse(
  {
     ...
  },
  'schemaName'
);

const obj = parser.parse(buffer, 'schemaName');
```
Or if you use one schema more frequently than others
```javascript
parser.use('schemaName');
const buffer = parser.parse({
  ...
});
```

#### Schemas
Schemas specify size(in bytes) for appropriate fields in objects. So this schema
```javascript
{
  packetType: '1b',
  packetId: '4b',
  payloadLength: '4b',
  payload: 'payloadLength'
}
```
defines that packetType needs 1 byte, packetId - 4, payloadLength - 4 and payload needs `<object to parse>.payloadLength` bytes. It is recommended to define static size with string, like `field: 'Nb'`, but you can specify it with a number `field: N`. You can also use functions to declare the behavior of the field's size depending on object to parse. For example:
```javascript
{
  id: '2b',
  length: '8b',
  payload: obj => parseInt(obj.length, '10')
}
```

Parser supports multiple named schemas with multuiple versions. Default version is `1.0.0`.
NOTE: if field's size is greater than 4 bytes(more than Int32), it should be passed within a parser as a string.


#### Versions
For schemas updating and versioning you can use `versions` extension for parser. It works like:
```javascript
const parser = new Parser(/* schemas */) // create a simple parser
const versioned = parser.versions() // here will be created a new parser instance, supporting versioning
                                    // and old simple parser will not change after this
```

Using `versions` extension you can easily update schemas without losing older ones. For version updating use semver contract:
```javascript
parser.updateSchema(
  schemaName,
  newSchema,
  updateType // 'major', 'minor' or 'patch'
)
```

You can also use any version of schema to parse data, just specify version as a last parameter of `parse` method, it is `latest` by default:
```javascript
parser.parse({ ... }, `schemaName`, `version`);
```
