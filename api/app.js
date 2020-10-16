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

// time to run the worker
const removerTime = moment('4:00:00 pm', 'hh:mm:ss a').format('hh:mm:ss a')

// set the view engine
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'twig')

// set other things
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.urlencoded({ extended: true }))

// check if the env is set
if (!process.env.MONGO_DB) {
  console.log('The MONGO_DB environment variable is not set!')
  process.exit(0) // exit
}

// require the database connection
const ConDB = require('./db')

// set the webapp title
const websiteTitle = 'Grue | Simple URL Shortener'

// for validation of the url
const { body, validationResult } = require('express-validator')

// default index route
app.get('/', async (req, res) => {
  res.render('index', { title: websiteTitle })
})

// main route to generate a short link
app.post(
  '/',
  [body('grue-link').isURL().trim().withMessage('Invalid URL!')],
  async (req, res) => {
    // get the link query parameter
    const link = req.body['grue-link']

    // check if the link exists
    if (link) {
      // get the errors
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.render('index', {
          title: websiteTitle,
          errors: errors,
        })
      } else {
        // get the shortlink
        const short = nanoid(5)

        // connect to the db
        const db = await ConDB()

        // initialize the data
        const links = await db.collection('ShortLinks')
        const url = {
          grue_url: link,
          short: short,
          date: moment().utc().format(),
          last_visit: moment().utc().format(),
          remove_dt: moment().add(30, 'd').utc().format(),
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
      }
    } else {
      const errors = {
        errors: [
          {
            msg: 'Please enter a URL!',
          },
        ],
      }
      res.render('index', {
        title: websiteTitle,
        errors: errors,
      })
    }
  },
)

// make an api for the post form
app.post(
  '/api/generate',
  [body('grue-link').isURL().trim().withMessage('Invalid URL!')],
  async (req, res) => {
    // get the request link
    const reqLink = req.body['grue-link']

    // continue if the request link is not empty
    if (reqLink) {
      // get the errors, send them if there is
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.send({ error: 'Invalid URL!' })
      }

      // generate the random string
      const short = nanoid(5)

      // connect to the database
      const db = await ConDB()

      // generate a shortlink
      const links = await db.collection('ShortLinks')
      const url = {
        grue_url: reqLink,
        short: short,
        date: moment().utc().format(),
        last_visit: moment().utc().format(),
        remove_dt: moment().add(30, 'd').utc().format(),
      }

      // insert the data to the database
      links
        .insertOne(url)
        .then((result) => {
          // get the output
          const output = {
            link: 'https://grue.cf/' + short,
            redirect: reqLink,
          }

          // send the json
          res.send(output)
        })
        .catch((error) => {
          console.error(error)
          res.send('There was a problem with your request.')
        })
    } else {
      res.send({}) // return nothing if the request is empty
    }
  },
)

// redirect from the shortlink
app.get('/:shortlink', async (req, res) => {
  // get the shortlink
  const short = req.params['shortlink']

  // connect to the db
  const db = await ConDB()

  // get the data from the database if exists
  const links = await db.collection('ShortLinks')
  links
    .findOne({ short: short })
    .then((result) => {
      // change the latest visit and redirect
      if (result) {
        links
          .updateOne(
            { short: short },
            {
              $set: {
                last_visit: moment().utc().format(),
                remove_dt: moment().add(30, 'd').utc().format(),
              },
            },
          )
          .then((upres) => {
            res.redirect(result.grue_url) // redirect after updating the record
          })
          .catch((error) => {
            console.error(error)
          })
      } else {
        res.render('404') // render the 404 if null
      }
    })
    .catch((error) => {
      console.error(error)
    })
})

// worker / deleter api (this will be called through a cron job)
app.get('/worker/clean/database', async (req, res) => {
  // get the date and time
  const time = moment().utc().format('hh:mm:ss a')
  const today = moment().utc().format()

  if (time === removerTime) {
    const db = await ConDB()

    const links = await db.collection('ShortLinks')

    // query all of the links
    links.find().toArray(function (err, shlinks) {
      shlinks.map((i) => {
        if (moment(today).isAfter(i.remove_dt)) {
          // if the link has expired, delete it
          try {
            links.deleteOne(i)
          } catch (e) {
            console.error(e) // log if there was a problem
          }
        }
      })

      // send a success message
      res.send('The deletion of expired links was successful.')
    })
  } else {
    res.send('Today is not the time. :)')
  }
})

// export the app
module.exports = app
