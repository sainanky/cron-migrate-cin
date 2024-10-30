require('dotenv').config();
require('./connection/database_common');

const cinProcess = require('./controllers/cin_process');
setTimeout(() => {
    cinProcess.init();
}, 4000);