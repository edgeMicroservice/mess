const Promise = require('bluebird');
const { map, find } = require('lodash');

const ADDRESS_TYPE = {
  PUBLIC: 'public',
  PROXY: 'proxy',
  LOCAL: 'local',
};

const CLUSTER_DISCOVERY_TAG = {
  ACCOUNT: 'account',
};

let findByAccountResult;

const makeMDSRequests = (context) => {
  const { edge } = context;

  const populateUrl = (node) => {
    const pub = find(node.addresses, (addr) => addr.type === ADDRESS_TYPE.PUBLIC);
    const proxy = find(node.addresses, (addr) => addr.type === ADDRESS_TYPE.PROXY);
    const local = find(node.addresses, (addr) => addr.type === ADDRESS_TYPE.LOCAL);
    let url;

    if (pub && pub.url && pub.url.href && pub.url.href.startsWith('https://')) {
      url = pub.url.href;
    } else if (proxy) {
      url = undefined;
    } else {
      url = local.url.href;
    }

    return { ...node, url };
  };

  const clusterDiscovery = (type, accessToken) => new Promise((resolve, reject) => {
    edge.clusterDiscovery(
      type,
      accessToken,
      (nodes) => { resolve(nodes); },
      (err) => { reject(err); },
    );
  });

  const findByAccount = (accessToken) => {
    if (findByAccountResult) return Promise.resolve(findByAccountResult);

    return clusterDiscovery(
      CLUSTER_DISCOVERY_TAG.ACCOUNT, accessToken,
    )
      .then((data) => map(data.nodes, (node) => populateUrl(node)))
      .then((result) => {
        findByAccountResult = result;
        return result;
      });
  };

  return {
    findByAccount,
  };
};

module.exports = makeMDSRequests;
