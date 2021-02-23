const { extractToken } = require('@mimik/edge-ms-helper/authorization-helper');
const { decodePayload } = require('../util/jwtHelper');
const { middlewareRequestLog, middlewareLoggedNext } = require('../util/logHelper');

const handlerName = 'User Security';

const SecurityHandler = (req, definition, scopes, next) => {
  const {
    SERVER_SECURITY_SET,
  } = req.context.env;
  middlewareRequestLog(handlerName, req);

  const throwError = (error) => {
    if (SERVER_SECURITY_SET === 'off') {
      middlewareLoggedNext(handlerName, next);
    } else {
      middlewareLoggedNext(handlerName, next, error);
    }
  };

  if (!req.authorization) {
    throwError(new Error('authorization header is needed'));
    return;
  }

  const token = extractToken(req.authorization);

  try {
    const payload = decodePayload(token);
    if (!payload.iss || !payload.iss.includes('mID/v1')) {
      throwError(new Error('issuer not valid'));
    } else {
      req.context.security = {
        type: 'UserSecurity',
        issuer: 'MID',
        token: {
          jwt: token,
          payload,
        },
      };
      middlewareLoggedNext(handlerName, next);
    }
  } catch (e) {
    throwError(new Error(`invalid token: ${e.message}`));
  }
};

module.exports = SecurityHandler;
