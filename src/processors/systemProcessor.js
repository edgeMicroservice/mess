const includes = require('lodash/includes');

const makeRequestHelper = require('../lib/requestHelper');

const { name, version } = require('../../package.json');

const makeSystemProcessor = (context) => {
  const { runReplaysParallelly } = makeRequestHelper(context);

  const getDuktapeVersion = () => {
    const ver = Duktape.version;
    const major = Math.floor(ver / 10000);
    const minor = Math.floor((ver - (major * 10000)) / 100);
    const patch = ver - (major * 10000) - (minor * 100);
    return `${major}.${minor}.${patch}`;
  };

  const getPlatform = () => {
    const dukEnv = Duktape.env;
    if (includes(dukEnv, 'linux')) return 'Linux';

    if (includes(dukEnv, 'osx')) return 'macOS';

    if (includes(dukEnv, 'iPhone')) return 'iPhone';

    if (includes(dukEnv, 'android')) return 'Android';

    if (includes(dukEnv, 'windows')) return 'Windows';

    return 'Other';
  };

  const getHealthCheck = (swaggerInfo) => runReplaysParallelly(() => {
    const healthCheckInfo = {};
    healthCheckInfo.type = name;
    healthCheckInfo.version = version;
    healthCheckInfo.swaggerInfo = swaggerInfo;
    healthCheckInfo.duktapeVersion = getDuktapeVersion();
    healthCheckInfo.platform = getPlatform();

    return healthCheckInfo;
  });


  return {
    getHealthCheck,
  };
};

module.exports = makeSystemProcessor;
