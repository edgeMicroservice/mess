const makeRequestHelper = require('../lib/requestHelper');

const makeObjectModel = require('../models/objectModel');

const {
  objectServiceRoles,
  objectClusterUpdateTypes,
} = require('../util/objectUtil');

const makeClusterProcessor = (context) => {
  const createObjectInCluster = (newObject) => {
    const objectToSave = newObject;
    objectToSave.serviceRole = objectServiceRoles.DESTINATION;

    return makeObjectModel(context).saveObject(newObject)
      .then((object) => {
        makeRequestHelper(context).initializeReplays();
        return object;
      });
  };

  const updateObjectInCluster = (updateType, objectUpdate) => (() => {
    switch (updateType) {
      case objectClusterUpdateTypes.METADATA_UPDATED:
        return makeObjectModel(context).updateObject(objectUpdate.type, objectUpdate.id, objectUpdate);
      case objectClusterUpdateTypes.DATA_UPDATED:
        // TODO implement handler of data updated
        return Promise.resolve();
      case objectClusterUpdateTypes.RECEIVAL_FAILED:
        // TODO Add a process of sending data update request again
        return makeObjectModel(context).updateObject(objectUpdate.type, objectUpdate.id, objectUpdate);
      default:
        throw new Error(`Unexpected update type found on cluster object: ${JSON.stringify({ updateType, objectUpdate })}`);
    }
  })()
    .then(() => {
      makeRequestHelper(context).initializeReplays();
      return objectUpdate;
    });

  const deleteObjectInCluster = (objectType, objectId) => {
    const objectModel = makeObjectModel(context);

    return objectModel.getObject(objectType, objectId)
      .then((object) => objectModel.deleteObject(objectType, objectId)
        .then(() => {
          makeRequestHelper(context).initializeReplays();
          return object;
        }));
  };

  return {
    createObjectInCluster,
    updateObjectInCluster,
    deleteObjectInCluster,
  };
};

module.exports = makeClusterProcessor;
