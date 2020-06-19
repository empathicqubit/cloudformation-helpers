const
    utilPromisifyAll = require('util-promisifyall'),
    AWS = require('aws-sdk'),
    base = require('lib/base'),
    s3 = utilPromisifyAll(new AWS.S3());

// Exposes the SNS.subscribe API method
function PutObject(event, context) {
  base.Handler.call(this, event, context);
}
PutObject.prototype = Object.create(base.Handler.prototype);
PutObject.prototype.handleCreate = async function() {
  const p = this.event.ResourceProperties;
  delete p.ServiceToken;
  return await s3.putObjectAsync(p);
};
// eslint-disable-next-line no-unused-vars
PutObject.prototype.handleDelete = async function(referenceData) {
  const p = this.event.ResourceProperties;
  if (p.Key.endsWith("/")) {
    const subObjects = await s3.listObjectsAsync({
      Bucket: p.Bucket,
      Prefix: p.Key
    });

    await Promise.all(
      subObjects.Contents.map(async item => {
        return await s3.deleteObjectAsync({
          Bucket: p.Bucket,
          Key: item.Key
        });
      })
    );
  }

  return s3.deleteObjectAsync({
    Bucket: p.Bucket,
    Key: p.Key
  });
};
exports.putObject = function(event, context) {
  handler = new PutObject(event, context);
  handler.handle();
};

// Exposes the S3.putBucketPolicy API method
function PutBucketPolicy(event, context) {
  base.Handler.call(this, event, context);
}
PutBucketPolicy.prototype = Object.create(base.Handler.prototype);
PutBucketPolicy.prototype.handleCreate = async function() {
  const p = this.event.ResourceProperties;
  delete p.ServiceToken;
  await s3.putBucketPolicyAsync(p);

  return {
    BucketName : p.Bucket
  };
};
PutBucketPolicy.prototype.handleDelete = async function(referencedData) {
  if(referencedData) {
    return await s3.deleteBucketPolicyAsync({
      Bucket : referencedData.BucketName
    });
  }
};
exports.putBucketPolicy = function(event, context) {
  console.log(JSON.stringify(event));
  handler = new PutBucketPolicy(event, context);
  handler.handle();
};

