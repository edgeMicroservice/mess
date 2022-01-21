const merge = require('lodash/merge');
const filter = require('lodash/filter');

const { extractFromServiceType } = require('../util/serviceNameHelper');
const { rpAuth, getEdgeServiceLinkByNodeId } = require('../lib/auth-helper');

const makeClientModel = require('../lib/tokenSelector');

const makeMESSRequests = (context) => {
  const request = (nodeId, requestOptions) => makeClientModel(context).selectUserToken()
    .then((accessToken) => {
      const { serviceType } = context.info;
      const { serviceName } = extractFromServiceType(serviceType);

      return getEdgeServiceLinkByNodeId(nodeId, serviceType, accessToken, context)
        .then((serviceLink) => {
          const updatedRequestOptions = merge(requestOptions, serviceLink);
          updatedRequestOptions.url = `${updatedRequestOptions.url}${requestOptions.endpoint}`;

          return rpAuth(serviceName, updatedRequestOptions, context);
        });
    });

  const getObjects = (nodeId, destinationNodeId, dataUpdatedAfter, metadataUpdatedAfter) => {
    const requestOptions = {
      endpoint: '/objects',
      method: 'GET',
      qs: {},
    };

    if (dataUpdatedAfter) requestOptions.qs.dataUpdatedAfter = dataUpdatedAfter;
    if (destinationNodeId) requestOptions.qs.destinationNodeId = destinationNodeId;
    if (metadataUpdatedAfter) requestOptions.qs.metadataUpdatedAfter = metadataUpdatedAfter;

    return request(nodeId, requestOptions)
      .then(({ data }) => data);
  };

  const createObjectInCluster = (nodeId, object) => {
    const requestOptions = {
      endpoint: '/cluster/objects',
      method: 'POST',
      body: {
        id: object.id,
        type: object.type,
        version: object.version,
        destinations: filter(object.destinations, (dest) => dest.nodeId === nodeId),
        originId: object.originId,
        createdAt: object.createdAt,
      },
    };

    return request(nodeId, requestOptions);
  };

  const updateObjectDataInCluster = (nodeId, object) => {
    const requestOptions = {
      endpoint: `/cluster/objects/${object.type}/${object.id}`,
      method: 'PUT',
      body: {
        isDataUpdated: true,
      },
    };

    return request(nodeId, requestOptions);
  };

  const updateObjectMetadataInCluster = (nodeId, object) => {
    const requestOptions = {
      endpoint: `/cluster/objects/${object.type}/${object.id}`,
      method: 'PUT',
      body: {
        version: object.version,
        labels: object.labels,
        attributes: object.attributes,
        destinations: object.destinations,
        mimeType: object.mimeType,
      },
    };

    return request(nodeId, requestOptions);
  };

  const deleteObjectInCluster = (nodeId, object) => {
    const requestOptions = {
      endpoint: `/cluster/objects/${object.type}/${object.id}`,
      method: 'DELETE',
    };

    return request(nodeId, requestOptions);
  };

  const markReceivalFailed = (currentNodeId, nodeId, object) => {
    const requestOptions = {
      endpoint: `/cluster/objects/${object.type}/${object.id}`,
      method: 'PUT',
      body: {
        receivalFailedBy: currentNodeId,
      },
    };

    return request(nodeId, requestOptions);
  };

  return {
    getObjects,
    createObjectInCluster,
    updateObjectDataInCluster,
    updateObjectMetadataInCluster,
    deleteObjectInCluster,
    markReceivalFailed,
  };
};

module.exports = makeMESSRequests;
