module.exports =
    {
        "env": {
            "node": true,
            "es6": true,
        },
        "globals": {
            "handler": "readonly",
        },
        "parserOptions": {
            "ecmaVersion": 2017,
            "sourceType": "module",
        },
        "rules": {
            "no-undef": "error",
            "no-unused-vars": "error",
            "no-var": "error",
            "semi": ["error", "always" ],
        }
    };
