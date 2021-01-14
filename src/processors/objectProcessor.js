const makeObjectHelper = require('../lib/objectHelper');
const makeObjectModel = require('../models/objectModel');

const makeObjectProcessor = (context) => {
  const createObject = (newObject) => {
    const {
      validateAndInitializeNewObject,
      notifyNewObjectDestinations,
    } = makeObjectHelper(context);
    const { saveObject } = makeObjectModel(context);

    return validateAndInitializeNewObject(newObject)
      .then((initializedNewObject) => saveObject(initializedNewObject))
      .then((persistedObject) => notifyNewObjectDestinations(persistedObject)
        .then(() => persistedObject));
  };

  const readObjects = (objectType, destinationNodeId, updatedAfter) => makeObjectModel(context)
    .getAllObjects((objects) => {
      const filteredObjects = objects
        .map((object) => {
          if (objectType && object.type !== objectType) return false;

          if (updatedAfter && updatedAfter > new Date(object.updatedAt)) return false;

          if (!destinationNodeId) return object;

          const updatedObject = object;
          updatedObject.destinations = updatedObject.destinations.filter((destination) => {
            if (destination.nodeId === destinationNodeId) return true;

            return false;
          });
          return updatedObject;
        })
        .filter((object) => !!object);

      return filteredObjects;
    });

  return {
    createObject,
    readObjects,
  };
};

module.exports = makeObjectProcessor;
