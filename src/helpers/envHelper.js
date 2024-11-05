require('dotenv').config();

const getEnvVars = (env = 'prod') => {
    switch(env) {
        case 'dev':
            return {
                host: process.env._HOST_DEV,
                hostLogged: process.env._HOST_LOGGED_DEV,
                username: process.env._USERNAME_DEV,
                password: process.env._PASSWORD_DEV,
                basicAuthUser: process.env._BASIC_AUTH_DEV_USER,
                basicAuthPassword: process.env._BASIC_AUTH_DEV_PASSWORD
            };
        case 'stage':
            return {
                host: process.env._HOST_STAGE,
                hostLogged: process.env._HOST_LOGGED_STAGE,
                username: process.env._USERNAME_STAGE,
                password: process.env._PASSWORD_STAGE,
                basicAuthUser: process.env._BASIC_AUTH_STAGE_USER,
                basicAuthPassword: process.env._BASIC_AUTH_STAGE_PASSWORD
            };
        default: // prod
            return {
                host: process.env._HOST,
                hostLogged: process.env._HOST_LOGGED,
                username: process.env._USERNAME,
                password: process.env._PASSWORD
            };
    }
};

module.exports = { getEnvVars };