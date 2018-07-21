module.exports = {

  handshake: {
    version: 2,
    status: 1,
    reserved: 1,
    token: 32
  },

  parcel: {
    structType: 1,
    parcelId: 4,
    parcelType: 1,
    compression: 1,
    encoding: 1,
    length: 8
  },

  chunk: {
    structType: 1,
    parcelId: 4,
    chunkId: 4,
    flags: 1,
    length: 2,
    payload: 'length'
  }

};
