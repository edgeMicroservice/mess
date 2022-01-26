const querystring = require('query-string');
const { getRichError, middlewareRequestLog, middlewareLoggedNext } = require('../../util/logHelper');

const { decrypt } = require('./encryptionHelper');
const makeSessionMap = require('./sessionMap');

const handlerName = 'Edge Session Middleware';

const edgeSessionMiddleware = (req, res, next) => {
  middlewareRequestLog(handlerName, req);

  const { url } = req;

  const queryString = url.split('?')[1];
  const queryParams = queryString ? querystring.parse(`?${queryString}`) : undefined;

  if (queryParams && (queryParams.edgeSessionId || queryParams.edgeSessionInteraction)) {
    if (!(queryParams.edgeSessionId && queryParams.edgeSessionInteraction)) {
      throw getRichError('Parameter', 'both edgeSessionId and edgeSessionInteraction are required in the query string to decrypt request');
    }

    const keyMap = makeSessionMap(req.context).findBySessionId(queryParams.edgeSessionId);
    if (!keyMap) throw getRichError('Parameter', 'cannot find edgeSessionId. might have been removed or expired');
    let options;
    try {
      options = JSON.parse(
        decrypt(queryParams.edgeSessionInteraction, keyMap.sessionId, keyMap.sessionSecret),
      );
    } catch (error) {
      throw getRichError('System', 'cannot decode edgeSessionInteraction param');
    }

    if (options.qs) {
      const qs = querystring.stringify(options.qs);
      req.url = `${req.url.split('?')[0]}?${qs}`;
    } else {
      req.url = `${req.url.split('?')[0]}`;
    }
    if (options.token || (options.headers && options.headers.Authorization)) {
      req.authorization = options.token || options.headers.Authorization;
    }
    if (options.body) req.body = JSON.stringify(options.body);
    req.esession = {
      projectId: keyMap.projectId,
    };

    middlewareLoggedNext(handlerName, next);
  } else {
    middlewareLoggedNext(handlerName, next);
  }
};

module.exports = {
  edgeSessionMiddleware,
};
