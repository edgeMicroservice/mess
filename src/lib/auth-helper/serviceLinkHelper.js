const find = require('lodash/find');
const Base64 = require('Base64');

const makeMDSRequests = require('../../external/mDSRequests');
const { extractFromServiceType } = require('../../util/serviceNameHelper');

const ADDRESS_TYPE = {
  PUBLIC: 'public',
  PROXY: 'proxy',
  LOCAL: 'local',
};

const getEdgeServiceLinkByNodeId = (nodeId, serviceType, edgeAccessToken, ctx) => {
  const getNodeLink = (currentNode, targetNode) => {
    if (currentNode.localLinkNetworkId === targetNode.localLinkNetworkId) {
      const nodeAddress = find(
        targetNode.addresses, (address) => address.type === ADDRESS_TYPE.LOCAL,
      );
      if (!nodeAddress) throw new Error(`cannot found local address for target node: ${nodeId}`);
      return {
        url: nodeAddress.url.href,
      };
    }

    const proxyAddress = find(
      targetNode.addresses, (address) => address.type === ADDRESS_TYPE.PROXY,
    );
    if (!proxyAddress) throw new Error(`cannot find proxy address for target node: ${nodeId}`);
    const routingHeader = Base64.btoa(JSON.stringify({
      nodeId: targetNode.id,
      localLinkNetworkId: targetNode.localLinkNetworkId,
    }));
    return {
      url: proxyAddress.url.href,
      headers: {
        'x-mimik-routing': routingHeader,
        'x-mimik-port': proxyAddress.routingPort,
      },
    };
  };

  const appendServiceUrl = (nodeLink, targetNode, srvcType) => {
    const updatedLink = nodeLink;
    const selectedService = find(
      targetNode.services, (service) => service.serviceType === srvcType,
    );
    if (!selectedService) throw new Error(`cannot create cluster operation. serviceType: ${serviceType} cannot be found, on nodeId: ${targetNode.id}`);
    let serviceAddress;
    if (selectedService.self) serviceAddress = selectedService.self;
    else {
      const { serviceAddress: srvcAdd } = extractFromServiceType(srvcType);
      serviceAddress = srvcAdd;
    }
    const nodeUrl = updatedLink.url;
    updatedLink.url = ((nodeUrl.substr(nodeUrl.length - 1, nodeUrl.length) === '/')
      || (serviceAddress.substr(0, 1) === '/'))
      ? `${nodeUrl}${serviceAddress}` : `${nodeUrl}/${serviceAddress}`;
    return updatedLink;
  };

  return makeMDSRequests(ctx)
    .findByAccount(edgeAccessToken)
    .then((nodes) => {
      const targetNode = find(nodes, (node) => node.id === nodeId);
      if (!targetNode) throw new Error(`target node with id: ${nodeId} cannot be found`);

      const currentNode = find(nodes, (node) => node.id === ctx.info.nodeId);
      if (!currentNode) throw new Error(`current node with id: ${ctx.info.nodeId} cannot be found`);

      const nodeLink = getNodeLink(currentNode, targetNode);
      const serviceLink = appendServiceUrl(nodeLink, targetNode, serviceType);

      return serviceLink;
    });
};


module.exports = {
  getEdgeServiceLinkByNodeId,
};
