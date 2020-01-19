const StellarSdk = require('stellar-sdk')
const server = new StellarSdk.Server('https://horizon-testnet.stellar.org')

const AWS = require('aws-sdk')
const config = {
  endpoint: 'http://dynamodb:8000',
  region: 'ap-northeast',
  accessKeyId: 'fakeAccessKeyId',
  secretAccessKey: 'fakeSecretAccessKey'
}
AWS.config.update(config)
const ddb = new AWS.DynamoDB.DocumentClient()

exports.handler = (event, context, callback) => {
  const arg = JSON.parse(event.body)
  const params = {
    TableName: 'address',
    Key: {id: arg.id}
  }
  ddb.get(params, (err, data)=>{
    if (err) console.log(err)
    else {
      const receiverSecretKey = data.Item.secKey
      const receiverPublicKey = data.Item.pubKey
      const receiverKeypair = StellarSdk.Keypair.fromSecret(receiverSecretKey)
      const myToken = new StellarSdk.Asset(arg.coin, 'GBBUBNHY6FUHAGJWPWIZ5DFVB2FUJJCJZAWUOOLTXTN6CJMXKGR4Z5E6');

      (async function main() {
        const receiver = await server.loadAccount(receiverPublicKey)
        const fee = await server.fetchBaseFee();
        const trustTx = new StellarSdk.TransactionBuilder(receiver, {
                fee,
                networkPassphrase: StellarSdk.Networks.TESTNET
            }).addOperation(StellarSdk.Operation.changeTrust({
                asset: myToken
            })).setTimeout(30).build();
      
        trustTx.sign(receiverKeypair);
      
        try {
            const trustTxResult = await server.submitTransaction(trustTx);
            console.log(JSON.stringify(trustTxResult, null, 2));
            console.log('\nSuccess! View the transaction at: ');
            console.log(trustTxResult._links.transaction.href);
            const param = {
              TableName: 'address',
              Key: {id: arg.id},
              ExpressionAttributeNames: {'#a': arg.coin},
              ExpressionAttributeValues: {':newAddress': 'true'},
              UpdateExpression: 'SET #a = :newAddress'
            }
            ddb.update(param, (err, data) => {
              if (err) console.log(err)
              else {
                console.log("updated successfully!!")
              }
            })
        } catch (e) {
            console.log('An error has occured:');
            console.log(e);
        }
      })();
    }
  })
}

