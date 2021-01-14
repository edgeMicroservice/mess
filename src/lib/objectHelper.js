const merge = require('lodash/merge');

const { ParameterError } = require('@mimik/edge-ms-helper/error-helper');

const makeClientModel = require('../lib/tokenSelector');
const makeMCMRequests = require('../external/mCMRequests');

const { decodePayload } = require('./jwtHelper');

const { extractFromServiceType } = require('../util/serviceNameHelper');
const { rpAuth, getEdgeServiceLinkByNodeId } = require('../lib/auth-helper');

const makeObjectHelper = (context) => {
  const validateAndInitializeNewObject = (newObject) => {
    const { findByAccount } = makeMCMRequests(context);
    const { selectUserToken } = makeClientModel(context);

    const updatedNewObject = {
      hasData: false,
      updatedAt: new Date(),
      createdAt: new Date(),
      ...newObject,
    };

    if (updatedNewObject.isValidated) {
      return updatedNewObject;
    }

    if (updatedNewObject.version === '') throw new ParameterError('version cannot be an empty string');

    const validateAndFormatDestinations = (accountId, nodes, destinations) => {
      const unfoundDestinationNodeIds = [];

      const verifiedAndFormattedDestinations = destinations.map((destination) => {
        const requestedNodeId = destination.nodeId;

        const foundDestNode = nodes.find((node) => {
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

    const validateAndDecideOriginId = (accountId, nodes, currentNodeId, originId) => {
      if (originId) {
        const foundOriginNode = nodes.find((node) => {
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

    return selectUserToken()
      .then((accessToken) => findByAccount(accessToken).then((nodes) => {
        const decodedToken = decodePayload(accessToken);
        const accountId = decodedToken.sub;
        const currentNodeId = decodedToken.node_id;

        updatedNewObject.originId = validateAndDecideOriginId(accountId, nodes, updatedNewObject.destinations);
        updatedNewObject.destinations = validateAndFormatDestinations(accountId, nodes, currentNodeId, updatedNewObject.originId, true);
        updatedNewObject.isValidated = true;

        return updatedNewObject;
      }));
  };

  const notifyNewObjectDestinations = (newObject) => {
    const { serviceType } = context.info;
    const { destinations } = newObject;

    const { selectUserToken } = makeClientModel(context);

    const { serviceName } = extractFromServiceType(serviceType);

    const notifyNewObjectToDestinations = (nodeId, accessToken, requestOptions) => getEdgeServiceLinkByNodeId(nodeId, serviceType, accessToken, context)
      .then((serviceLink) => {
        const updatedRequestOptions = merge(requestOptions, serviceLink);
        updatedRequestOptions.url = `${updatedRequestOptions.url}${requestOptions.endpoint}`;

        return rpAuth(serviceName, updatedRequestOptions, context);
      });

    return selectUserToken()
      .then((accessToken) => {
        const decodedToken = decodePayload(accessToken);
        const currentNodeId = decodedToken.node_id;

        const requestOptions = {
          endpoint: '/objects',
          method: 'POST',
          body: {
            id: newObject.id,
            type: newObject.type,
            version: newObject.version,
            isValidated: true,
            originId: newObject.originId,
          },
        };

        return Promise.map(destinations, (destination) => {
          if (currentNodeId === destination.nodeId) return undefined;

          return notifyNewObjectToDestinations(destination.nodeId, accessToken, requestOptions)
            .catch((error) => {
              console.log('===> notifyNewObjectToDestinations error', error);
              // TODO update logging
            });
        });
      });
  };

  return {
    validateAndInitializeNewObject,
    notifyNewObjectDestinations,
  };
};

module.exports = makeObjectHelper;
