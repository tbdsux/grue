// initialize the .env config file
require('dotenv').config()

// main express
const express = require('express')
const app = express()
const port = 3000

// other required
const path = require('path')
const bodyParser = require('body-parser')
const util = require('util')

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

// require the database connection
var db = require('./db')

// connect to the database
db.connect(process.env.MONGO_DB, function (err) {
  if (err) {
    console.log('Unable to connect to the database')
    process.exit(1)
  } else {
    console.log('Connected to the Database!')
  }
})

// set the webapp title
const websiteTitle = 'Grue | Simple URL Shortener'

// default index route
app.get('/', (req, res) => {
  res.render('index', { title: websiteTitle })
})

// main route to generate a short link
app.post('/', (req, res) => {
  // get the link query parameter
  const link = req.body['grue-link']

  // get the shortlink
  const short = nanoid(5)

  // initialize the data
  const links = db.get().collection('ShortLinks')
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
app.get('/:shortlink', (req, res) => {
  const short = req.params['shortlink']

  const links = db.get().collection('ShortLinks')
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

// listen and start the app
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
