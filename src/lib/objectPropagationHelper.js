const Promise = require('bluebird');
const { some } = require('lodash');


const makeObjectCommonHelper = require('./commonHelper');

const makeMESSRequests = require('../external/messRequests');

const makeObjectHelper = (context) => {
  const sendCreationRequest = (nodeId, object) => makeObjectCommonHelper()
    .getCurrentContextDetails()
    .then(({ currentNodeId }) => {
      if (nodeId === currentNodeId) return Promise.resolve();

      return makeMESSRequests(context)
        .createObjectInCluster(nodeId, object)
        .catch((error) => {
          console.log('===> sendCreationRequest error', { nodeId, error });
          // TODO update logging
        });
    });

  const sendUpdationRequest = (nodeId, object) => makeObjectCommonHelper()
    .getCurrentContextDetails()
    .then(({ currentNodeId }) => {
      if (nodeId === currentNodeId) return Promise.resolve();

      return makeMESSRequests(context)
        .updateObjectInCluster(nodeId, object)
        .catch((error) => {
          console.log('===> sendUpdationRequest error', { nodeId, error });
          // TODO update logging
        });
    });

  const sendRemovalRequest = (nodeId, object) => makeObjectCommonHelper()
    .getCurrentContextDetails()
    .then(({ currentNodeId }) => {
      if (nodeId === currentNodeId) return Promise.resolve();

      return makeMESSRequests(context)
        .deleteObjectInCluster(nodeId, object)
        .catch((error) => {
          console.log('===> sendRemovalRequest error', { nodeId, error });
          // TODO update logging
        });
    });

  const notifyNewObjectDestinations = (newObject) => {
    const { destinations } = newObject;

    return Promise.map(destinations, (dest) => sendCreationRequest(dest.nodeId, newObject));
  };

  const notifyUpdatedObjectDestinations = (originalObject, updatedObject, updateInfo) => {
    if (!updateInfo.destinations) {
      if (updateInfo.version) {
        const { destinations } = updateInfo;

        return Promise.map(destinations, (dest) => sendUpdationRequest(dest.nodeId, updatedObject));
      }

      return Promise.resolve();
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
      : Promise.map(destinationsToCreate, (nodeId) => sendCreationRequest(nodeId, updatedObject));

    const destinationsUpdationPromise = destinationsToUpdate.length === 0
      ? Promise.resolve()
      : Promise.map(destinationsToUpdate, (nodeId) => sendUpdationRequest(nodeId, updatedObject));

    const destinationsRemovalPromise = destinationsToRemove.length === 0
      ? Promise.resolve()
      : Promise.map(destinationsToRemove, (nodeId) => sendRemovalRequest(nodeId, updatedObject));

    return Promise.all([
      destinationsCreationPromise,
      destinationsUpdationPromise,
      destinationsRemovalPromise,
    ]);
  };

  const notifyRemovedObjectDestinations = (object) => {
    const { destinations } = object;

    return Promise.map(destinations, (dest) => sendRemovalRequest(dest.nodeId, object));
  };

  return {
    notifyNewObjectDestinations,
    notifyUpdatedObjectDestinations,
    notifyRemovedObjectDestinations,
  };
};

module.exports = makeObjectHelper;
