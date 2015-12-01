'use strict';

var _ = require('underscore');
var GoodTables = require('goodtables');
var Promise = require('bluebird');
var csv = require('papaparse');
var jts = require('json-table-schema');
var inflector = require('inflected');
var path = require('path');
var url = require('url');

inflector.transliterations(function(t) {
  t.approximate('А', 'A');  t.approximate('а', 'a');
  t.approximate('Б', 'B');  t.approximate('б', 'b');
  t.approximate('В', 'V');  t.approximate('в', 'v');
  t.approximate('Г', 'G');  t.approximate('г', 'g');
  t.approximate('Ґ', 'G');  t.approximate('ґ', 'g');
  t.approximate('Д', 'D');  t.approximate('д', 'd');
  t.approximate('Е', 'E');  t.approximate('е', 'e');
  t.approximate('Є', 'Je'); t.approximate('є', 'je');
  t.approximate('Ж', 'Zh'); t.approximate('ж', 'zh');
  t.approximate('З', 'Z');  t.approximate('з', 'z');
  t.approximate('И', 'Y');  t.approximate('и', 'y');
  t.approximate('І', 'I');  t.approximate('і', 'i');
  t.approximate('Ї', 'Ji'); t.approximate('ї', 'ji');
  t.approximate('Й', 'J');  t.approximate('й', 'j');
  t.approximate('К', 'K');  t.approximate('к', 'k');
  t.approximate('Л', 'L');  t.approximate('л', 'l');
  t.approximate('М', 'M');  t.approximate('м', 'm');
  t.approximate('Н', 'N');  t.approximate('н', 'n');
  t.approximate('О', 'O');  t.approximate('о', 'o');
  t.approximate('П', 'P');  t.approximate('п', 'p');
  t.approximate('Р', 'R');  t.approximate('р', 'r');
  t.approximate('С', 'S');  t.approximate('с', 's');
  t.approximate('Т', 'T');  t.approximate('т', 't');
  t.approximate('У', 'U');  t.approximate('у', 'u');
  t.approximate('Ф', 'F');  t.approximate('ф', 'f');
  t.approximate('Х', 'H');  t.approximate('х', 'h');
  t.approximate('Ц', 'Ts'); t.approximate('ц', 'ts');
  t.approximate('Ч', 'Ch'); t.approximate('ч', 'ch');
  t.approximate('Ш', 'Sh'); t.approximate('ш', 'sh');
  t.approximate('Щ', 'Shch'); t.approximate('щ', 'shch');
  t.approximate('Ю', 'Ju'); t.approximate('ю', 'ju');
  t.approximate('Я', 'Ja'); t.approximate('я', 'ja');
  t.approximate('Ы', 'Y');  t.approximate('ы', 'y');
  t.approximate('Э', 'E');  t.approximate('э', 'e');
  t.approximate('Ё', 'Jo'); t.approximate('ё', 'jo');
});

module.exports.undecorateProxyUrl = function(urlToUndecorate) {
  var result = url.parse(urlToUndecorate, true);
  if (result && result.pathname) {
    if ((result.pathname == '/proxy') && result.query && result.query.url) {
      return result.query.url;
    }
  }
  return urlToUndecorate;
};

module.exports.decorateProxyUrl = function(urlToDecorate) {
  return '/proxy?url=' + encodeURIComponent(
    module.exports.undecorateProxyUrl(urlToDecorate));
};

module.exports.convertToTitle = function(string) {
  return inflector.titleize('' + (string || ''));
};

module.exports.convertToSlug = function(string) {
  return inflector.parameterize(inflector.transliterate('' + (string || '')));
};

module.exports.getCsvSchema = function(urlOrFile) {
  return new Promise(function(resolve, reject) {
    var config = {
      download: true,
      preview: 1000,
      skipEmptyLines: true,
      complete: function(results) {
        if (results.errors.length) {
          reject(results.errors);
        }
        var headers = _.first(results.data);
        var rows = _.rest(results.data);
        var schema = jts.infer(headers, rows);
        resolve({
          raw: csv.unparse(results.data, {
            quotes: true,
            delimiter: ',',
            newline: '\r\n'
          }),
          headers: headers,
          rows: rows,
          schema: schema
        });
      }
    };
    csv.parse(urlOrFile, config);
  });
};

module.exports.validateData = function(data, schema, userEndpointURL) {
  var goodTables = new GoodTables({
    'method': 'post',
    'report_type': 'grouped'
  }, userEndpointURL);
  return goodTables.run(data, !!schema ? JSON.stringify(schema) : undefined)
    .then(function(results) {
      if (!results) {
        return false;
      }
      var groupped = results.getGroupedByRows();
      var headers = results.getHeaders();
      return _.map(groupped, function(item) {
        return _.extend(_.values(item)[0], {
          headers: headers
        });
      });
    });
};

module.exports.availableDataTypes = (function() {
  return _.chain(jts.types)
    .filter(function(item, key) {
      return (key != 'JSType') && (key.substr(-4) == 'Type');
    })
    .map(function(TypeConstructor) {
      var result = new TypeConstructor();
      result.id = result.name;
      return result;
    })
    .value();
})();

module.exports.availableConcepts = (function() {
  var allTypes = _.pluck(module.exports.availableDataTypes, 'id');
  var idTypes = ['integer', 'number', 'string'];
  return [
    {
      name: '',
      id: '',
      allowedTypes: allTypes,
      group: null,
      required: false,
      map: {
        name: 'other',
        dimensionType: 'other'
      }
    },
    {
      name: 'Amount',
      id: 'measures.amount',
      allowedTypes: ['number', 'integer'],
      group: 'measure',
      required: true,
      map: {
        name: 'amount',
        dimensionType: 'amount'
      }
    },
    {
      name: 'Date / Time',
      id: 'dimensions.datetime',
      allowedTypes: ['datetime', 'date', 'time', 'integer', 'numeric'],
      group: 'dimension',
      required: true,
      map: {
        name: 'datetime',
        dimensionType: 'datetime'
      }
    },
    {
      name: 'Classification',
      id: 'dimensions.classification',
      allowedTypes: idTypes,
      group: 'dimension',
      required: false,
      map: {
        name: 'classification',
        dimensionType: 'classification'
      }
    },
    {
      name: 'Classification > ID',
      id: 'dimensions.classification.id',
      allowedTypes: idTypes,
      group: 'dimension',
      required: false,
      map: {
        name: 'classification-id',
        dimensionType: 'classification'
      }
    },
    {
      name: 'Classification > Label',
      id: 'dimensions.classification.label',
      allowedTypes: allTypes,
      group: 'dimension',
      required: false,
      map: {
        name: 'classification-label',
        dimensionType: 'classification'
      }
    },
    {
      name: 'Entity',
      id: 'dimensions.entity',
      allowedTypes: idTypes,
      group: 'dimension',
      required: false,
      map: {
        name: 'entity',
        dimensionType: 'entity'
      }
    },
    {
      name: 'Entity > ID',
      id: 'dimensions.entity.id',
      allowedTypes: idTypes,
      group: 'dimension',
      required: false,
      map: {
        name: 'entity-id',
        dimensionType: 'entity'
      }
    },
    {
      name: 'Entity > Label',
      id: 'dimensions.entity.label',
      allowedTypes: allTypes,
      group: 'dimension',
      required: false,
      map: {
        name: 'entity-label',
        dimensionType: 'entity'
      }
    }
  ];
})();

module.exports.availableCurrencies = require('../data/iso4217.json');

module.exports.defaultCurrency = (function(currencies) {
  var defaultCurrencies = _.intersection(
    ['USD', 'EUR', _.first(currencies).code],
    _.pluck(currencies, 'code'));
  var defaultCurrencyCode = _.first(defaultCurrencies);
  return _.find(currencies, function(item) {
    return item.code == defaultCurrencyCode;
  });
})(module.exports.availableCurrencies);

module.exports.createNameFromPath = function(fileName) {
  var result = path.basename(fileName, path.extname(fileName));
  return module.exports.convertToSlug(result || fileName);
};

module.exports.createNameFromUrl = function(urlOfResource) {
  var result = url.parse(module.exports.undecorateProxyUrl(urlOfResource));
  if (result && result.pathname) {
    return module.exports.createNameFromPath(result.pathname);
  }
  return urlOfResource;
};

module.exports.getAllowedTypesForValues = function(values) {
  if (_.isArray(values)) {
    var result = _.map(values, module.exports.getAllowedTypesForValues);
    return _.intersection.apply(_, result);
  } else {
    return _.filter(module.exports.availableDataTypes, function(type) {
      return type.cast(values);
    });
  }
};

module.exports.getAllowedConcepts = function(types) {
  types = _.isArray(types) ? _.pluck(types, 'id') : [types.id];
  return _.filter(module.exports.availableConcepts, function(concept) {
    if (_.isArray(concept.allowedTypes)) {
      return _.intersection(concept.allowedTypes, types).length > 0;
    }
    return false;
  });
};

module.exports.createUniqueResourceName = function(resourceName, resources) {
  var i = 1;
  var result = resourceName;
  while (true) {
    var found = _.find(resources, function(item) {
      return item.name == result;
    });
    if (found) {
      result = resourceName + '-' + i;
      i++;
    } else {
      break;
    }
  }
  return result;
};