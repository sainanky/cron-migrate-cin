const mysql = require('mysql2');
var pool = mysql.createPool({
    host     : process.env.DB_HOST,
    port     : process.env.DB_PORT,
    user     : process.env.DB_USER,
    password : process.env.DB_PASSWORD,
    multipleStatements : true
});

let url = `mysql -u ${process.env.DB_USER} -p'${process.env.DB_PASSWORD}' -h ${process.env.DB_HOST} -P ${process.env.DB_PORT} -D Common`;
// console.log(url)
pool.getConnection((err, connection) => {
    if(err) {
        console.log("error in ", 'Common', err);
    }
    console.log('connected with','Common');
});

module.exports = pool;