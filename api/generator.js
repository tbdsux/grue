// nanoid for random short link generator
const { nanoid } = require('nanoid')

// date parser
const moment = require('moment')

// generate a url
module.exports = async function generate_base_schema(request_url) {
  // generate the random string
  const short = nanoid(5)

  // structure the json to be storred in the DB
  const url = {
    grue_url: request_url,
    short: short,
    date: moment().utc().format(),
    last_visit: moment().utc().format(),
  }

  // return the url
  return url
}
