const async     = require('async');
const fs        = require('fs');

// Require Nimsoft lib!
const Nimsoft   = require('./nimsoft.js');
const Logger    = Nimsoft.Logger;
const PDS       = Nimsoft.PDS;

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
        SDK.Request(config)({ path: hubAddr, callback: 'getrobots', args: new PDS(void 0,void 0) })
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
        SDK.Request(config)({ path: robotAddr, callback: 'probe_list', args: new PDS(void 0,void 0) })
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
        var HUB_PDS = await SDK.Request(config)({ callback: 'gethubs' });
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
