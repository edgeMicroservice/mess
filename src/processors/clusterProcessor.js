const makeObjectModel = require('../models/objectModel');

const { objectServiceRoles } = require('../util/objectUtil');

const makeClusterProcessor = (context) => {
  const createObjectInCluster = (newObject) => {
    const objectToSave = newObject;
    objectToSave.serviceRole = objectServiceRoles.DESTINATION;

    return makeObjectModel(context).saveObject(newObject);
  };

  const updateObjectInCluster = (objectType, objectId, objectUpdate) => {
    if (!objectUpdate) {
      // TODO Add logic to call webhook if configured
      return makeObjectModel(context).getObject(objectType, objectId);
    }

    return makeObjectModel(context).updateObject(objectUpdate.type, objectUpdate.id, objectUpdate);
  };

  const deleteObjectInCluster = (objectType, objectId) => {
    const objectModel = makeObjectModel(context);

    return objectModel.getObject(objectType, objectId)
      .then(() => objectModel.deleteObject(objectType, objectId));
  };

  return {
    createObjectInCluster,
    updateObjectInCluster,
    deleteObjectInCluster,
  };
};

module.exports = makeClusterProcessor;
