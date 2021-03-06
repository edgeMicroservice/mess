const Promise = require('bluebird');
const querystring = require('query-string');
const keys = require('lodash/keys');
const merge = require('lodash/merge');
const keysIn = require('lodash/keysIn');

const { SERVICE_CONSTANTS } = require('./common');

const makeSessionMap = require('./sessionMap');
const makeRequestPromise = require('./requestPromise');
const { encrypt } = require('./encryptionHelper');
const { debugLog, getRichError } = require('../../util/logHelper');
const { extractFromServiceType } = require('../../util/serviceNameHelper');

const fetchTokenFromMST = (serviceType, context) => {
  const {
    OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET,
    MST_URL,
    CUSTOMER_CODE,
  } = context.env;

  return makeRequestPromise(context)
    .request({
      url: `${MST_URL}/oauth/token`,
      type: 'POST',
      data: {
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
        audience: `${MST_URL}/clients/Generic-${serviceType}-${CUSTOMER_CODE}`,
        grant_type: 'client_credentials',
      },
    })
    .then((response) => ({ token: `${response.data.token_type} ${response.data.access_token}` }))
    .catch((error) => ({
      error,
    }));
};

const makeHeaders = (auth, maps) => {
  const DELI = '\r\n';
  let headers = auth;

  keys(maps).forEach((key) => {
    const value = maps[key];
    if (headers) {
      headers = `${headers}${DELI}${key}: ${value}`;
    } else {
      headers = `${DELI}${key}: ${value}`;
    }
  });

  return headers;
};

let requestSent = false;

const sendRequest = (context, requestObj) => {
  requestSent = true;
  return makeRequestPromise(context)
    .request(requestObj);
};

const rpAuth = (serviceObj, options, context, encryptRequest = true) => {
  debugLog('Sending request', {
    serviceObj,
    options,
  });

  let serviceType;
  let projectId;
  if (typeof serviceObj === 'string') {
    serviceType = serviceObj;
  } else {
    serviceType = serviceObj.serviceType;
    projectId = serviceObj.projectId;
  }

  const updatedOptions = options;

  return Promise.resolve()
    .then(() => {
      if (!updatedOptions.token && serviceType !== SERVICE_CONSTANTS.MCM && context.env.SERVER_SECURITY_SET === 'on') {
        const { serviceType: currentServiceType } = context.info;
        const { serviceName: currentServiceName } = extractFromServiceType(currentServiceType);

        if (serviceType === currentServiceName) {
          const { SERVER_API_KEYS } = context.env;
          const messAPIKey = SERVER_API_KEYS.split(',')[0].trim();
          if (SERVER_API_KEYS !== '') return { apiKey: messAPIKey };
        }

        return fetchTokenFromMST(serviceType, context)
          .then((tokenResult) => ({ tokenResult }));
      }
      return {};
    })
    .then(({ tokenResult = {}, apiKey }) => {
      if (tokenResult.error && context.env.SERVER_SECURITY_SET === 'on') {
        throw getRichError('System', `cannot fetch mST token for serviceType: ${serviceType}`, {
          error: tokenResult.error.message,
          SERVER_SECURITY_SET: context.env.SERVER_SECURITY_SET,
          SESSION_SECURITY_AUTHORIZATION_SET: context.env.SESSION_SECURITY_AUTHORIZATION_SET,
        });
      }
      if (tokenResult.token) updatedOptions.token = tokenResult.token;

      if (apiKey) updatedOptions.headers = { apiKey, ...updatedOptions.headers = {} };

      if (context.env.SESSION_SECURITY_AUTHORIZATION_SET === 'off'
        || !encryptRequest
        || serviceType === SERVICE_CONSTANTS.MCM
        || (options.headers && options.headers['x-mimik-routing'])) {
        if (serviceType !== SERVICE_CONSTANTS.MCM && tokenResult.error) {
          throw getRichError('System', `cannot fetch mST token for serviceType: ${serviceType}`, {
            error: tokenResult.error.message,
            SERVER_SECURITY_SET: context.env.SERVER_SECURITY_SET,
            SESSION_SECURITY_AUTHORIZATION_SET: context.env.SESSION_SECURITY_AUTHORIZATION_SET,
          });
        }
        let url = updatedOptions.url || updatedOptions.uri;
        const qs = querystring.stringify(updatedOptions.qs);
        if (updatedOptions.qs) url = url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`;

        const requestOptions = {
          url,
          type: updatedOptions.method,
        };
        if (updatedOptions.body) requestOptions.data = updatedOptions.body;

        if (updatedOptions.token
          || (updatedOptions.headers && updatedOptions.headers.Authorization)) {
          requestOptions.authorization = updatedOptions.token
            || updatedOptions.headers.Authorization;
        }
        const headerKeys = keysIn(updatedOptions.headers);
        const isAdditionalHeaders = headerKeys.indexOf('Authorization') > -1 ? headerKeys.length > 1 : headerKeys.length > 0;
        if (isAdditionalHeaders) {
          const additionalHeaders = updatedOptions.headers;
          delete additionalHeaders.Authorization;
          requestOptions.authorization = makeHeaders(
            requestOptions.authorization, additionalHeaders,
          );
        }
        return sendRequest(context, requestOptions);
      }

      const keyMap = makeSessionMap(context).findByProject(projectId);
      if (!keyMap) throw getRichError('Parameter', projectId ? `could not find session key for projectId: ${projectId}` : 'could not find session key for current project');

      let url = updatedOptions.url || updatedOptions.uri;
      if (url.includes('?')) {
        const [path, queries] = url.split('?');
        url = path;
        updatedOptions.qs = merge(updatedOptions.qs, querystring.parse(queries));
      }

      const edgeSessionParams = {
        edgeSessionId: keyMap.sessionId,
        edgeSessionInteraction: encrypt(
          JSON.stringify(updatedOptions), keyMap.sessionId, keyMap.sessionSecret,
        ),
      };

      const qs = querystring.stringify(edgeSessionParams);
      const urlWithParams = url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`;

      return sendRequest(context, {
        url: urlWithParams,
        type: updatedOptions.method,
      });
    })
    .catch((error) => {
      if (!requestSent) throw getRichError('System', 'Sending request failed', null, error);
      throw getRichError(error?.statusCode, 'Failure response received', null, error);
    })
    .then((data) => {
      // For JsonRPC
      if (data && data.error) throw getRichError(data?.error?.statusCode || 'System', 'Failure response received', null, { error: data.error });
      debugLog('Success response received', data);
      return data;
    });
};

module.exports = {
  rpAuth,
};
