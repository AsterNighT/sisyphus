module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        // enable additional rules
        '@typescript-eslint/indent': ['error', 4],
        'linebreak-style': ['error', 'unix'],
        '@typescript-eslint/quotes': ['error', 'single'],
        '@typescript-eslint/semi': ['error', 'always'],
        'space-before-blocks': 'off',
        '@typescript-eslint/space-before-blocks': ['error'],
        'space-before-function-paren': 'off',
        '@typescript-eslint/space-before-function-paren': ['error'],
        'space-infix-ops': 'off',
        '@typescript-eslint/space-infix-ops': ['error', { 'int32Hint': false }],
        // override configuration set by extending 'eslint:recommended'
        'no-empty': 'warn',
        'no-cond-assign': ['error', 'always'],
        '@typescript-eslint/no-shadow': ['error', { 'builtinGlobals': true }],
    },
    parserOptions: {
        'project': ['./tsconfig.json']
    },
};