const crypto = require('crypto-browserify');

const { getRichError } = require('../../util/logHelper');

const ENCODING_FORMAT = 'utf8';
const ENCRYPTION_STANDARD = 'aes-256-cbc';

const encrypt = (text, keyId, keySecret) => {
  try {
    const iv = Buffer.from(keyId, ENCODING_FORMAT);
    const key = Buffer.from(keySecret, ENCODING_FORMAT);

    const cipher = crypto.createCipheriv(ENCRYPTION_STANDARD, Buffer.from(key), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString('hex');
  } catch (error) {
    throw getRichError('System', 'Error occured while encrypting edgeSessionInteraction', error);
  }
};

const decrypt = (text, keyId, keySecret) => {
  const iv = Buffer.from(keyId, ENCODING_FORMAT);
  const key = Buffer.from(keySecret, ENCODING_FORMAT);

  const encryptedText = Buffer.from(text, 'hex');
  const decipher = crypto.createDecipheriv(ENCRYPTION_STANDARD, Buffer.from(key), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};

module.exports = {
  encrypt,
  decrypt,
};
