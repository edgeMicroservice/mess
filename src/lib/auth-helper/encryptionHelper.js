const crypto = require('crypto-browserify');

const { throwException } = require('../../util/logHelper');

const encrypt = (text, keyId, keySecret) => {
  try {
    const iv = Buffer.from(keyId, 'utf8');
    const key = Buffer.from(keySecret, 'utf8');

    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString('hex');
  } catch (error) {
    throwException('Error occured while encryting edgeSessionInteraction', error);
  }
  return null;
};

const decrypt = (text, keyId, keySecret) => {
  const iv = Buffer.from(keyId, 'utf8');
  const key = Buffer.from(keySecret, 'utf8');

  const encryptedText = Buffer.from(text, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};

module.exports = {
  encrypt,
  decrypt,
};
