const makeClientModel = require('./tokenSelector');
const makeMDSRequests = require('../external/mDSRequests');

const { decodePayload } = require('./jwtHelper');

let currentNodeId;
let accountId;

const makeObjectCommonHelper = (context) => {
  const fetchNodes = () => makeClientModel(context).selectUserToken()
    .then((accessToken) => makeMDSRequests(context).findByAccount(accessToken));

  const getCurrentContextDetails = () => (() => {
    if (currentNodeId) return Promise.resolve();

    return makeClientModel(context).selectUserToken()
      .then((accessToken) => {
        const decodedToken = decodePayload(accessToken);

        accountId = decodedToken.sub;
        currentNodeId = decodedToken.node_id;
      });
  })()
    .then(() => ({
      accountId,
      currentNodeId,
    }));

  return {
    fetchNodes,
    getCurrentContextDetails,
  };
};

module.exports = makeObjectCommonHelper;
