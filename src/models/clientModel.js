const Promise = require('bluebird');

const MODEL_NAME = 'client';
const TOKEN_LOCATION = 'token';

const makeClientModel = (context) => {
  const { storage } = context;

  const saveClientToken = (accessToken, expiresAt) => {
    storage.setItemWithTag(
      TOKEN_LOCATION,
      JSON.stringify({
        accessToken,
        expiresAt,
      }),
      MODEL_NAME,
    );
    return Promise.resolve();
  };

  const getClientToken = () => {
    const clientTokenStr = storage.getItem(TOKEN_LOCATION);
    const clientToken = !clientTokenStr || clientTokenStr === '' ? null : JSON.parse(clientTokenStr);
    if (!clientToken) throw new Error('client is not activated for this service');
    if (clientToken.expiresAt < Date.now()) throw new Error('client\'s activation is expired');
    return Promise.resolve(clientToken.accessToken);
  };

  const deleteClientToken = () => {
    storage.setItemWithTag(TOKEN_LOCATION, '', MODEL_NAME);
    return Promise.resolve();
  };

  const fetchClientTokenData = () => {
    const clientTokenStr = storage.getItem(TOKEN_LOCATION);
    const clientTokenData = !clientTokenStr || clientTokenStr === '' ? {} : JSON.parse(clientTokenStr);
    if (clientTokenData.expiresAt > Date.now()) {
      return Promise.resolve(clientTokenData);
    }
    return Promise.resolve({});
  };

  return {
    getClientToken,
    saveClientToken,
    deleteClientToken,
    fetchClientTokenData,
  };
};

module.exports = makeClientModel;
