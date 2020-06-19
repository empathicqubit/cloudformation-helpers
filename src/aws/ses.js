const
  utilPromisifyAll = require('util-promisifyall'),
  AWS = require('aws-sdk'),
  base = require('lib/base'),
  ses = utilPromisifyAll(new AWS.SES());
    
// Exposes the SES.createReceiptRule API method
function CreateReceiptRule(event, context) {
  base.Handler.call(this, event, context);
}
CreateReceiptRule.prototype = Object.create(base.Handler.prototype);
CreateReceiptRule.prototype.handleCreate = async function() {
  const p = this.event.ResourceProperties;
  delete p.ServiceToken;
  p.Rule.Enabled = ("true" === p.Rule.Enabled );
  p.Rule.ScanEnabled = ("true" === p.Rule.ScanEnabled );
  await ses.createReceiptRuleAsync(p);

  return {
    RuleSetName : p.RuleSetName,
    RuleName : p.Rule.Name
  };
};
CreateReceiptRule.prototype.handleDelete = async function(referenceData) {
  if (referenceData) {
    return await ses.deleteReceiptRuleAsync({
      RuleSetName : referenceData.RuleSetName,
      RuleName : referenceData.RuleName
    });
  }
};
exports.createReceiptRule = function(event, context) {
  console.log(JSON.stringify(event));
  handler = new CreateReceiptRule(event, context);
  handler.handle();
};
