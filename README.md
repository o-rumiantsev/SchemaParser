# SchemaParser
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

#### Parsing
Just pass object or buffer to `parse` method, and specify schema name and version:
```javascript
const buffer = parser.parse(
  {
     ...
  },
  'schemaName',
  'latest' // default
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
  packetType: 1,
  packetId: 4,
  payloadLength: 4,
  payload: 'payloadLength'
}
```
defines that packetType needs 1 byte, packetId - 4, payloadLength - 4 and payload needs `<object to parse>.payloadLength` bytes.


Parser supports multiple named schemas with multuiple versions. Default version is `1.0.0`.


#### Versions
You can easily update schemas without losing older ones. For version updating use semver contract:
```javascript
parser.updateSchema(
  schemaName,
  newSchema,
  updateType // 'major', 'minor' or 'patch'
)
```
