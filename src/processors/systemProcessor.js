const includes = require('lodash/includes');

const { name, version } = require('../../package.json');

function getDuktapeVersion() {
  const ver = Duktape.version;
  const major = Math.floor(ver / 10000);
  const minor = Math.floor((ver - (major * 10000)) / 100);
  const patch = ver - (major * 10000) - (minor * 100);
  return `${major}.${minor}.${patch}`;
}

function getPlatform() {
  const dukEnv = Duktape.env;
  if (includes(dukEnv, 'linux')) {
    return 'Linux';
  }
  if (includes(dukEnv, 'osx')) {
    return 'macOS';
  }

  if (includes(dukEnv, 'iPhone')) {
    return 'iPhone';
  }

  if (includes(dukEnv, 'android')) {
    return 'Android';
  }

  if (includes(dukEnv, 'windows')) {
    return 'Windows';
  }

  return 'Other';
}

function getHealthCheckInfo(req) {
  const json = {};
  json.data = {};
  json.data.type = name;
  json.data.version = version;
  json.data.swaggerInfo = req.swagger.info;
  json.data.duktapeVersion = getDuktapeVersion();
  json.data.platform = getPlatform();

  return json;
}

module.exports = {
  getHealthCheckInfo,
};
