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

exports.findById = function(id, cb) {
  process.nextTick(async function() {
    var sql = "SELECT * FROM users WHERE id=" + id
    await pool.query(sql, (err, result) => {
      if (err) {
        console.log('findByUsername error: ' + err)
      }
      if (result.rowCount != 0) {
        return cb(null, result.rows[0])
      }
      return cb(null, null)

    })
  });
}

exports.findByUsername = function(username, cb) {
  process.nextTick(async function() {
    var sql = "SELECT * FROM users WHERE username='" + username + "'"
    await pool.query(sql, (err, result) => {
      if (err) {
        console.log('findByUsername error: ' + err)
      }
      if (result.rowCount != 0) {
        return cb(null, result.rows[0])
      }
      return cb(null, null)

    })
  });
}

exports.addNewUser = function(q, cb) {
  // Hash password
  console.log(q);
  bcrypt.hash(q.password1, saltRounds, function(err, hash) {
    console.log(hash)
    process.nextTick(function() {
      var sql = "INSERT INTO users(username, password) VALUES ('" + q.username + "', '" + hash + "') RETURNING id"
      pool.query(sql, function(err, result) {
        if (err) {
          console.log("unable to add new user: " + err)
          return cb(err, null)
        }
        console.log (result.rows[0].id)
        var sql = "INSERT INTO googleTokens(users_id) VALUES ('" + result.rows[0].id + "')"
        pool.query(sql, (err, result) => {
          if (err) {
            console.log('unable to add id to googleTokens: ' + err)
            return cb (err, null)
          }
        })
        return cb(null, result.user)
      })
    })
    // Create google auth row
  })  
}