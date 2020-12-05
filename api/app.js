// initialize the .env config file
require('dotenv').config()

// main express
const express = require('express')
const app = express()

// other required
const path = require('path')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')

// csurf
const csurf = require('csurf')
const csrfProtection = csurf({ cookie: true })

// set the view engine
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'twig')

// set other things
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cookieParser())

// check if the env is set
if (!process.env.MONGO_DB) {
  console.log('The MONGO_DB environment variable is not set!')
  process.exit(0) // exit
}

// require the database connection
const ConDB = require('./db')

// date parser
const moment = require('moment')

// require the generator
const generator = require('./generator')

// set the webapp title
const websiteTitle = 'Grue | Simple URL Shortener'

// for validation of the url
const { body, validationResult } = require('express-validator')

// default index route
app.get('/', csrfProtection, async (req, res) => {
  res.render('index', { title: websiteTitle, csrfToken: req.csrfToken() })
})

// main route to generate a short link
app.post(
  '/',
  csrfProtection,
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
        // connect to the db
        const db = await ConDB()
        const links = await db.collection('ShortLinks')

        // find if the url exists in the db
        links
          .findOne({ grue_url: link })
          .then(async (result) => {
            const success = 'Successfully shortened the long url!'
            let output = {}

            // if the url to shorten already exist in the database
            if (result) {
              // set the output
              output = {
                link: process.env.DOMAIN_URL + result.short,
                redirect: link,
              }
              // render
              res.render('index', {
                title: websiteTitle,
                success: success,
                output: output,
                csrfToken: req.csrfToken(),
              })
            } else {
              // generate the shortlink
              const url = await generator(link)

              // insert the data to the database
              links
                .insertOne(url)
                .then((_) => {
                  // set the output
                  output = {
                    link: process.env.DOMAIN_URL + url.short,
                    redirect: link,
                  }
                  // render
                  res.render('index', {
                    title: websiteTitle,
                    success: success,
                    output: output,
                    csrfToken: req.csrfToken(),
                  })
                })
                .catch((error) => {
                  console.error(error) // log errors
                })
            }
          })
          .catch((error) => {
            console.error(error) // log errors
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

// AN EXTERNAL API FOR USING THIS FOR OTHER PURPOSES
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

      // connect to the database
      const db = await ConDB()

      // generate a shortlink
      const links = await db.collection('ShortLinks')

      // check if the requested url already exists
      links
        .findOne({ grue_url: reqLink })
        .then(async (result) => {
          let output = {}

          if (result) {
            // set the output
            output = {
              link: process.env.DOMAIN_URL + result.short,
              redirect: reqLink,
            }

            // send the output
            res.send(output)
          } else {
            // generate the shortlink
            const url = await generator(reqLink)

            // insert the data to the database
            links
              .insertOne(url)
              .then((_) => {
                // get the output
                output = {
                  link: process.env.DOMAIN_URL + url.short,
                  redirect: reqLink,
                }

                // send the json
                res.send(output)
              })
              .catch((error) => {
                console.error(error)
                res.send('There was a problem with your request.')
              })
          }
        })
        .catch((error) => {
          console.error(error)
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
              },
            },
          )
          .then((_) => {
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

// export the app
module.exports = app
