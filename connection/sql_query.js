
function fetch(pool, query, values) {
    return new Promise((resolve, reject) =>{
        pool.getConnection((err, conn) => {
            if(err || !conn) {
                restartApp();
                reject(err);
            }
            if(values){
                try{
                    conn.query(query, values, (err, doc) => {
                        conn.release();
                        if(err) reject(err);
                        resolve(doc);
                    })
                }
                catch(err){
                    restartApp();
                    console.log("app crashed");
                }
            }
            else{
                try{
                    conn.query(query, (err, doc) => {
                        conn.release();
                        if(err) reject(err);
                        resolve(doc);
                    })
                }
                catch(err){
                    console.log("error in =", err)
                    restartApp();
                    console.log("app crashed");
                }
            }
        });
    })
}


function restartApp() {
    if(process.env.environment && process.env.environment == 'local'){
        return false;
    }
    let app_name = 'cron-masked-api';
    // setTimeout(async() => {
    //     let command = `pm2 restart ${app_name}`;
    //     await common.execComand(command);
    // }, 5000);
}

module.exports = fetch;