const defaultMimeType = 'application/octet-stream';

const maxiumumLabels = 10;
const maxiumumAttributes = 10;
const maximumTotalLabelsLength = 500;
const maximumTotalAttributesLength = 500;

const objectServiceRoles = {
  ORIGIN: 'origin',
  DESTINATION: 'destination',
};

const objectClusterUpdateTypes = {
  DATA_UPDATED: 'data_updated',
  METADATA_UPDATED: 'metadata_updated',
  RECEIVAL_FAILED: 'receival_failed',
};

const generateObjectDataStoragePath = (objectType, objectId) => `objects_${objectType}_${objectId}_data`;

const generateObjectMetadataStoragePath = (objectType, objectId) => `objects_${objectType}_${objectId}_metadata`;

module.exports = {
  defaultMimeType,
  maxiumumLabels,
  maxiumumAttributes,
  maximumTotalLabelsLength,
  maximumTotalAttributesLength,
  objectServiceRoles,
  objectClusterUpdateTypes,
  generateObjectDataStoragePath,
  generateObjectMetadataStoragePath,
};
