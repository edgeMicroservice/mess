const generateObjectStoragePath = (objectType, objectId) => `${objectType}/${objectId}`;

const generateObjectDataStoragePath = (objectType, objectId) => `${objectType}/${objectId}/data`;

const objectServiceRoles = {
  ORIGIN: 'origin',
  DESTINATION: 'destination',
};

const objectUpdateTypes = {
  NODE_RECEIVED: 'node_received',
  NODE_DELETED: 'node_deleted',
  DATA_UPDATED: 'data_updated',
  METADATA_UPDATED: 'metadata_updated',
};

module.exports = {
  generateObjectStoragePath,
  generateObjectDataStoragePath,
  objectServiceRoles,
  objectUpdateTypes,
};
