// initialize the .env config file
require('dotenv').config()

// main express
const express = require('express')
const app = express()

// other required
const path = require('path')
const bodyParser = require('body-parser')

// nanoid for random short link generator
const { nanoid } = require('nanoid')

// date parser
const moment = require('moment')

// set the view engine
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'twig')

// set other things
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.urlencoded({ extended: true }))

// setup the database connection
const MongoClient = require('mongodb').MongoClient

let cachedDb = null

// connect to the database
async function connectToDB() {
  if (cachedDb) {
    return cachedDb
  }

  const client = await MongoClient.connect(process.env.MONGO_DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })

  const db = await client.db('GrueLinks')

  // cache the database and return the connection
  cachedDb = db
  return db
}

// check if the env is set
if (!process.env.MONGO_DB) {
  console.log('The MONGO_DB environment variable is not set!')
}

// set the webapp title
const websiteTitle = 'Grue | Simple URL Shortener'

// default index route
app.get('/', async (req, res) => {
  res.render('index', { title: websiteTitle })
})

// main route to generate a short link
app.post('/', async (req, res) => {
  // get the link query parameter
  const link = req.body['grue-link']

  // get the shortlink
  const short = nanoid(5)

  // connect to the db
  const db = await connectToDB()

  // initialize the data
  const links = await db.collection('ShortLinks')
  const url = {
    grue_url: link,
    short: short,
    date: moment().format(),
  }

  // insert the data to the database
  links
    .insertOne(url)
    .then((result) => {
      const success = 'Successfully shortened the long url!'
      const output = {
        link: req.protocol + '://' + req.get('host') + '/' + short,
        redirect: link,
      }
      res.render('index', {
        title: websiteTitle,
        success: success,
        output: output,
      })
    })
    .catch((error) => {
      console.error(error)
    })
})

// redirect from the shortlink
app.get('/:shortlink', async (req, res) => {
  const { short } = req.params

  // connect to the db
  const db = await connectToDB()

  const links = await db.collection('ShortLinks')
  links
    .findOne({ short: short })
    .then((result) => {
      // redirect it the the long url if not null
      if (result) {
        res.redirect(result.grue_url)
      } else {
        res.render('404') // render the 404 if null
      }
    })
    .catch((error) => {
      console.error(error)
    })
})

// export the app
module.exports = app
