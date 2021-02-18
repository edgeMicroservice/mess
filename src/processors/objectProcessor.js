const makeObjectModel = require('../models/objectModel');
const makeNodeReplay = require('../models/nodeReplayModel');

const makeRequestHelper = require('../lib/requestHelper');
const makeObjectPropagationHelper = require('../lib/objectPropagationHelper');
const makeObjectValidationHelper = require('../lib/objectValidationHelper');

const {
  objectServiceRoles,
  generateObjectDataStoragePath,
} = require('../util/objectUtil');

const {
  requestTypes,
} = require('../util/nodeReplayUtil');

const makeObjectProcessor = (context) => {
  const getObjectAndCheckIfActive = (objectType, objectId) => makeObjectModel(context)
    .getObject(objectType, objectId)
    .then((object) => {
      if (object.deletionRequestedAt) throw new Error(`Requested object is up for deletion: ${JSON.stringify({ objectType, objectId })}`);

      return object;
    });

  const createObject = (newObject) => {
    const objectToSave = newObject;
    objectToSave.serviceRole = objectServiceRoles.ORIGIN;

    return makeObjectModel(context).saveObject(newObject)
      .then((persistedObject) => makeObjectPropagationHelper(context)
        .notifyNewObjectDestinations(persistedObject)
        .then(() => persistedObject));
  };

  const readObjects = (objectType, destinationNodeId) => makeObjectModel(context)
    .getAllObjects()
    .then((objects) => {
      const filteredObjects = objects.map(
        (object) => {
          if (objectType && object.type !== objectType) return false;

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
    })
    .then((objects) => {
      makeRequestHelper(context).initializeReplays();
      return objects;
    });

  const readObject = (objectType, objectId) => makeObjectModel(context)
    .getObject(objectType, objectId)
    .then((object) => {
      if (!object) throw new Error('Object not found');

      makeRequestHelper(context).initializeReplays();
      return object;
    });

  const updateObject = (objectUpdate, updateInfo) => getObjectAndCheckIfActive(objectUpdate.type, objectUpdate.id)
    .then((originalObject) => makeObjectModel(context).updateObject(objectUpdate.type, objectUpdate.id, objectUpdate)
      .then((updatedObject) => makeObjectPropagationHelper(context)
        .notifyUpdatedMetadataObjectDestinations(originalObject, updatedObject, updateInfo)
        .then(() => updatedObject)));

  const deleteObject = (objectType, objectId) => getObjectAndCheckIfActive(objectType, objectId)
    .then((originalObject) => {
      if (originalObject.serviceRole !== objectServiceRoles.ORIGIN) {
        throw new Error('Object can only be deleted at origin');
      }

      return makeObjectModel(context).deleteObject(objectType, objectId)
        .then(() => makeObjectPropagationHelper(context)
          .notifyRemovedObjectDestinations(originalObject))
        .then(() => originalObject);
    });

  const readObjectData = (objectType, objectId) => getObjectAndCheckIfActive(objectType, objectId)
    .then((object) => {
      makeRequestHelper(context).initializeReplays();

      return {
        path: generateObjectDataStoragePath(objectType, objectId),
        mimeType: object.mimeType,
      };
    });

  const updateObjectData = (objectType, objectId, handleFormRequestFunc) => readObject(objectType, objectId)
    .then(() => {
      let attributes = '';
      let mimeType = '';

      handleFormRequestFunc({
        found: (key) => {
          let todo = {
            action: 'skip',
          };

          if (key === 'attributes') {
            todo = {
              action: 'getAttributes',
            };
          } else if (key === 'mimeType') {
            todo = {
              action: 'getMimeType',
            };
          } else if (key === 'file') {
            todo = {
              action: 'store',
              path: `${generateObjectDataStoragePath(objectType, objectId)}`,
            };
          }

          return todo;
        },
        getAttributes: (key, value) => {
          attributes = attributes.concat(value);
        },
        getMimeType: (key, value) => {
          mimeType = mimeType.concat(value);
        },
        store: () => { },
      });

      let metadataUpdateInfo;
      if (attributes || mimeType) {
        metadataUpdateInfo = {};
        if (mimeType !== '') metadataUpdateInfo.mimeType = mimeType;
        if (attributes !== '') metadataUpdateInfo.attributes = attributes;
      }

      if (!metadataUpdateInfo) return Promise.resolve();

      return makeObjectValidationHelper(context)
        .validateAndPopulateObjectUpdate(objectType, objectId, metadataUpdateInfo)
        .then((preppedObject) => updateObject(preppedObject, metadataUpdateInfo))
        .then((updatedObject) => makeNodeReplay(context).deleteRequest(updatedObject.originId, requestTypes.RECEIVAL_FAILED, updatedObject, false)
          .then(() => {
            makeObjectPropagationHelper(context)
              .notifyUpdatedDataObjectDestinations(updatedObject);
            return updatedObject;
          }));
    });

  return {
    createObject,
    readObjects,
    readObject,
    updateObject,
    deleteObject,
    readObjectData,
    updateObjectData,
  };
};

module.exports = makeObjectProcessor;
