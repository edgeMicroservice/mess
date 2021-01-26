const objectServiceRoles = {
  ORIGIN: 'origin',
  DESTINATION: 'destination',
};

const objectClusterUpdateTypes = {
  DATA_UPDATED: 'data_updated',
  METADATA_UPDATED: 'metadata_updated',
  RECEIVAL_FAILED: 'receival_failed',
};

const generateObjectDataStoragePath = (objectType, objectId) => `objects/${objectType}/${objectId}/data`;

const generateObjectMetadataStoragePath = (objectType, objectId) => `objects/${objectType}/${objectId}/metadata`;

module.exports = {
  objectServiceRoles,
  objectClusterUpdateTypes,
  generateObjectDataStoragePath,
  generateObjectMetadataStoragePath,
};
