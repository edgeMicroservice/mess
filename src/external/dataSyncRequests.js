const makeRequestPromise = require('../lib/auth-helper/requestPromise');
const { getEdgeServiceLinkByNodeId } = require('../lib/auth-helper');

const WEBSOCKET_REQUEST_TYPE = 'data_sync';

const makeDataSyncRequests = (context) => {
  const { request } = makeRequestPromise(context);
  const { env: { MDEPLOYMENT_AGENT_URL, MDEPLOYMENT_AGENT_API_KEY, SERVER_API_KEYS } } = context;

  const syncData = (object, originMessLink, accessToken) => {
    const { serviceType } = context.info;

    const dataOriginLink = {
      url: `${originMessLink.url}/objects/${object.type}/${object.id}/data`,
      method: 'GET',
      headers: {
        apiKey: SERVER_API_KEYS,
      },
    };

    return getEdgeServiceLinkByNodeId(context.info.nodeId, serviceType, accessToken, context)
      .then((localMessLink) => {
        const data = {
          id: object.id,
          type: object.type,
          version: object.version,
          fileLink: dataOriginLink,
          deploymentLink: {
            url: `${localMessLink.url}/objects/${object.type}/${object.id}/data`,
            method: 'PUT',
            formData: {
              file: '--file-data-from-origin-link--',
            },
            headers: {
              apiKey: SERVER_API_KEYS,
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
          data,
          headers: {
            apiKey: MDEPLOYMENT_AGENT_API_KEY,
          },
        };

        return request(requestOpts);
      });
  };

  return {
    syncData,
  };
};

module.exports = makeDataSyncRequests;
