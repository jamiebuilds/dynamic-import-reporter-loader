'use strict';

const babylon = require('babylon');
const traverse = require('babel-traverse').default;
const NodePath = require('babel-traverse').NodePath;
const template = require('babel-template');
const generate = require('babel-generator').default;
const t = require('babel-types');
const loaderUtils = require('loader-utils');
const getRelativePath = require('path').relative;

let VISITED = Symbol('visited');

let createInitDate = template('const INIT_DATE = Date.now()');
let createImportHelper = template(`
  function IMPORT_HELPER(currentModule, requestedModule) {
    let timing = Date.now() - INIT_DATE;
    fetch(ROUTE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        timing,
        currentModule,
        requestedModule
      })
    });
  }
`);

let addHelper = (path, opts) => {
  let initDateId = path.scope.generateUidIdentifier('currentDate');
  let importHelperId = path.scope.generateUidIdentifier('reportDynamicImport');

  let program = path.findParent(p => p.isProgram());
  let firstStatement = program.get('body')[0];

  firstStatement.insertBefore(createInitDate({
    INIT_DATE: initDateId
  }));

  firstStatement.insertBefore(createImportHelper({
    INIT_DATE: initDateId,
    IMPORT_HELPER: importHelperId,
    ROUTE: t.stringLiteral(opts.route)
  }));

  return importHelperId;
};

module.exports = function(content) {
  // console.log();
  let options = loaderUtils.getOptions(this);

  let baseDir = this.context;
  let filename = this.resource;
  let reportingRoute = options.reportingRoute;

  let relativePath = getRelativePath(baseDir, filename);

  let ast = babylon.parse(content, {
    sourceType: 'module',
    plugins: [
      'jsx',
      'flow',
      'doExpressions',
      'objectRestSpread',
      'decorators',
      'classProperties',
      'exportExtensions',
      'asyncGenerators',
      'functionBind',
      'functionSent',
      'dynamicImport',
    ]
  });

  let path = NodePath.get({
    parentPath: null,
    parent: ast,
    container: ast,
    key: 'program'
  }).setContext();

  let scope = path.scope;

  let _helperId = null;

  let visitor = {
    CallExpression(path, state) {
      if (path.node[VISITED]) return;
      if (!path.get('callee').isImport()) return;

      path.node[VISITED] = true;

      if (!_helperId) {
        _helperId = addHelper(path, {
          route: reportingRoute
        });
      }

      let importString = path.get('arguments')[0];

      path.replaceWith(
        t.sequenceExpression([
          t.callExpression(_helperId, [
            t.stringLiteral(relativePath),
            t.stringLiteral(importString.node.value)
          ]),
          path.node
        ])
      );
    }
  };

  traverse(ast, visitor, scope);

  let {code} = generate(ast);

  this.callback(null, code, null);
};
