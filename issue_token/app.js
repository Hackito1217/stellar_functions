const AWS = require('aws-sdk')
const config = {
  endpoint: 'http://dynamodb:8000',
  region: 'ap-northeast-1',
  accessKeyId: 'fakeAccessKeyId',
  secretAccessKey: 'fakeSecretAccessKey'
}
AWS.config.update(config)
const ddb = new AWS.DynamoDB.DocumentClient()

const StellarSdk = require('stellar-sdk')
const server = new StellarSdk.Server('https://horizon-testnet.stellar.org')

exports.handler = (event, context, callback) => {
  const args = JSON.parse(event.body)
  const params = {
    TableName: 'address',
    Key: {id: args.distributor}
  }
  ddb.get(params, (err, data) => {
    if (err) console.log(err)
    else {
      console.log(JSON.stringify(data.Item))
      if (data.Item[args.coin] === undefined) console.log(`distributor doesn't have trust for ${args.coin}`)
      else {
        const senderSec = "SBX2DM6P2XWBWIPLU7JG2YKBUKA6Q6EFXVPVBI6L4CADSG54NZDRWTJH"
        const senderKeypair = StellarSdk.Keypair.fromSecret(senderSec)
        const senderPub = senderKeypair.publicKey()
        const serviceToken = new StellarSdk.Asset(args.coin, senderPub)
        const memo = `token issue : ${args.coin}`;

        (async function main(){
          const sender = await server.loadAccount(senderPub)
          const fee = await server.fetchBaseFee()
          const transaction = new StellarSdk.TransactionBuilder(sender, {
            fee,
            networkPassphrase: StellarSdk.Networks.TESTNET
          })
          .addOperation(StellarSdk.Operation.payment({
            destination: data.Item.pubKey,
            asset: serviceToken,
            amount: String(100000000)
          }))
          .setTimeout(30)
          .addMemo(StellarSdk.Memo.text(memo))
          .build();
          transaction.sign(senderKeypair)

          try {
            const transactionResult = await server.submitTransaction(transaction);
            console.log(JSON.stringify(transactionResult, null, 2));
            console.log('\nSuccess! View the transaction at: ');
            console.log(transactionResult._links.transaction.href);
          } catch (e) {
            console.log('An error has occured:');
            console.log(e);
          }
        })()
      }
    }
  })
}