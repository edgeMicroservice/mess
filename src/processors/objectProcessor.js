const Promise = require('bluebird');

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
  const objectModel = makeObjectModel(context);
  const { runReplaysParallelly } = makeRequestHelper(context);

  const getObjectAndCheckIfActive = (objectType, objectId) => runReplaysParallelly(objectModel
    .getObject(objectType, objectId)
    .then((object) => {
      if (object.deletionRequestedAt) throw new Error(`Requested object is up for deletion: ${JSON.stringify({ objectType, objectId })}`);

      return object;
    }));

  const createObject = (newObject) => runReplaysParallelly(() => {
    const objectToSave = newObject;
    objectToSave.serviceRole = objectServiceRoles.ORIGIN;

    return objectModel.saveObject(newObject)
      .then((persistedObject) => makeObjectPropagationHelper(context)
        .notifyNewObjectDestinations(persistedObject)
        .then(() => persistedObject));
  });

  const readObjects = (objectType, destinationNodeId) => runReplaysParallelly(objectModel
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
    }));

  const readObject = (objectType, objectId) => runReplaysParallelly(objectModel
    .getObject(objectType, objectId)
    .then((object) => {
      if (!object) throw new Error('Object not found');

      return object;
    }));

  const updateObject = (objectUpdate, updateInfo) => runReplaysParallelly(getObjectAndCheckIfActive(objectUpdate.type, objectUpdate.id)
    .then((originalObject) => objectModel.updateObject(objectUpdate.type, objectUpdate.id, objectUpdate)
      .then((updatedObject) => makeObjectPropagationHelper(context)
        .notifyUpdatedMetadataObjectDestinations(originalObject, updatedObject, updateInfo)
        .then(() => updatedObject))));

  const deleteObject = (objectType, objectId) => runReplaysParallelly(getObjectAndCheckIfActive(objectType, objectId)
    .then((originalObject) => {
      if (originalObject.serviceRole !== objectServiceRoles.ORIGIN) {
        throw new Error('Object can only be deleted at origin');
      }

      return makeObjectPropagationHelper(context)
        .notifyRemovedObjectDestinations(originalObject)
        .then(() => originalObject);
    }));

  const readObjectData = (objectType, objectId) => runReplaysParallelly(getObjectAndCheckIfActive(objectType, objectId)
    .then((object) => ({
      path: generateObjectDataStoragePath(objectType, objectId),
      mimeType: object.mimeType,
    })));

  const updateObjectData = (objectType, objectId, handleFormRequestFunc) => runReplaysParallelly(readObject(objectType, objectId)
    .then((object) => {
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

      return (() => {
        if (object.serviceRole === objectServiceRoles.DESTINATION) {
          return makeNodeReplay(context).deleteRequest(object.originId, requestTypes.RECEIVAL_FAILED, object, false);
        }

        return makeObjectPropagationHelper(context)
          .notifyUpdatedDataObjectDestinations(object);
      })()
        .then(() => {
          if (!metadataUpdateInfo) return Promise.resolve(object);

          return makeObjectValidationHelper(context)
            .validateAndPopulateObjectUpdate(objectType, objectId, metadataUpdateInfo)
            .then((preppedObject) => updateObject(preppedObject, metadataUpdateInfo));
        });
    }));

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
