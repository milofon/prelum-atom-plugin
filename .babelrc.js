module.exports = {
  plugins: [
    // Support async/await
    // https://babeljs.io/docs/plugins/transform-runtime/
    [
      '@babel/transform-runtime',
      {
        helpers: true,
        regenerator: true,
        corejs: 2,
      },
    ],
    '@babel/plugin-transform-object-assign',
  ],
};
