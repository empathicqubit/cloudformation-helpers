const 
  utilPromisifyAll = require('util-promisifyall'),
  AWS = require('aws-sdk'),
  base = require('lib/base'),
  sns = utilPromisifyAll(new AWS.SNS());

// Exposes the SNS.subscribe API method
function Subscribe(event, context) {
  base.Handler.call(this, event, context);
}
Subscribe.prototype = Object.create(base.Handler.prototype);
Subscribe.prototype.handleCreate = async function() {
  const p = this.event.ResourceProperties;
  return await sns.subscribeAsync({
    Endpoint: p.Endpoint,
    Protocol: p.Protocol,
    TopicArn: p.TopicArn
  });
};
Subscribe.prototype.handleDelete = async function(referenceData) {
  if (referenceData && referenceData.SubscriptionArn) {
    return await sns.unsubscribeAsync({
      SubscriptionArn: referenceData.SubscriptionArn
    });
  }
};
exports.subscribe = function(event, context) {
  handler = new Subscribe(event, context);
  handler.handle();
};
