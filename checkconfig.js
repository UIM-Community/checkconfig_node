const async     = require('async');
const fs        = require('fs');
const sqlite3   = require('sqlite3').verbose();

// Require Nimsoft lib!
const nodeuim   = require('nodeuim');
const Logger    = nodeuim.Logger;
const PDS       = nodeuim.PDS;

// Require configuration
const config    = require('./configuration.json');

// Configure logger!
const logger = new Logger({
    file: 'checkconfig.log'
});

process.on('exit', () => {
    logger.nohead(console.timeEnd('time'));
    logger.close();
});

/*
 * Connect the SQLite database!
 */
logger.info('Create SQLite database');
const db = new sqlite3.Database('checkconfig.db');

/*
 * Create SQLite tables!
 */
db.serialize(function() {
    db.run(`CREATE TABLE IF NOT EXISTS hubs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(255) NOT NULL,
            domain TEXT NOT NULL,
            origin TEXT,
            ip TEXT NOT NULL,
            versions VARCHAR(255),
            tunnel VARCHAR(10) NOT NULL,
            getrobots_success TINYINT,
            getrobots_time INTEGER,
            getallrobots_time INTEGER
        )`);

    db.run(`CREATE TABLE IF NOT EXISTS robots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hubid INTEGER NOT NULL,
            status TINYINT NOT NULL,
            os_major TEXT,
            os_user1 TEXT,
            os_user2 TEXT,
            os_minor TEXT,
            os_description TEXT,
            name VARCHAR(255) NOT NULL,
            ip TEXT NOT NULL,
            origin TEXT NOT NULL,
            versions VARCHAR(255),
            probeslist_success TINYINT,
            probeslist_responsetime INTEGER,
            packages_success TINYINT,
            FOREIGN KEY(hubid) REFERENCES hubs(id)
        )`);
});

logger.nohead(console.time('time'));
logger.info('Get hubs!');
logger.nohead('---------------------------------');

function processingHubs(hubArr) {
    return new Promise((resolve,reject) => {
        async.each(hubArr,(hub, next) => {
            if(hub.domain !== 'NMS-PREPROD') {
                next();
                return;
            }
            logger.info(hub.addr);
            getRobots(hub.addr,hub.name).then(next).catch( Err => {
                logger.error(Err);
                next();
            });
        }, err => {
            if(err) {
                reject(err);
            }
            else {
                logger.info('All hubs processing done!');
                resolve();
            }
        });
    });
}

function getRobots(hubAddr,hubName) {
    return new Promise((resolve,reject) => {
        nodeuim.Request(config)({ path: hubAddr, callback: 'getrobots', args: new PDS(void 0,void 0) })
        .then( PDS => {
            const robotsArr = PDS.get('robotlist'); 
            async.eachLimit(robotsArr,5,(robot, next) => {
                logger.info(robot.name);
                getProbes(robot.addr,robot.name).then(next).catch( Err => {
                    logger.error(Err);
                    next();
                });
            }, err => {
                if(err) {
                    reject(err);
                }
                else {
                    logger.info('Robots processing done for hub => '+hubName);
                    resolve();
                }
            });
        })
        .catch( Err => reject(Err) );
    });
}

function getProbes(robotAddr,robotName) {
    return new Promise((resolve,reject) => {
        nodeuim.Request(config)({ path: robotAddr, callback: 'probe_list', args: new PDS(void 0,void 0) })
        .then( PDS => {
            PDS.forEach( (probe,name) => {
                logger.info(`Probe ${name} , active => ${probe.get('active')}`);
            });
        })
        .catch( Err => reject(Err) );
    });
}

setImmediate( async function() {
    try {
        var HUB_PDS = await nodeuim.Request(config)({ callback: 'gethubs' });
    }
    catch(Err) {
        logger.error(Err);
        process.exit(1);
    }

    try {
        await processingHubs(HUB_PDS.get('hublist'));
    }
    catch(Err) {
        logger.error(Err);
        process.exit(1);
    }
});
