const decodePayload = (token) => {
  const payloadStr = token.slice(token.indexOf('.') + 1, token.lastIndexOf('.'));
  const buff = Buffer.from(payloadStr, 'base64');
  return JSON.parse(buff.toString('utf-8'));
};

module.exports = {
  decodePayload,
};
