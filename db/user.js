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
      }
      //Check if hash matches
      if (result.rows.password = )
      //return results

    })    
    return (cb(null, null))
  })
}