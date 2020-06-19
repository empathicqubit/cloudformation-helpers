const
  utilPromisifyAll = require('util-promisifyall'),
  AWS = require('aws-sdk'),
  base = require('lib/base'),
  apiGateway = utilPromisifyAll(new AWS.APIGateway());

// Exposes the SNS.subscribe API method
function CreateApi(event, context) {
  base.Handler.call(this, event, context);
}
CreateApi.prototype = Object.create(base.Handler.prototype);
CreateApi.prototype.handleCreate = async function() {
  const p = this.event.ResourceProperties;
  const apiData = await apiGateway.createRestApiAsync({
    name: p.name,
    description: p.description
  });
  await this.setReferenceData({ restApiId: apiData.id }); // Set this immediately, in case later calls fail
  const resourceData = await apiGateway.getResourcesAsync({
    restApiId: apiData.id
  });
  await setupEndpoints(p.endpoints, resourceData.items[0].id, apiData.id);
  await apiGateway.createDeploymentAsync({
    restApiId: apiData.id,
    stageName: p.version
  });
  // Total hack: there are limits to the number of API Gateway API calls you can make. So this function
  // will fail if a CloudFormation template includes two or more APIs. Attempting to avoid this by blocking.
  const until = new Date();
  until.setSeconds(until.getSeconds() + 60);
  while (new Date() < until) {
    // Wait...
  }
  // AWS.config.region is a bit of a hack, but I can't figure out how else to dynamically
  // detect the region of the API - seems to be nothing in API Gateway or AWS Lambda context.
  // Could possibly get it from the CloudFormation stack, but that seems wrong.
  return {
    baseUrl: "https://" + apiData.id + ".execute-api." + AWS.config.region + ".amazonaws.com/" + p.version,
    restApiId: apiData.id
  };
};
CreateApi.prototype.handleDelete = async function(referenceData) {
  if (referenceData && referenceData.restApiId) {
    // Can simply delete the entire API - don't need to delete each individual component
    return await apiGateway.deleteRestApiAsync({
      restApiId: referenceData.restApiId
    });
  }
};
async function setupEndpoints(config, parentResourceId, restApiId) {
  return await Promise.all(
    Object.keys(config).map(async key => {
      switch (key.toUpperCase()) {
        case 'GET':
        case 'HEAD':
        case 'DELETE':
        case 'OPTIONS':
        case 'PATCH':
        case 'POST':
        case 'PUT':
          const params = config[key];
          params["httpMethod"] = key.toUpperCase();
          params["resourceId"] = parentResourceId;
          params["restApiId"] = restApiId;
          params["apiKeyRequired"] = params["apiKeyRequired"] == "true"; // Passing through CloudFormation, booleans become strings :/
          const integration = params["integration"];
          delete params.integration;
          await apiGateway.putMethodAsync(params);
          if (integration) {
            const contentType = integration["contentType"];
            if (!contentType) {
              throw "Integration config must include response contentType.";
            }
            delete integration.contentType;
            integration["httpMethod"] = key.toUpperCase();
            integration["resourceId"] = parentResourceId;
            integration["restApiId"] = restApiId;
            apiGateway.putIntegrationAsync(integration);
            const responseContentTypes = {};
            responseContentTypes[contentType] = "Empty";
            await apiGateway.putMethodResponseAsync({
              httpMethod: key.toUpperCase(),
              resourceId: parentResourceId,
              restApiId: restApiId,
              statusCode: '200',
              responseModels: responseContentTypes
            });
            responseContentTypes[contentType] = "";
            return await apiGateway.putIntegrationResponseAsync({
              httpMethod: key.toUpperCase(),
              resourceId: parentResourceId,
              restApiId: restApiId,
              statusCode: '200',
              responseTemplates: responseContentTypes
            });
          }
          else {
            return;
          }
        default:
          const resourceData = await apiGateway.createResourceAsync({
            parentId: parentResourceId,
            pathPart: key,
            restApiId: restApiId,
          });
          return await setupEndpoints(config[key], resourceData.id, restApiId);
      }
    })
  );
}
exports.createApi = function(event, context) {
  handler = new CreateApi(event, context);
  handler.handle();
};
