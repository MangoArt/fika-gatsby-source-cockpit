const fs = require("fs");
const path = require("path");
const setFieldsOnGraphQLNodeType = require('./setFieldsOnGraphQLNodeType');

const CockpitService = require("./src/CockpitService");
const CollectionItemNodeFactory = require("./src/CollectionItemNodeFactory");
const RegionItemNodeFactory = require("./src/RegionItemNodeFactory");
const PageItemNodeFactory = require("./src/PageItemNodeFactory");

const {
  MARKDOWN_IMAGE_REGEXP_GLOBAL,
  MARKDOWN_ASSET_REGEXP_GLOBAL
} = require("./src/constants");
const FileNodeFactory = require("./src/FileNodeFactory");
const MarkdownNodeFactory = require("./src/MarkdownNodeFactory");

exports.setFieldsOnGraphQLNodeType = setFieldsOnGraphQLNodeType;
exports.sourceNodes = async ({ actions, cache, store }, configOptions) => {
  const { createNode } = actions;
  const cockpit = new CockpitService(
    configOptions.baseUrl,
    configOptions.token,
    configOptions.locales
  );
  const fileNodeFactory = new FileNodeFactory(createNode, store, cache);
  const markdownNodeFactory = new MarkdownNodeFactory(createNode);

  await cockpit.validateBaseUrl();
  await cockpit.validateToken();

  const collections = await cockpit.getCollections();
  const { images, assets, markdowns } = cockpit.normalizeResources(collections);

  const regions = await cockpit.getRegions();
  cockpit.normalizeResources(regions, images, assets, markdowns);

  const pages = await cockpit.getPages();
  cockpit.normalizeResources(pages, images, assets, markdowns);

  cache.set('collections', collections);
  cache.set('regions', regions);
  cache.set('pages', pages);
  cache.set('images', images);
  cache.set('assets', assets);
  cache.set('markdowns', markdowns);

  for (let path in images) {
    const imageNode = await fileNodeFactory.createImageNode(path);
    images[path] = {
      localPath: copyFileToStaticFolder(imageNode),
      id: imageNode.id
    };
  }

  for (let path in assets) {
    const assetNode = await fileNodeFactory.createAssetNode(path);
    assets[path] = {
      localPath: copyFileToStaticFolder(assetNode),
      id: assetNode.id
    };
  }

  for (let markdown in markdowns) {
    const localMarkdown = updateAssetPathsWithLocalPaths(
      updateImagePathsWithLocalPaths(markdown, images),
      assets
    );
    const id = markdownNodeFactory.create(localMarkdown);
    markdowns[markdown] = { id };
  }

  collections.forEach(collection => {
    const nodeFactory = new CollectionItemNodeFactory(
      createNode,
      collection.name,
      images,
      assets,
      markdowns
    );

    collection.items.forEach(item => {
      nodeFactory.create(item);
    });
  });

  regions.forEach(region => {
    const nodeFactory = new RegionItemNodeFactory(
      createNode,
      region.name,
      images,
      assets,
      markdowns
    );

    region.items.forEach(item => {
      nodeFactory.create(item);
    });
  });

  pages.forEach(page => {
    const nodeFactory = new PageItemNodeFactory(
      createNode,
      page.name,
      images,
      assets,
      markdowns
    );

    page.items.forEach(item => {
      nodeFactory.create(item);
    });
  });
};

const copyFileToStaticFolder = ({ absolutePath, name, ext, internal }) => {
  const localPath = path.join(
    "/",
    "static",
    `${name}-${internal.contentDigest}${ext}`
  );

  fs.copyFileSync(absolutePath, path.join(process.cwd(), "public", localPath));

  return localPath;
};

const updateImagePathsWithLocalPaths = (markdown, images) => {
  return markdown.replace(MARKDOWN_IMAGE_REGEXP_GLOBAL, (...match) =>
    match[0].replace(match[1], images[match[1]].localPath)
  );
};

const updateAssetPathsWithLocalPaths = (markdown, assets) => {
  return markdown.replace(MARKDOWN_ASSET_REGEXP_GLOBAL, (...match) =>
    assets[match[1]]
      ? match[0].replace(match[1], assets[match[1]].localPath)
      : match[0]
  );
};
