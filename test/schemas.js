module.exports = {

  handshake: {
    version: '2b',
    status: '1b',
    reserved: '1b',
    token: '32b'
  },

  parcel: {
    structType: '1b',
    parcelId: '4b',
    parcelType: '1b',
    compression: '1b',
    encoding: '1b',
    length: '8b'
  },

  chunk: {
    structType: '1b',
    parcelId: '4b',
    chunkId: '4b',
    flags: '1b',
    length: '2b',
    payload: 'length'
  }

};
