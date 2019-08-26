const fs = require('fs')
const path = require('path')
const setFieldsOnGraphQLNodeType = require('./setFieldsOnGraphQLNodeType')

const CockpitService = require('./src/CockpitService')
const CollectionItemNodeFactory = require('./src/CollectionItemNodeFactoryV2')
const RegionItemNodeFactory = require('./src/RegionItemNodeFactoryV2')
const PageItemNodeFactory = require('./src/PageItemNodeFactoryV2')

const {
  MARKDOWN_IMAGE_REGEXP_GLOBAL,
  MARKDOWN_ASSET_REGEXP_GLOBAL,
} = require('./src/constants')
const FileNodeFactory = require('./src/FileNodeFactory')
const MarkdownNodeFactory = require('./src/MarkdownNodeFactory')

exports.setFieldsOnGraphQLNodeType = setFieldsOnGraphQLNodeType
exports.sourceNodes = async ({ actions, cache, store }, configOptions) => {
  const { createNode } = actions
  const cockpit = new CockpitService(
    configOptions.baseUrl,
    configOptions.token,
    configOptions.locales,
    configOptions.defaultLocale,
    configOptions.collections
  )
  const fileNodeFactory = new FileNodeFactory(createNode, store, cache)
  const markdownNodeFactory = new MarkdownNodeFactory(createNode)

  await cockpit.validateBaseUrl()
  await cockpit.validateToken()

  const collections = await cockpit.getCollections()
  const { images, assets, markdowns } = cockpit.normalizeResources(collections)

  const regions = await cockpit.getRegions()
  cockpit.normalizeResources(regions, images, assets, markdowns)

  const pages = await cockpit.getPages()
  cockpit.normalizeResources(pages, images, assets, markdowns)

  cache.set('collections', collections)
  cache.set('regions', regions)
  cache.set('pages', pages)
  cache.set('images', images)
  cache.set('assets', assets)
  cache.set('markdowns', markdowns)

  // add placeholder image
  const brokenImagePlaceholderUrl =
    configOptions.brokenImagePlaceholderUrl || null
  const brokenImagePlaceholderImageNode = brokenImagePlaceholderUrl
    ? await fileNodeFactory.createImageNode(
        encodeURI(brokenImagePlaceholderUrl)
      )
    : null
  const brokenImagePlaceholderLocalPath = brokenImagePlaceholderImageNode
    ? copyFileToStaticFolder(brokenImagePlaceholderImageNode)
    : null

  // add no image placeholder URL => used to complete the schema
  const noImagePlaceholderUrl =
    configOptions.noImagePlaceholderUrl || 'https://placekitten.com/1600/1200'
  images[noImagePlaceholderUrl] = null

  for (let path in images) {
    const imageNode = await fileNodeFactory.createImageNode(encodeURI(path))
    if (imageNode) {
      try {
        images[path] = {
          localPath: copyFileToStaticFolder(imageNode),
          id: imageNode.id,
        }
      } catch (e) {
        console.error('Error copying image to static folder ', path)
      }
    } else {
      if (brokenImagePlaceholderUrl) {
        images[path] = {
          localPath: brokenImagePlaceholderLocalPath,
          id: brokenImagePlaceholderImageNode.id,
        }
      }
    }
  }

  // TODO: I probably can remove this
  if (brokenImagePlaceholderUrl) {
    images[brokenImagePlaceholderUrl] = {
      localPath: brokenImagePlaceholderLocalPath,
      id: brokenImagePlaceholderImageNode.id,
    }
  }

  for (let path in assets) {
    const assetNode = await fileNodeFactory.createAssetNode(encodeURI(path))
    assets[path] = {
      localPath: copyFileToStaticFolder(assetNode),
      id: assetNode.id,
    }
  }

  for (let markdown in markdowns) {
    const localMarkdown = updateAssetPathsWithLocalPaths(
      updateImagePathsWithLocalPaths(markdown, images),
      assets
    )
    const id = markdownNodeFactory.create(localMarkdown)
    markdowns[markdown] = { id }
  }

  collections.forEach(collection => {
    const nodeFactory = new CollectionItemNodeFactory(
      createNode,
      collection.name,
      images,
      assets,
      markdowns,
      configOptions
    )

    collection.items.forEach(item => {
      nodeFactory.create(item)
    })
  })

  regions.forEach(region => {
    const nodeFactory = new RegionItemNodeFactory(
      createNode,
      region.name,
      images,
      assets,
      markdowns,
      configOptions
    )

    region.items.forEach(item => {
      nodeFactory.create(item)
    })
  })

  pages.forEach(page => {
    const nodeFactory = new PageItemNodeFactory(
      createNode,
      page.name,
      images,
      assets,
      markdowns,
      configOptions
    )

    page.items.forEach(item => {
      nodeFactory.create(item)
    })
  })
}

const copyFileToStaticFolder = ({ absolutePath, name, ext, internal }) => {
  const localPath = path.join(
    '/',
    'static',
    `${name}-${internal.contentDigest}${ext}`
  )

  fs.copyFileSync(absolutePath, path.join(process.cwd(), 'public', localPath))

  return localPath
}

const updateImagePathsWithLocalPaths = (markdown, images) => {
  return markdown.replace(MARKDOWN_IMAGE_REGEXP_GLOBAL, (...match) =>
    match[0].replace(match[1], images[match[1]].localPath)
  )
}

const updateAssetPathsWithLocalPaths = (markdown, assets) => {
  return markdown.replace(MARKDOWN_ASSET_REGEXP_GLOBAL, (...match) =>
    assets[match[1]]
      ? match[0].replace(match[1], assets[match[1]].localPath)
      : match[0]
  )
}
