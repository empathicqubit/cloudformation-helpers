const
    utilPromisifyAll = require('util-promisifyall'),
    AWS = require('aws-sdk'),
    base = require('lib/base'),
    helpers = require('lib/helpers'),
    dynamoDB = utilPromisifyAll(new AWS.DynamoDB());

// Exposes the SNS.subscribe API method
function PutItems(event, context) {
  base.Handler.call(this, event, context);
}
PutItems.prototype = Object.create(base.Handler.prototype);
PutItems.prototype.handleCreate = async function() {
  const p = this.event.ResourceProperties;

  const tableData = await dynamoDB.describeTableAsync({
    TableName: p.TableName
  });

  const itemsInserted = await Promise.all(
    p.Items.map(async item => {
      await dynamoDB.putItemAsync({
        TableName: p.TableName,
        Item: helpers.formatForDynamo(item, true)
      });

      const key = {};
      tableData.Table.KeySchema.forEach(function(keyMember) {
        key[keyMember.AttributeName] = item[keyMember.AttributeName];
      });

      return {
        TableName: p.TableName,
        Key: key
      };
    })
  );

  return {
    ItemsInserted: itemsInserted
  };
};
PutItems.prototype.handleDelete = async function(referenceData) {
  if (referenceData) {
    const itemsDeleted = await Promise.all(
      referenceData.itemsInserted.map(async item => {
        await dynamoDB.deleteItemAsync({
          TableName: item.TableName,
          Key: helpers.formatForDynamo(item.Key, true)
        });

        return item.Key;
      })
    );

    return {
      ItemsDeleted: itemsDeleted
    };
  }
};
exports.putItems = function(event, context) {
  handler = new PutItems(event, context);
  handler.handle();
};
