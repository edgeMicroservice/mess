const Promise = require('bluebird');

const {
  map, find, keys, some,
} = require('lodash');

const makeObjectModel = require('../models/objectModel');
const makeObjectCommonHelper = require('./commonHelper');

const makeObjectValidationHelper = (context) => {
  const { fetchNodes, getCurrentContextDetails } = makeObjectCommonHelper(context);

  const validateAndFormatDestinations = (accountId, nodes, destinations) => {
    const unfoundDestinationNodeIds = [];

    const verifiedAndFormattedDestinations = map(destinations, (destination) => {
      const requestedNodeId = destination.nodeId;

      const foundDestNode = find(nodes, (node) => {
        if (node.account.id === accountId && node.id.includes(requestedNodeId)) {
          return true;
        }
        return false;
      });

      if (!foundDestNode) {
        unfoundDestinationNodeIds.push(requestedNodeId);
        return {};
      }

      return destination;
    });

    if (unfoundDestinationNodeIds.length > 0) {
      throw new Error(`Destinations nodeId(s) not found: ${unfoundDestinationNodeIds.join(', ')}`);
    }

    return verifiedAndFormattedDestinations;
  };

  const validateAndPopulateNewObject = (newObject) => {
    const updatedNewObject = {
      hasData: false,
      updatedAt: new Date(),
      createdAt: new Date(),
      ...newObject,
    };

    if (updatedNewObject.isValidated) {
      return updatedNewObject;
    }

    if (updatedNewObject.version === '') throw new Error('version cannot be an empty string');

    const validateAndDecideOriginId = (accountId, nodes, currentNodeId, originId) => {
      if (originId) {
        const foundOriginNode = find(nodes, (node) => {
          if (node.account.id === accountId && node.id.includes(originId)) return true;
          return false;
        });

        if (!foundOriginNode) {
          throw new Error(`Node with originId cannot be found: ${originId}`);
        }
        return originId;
      }
      return currentNodeId;
    };

    return fetchNodes()
      .then((nodes) => getCurrentContextDetails()
        .then(({ accountId, currentNodeId }) => {
          updatedNewObject.originId = validateAndDecideOriginId(accountId, nodes, currentNodeId, updatedNewObject.originId);
          updatedNewObject.destinations = validateAndFormatDestinations(accountId, nodes, updatedNewObject.destinations);

          updatedNewObject.isValidated = true;

          return updatedNewObject;
        }));
  };

  const validateAndPopulateObjectUpdate = (objectType, objectId, updateInfo) => Promise.resolve()
    .then(() => {
      const versionBeingEmptyStringError = 'Property \'version\' cannot be an empty string';

      if (updateInfo.version && updateInfo.version === '') throw new Error(versionBeingEmptyStringError);
    })
    .then(() => makeObjectModel(context).getObject(objectType, objectId))
    .then((currentObject) => getCurrentContextDetails()
      .then(({ accountId, currentNodeId }) => {
        if (currentObject.originId !== currentNodeId) throw new Error('Requested update(s) can only be made on originId nodeId');

        const updatedObject = { ...currentObject };

        const {
          version,
          destinations,
        } = updateInfo;

        updatedObject.updatedAt = new Date();

        if (version) updatedObject.version = version;

        if (!destinations) return updatedObject;

        return fetchNodes(context)
          .then((nodes) => {
            updatedObject.destinations = validateAndFormatDestinations(
              accountId, nodes, updatedObject.destinations,
            );
            return updatedObject;
          });
      }));

  const validateAndPopulateObjectUpdateInCluster = (objectType, objectId, updateInfo) => Promise.resolve()
    .then(() => {
      const deleteAtAdditionalPropertiesError = 'Cannot declare other properties while updating deletedAt/deletedBy';
      const receivedAtAdditionalPropertiesError = 'Cannot declare other properties while updating receivedAt/receivedBy';

      const deletedAtAnddeletedByDontCoexistError = 'Cannot declare deletedAt and deletedBy individually, both should be provided together';
      const receivedAtAndreceivedByDontCoexistError = 'Cannot declare receivedAt and receivedBy separately, both should be provided together';

      const versionBeingEmptyStringError = 'Property \'version\' cannot be an empty string';

      const minimumDestinationsError = 'Minumum number destinations is 1';
      const nodeIdNotPresentError = 'Every destination in destinations should include nodeId';

      const errors = [];

      const {
        deletedAt,
        deletedBy,
        receivedAt,
        receivedBy,
        version,
        destinations,
      } = updateInfo;

      const totalUpdateInfoProps = keys(updateInfo).length;

      if ((deletedAt || deletedBy) && !(deletedAt && deletedBy)) errors.push(deletedAtAnddeletedByDontCoexistError);
      if ((receivedAt || receivedBy) && !(receivedAt && receivedBy)) errors.push(receivedAtAndreceivedByDontCoexistError);

      if (deletedAt) {
        if (deletedBy && totalUpdateInfoProps > 2) errors.push(deleteAtAdditionalPropertiesError);
        else if (totalUpdateInfoProps > 1) errors.push(deleteAtAdditionalPropertiesError);
      }

      if (receivedAt) {
        if (receivedBy && totalUpdateInfoProps > 2) errors.push(receivedAtAdditionalPropertiesError);
        else if (totalUpdateInfoProps > 1) errors.push(receivedAtAdditionalPropertiesError);
      }

      if (version && version === '') errors.push(versionBeingEmptyStringError);

      if (destinations) {
        if (destinations.length < 1) errors.push(minimumDestinationsError);

        const isAnyDestinationWithoutNodeId = some(destinations, (destination) => {
          if (!destination.nodeId) return true;
          return false;
        });

        if (isAnyDestinationWithoutNodeId) errors.push(nodeIdNotPresentError);
      }


      if (errors.length > 1) throw new Error(`Update request cannot be validated: ${errors.join(', ')}`);
    })
    .then(() => makeObjectModel(context).getObject(objectType, objectId))
    .then((currentObject) => getCurrentContextDetails()
      .then(({ accountId, currentNodeId }) => {
        if (currentObject.originId !== currentNodeId) throw new Error('Requested update(s) can only be made on originId nodeId');

        const updatedObject = { ...currentObject };

        const {
          deletedAt,
          deletedBy,
          receivedAt,
          receivedBy,
          version,
          destinations,
        } = updateInfo;

        updatedObject.updatedAt = new Date();

        if (deletedAt) {
          let updatableFound = false;
          updatedObject.destinations = map(updatedObject.desitnations, (destination) => {
            if (destination.nodeId === deletedBy) {
              updatableFound = true;
              const updatedDestination = destination;
              updatedDestination.deletedAt = deletedAt;
              return updatedDestination;
            }
            return destination;
          });
          if (!updatableFound) throw new Error(`Destination node cannot be found: ${deletedBy}`);
          return updatedObject;
        }

        if (receivedAt) {
          let updatableFound = false;
          updatedObject.destinations = map(updatedObject.desitnations, (destination) => {
            if (destination.nodeId === receivedBy) {
              updatableFound = true;
              const updatedDestination = destination;
              updatedDestination.receivedAt = receivedAt;
              return updatedDestination;
            }
            return destination;
          });
          if (!updatableFound) throw new Error(`Destination node cannot be found: ${deletedBy}`);
          return updatedObject;
        }

        if (version) updatedObject.version = version;

        if (!destinations) return updatedObject;

        return fetchNodes(context)
          .then((nodes) => {
            updatedObject.destinations = validateAndFormatDestinations(
              accountId, nodes, updatedObject.destinations,
            );
            return updatedObject;
          });
      }));

  return {
    validateAndPopulateNewObject,
    validateAndPopulateObjectUpdate,
    validateAndPopulateObjectUpdateInCluster,
  };
};


module.exports = makeObjectValidationHelper;
