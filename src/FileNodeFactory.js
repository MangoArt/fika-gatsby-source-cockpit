const { generateNodeId } = require('gatsby-node-helpers').default({
  typePrefix: 'Cockpit',
})
const { createRemoteFileNode } = require('gatsby-source-filesystem')
const hash = require('string-hash')
const fs = require('fs')

module.exports = class FileNodeFactory {
  constructor(createNode, store, cache) {
    this.createNode = createNode
    this.store = store
    this.cache = cache
  }

  async createImageNode(path) {
    const imageNode = await createRemoteFileNode({
      url: path,
      store: this.store,
      cache: this.cache,
      createNode: this.createNode,
      createNodeId: () => generateNodeId('Image', `${hash(path)}`),
    })

    // TODO: check if file is image and not html page
    const imagePath = imageNode.absolutePath
    const content = fs.readFileSync(imagePath)
    if (content.indexOf('<title>Authenticate Please!</title>') > 0) {
      console.log('Invalid image url:', path)
      return null
    }
    return imageNode
  }

  async createAssetNode(path) {
    return createRemoteFileNode({
      url: path,
      store: this.store,
      cache: this.cache,
      createNode: this.createNode,
      createNodeId: () => generateNodeId('Asset', `${hash(path)}`),
    })
  }
}
