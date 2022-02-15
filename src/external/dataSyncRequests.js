const makeRequestPromise = require('../lib/auth-helper/requestPromise');
const { getEdgeServiceLinkByNodeId } = require('../lib/auth-helper');

const WEBSOCKET_REQUEST_TYPE = 'data_sync';

const makeDataSyncRequests = (context) => {
  const { request } = makeRequestPromise(context);
  const { env: { MDEPLOYMENTAGENT_URL, MDEPLOYMENTAGENT_KEY, SERVER_API_KEYS } } = context;

  const syncData = (object, originMessLink, accessToken) => {
    const { serviceType } = context.info;
    const messAPIKey = SERVER_API_KEYS.split(',')[0].trim();

    const originLink = {
      url: `${originMessLink.url}/objects/${object.type}/${object.id}/data`,
      method: 'GET',
      headers: {
        apiKey: messAPIKey,
      },
    };

    return getEdgeServiceLinkByNodeId(context.info.nodeId, serviceType, accessToken, context)
      .then((localMessLink) => {
        const data = {
          originLink,
          destinationLink: {
            url: `${localMessLink.url}/objects/${object.type}/${object.id}/data`,
            method: 'PUT',
            headers: {
              apiKey: messAPIKey,
            },
            formData: {
              file: '$file.stream',
            },
          },
        };

        if (MDEPLOYMENTAGENT_URL === 'ws://') {
          const options = {};
          options.type = WEBSOCKET_REQUEST_TYPE;
          options.message = JSON.stringify(data);
          context.dispatchWebSocketEvent(options);
          return Promise.resolve();
        }

        const requestOpts = {
          url: `${MDEPLOYMENTAGENT_URL}/files`,
          method: 'POST',
          headers: {
            apiKey: MDEPLOYMENTAGENT_KEY,
          },
          data,
        };

        return request(requestOpts);
      });
  };

  return {
    syncData,
  };
};

module.exports = makeDataSyncRequests;
