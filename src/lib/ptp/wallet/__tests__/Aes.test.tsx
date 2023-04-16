import Aes256Gcm from '../Aes256Gcm';

it('Aes gcm test', () => {
  const data = 'test';
  const key = Buffer.from(
    'ca2cedd8bb5676b24e59f04c1652f8db17d850b0939f113e894a9317e80e6d90',
    'hex'
  );
  const iv = Buffer.from('064ff263ab885fc8401ad26434a87214', 'hex');

  const cipherData = Aes256Gcm.encrypt(Buffer.from(data), key, iv, null);
  console.log('cipherData', cipherData.toString('hex'));
  const tag = Buffer.from(cipherData.subarray(0, 16));
  console.log('tag', tag.toString('hex'));
  const plainData1 = Aes256Gcm.decrypt(cipherData, key, iv, undefined);
  console.log('plainData1', plainData1.toString());
});

it('Aes gcm test2', () => {
  const data = 'Across the Great Wall we can reach every corner in the world.';
  const key = Buffer.from(
    '0xe054f683521261beb71b95d6394eaeb9895291584aaa6e63e4b239a912fe4978'.substring(
      2
    ),
    'hex'
  );
  const iv = Buffer.from(
    '0x38f6f3c737eb1a1e187e9c673fce44d0'.substring(2),
    'hex'
  );

  const aad = Buffer.from(
    '0x38f6f3c737eb1a1e187e9c673fce44d0'.substring(2),
    'hex'
  );

  const cipherData = Aes256Gcm.encrypt(
    Buffer.from(data),
    key,
    Buffer.from(iv),
    Buffer.from(aad)
  );
  console.log(cipherData.toString('hex'));
  const tag = Buffer.from(cipherData.subarray(0, 16));
  console.log('tag', tag.toString('hex'));
  const plainData1 = Aes256Gcm.decrypt(
    cipherData,
    key,
    Buffer.from(iv),
    Buffer.from(aad)
  );
  console.log(plainData1.toString());
});
