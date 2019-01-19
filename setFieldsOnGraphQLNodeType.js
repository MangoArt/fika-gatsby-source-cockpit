const { GraphQLJSON } = require('gatsby/graphql');
const sanitizeHtml = require('sanitize-html');
const styler = require('react-styling');
const HtmlToReactParser = require('html-to-react').Parser;
const htmlToReactParser = new HtmlToReactParser();

const {
  TYPE_PREFIX_COCKPIT,
  TYPE_PREFIX_COCKPIT_COLLECTION,
  TYPE_PREFIX_COCKPIT_REGION,
  TYPE_PREFIX_COCKPIT_PAGE,
} = require("./src/constants");

async function getCockpitData(cache, typeName) {
  if (typeName.startsWith(TYPE_PREFIX_COCKPIT_COLLECTION)) {
    const cockpitTypeName = typeName.replace(TYPE_PREFIX_COCKPIT_COLLECTION, '');
    const cachedData = await cache.get('collections');
    const cachedDataForType = cachedData.filter((entry) => (
        entry.name === cockpitTypeName
      ))[0];
    return cachedDataForType;
  }
  return null;
}

module.exports = async (
  { type, store, pathPrefix, getNode, cache },
  { cockpitConfig }
) => {
  console.log(`Type: ${type.name}`);
  if (!type.name.startsWith(TYPE_PREFIX_COCKPIT)) {
    return {};
  }

  const cachedData = await getCockpitData(cache, type.name);
  if (!cachedData) {
    return {};
  }

  const parseLayout = layout => {
    if (layout == null || layout.length === 0) {
      return layout;
    }
    return layout.map(node => {
      if (node.settings) {
        node = parseSettings(node);
      }
      Object.entries(node).forEach(([key, value]) => {
        if (value instanceof Array) {
          parseLayout(node[key]);
        }
        if (value instanceof Object && node[key].settings) {
          node[key].settings = parseSettings(node.settings);
        }
      });
      return node;
    });
  };

  const parseHtml = (type, node) => {
    const { settings } = node;
    if (settings[type] === '') {
      node.settings.html = null;
    } else if (settings[type] && settings[type].length > 0) {
      node.settings.html = settings[type];
      node.settings.html_sanitize = sanitizeHtml(
        settings[type],
        cockpitConfig.sanitizeHtmlConfig
      );
      node.settings.html_react = htmlToReactParser.parse(settings[type]);
    }
    return node;
  };

  const parseSettings = node => {
    const { settings } = node;
    if (settings.html) {
      node = parseHtml('html', node);
    }
    if (settings.text) {
      node = parseHtml('text', node);
    }
    if (settings.id === '') {
      settings.id = null;
    }
    if (settings.class === '') {
      settings.className = settings.class;
    } else {
      settings.className = null;
    }
    delete settings.class;
    if (settings.style === '' || settings.style == null) {
      settings.style = null;
    } else {
      settings.style = styler(settings.style);
    }
    return node;
  };

  let nodeExtendType = {};

  cachedData.items.forEach((item) => {

    const jsonFields = Object.keys(item).filter(
      fieldname => item[fieldname].type === 'layout'
    );

    jsonFields.forEach(fieldname => {
      nodeExtendType[`${fieldname}_parsed`] = {
        type: GraphQLJSON,
        resolve(Item) {
          return parseLayout(Item[`${fieldname}`].value);
        },
      };
    });
  });
  console.log('EXTEND:', nodeExtendType);
  return nodeExtendType;
};
