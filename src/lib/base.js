// Implement this class for every new handler.

const
  utilPromisifyAll = require('util-promisifyall'),
  helpers = require('lib/helpers'),
  response = require('lib/cfn-response'),
  AWS = require('aws-sdk'),
  dynamoDB = utilPromisifyAll(new AWS.DynamoDB());

exports.Handler = function(event, context) {
  this.event = event;
  this.context = context;
};

exports.Handler.prototype.handle = async function() {
  try {
    let data;
    let referenceData;
    switch (this.event.RequestType) {
      case 'Create':
        const created = await this.handleCreate();
        await this.setReferenceData(created);
        data = created;
        break;
      case 'Delete':
        referenceData = await this.getReferenceData();
        data = await this.handleDelete(referenceData);
        break;
      case 'Update':
        await this.getReferenceData();
        data = await this.handleUpdate();
        break;
      default:
        throw "Unrecognized RequestType [" + this.event.RequestType + "]";
    }

    response.send(this.event, this.context, response.SUCCESS, data);
  }
  catch(err) {
    this.error(err);
  }
};

/*
  When implemented, these should all return a Promise, which will then be completed by the handle()
  method above.

  NB: These methods are named 'handle*' because 'delete' is a reserved word in Javascript and
      can't be overridden. To ensure naming parity, they have been named with the 'handle' prefix.
*/
exports.Handler.prototype.handleCreate = function() {
  throw "create method not implemented";
};

// eslint-disable-next-line no-unused-vars
exports.Handler.prototype.handleDelete = function(referenceData) {
  throw "delete method not implemented";
};

exports.Handler.prototype.handleUpdate = async function(referenceData) {
  await this.handleDelete(referenceData);
  return await this.handleCreate();
};

exports.Handler.prototype.error = function(message) {
  console.error(message);
  response.send(this.event, this.context, response.FAILED, { Error: message });
  throw message;
};

exports.Handler.prototype.getStackName = function() {
  const functionName = this.context.functionName;
  // Assume functionName is: stackName-resourceLogicalId-randomString.
  // Per http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resources-section-structure.html,
  // resourceLogicalId cannot include a '-'; randomString seems to also be alphanumeric.
  // Thus it seems safe to search for the two dashes in order to find the stackName.
  const i = functionName.lastIndexOf("-", functionName.lastIndexOf("-") - 1);
  if (i >= 0)
    return functionName.substr(0, i);
  else
    return functionName;
};

exports.Handler.prototype.getReferenceData = async function() {
  const data = await dynamoDB.getItemAsync(
    {
      TableName: this.getStackName() + "-reference",
      Key: helpers.formatForDynamo({
        key: this.event.StackId + this.event.LogicalResourceId
      }, true)
    }
  );

  const formattedData = helpers.formatFromDynamo(data);
  if (formattedData && formattedData.Item && formattedData.Item.value)
    return formattedData.Item.value;
  else
    return null;
};

exports.Handler.prototype.setReferenceData = async function(data) {
  return await dynamoDB.putItemAsync(
    {
      TableName: this.getStackName() + "-reference",
      Item: helpers.formatForDynamo({
        key: this.event.StackId + this.event.LogicalResourceId,
        value: data
      }, true)
    }
  );
};