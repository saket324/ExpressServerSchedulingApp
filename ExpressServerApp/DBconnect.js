const mysql = require('mysql');

function newConnection()
{
    let conn = mysql.createConnection({
        host:'34.130.148.203',
        user: 'root',
        password:'password',
        database:'doodle'
    });
    return conn;
}
module.exports = newConnection;