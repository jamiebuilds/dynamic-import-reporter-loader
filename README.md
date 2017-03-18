# dynamic-import-reporter-loader

Report timing data about import() back to an endpoint using a POST request.

### Install

```sh
yarn add --dev dynamic-import-reporter-loader
```

### Usage

```js
// webpack.config.js
module.exports = {
  module: {
    rules: [{
      test: /\.js$/,
      exclude: /node_modules/,
      loader: 'dynamic-import-reporter-loader',
      options: {
        reportingRoute: '/scripts/report',
      },
    }],
  },
};
```
