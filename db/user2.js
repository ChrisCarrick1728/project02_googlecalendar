// const { Pool, Client } = require('pg')
// const connectionString = process.env.DATABASE_URL
// const pool = new Pool({connectionString: connectionString})
const dotenv = require("dotenv")
const bcrypt = require('bcrypt')
const saltRounds = 10;

// Setup .env
let envFile = 'db.env'
const env = process.env.NODE_ENV || 'db'

if (process.env.ENV !== undefined) {
  envFile = env + ".env"
}

dotenv.config({
  path: "environment/" + envFile
})

// Database connection
const { Pool, Client } = require('pg')
const connectionString = process.env.DATABASE_URL
const pool = new Pool({connectionString: connectionString})

exports.findByUsername = function(username, cb) {
  process.nextTick(function() {
    //Find user
    var sql = "SELECT * FROM users WHERE username='" + username + "'"
    pool.query(sql, function(err, result) {
      if (err) {
        console.log("Error in query: " + err)
        return cb(null, null);
      }
      if (result.rowCount != 0) {
        console.log("findByUsername")
        console.log(result.rows[0])
        return cb(null, result.rows[0]);
      }
    })
    return cb(null, null);
  })  
}

exports.findById = function(id, cb) {
  process.nextTick(function() {
    var sql = "SELECT * FROM users WHERE id =" + id
    pool.query(sql, function(err, result) {
      if (err) {
        console.log("no user found with that id: " + err)
      }
      console.log('findById: ')
      console.log(result.rows[0])
      if (result.rowCount != 0) {
        return cb(null, result.rows[0])
      }
    })
    return cb(null, null)
  })
}

exports.addNewUser = function(q, cb) {
  // Hash password
  console.log(q);
  bcrypt.hash(q.password1, saltRounds, function(err, hash) {
    console.log(hash)
    //return cb(null)
    process.nextTick(function() {
      var sql = "INSERT INTO users(username, password) VALUES ('" + q.username + "', '" + hash + "')"
      pool.query(sql, function(err, result) {
        if (err) {
          console.log("unable to add new user: " + err)
          return cb(err, null)
        }
        return cb(null, result.user)
      })
    })
  })  
}