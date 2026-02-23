const mysql = require('mysql2');

const config = {
    host: 'srv1673.hstgr.io',
    port: 3306,
    user: 'u778398232_skmartposadmin',
    password: '!u2w8?WM',
    database: 'u778398232_skmartpos'
};

console.log('Testing connection with config:', { ...config, password: '***' });

const connection = mysql.createConnection(config);

connection.connect((err) => {
    if (err) {
        console.error('Connection failed:', err.message);
        console.error('Error code:', err.code);
        process.exit(1);
    }
    console.log('Successfully connected to MySQL!');
    connection.end();
});
