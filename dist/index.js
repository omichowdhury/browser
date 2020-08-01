
'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./browser.cjs.production.min.js')
} else {
  module.exports = require('./browser.cjs.development.js')
}
