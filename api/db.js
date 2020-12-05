// initialize the .env config file
require('dotenv').config()

// setup the database connection
const MongoClient = require('mongodb').MongoClient

let cachedDb = null

// connect to the database (serveless setup)
module.exports = async function connectToDB() {
  if (cachedDb) {
    return cachedDb
  }

  const client = await MongoClient.connect(process.env.MONGO_DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })

  const db = await client.db(process.env.DB_NAME)

  // cache the database and return the connection
  cachedDb = db
  return db
}
