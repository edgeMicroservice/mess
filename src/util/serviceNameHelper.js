const PROJECT_CLIENT_ID_LENGTH = 36;

const extractFromServiceType = (serviceType) => {
  const projectClientId = serviceType.substr(0, PROJECT_CLIENT_ID_LENGTH);
  const serviceNameVersion = serviceType.substr(
    PROJECT_CLIENT_ID_LENGTH + 1, serviceType.length + 1,
  );
  const serviceName = serviceNameVersion.split('-')[0];
  const serviceVersion = serviceNameVersion.split('-')[1];
  const serviceAddress = `${projectClientId}/${serviceName}/${serviceVersion}`;
  return {
    projectClientId,
    serviceNameVersion,
    serviceAddress,
    serviceName,
    serviceVersion,
  };
};

module.exports = {
  extractFromServiceType,
};
