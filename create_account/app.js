const StellarSdk = require('stellar-sdk')
const server = new StellarSdk.Server('https://horizon-testnet.stellar.org')

const AWS = require('aws-sdk')
// configはデプロイするときに消すこと--------------
const config = {
  endpoint: 'http://dynamodb:8000',
  region: 'ap-northeast',
  accessKeyId: 'fakeAccessKeyId',
  secretAccessKey: 'fakeSecretAccessKey'
}
AWS.config.update(config)
// -------------------------------------------
const ddb = new AWS.DynamoDB.DocumentClient()

exports.handler = async (event, context, callback) => {
  const newAccount = await StellarSdk.Keypair.random()
  const secretKey = event.body
  const keypair = await StellarSdk.Keypair.fromSecret(secretKey)
  const account = await server.loadAccount(keypair.publicKey())
  try {
    const setting = await StellarSdk.Operation.createAccount({
      destination: newAccount.publicKey(),
      startingBalance: String(5)
    })
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    }).addOperation(setting).setTimeout(3000).build()
    await transaction.sign(keypair)
    await server.submitTransaction(transaction)
    const date = new Date()
    const date_s = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()} ${date.getUTCHours() + 9}:${date.getUTCMinutes()}`

    const params = {
      TableName: 'seq',
      Key: {id: 0}
    }
    ddb.get(params, (err, data) => {
      if (err) console.log(err)
      else {
        let id = data.Item.address
        id += 1
  
        const p2 = {
          TableName: 'address',
          Item: {
            id: id,
            pubKey: newAccount.publicKey(),
            secKey: newAccount.secret(),
            created: date_s
          }
        }
        ddb.put(p2, (err, data) => {
          if (err) console.log(err)
          else console.log('updated successfully!! ',data)
        })
  
        const p1 = {
          TableName: 'seq',
          Key: {id:0},
          ExpressionAttributeNames: {'#a': 'address'},
          ExpressionAttributeValues: {':newAddress': id},
          UpdateExpression: 'SET #a = :newAddress'
        }
        ddb.update(p1, (err, data) => {
          if (err) console.log(err)
          else {
            console.log(data)
          }
        })
      }
    })

    // const params = {
    //   TableName: 'address',
    //   Item: {
    //     pubKey: {"S": newAccount.publicKey()},
    //     secKey: {"S": newAccount.secret()},
    //     created: {"S": date_s}
    //   }
    // }
    // ddb.putItem(params, (err, data) => {
    //   if (err) console.log(err)
    //   else console.log("upload successfully!!", data)
    // })

    const aa = `sec : ${newAccount.secret()} , pub : ${newAccount.publicKey()}`
    callback(null, aa)
  } catch (err) {
    console.log(err)
  }
}