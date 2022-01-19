const makeRequestPromise = require('../lib/auth-helper/requestPromise');
const { extractFromServiceType } = require('../util/serviceNameHelper');

const WEBSOCKET_REQUEST_TYPE = 'data_sync';

const makeDataSyncRequests = (context) => {
  const EDGE_ENGINE_URL = `http://localhost:${context.info.httpPort}`;
  const MESS_API_ENDPOINT = '/mess/v1';

  const { request } = makeRequestPromise(context);
  const { env: { MDEPLOYMENT_AGENT_URL } } = context;

  const syncData = (object, originMessLink) => {
    const { serviceType } = context.info;
    const { projectClientId } = extractFromServiceType(serviceType);

    const dataOriginLink = {
      url: `${originMessLink.url}/objects/${object.type}/${object.id}/data`,
      method: 'GET',
    };

    const data = {
      id: object.id,
      type: object.type,
      version: object.version,
      dataOriginLink,
      dataDestinationLink: {
        url: `${EDGE_ENGINE_URL}/${projectClientId}${MESS_API_ENDPOINT}/objects/${object.id}/${object.type}/data`,
        method: 'PUT',
        formData: {
          file: '--file-data-from-origin-link--',
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
    };

    return request(requestOpts);
  };

  return {
    syncData,
  };
};

module.exports = makeDataSyncRequests;
