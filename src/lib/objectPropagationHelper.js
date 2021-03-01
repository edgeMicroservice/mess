const Promise = require('bluebird');
const some = require('lodash/some');

const makeRequestHelper = require('./requestHelper');
const makeObjectCommonHelper = require('./commonHelper');

const { requestTypes } = require('../util/nodeReplayUtil');

const makeObjectPropagationHelper = (context) => {
  const { notifyMess } = makeRequestHelper(context);
  const { getCurrentContextDetails } = makeObjectCommonHelper(context);

  const sendRequest = (nodeId, requestType, object) => getCurrentContextDetails()
    .then(({ currentNodeId }) => {
      if (nodeId === currentNodeId) return Promise.resolve();

      return notifyMess(nodeId, requestType, object);
    });


  const notifyNewObjectDestinations = (newObject) => {
    const { destinations } = newObject;

    return Promise.map(destinations, (dest) => sendRequest(dest.nodeId, requestTypes.CREATE_OBJECT, newObject));
  };

  const notifyUpdatedMetadataObjectDestinations = (originalObject, updatedObject, updateInfo) => {
    if (!updateInfo.destinations) {
      const { destinations } = updateInfo;
      return Promise.map(destinations, (dest) => sendRequest(dest.nodeId, requestTypes.UPDATE_OBJECT_METADATA, updatedObject));
    }

    const { destinations: oldDestinations } = originalObject;
    const { destinations: updatedDestinations } = updateInfo;

    const destinationsToCreate = [];
    const destinationsToUpdate = [];
    const destinationsToRemove = [];

    updatedDestinations.forEach((updDest) => {
      const isPresentInOld = some(oldDestinations, (oldDest) => oldDest.nodeId === updDest.nodeId);

      if (!isPresentInOld) destinationsToCreate.push(updDest.nodeId);
    });

    oldDestinations.forEach((oldDest) => {
      const isPresentInUpdate = some(updatedDestinations, (updDest) => updDest.nodeId === oldDest.nodeId);

      if (isPresentInUpdate && updateInfo.version) destinationsToUpdate.push(oldDest.nodeId);
      if (!isPresentInUpdate) destinationsToRemove.push(oldDest.nodeId);
    });

    const destinationsCreationPromise = destinationsToCreate.length === 0
      ? Promise.resolve()
      : Promise.map(destinationsToCreate, (nodeId) => sendRequest(nodeId, requestTypes.CREATE_OBJECT, updatedObject));

    const destinationsUpdationPromise = destinationsToUpdate.length === 0
      ? Promise.resolve()
      : Promise.map(destinationsToUpdate, (nodeId) => sendRequest(nodeId, requestTypes.UPDATE_OBJECT_METADATA, updatedObject));

    const destinationsRemovalPromise = destinationsToRemove.length === 0
      ? Promise.resolve()
      : Promise.map(destinationsToRemove, (nodeId) => sendRequest(nodeId, requestTypes.DELETE_OBJECT, updatedObject));

    return Promise.all([
      destinationsCreationPromise,
      destinationsUpdationPromise,
      destinationsRemovalPromise,
    ]);
  };

  const notifyUpdatedDataObjectDestinations = (object) => {
    const { destinations } = object;

    return Promise.map(destinations, (dest) => sendRequest(dest.nodeId, requestTypes.UPDATE_OBJECT_DATA, object));
  };

  const notifyRemovedObjectDestinations = (object) => {
    const { destinations } = object;

    return Promise.map(destinations, (dest) => sendRequest(dest.nodeId, requestTypes.DELETE_OBJECT, object));
  };

  return {
    notifyNewObjectDestinations,
    notifyUpdatedDataObjectDestinations,
    notifyUpdatedMetadataObjectDestinations,
    notifyRemovedObjectDestinations,
  };
};

module.exports = makeObjectPropagationHelper;
