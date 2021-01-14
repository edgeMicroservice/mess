const generateObjectStoragePath = (objectType, objectId) => `${objectType}/${objectId}`;

const generateObjectDataStoragePath = (objectType, objectId) => `${objectType}/${objectId}/data`;

module.exports = {
  generateObjectStoragePath,
  generateObjectDataStoragePath,
};
