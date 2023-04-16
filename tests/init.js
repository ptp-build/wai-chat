const nodeCrypto = require('crypto');
// const PouchDB = require('pouchdb');
const fetch = require('node-fetch');
import { TextEncoder, TextDecoder } from 'util';

jest.setTimeout(10000000);
window.fetch = fetch;
window.TextEncoder = TextEncoder;
window.TextDecoder = TextDecoder;
// window.PouchDB = PouchDB;
window.crypto = {
  getRandomValues: function (buffer) {
    return nodeCrypto.randomFillSync(buffer);
  }
};
