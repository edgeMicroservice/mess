const { sortBy } = require('lodash');

const maximumRetries = 6;
const minimumRetryDelay = 10; // seconds

const requestTypes = {
  CREATE_OBJECT: 'create_object',
  UPDATE_OBJECT_METADATA: 'update_object_metadata',
  UPDATE_OBJECT_DATA: 'update_object_data',
  DELETE_OBJECT: 'delete_object',
  RECEIVAL_FAILED: 'receival_failed',
};

const requestsOrder = {};
requestsOrder[requestTypes.CREATE_OBJECT] = 0;
requestsOrder[requestTypes.UPDATE_OBJECT_METADATA] = 1;
requestsOrder[requestTypes.UPDATE_OBJECT_DATA] = 2;
requestsOrder[requestTypes.DELETE_OBJECT] = 3;
requestsOrder[requestTypes.RECEIVAL_FAILED] = 4;

const requestsSorter = (requests) => {
  if (requests.length < 2) return requests;

  return sortBy(
    requests, (a, b) => requestsOrder[a.requestType] - requestsOrder[b.requestType],
  );
};

const storagePathTag = 'nodeReplays/';
const generateNodeReplayStoragePath = (nodeId) => `${storagePathTag}${nodeId}`;
const extractNodeIdFromStoragePath = (storagePath) => storagePath.substr(storagePathTag.length);

module.exports = {
  requestTypes,
  maximumRetries,
  minimumRetryDelay,
  requestsSorter,
  generateNodeReplayStoragePath,
  extractNodeIdFromStoragePath,
};
