const makeObjectPropagationHelper = require('../lib/objectPropagationHelper');
const makeObjectModel = require('../models/objectModel');

const makeObjectProcessor = (context) => {
  const createObject = (newObject) => {
    const {
      notifyNewObjectDestinations,
    } = makeObjectPropagationHelper(context);

    const { saveObject } = makeObjectModel(context);

    return saveObject(newObject)
      .then((persistedObject) => notifyNewObjectDestinations(persistedObject)
        .then(() => persistedObject));
  };

  const readObjects = (objectType, destinationNodeId, updatedAfter) => makeObjectModel(context)
    .getAllObjects()
    .then((objects) => {
      const filteredObjects = objects.map(
        (object) => {
          if (objectType && object.type !== objectType) return false;

          if (updatedAfter && updatedAfter > new Date(object.updatedAt)) return false;

          if (!destinationNodeId) return object;

          const updatedObject = object;
          const sameDestination = updatedObject.destinations.some((destination) => {
            if (destination.nodeId === destinationNodeId) return true;

            return false;
          });
          return sameDestination ? updatedObject : false;
        },
      )
        .filter((object) => !!object);

      return filteredObjects;
    });

  const readObject = (objectType, objectId) => makeObjectModel(context)
    .getObject(objectType, objectId)
    .then((object) => {
      if (!object) throw new Error('Object not found');

      return object;
    });

  const updateObject = (objectUpdate, updateInfo) => {
    const objectModel = makeObjectModel(context);

    return objectModel.getObject(objectUpdate.type, objectUpdate.id)
      .then((originalObject) => objectModel.updateObject(objectUpdate.type, objectUpdate.id, objectUpdate)
        .then((updatedObject) => makeObjectPropagationHelper(context)
          .notifyUpdatedObjectDestinations(originalObject, updatedObject, updateInfo)));
  };

  const deleteObject = (objectType, objectId) => {
    const objectModel = makeObjectModel(context);

    return objectModel.getObject(objectType, objectId)
      .then((originalObject) => objectModel.deleteObject(objectType, objectId)
        .then(() => makeObjectPropagationHelper(context)
          .notifyRemovedObjectDestinations(originalObject)));
  };

  return {
    createObject,
    readObjects,
    readObject,
    updateObject,
    deleteObject,
  };
};

module.exports = makeObjectProcessor;
