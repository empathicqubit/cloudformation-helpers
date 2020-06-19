const
    utilPromisifyAll = require('util-promisifyall'),
    AWS = require('aws-sdk'),
    base = require('lib/base'),
    kinesis = utilPromisifyAll(new AWS.Kinesis());

// Exposes the SNS.subscribe API method
function CreateStream(event, context) {
  base.Handler.call(this, event, context);
}
CreateStream.prototype = Object.create(base.Handler.prototype);
CreateStream.prototype.handleCreate = async function() {
  const p = this.event.ResourceProperties;
  delete p.ServiceToken;
  p.ShardCount = parseInt(p.ShardCount);
  await kinesis.createStreamAsync(p);
  const arn = await waitWhileStatus(p.StreamName, "CREATING");
  return {
    StreamName: p.StreamName,
    Arn: arn
  };
};
// eslint-disable-next-line no-unused-vars
CreateStream.prototype.handleDelete = async function(referenceData) {
  try {
    const p = this.event.ResourceProperties;
    await kinesis.deleteStreamAsync({StreamName: p.StreamName});
    return await waitWhileStatus(p.StreamName, "DELETING");
  }
  catch(err) {
    return err;
  }
};
exports.createStream = function(event, context) {
  handler = new CreateStream(event, context);
  handler.handle();
};
// Watch until the given status is no longer the status of the stream.
async function waitWhileStatus(streamName, status) {
  const validStatuses = ["CREATING", "DELETING", "ACTIVE", "UPDATING"];
  if (validStatuses.indexOf(status) >= 0) {
    const data = await kinesis.describeStreamAsync({StreamName: streamName});

    console.log("Current status for [" + streamName +"]: " + data.StreamDescription.StreamStatus);
    if (data.StreamDescription.StreamStatus == status) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return await waitWhileStatus(streamName, status);
    } else {
      return data.StreamDescription.StreamARN;
    }
  } else {
    throw "status [" + status + "] not one of [" + validStatuses.join(", ") + "]";
  }
}