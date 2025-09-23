const HTTP_RESPONSES = { 
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: {
        code: 500,
        message: 'Internal Server Error. Please try again later.',
    },
    FORBIDDEN: 403,
    CONFLICT: 409,
};

module.exports = { HTTP_RESPONSES };