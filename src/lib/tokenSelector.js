const Promise = require('bluebird');

const makeClientModel = require('../models/clientModel');

const makeTokenSelector = (context) => {
  const selectUserToken = () => {
    if (context.security && context.security.token && context.security.type === 'UserSecurity') {
      return Promise.resolve(context.security.token.jwt);
    }
    return makeClientModel(context)
      .getClientToken();
  };

  return {
    selectUserToken,
  };
};

module.exports = makeTokenSelector;
