const Promise = require('bluebird');

const makeClientModel = require('../models/clientModel');

let userToken;

const makeTokenSelector = (context) => {
  const selectUserToken = () => {
    if (userToken) return Promise.resolve(userToken);

    return (() => {
      if (context.security && context.security.token && context.security.type === 'UserSecurity') {
        return Promise.resolve(context.security.token.jwt);
      }
      return makeClientModel(context)
        .getClientToken();
    })()
      .then((selectedToken) => {
        userToken = selectedToken;
        return selectedToken;
      });
  };

  return {
    selectUserToken,
  };
};

module.exports = makeTokenSelector;
