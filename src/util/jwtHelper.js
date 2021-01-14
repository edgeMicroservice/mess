const decodePayload = (token) => {
  try {
    const payloadStr = token.slice(token.indexOf('.') + 1, token.lastIndexOf('.'));
    const buff = Buffer.from(payloadStr, 'base64');
    return JSON.parse(buff.toString('utf-8'));
  } catch (error) {
    throw new Error('cannot read token payload');
  }
};

module.exports = {
  decodePayload,
};
