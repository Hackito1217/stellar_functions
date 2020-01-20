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
            const p1 = {
              TableName: 'seq',
              Key: {id: 0}
            }
            ddb.get(p1, (err, data) => {
              const id2 = data.Item.service_token + 1
              const date = new Date()
              const date_s = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()} ${date.getUTCHours() + 9}:${date.getUTCMinutes()}`

              const p2 = {
                TableName: 'service_token',
                Item: {
                  id: id2,
                  tokenName: args.coin,
                  created: date_s
                }
              }
              ddb.put(p2, (err, data) => {
                if (err) console.log(err)
                else {
                  console.log('create coin successfully!!')
                  const p3 = {
                    TableName: 'seq',
                    Key: {id: 0},
                    ExpressionAttributeNames: {'#s': 'service_token'},
                    ExpressionAttributeValues: {':id': id2},
                    UpdateExpression: 'set #s = :id'
                  }
                  ddb.update(p3, (err, data) => {
                    if(err) console.log(err)
                    else console.log(data)
                  })
                }
              })
            })
          } catch (e) {
            console.log('An error has occured:');
            console.log(e);
          }
        })()
      }
    }
  })
}