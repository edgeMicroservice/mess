const includes = require('lodash/includes');

const { middlewareRequestLog, middlewareLoggedNext } = require('../util/logHelper');

const handlerName = 'APIKeySecurity';

const SecurityHandler = (req, definition, scopes, next) => {
  const providedKey = req.headers.apikey;
  const {
    SERVER_SECURITY_SET,
    SERVER_API_KEYS,
  } = req.context.env;

  middlewareRequestLog(handlerName, req);

  const throwError = (error) => {
    if (SERVER_SECURITY_SET === 'off') {
      middlewareLoggedNext(handlerName, next);
    } else {
      middlewareLoggedNext(handlerName, next, error);
    }
  };

  if (providedKey && providedKey !== '') {
    if (includes(SERVER_API_KEYS.split(','), providedKey)) {
      req.context.security = {
        type: handlerName,
      };
      middlewareLoggedNext(handlerName, next);
    } else {
      throwError(new Error('invalid apiKey'));
    }
  } else if (req.securityMiddleware === 'esession' && req.context.env.SESSION_SECURITY_AUTHORIZATION_SET === 'on') {
    req.context.security = {
      type: handlerName,
      issuer: 'MES',
    };
    middlewareLoggedNext(handlerName, next);
  } else {
    throwError(new Error('apiKey header is needed'));
  }
};

module.exports = SecurityHandler;
