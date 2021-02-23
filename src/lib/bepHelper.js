const Promise = require('bluebird');
const merge = require('lodash/merge');

const { rpAuth, getEdgeServiceLinkByNodeId } = require('../lib/auth-helper');
const { extractFromServiceType } = require('../util/serviceNameHelper');

const makeBepHelper = (context) => {
  const getHmacCodeByReq = (accessToken, nodeId) => {
    const { edge } = context;
    return new Promise((resolve, reject) => {
      edge.getRequestBepHmacCode(accessToken, nodeId,
        (hmacCode) => resolve(hmacCode),
        (error) => reject(error));
    });
  };


  const getBep = (accessToken, nodeId, serviceType, endpoint) => getHmacCodeByReq(
    accessToken, nodeId, context,
  )
    .then((hmac) => {
      const requestOptions = {
        qs: {
          hmac,
        },
      };

      return getEdgeServiceLinkByNodeId(nodeId, serviceType, accessToken, context)
        .then((serviceLink) => {
          const updatedRequestOptions = merge(requestOptions, serviceLink);
          updatedRequestOptions.url = `${updatedRequestOptions.url}${endpoint}`;
          const { serviceName } = extractFromServiceType(serviceType);
          return rpAuth(serviceName, updatedRequestOptions, context, true);
        });
    });

  return {
    getBep,
  };
};

module.exports = makeBepHelper;
