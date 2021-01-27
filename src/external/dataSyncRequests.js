const makeRequestPromise = require('../lib/auth-helper/requestPromise');
const { extractFromServiceType } = require('../util/serviceNameHelper');

const WEBSOCKET_REQUEST_TYPE = 'data_sync';

const makeDataSyncRequests = (context) => {
  const { request } = makeRequestPromise(context);
  const { env: { DATA_SYNC_URL } } = context;

  const syncData = (object, originMessLink) => {
    const { serviceType } = context.info;
    const { projectClientId } = extractFromServiceType(serviceType);

    const data = {
      id: object.id,
      type: object.type,
      dataOriginLink: {
        ...originMessLink,
        method: 'GET',
      },
      dataDestinationLink: {
        url: `https://localhost:8083/${projectClientId}/mess/v1/objects/${object.id}/${object.type}/data`,
        method: 'PUT',
      },
    };

    if (DATA_SYNC_URL === 'ws://') {
      const options = {};
      options.type = WEBSOCKET_REQUEST_TYPE;
      options.message = JSON.stringify(data);
      context.dispatchWebSocketEvent(options);
      return Promise.resolve();
    }

    return request({
      url: DATA_SYNC_URL,
      method: 'POST',
      data,
    });
  };

  return {
    syncData,
  };
};

module.exports = makeDataSyncRequests;
