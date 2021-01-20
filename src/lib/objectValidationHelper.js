const Promise = require('bluebird');

const {
  map, find, keys, some,
} = require('lodash');

const makeObjectModel = require('../models/objectModel');
const makeObjectCommonHelper = require('./commonHelper');

const { objectUpdateTypes } = require('../util/objectUtil');

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
      }))
    .then((object) => ({
      updateType: objectUpdateTypes.METADATA_UPDATED,
      object,
    }));

  const validateAndPopulateObjectUpdateInCluster = (objectType, objectId, updateInfo) => Promise.resolve()
    .then(() => {
      const deletedByAdditionalPropertiesError = 'Cannot declare other properties while updating deletedBy';
      const receivedByAdditionalPropertiesError = 'Cannot declare other properties while updating receivedBy';
      const isDataUpdatedAdditionalPropertiesError = 'Cannot declare other properties while updating isDataUpdated';

      const versionBeingEmptyStringError = 'Property \'version\' cannot be an empty string';

      const minimumDestinationsError = 'Minumum number destinations is 1';
      const nodeIdNotPresentError = 'Every destination in destinations should include nodeId';

      const errors = [];

      const {
        deletedBy,
        receivedBy,
        isDataUpdated,
        version,
        destinations,
      } = updateInfo;

      const totalUpdateInfoProps = keys(updateInfo).length;

      if (totalUpdateInfoProps < 1) errors.push('No property is requested to be updated');
      if (deletedBy && totalUpdateInfoProps > 1) errors.push(deletedByAdditionalPropertiesError);
      if (receivedBy && totalUpdateInfoProps > 1) errors.push(receivedByAdditionalPropertiesError);
      if (isDataUpdated && totalUpdateInfoProps > 1) errors.push(isDataUpdatedAdditionalPropertiesError);

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
    .then((currentObject) => makeObjectCommonHelper(context)
      .getCurrentContextDetails()
      .then(({ currentNodeId }) => {
        const preppedObject = { ...currentObject };
        preppedObject.updatedAt = new Date();

        const {
          deletedBy,
          receivedBy,
          isDataUpdated,
          version,
          destinations,
        } = updateInfo;

        if (receivedBy) {
          if (preppedObject.originId !== currentNodeId) throw new Error('receivedBy update can only be made at origin mess');

          let foundDest = false;
          preppedObject.destinations = map(preppedObject.destinations, (destination) => {
            if (destination.nodeId !== receivedBy) return destination;

            foundDest = true;
            const updatedDest = destination;
            updatedDest.receivedAt = new Date();
            return updatedDest;
          });

          if (!foundDest) throw new Error('Node with id in receivedBy cannot be found in destinations');
          return {
            updateType: objectUpdateTypes.NODE_RECEIVED,
            object: preppedObject,
          };
        }

        if (deletedBy) {
          if (preppedObject.originId !== currentNodeId) throw new Error('deletedBy update can only be made at origin mess');

          let foundDest = false;
          preppedObject.destinations = map(preppedObject.destinations, (destination) => {
            if (destination.nodeId !== deletedBy) return destination;

            foundDest = true;
            const updatedDest = destination;
            updatedDest.deletedAt = new Date();
            return updatedDest;
          });

          if (!foundDest) throw new Error('Node with id in deletedBy cannot be found in destinations');
          return {
            updateType: objectUpdateTypes.NODE_DELETED,
            object: preppedObject,
          };
        }

        if (version || destinations) {
          if (preppedObject.originId !== currentNodeId) throw new Error('version and destinations updates can only be made at origin mess');

          if (version) preppedObject.version = version;
          if (destinations) preppedObject.destinations = destinations;

          return {
            updateType: objectUpdateTypes.METADATA_UPDATED,
            object: preppedObject,
          };
        }

        if (isDataUpdated) {
          return {
            updateType: objectUpdateTypes.DATA_UPDATED,
            object: preppedObject,
          };
        }

        return false;
      }));

  return {
    validateAndPopulateNewObject,
    validateAndPopulateObjectUpdate,
    validateAndPopulateObjectUpdateInCluster,
  };
};


module.exports = makeObjectValidationHelper;
