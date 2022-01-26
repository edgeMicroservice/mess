const makeRequestPromise = require('../lib/auth-helper/requestPromise');
const { getEdgeServiceLinkByNodeId } = require('../lib/auth-helper');

const WEBSOCKET_REQUEST_TYPE = 'data_sync';

const makeDataSyncRequests = (context) => {
  const { request } = makeRequestPromise(context);
  const { env: { MDEPLOYMENT_AGENT_URL, MDEPLOYMENT_AGENT_API_KEY, SERVER_API_KEYS } } = context;

  const syncData = (object, originMessLink, accessToken) => {
    const { serviceType } = context.info;

    const originLink = {
      url: `${originMessLink.url}/objects/${object.type}/${object.id}/data`,
      method: 'GET',
      headers: {
        apiKey: SERVER_API_KEYS,
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
              apiKey: SERVER_API_KEYS,
            },
            formData: {
              file: '$file.stream',
            },
          },
        };

        if (MDEPLOYMENT_AGENT_URL === 'ws://') {
          const options = {};
          options.type = WEBSOCKET_REQUEST_TYPE;
          options.message = JSON.stringify(data);
          context.dispatchWebSocketEvent(options);
          return Promise.resolve();
        }

        const requestOpts = {
          url: MDEPLOYMENT_AGENT_URL,
          method: 'POST',
          headers: {
            apiKey: MDEPLOYMENT_AGENT_API_KEY,
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
