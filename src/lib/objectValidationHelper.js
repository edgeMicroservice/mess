const Promise = require('bluebird');

const map = require('lodash/map');
const find = require('lodash/find');
const keys = require('lodash/keys');
const some = require('lodash/some');
const pickBy = require('lodash/pickBy');
const identity = require('lodash/identity');

const makeObjectModel = require('../models/objectModel');
const makeObjectCommonHelper = require('./commonHelper');

const {
  objectServiceRoles,
  defaultMimeType,
  objectClusterUpdateTypes,
  maximumLabels,
  maximumAttributes,
  maximumTotalLabelsLength,
  maximumTotalAttributesLength,
} = require('../util/objectUtil');

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

  const validateAndFormatAttributesOrLabels = (unformatted, type, maxNumber, maxLength) => {
    let formatted = {};

    if (!unformatted) throw new Error(`value of '${type}' cannot be undefined`);

    if (typeof unformatted === 'object') formatted = unformatted;
    else {
      try {
        formatted = JSON.parse(unformatted);
      } catch (e) {
        throw new Error(`value of '${type}' cannot be converted to json object`);
      }
    }

    formatted = pickBy(formatted, identity);

    const totalProperties = keys(formatted).length;
    if (totalProperties > maxNumber) {
      throw new Error(`value of '${type}' cannot have more than ${maxNumber} of properites, current: ${totalProperties}`);
    }

    const formattedStrLen = JSON.stringify(formatted).length;
    if (formattedStrLen > maxLength) {
      throw new Error(`value of '${type}' cannot have stringified length of more than ${maxLength}, current: ${formattedStrLen}`);
    }

    keys(formatted).forEach((key) => {
      const value = formatted[key];
      if (typeof value === 'object') throw new Error(`value of '${type}' cannot contain objects, incorrect value: { "${key}": "${value}" }`);
    });

    return formatted;
  };

  const validateAndFormatVersion = (version) => {
    if (version === '') throw new Error('version cannot be an empty string');
    return version;
  };

  const validateAndFormatMimeType = (mimeType) => {
    if (mimeType === '') throw new Error('mimeType cannot be an empty string');
    return mimeType;
  };

  const validateOrDecideOriginId = (accountId, nodes, currentNodeId, originId) => {
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

  const validateAndFormatCommon = (object) => {
    const updatedObject = object;
    if (updatedObject.version) updatedObject.version = validateAndFormatVersion(updatedObject.version);
    if (updatedObject.mimeType) updatedObject.mimeType = validateAndFormatMimeType(updatedObject.mimeType);

    if (updatedObject.attributes) {
      updatedObject.attributes = validateAndFormatAttributesOrLabels(
        updatedObject.attributes, 'attributes', maximumAttributes, maximumTotalAttributesLength,
      );
    }

    if (updatedObject.labels) {
      updatedObject.labels = validateAndFormatAttributesOrLabels(
        updatedObject.labels, 'labels', maximumLabels, maximumTotalLabelsLength,
      );
    }

    return updatedObject;
  };

  const validateAndPopulateNewObject = (newObject) => {
    const updatedNewObject = {
      updatedAt: new Date(),
      createdAt: new Date(),
      ...validateAndFormatCommon(newObject),
    };

    return fetchNodes()
      .then((nodes) => getCurrentContextDetails()
        .then(({ accountId, currentNodeId }) => {
          updatedNewObject.originId = validateOrDecideOriginId(accountId, nodes, currentNodeId, updatedNewObject.originId);
          updatedNewObject.destinations = validateAndFormatDestinations(accountId, nodes, updatedNewObject.destinations);

          updatedNewObject.mimeType = updatedNewObject.mimeType || defaultMimeType;

          return updatedNewObject;
        }));
  };

  const validateAndFormatObjectUpdateData = (updateInfo, isCluster) => Promise.resolve()
    .then(() => {
      const isDataUpdatedAdditionalPropertiesError = 'Cannot declare other properties while updating isDataUpdated';
      const receivalFailedByAdditionalPropertiesError = 'Cannot declare other properties while updating receivalFailedBy';

      const minimumDestinationsError = 'Minumum number destinations is 1';
      const nodeIdNotPresentError = 'Every destination in destinations should include nodeId';

      const errors = [];

      const formattedUpdateInfo = validateAndFormatCommon(updateInfo);

      const {
        receivalFailedBy,
        isDataUpdated,
        destinations,
      } = formattedUpdateInfo;

      const totalUpdateInfoProps = keys(formattedUpdateInfo).length;

      if (totalUpdateInfoProps < 1) errors.push('No property is requested to be updated');
      if (isCluster && isDataUpdated && totalUpdateInfoProps > 1) errors.push(isDataUpdatedAdditionalPropertiesError);
      if (isCluster && receivalFailedBy && totalUpdateInfoProps > 1) errors.push(receivalFailedByAdditionalPropertiesError);

      if (destinations) {
        if (destinations.length < 1) errors.push(minimumDestinationsError);

        const isAnyDestinationWithoutNodeId = some(destinations, (destination) => {
          if (!destination.nodeId) return true;
          return false;
        });

        if (isAnyDestinationWithoutNodeId) errors.push(nodeIdNotPresentError);
      }

      if (errors.length > 1) throw new Error(`Update request cannot be validated: ${errors.join(', ')}`);
      return Promise.resolve(formattedUpdateInfo);
    });

  const validateAndPopulateObjectUpdate = (objectType, objectId, updateInfo) => validateAndFormatObjectUpdateData(updateInfo)
    .then((formattedUpdateInfo) => makeObjectModel(context).getObject(objectType, objectId)
      .then((currentObject) => getCurrentContextDetails()
        .then(({ accountId, currentNodeId }) => {
          if (currentObject.originId !== currentNodeId) throw new Error('Requested update(s) can only be made on originId nodeId');

          const updatedObject = { ...currentObject, ...formattedUpdateInfo };
          updatedObject.updatedAt = new Date();

          if (!formattedUpdateInfo.destinations) return updatedObject;

          return fetchNodes(context)
            .then((nodes) => {
              updatedObject.destinations = validateAndFormatDestinations(
                accountId, nodes, updatedObject.destinations,
              );
              return updatedObject;
            });
        })));

  const validateAndPopulateObjectUpdateInCluster = (objectType, objectId, updateInfo) => validateAndFormatObjectUpdateData(updateInfo, true)
    .then((formattedUpdateInfo) => makeObjectModel(context).getObject(objectType, objectId)
      .then((currentObject) => {
        const preppedObject = { ...currentObject, ...formattedUpdateInfo };
        preppedObject.updatedAt = new Date();

        const {
          version, destinations, mimeType, labels, attributes,
          isDataUpdated, receivalFailedBy,
        } = formattedUpdateInfo;

        if (receivalFailedBy) {
          if (preppedObject.serviceRole !== objectServiceRoles.ORIGIN) {
            throw new Error('receivalFailedBy update can only be made at origin mess');
          }

          let foundDest = false;
          preppedObject.destinations = map(preppedObject.destinations, (destination) => {
            if (destination.nodeId !== receivalFailedBy) return destination;

            foundDest = true;
            const updatedDest = destination;
            updatedDest.receivedAt = undefined;
            return updatedDest;
          });

          if (!foundDest) throw new Error('Node with id in receivalFailedBy cannot be found in destinations');
          return {
            updateType: objectClusterUpdateTypes.RECEIVAL_FAILED,
            objectUpdate: preppedObject,
          };
        }

        if (isDataUpdated) {
          if (preppedObject.serviceRole !== objectServiceRoles.DESTINATION) {
            throw new Error('isDataUpdated update can only be made at destination mess');
          }

          return {
            updateType: objectClusterUpdateTypes.DATA_UPDATED,
            objectUpdate: preppedObject,
          };
        }

        if (version || destinations || mimeType || labels || attributes) {
          return {
            updateType: objectClusterUpdateTypes.METADATA_UPDATED,
            objectUpdate: preppedObject,
          };
        }

        return undefined;
      }));

  return {
    validateAndPopulateNewObject,
    validateAndPopulateObjectUpdate,
    validateAndPopulateObjectUpdateInCluster,
  };
};


module.exports = makeObjectValidationHelper;
