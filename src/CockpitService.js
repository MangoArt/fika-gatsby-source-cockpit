const mime = require('mime')
const request = require('request-promise')
const getFieldsOfTypes = require('./helpers.js').getFieldsOfTypes
const slugify = require('slugify')
const merge = require('lodash').merge

const {
  METHODS,
  MARKDOWN_IMAGE_REGEXP,
  MARKDOWN_ASSET_REGEXP,
} = require('./constants')

module.exports = class CockpitService {
  constructor(
    baseUrl,
    token,
    locales,
    defaultLocale,
    whiteListedCollectionNames = []
  ) {
    this.baseUrl = baseUrl
    this.token = token
    this.locales = locales
    this.defaultLocale = defaultLocale
    this.whiteListedCollectionNames = whiteListedCollectionNames
  }

  async fetch(endpoint, method, lang = null) {
    const uri = `${this.baseUrl}/api${endpoint}?token=${this.token}${
      lang ? `&lang=${lang}` : ''
    }`

    return request({
      uri,
      method,
      json: true,
    })
  }

  async validateBaseUrl() {
    try {
      await this.fetch('', METHODS.GET)
    } catch (error) {
      throw new Error(
        'BaseUrl config parameter is invalid or there is no internet connection'
      )
    }
  }

  async validateToken() {
    try {
      await this.fetch('/collections/listCollections', METHODS.GET)
    } catch (error) {
      throw new Error('Token config parameter is invalid')
    }
  }

  async getCollectionNames() {
    return this.fetch('/collections/listCollections', METHODS.GET)
  }

  async getCollection(name) {
    const { fields: collectionFields, entries } = await this.fetch(
      `/collections/get/${name}`,
      METHODS.GET
    )

    const items = entries.map(entry =>
      createCollectionItem(name, collectionFields, entry, this.defaultLocale)
    )

    for (let index = 0; index < this.locales.length; index++) {
      const { fields: collectionFields, entries } = await this.fetch(
        `/collections/get/${name}`,
        METHODS.GET,
        this.locales[index]
      )

      items.push(
        ...entries.map(entry =>
          createCollectionItem(
            name,
            collectionFields,
            this.extractLanguageValues(entry, this.locales[index]),
            this.locales[index]
          )
        )
      )
    }

    return { items, name }
  }

  mergeObjects(obj1, obj2, locale) {
    return merge({}, obj1, obj2)
  }

  writeFile(name, content) {
    fs.writeFile(`./${name}.json`, content, function(err) {
      if (err) {
        return console.log(err)
      }
      console.log('The file was saved!')
    })
  }

  extractLanguageValues(entry, locale, debug) {
    if (entry === null) {
      return null
    }
    const value = {}
    Object.keys(entry).forEach(key => {
      if (
        key.endsWith(`_${locale}`) &&
        entry.hasOwnProperty(key.replace(`_${locale}`, ''))
      ) {
        // ignore => we only examine the default props
      } else if (key.endsWith(`_${locale}`)) {
        // no default prop, copy over
        value[key] = entry[key]
      } else if (Array.isArray(entry[key])) {
        if (entry.hasOwnProperty(`${key}_${locale}`)) {
          // TODO: Add check for object
          try {
            if (entry[key].length === entry[`${key}_${locale}`].length) {
              value[key] = entry[key].map((arrayEntry, index) => {
                return this.extractLanguageValues(
                  this.mergeObjects(
                    arrayEntry,
                    entry[`${key}_${locale}`][index],
                    locale
                  ),
                  locale
                )
              })
            } else {
              value[key] = entry[`${key}_${locale}`].map(arrayEntry =>
                this.extractLanguageValues(arrayEntry, locale)
              )
            }
          } catch (e) {
            // TODO: FIX THIS
            console.log(e)
          }
        } else {
          value[key] = entry[key].map(arrayEntry =>
            this.extractLanguageValues(arrayEntry, locale)
          )
        }
      } else if (typeof entry[key] === 'object') {
        if (entry.hasOwnProperty(`${key}_${locale}`)) {
          const mergedObjects = this.mergeObjects(
            entry[key],
            entry[`${key}_${locale}`],
            locale
          )
          value[key] = this.extractLanguageValues(mergedObjects, locale)
        } else {
          value[key] = this.extractLanguageValues(entry[key], locale)
        }
      } else if (entry.hasOwnProperty(`${key}_${locale}`)) {
        value[key] = entry[`${key}_${locale}`]
      } else {
        value[key] = entry[key]
      }
    })
    return value
  }

  async getCollections() {
    const names = await this.getCollectionNames()
    const whiteListedNames = this.whiteListedCollectionNames

    return Promise.all(
      names
        .filter(
          name =>
            whiteListedNames === null ||
            (Array.isArray(whiteListedNames) &&
              whiteListedNames.length === 0) ||
            whiteListedNames.includes(name)
        )
        .map(name => this.getCollection(name))
    )
  }

  async getRegionNames() {
    return this.fetch('/regions/listRegions', METHODS.GET)
  }

  async getRegion(name) {
    const { fields: regionFields, entries } = await this.fetch(
      `/regions/get/${name}`,
      METHODS.GET
    )

    const items = entries.map(entry =>
      createCollectionItem(name, regionFields, entry, this.defaultLocale)
    )

    for (let index = 0; index < this.locales.length; index++) {
      const { fields: regionFields, entries } = await this.fetch(
        `/regions/get/${name}`,
        METHODS.GET,
        this.locales[index]
      )

      items.push(
        ...entries.map(entry =>
          createCollectionItem(
            name,
            regionFields,
            this.extractLanguageValues(entry, this.locales[index]),
            this.locales[index]
          )
        )
      )
    }

    return { items, name }
  }

  async getRegions() {
    const names = await this.getRegionNames()
    return Promise.all(names.map(name => this.getRegion(name)))
  }

  async getPageNames() {
    return this.fetch('/pages/listPages', METHODS.GET)
  }

  async getPage(name) {
    const { fields: pageFields, entries } = await this.fetch(
      `/pages/get/${name}`,
      METHODS.GET
    )

    const items = entries.map(entry =>
      createCollectionItem(name, pageFields, entry, this.defaultLocale)
    )

    for (let index = 0; index < this.locales.length; index++) {
      const { fields: pageFields, entries } = await this.fetch(
        `/pages/get/${name}`,
        METHODS.GET,
        this.locales[index]
      )

      items.push(
        ...entries.map(entry =>
          createCollectionItem(
            name,
            pageFields,
            this.extractLanguageValues(entry, this.locales[index]),
            this.locales[index]
          )
        )
      )
    }

    return { items, name }
  }

  async getPages() {
    const names = await this.getPageNames()
    return Promise.all(names.map(name => this.getPage(name)))
  }

  normalizeResources(
    collections,
    existingImages = {},
    existingAssets = {},
    existingMarkdowns = {}
  ) {
    collections.forEach(collection => {
      collection.items.forEach(item => {
        this.normalizeCollectionItemImages(item, existingImages)
        this.normalizeCollectionItemAssets(item, existingAssets)
        this.normalizeCollectionItemMarkdowns(
          item,
          existingImages,
          existingAssets,
          existingMarkdowns
        )
      })
    })

    return {
      images: existingImages,
      assets: existingAssets,
      markdowns: existingMarkdowns,
    }
  }

  normalizeCollectionItemImages(item, existingImages) {
    getFieldsOfTypes(item, ['image', 'gallery']).forEach(field => {
      if (!Array.isArray(field.value)) {
        const imageField = field
        if (!imageField.value) {
          return
        }
        let path = imageField.value.path

        if (path == null) {
          return
        }

        if (path.startsWith('/')) {
          path = `${this.baseUrl}${path}`
        } else if (!path.startsWith('http')) {
          path = `${this.baseUrl}/${path}`
        }

        imageField.value = path
        existingImages[path] = null
      } else {
        const galleryField = field

        galleryField.value.forEach(galleryImageField => {
          let path = galleryImageField.path

          if (path == null) {
            return
          }

          trimGalleryImageField(galleryImageField)

          if (path.startsWith('/')) {
            path = `${this.baseUrl}${path}`
          } else {
            path = `${this.baseUrl}/${path}`
          }

          galleryImageField.value = path
          existingImages[path] = null
        })
      }
    })

    // Check the child items of the collection for any images
    if (Array.isArray(item.children)) {
      item.children.forEach(child => {
        this.normalizeCollectionItemImages(child, existingImages)
      })
    }
  }

  normalizeCollectionItemAssets(item, existingAssets) {
    getFieldsOfTypes(item, ['asset']).forEach(assetField => {
      if (!assetField.value) {
        return
      }

      let path = assetField.value.path

      trimAssetField(assetField)

      path = `${this.baseUrl}/storage/uploads${path}`

      assetField.value = path
      existingAssets[path] = null
    })

    getFieldsOfTypes(item, ['file']).forEach(fileField => {
      if (!fileField.value) {
        return
      }

      let path = fileField.value

      path = `${this.baseUrl}/${path}`

      fileField.value = path
      existingAssets[path] = null
    })

    if (Array.isArray(item.children)) {
      item.children.forEach(child => {
        this.normalizeCollectionItemAssets(child, existingAssets)
      })
    }
  }

  normalizeCollectionItemMarkdowns(
    item,
    existingImages,
    existingAssets,
    existingMarkdowns
  ) {
    getFieldsOfTypes(item, ['markdown']).forEach(markdownField => {
      existingMarkdowns[markdownField.value] = null
      extractImagesFromMarkdown(markdownField.value, existingImages)
      extractAssetsFromMarkdown(markdownField.value, existingAssets)
    })

    if (Array.isArray(item.children)) {
      item.children.forEach(child => {
        this.normalizeCollectionItemMarkdowns(
          child,
          existingImages,
          existingAssets,
          existingMarkdowns
        )
      })
    }
  }
}

const trimAssetField = assetField => {
  delete assetField.value._id
  delete assetField.value.path
  delete assetField.value.title
  delete assetField.value.mime
  delete assetField.value.size
  delete assetField.value.image
  delete assetField.value.video
  delete assetField.value.audio
  delete assetField.value.archive
  delete assetField.value.document
  delete assetField.value.code
  delete assetField.value.created
  delete assetField.value.modified
  delete assetField.value._by

  Object.keys(assetField.value).forEach(attribute => {
    assetField[attribute] = assetField.value[attribute]
    delete assetField.value[attribute]
  })
}

const trimGalleryImageField = galleryImageField => {
  galleryImageField.type = 'image'

  delete galleryImageField.meta.asset
  delete galleryImageField.path
}

const createCollectionItem = (
  collectionName,
  collectionFields,
  collectionEntry,
  locale = null,
  level = 1
) => {
  const item = {
    cockpitId: collectionEntry._id,
    lang: locale == null ? 'any' : locale,
    level: level,
  }

  if (collectionEntry.hasOwnProperty('_o')) {
    item.order = collectionEntry._o
  }

  Object.keys(collectionFields).reduce((accumulator, collectionFieldName) => {
    const collectionFieldValue = collectionEntry[collectionFieldName]
    const collectionFieldConfiguration = collectionFields[collectionFieldName]
    const field = createCollectionField(
      collectionName,
      collectionFieldValue,
      collectionFieldConfiguration
    )

    if (field !== null) {
      accumulator[collectionFieldName] = field
    }

    return accumulator
  }, item)

  if (collectionEntry.hasOwnProperty('children')) {
    item.children = collectionEntry.children.map(childEntry => {
      return createCollectionItem(
        collectionName,
        collectionFields,
        childEntry,
        locale,
        level + 1
      )
    })
  }

  return item
}

const createCollectionField = (
  collectionName,
  collectionFieldValue,
  collectionFieldConfiguration
) => {
  const collectionFieldType = collectionFieldConfiguration.type

  /* if (
    !(
      Array.isArray(collectionFieldValue) && collectionFieldValue.length === 0
    ) &&
    collectionFieldValue != null &&
     collectionFieldValue !== ''
  ) { */
  const itemField = {
    type: collectionFieldType,
  }

  if (collectionFieldType === 'repeater') {
    const repeaterFieldOptions = collectionFieldConfiguration.options || {}

    if (
      (Array.isArray(collectionFieldValue) &&
        collectionFieldValue.length === 0) ||
      collectionFieldValue === null ||
      collectionFieldValue === ''
    ) {
      itemField.value = []
    } else if (typeof repeaterFieldOptions.field !== 'undefined') {
      try {
        itemField.value = collectionFieldValue.map(repeaterEntry =>
          createCollectionField(
            collectionName,
            repeaterEntry.value,
            repeaterFieldOptions.field
          )
        )
      } catch (e) {
        // TODO: FIX THIS
        console.log(e)
      }
    } else if (typeof repeaterFieldOptions.fields !== 'undefined') {
      if (collectionFieldValue) {
        try {
          itemField.value = collectionFieldValue.map(repeaterEntry =>
            repeaterFieldOptions.fields.reduce(
              (accumulator, currentFieldConfiguration) => {
                if (
                  typeof currentFieldConfiguration.name === 'undefined' &&
                  currentFieldConfiguration.label === repeaterEntry.field.label
                ) {
                  const generatedNameProperty = slugify(
                    currentFieldConfiguration.label,
                    { lower: true }
                  )
                  console.warn(
                    `\nRepeater field without 'name' attribute used in collection '${collectionName}'. ` +
                      `Using value '${generatedNameProperty}' for name (generated from the label).`
                  )
                  currentFieldConfiguration.name = generatedNameProperty
                  repeaterEntry.field.name = generatedNameProperty
                }

                if (
                  currentFieldConfiguration.name === repeaterEntry.field.name
                ) {
                  accumulator.valueType = currentFieldConfiguration.name
                  accumulator.value[
                    currentFieldConfiguration.name
                  ] = createCollectionField(
                    collectionName,
                    repeaterEntry.value,
                    currentFieldConfiguration
                  )
                }

                return accumulator
              },
              {
                type: 'set',
                value: {},
              }
            )
          )
        } catch (e) {
          // TODO: FIX THIS
          console.log(e)
        }
      } else {
        itemField.value = []
      }
    }
  } else if (collectionFieldType === 'set') {
    const setFieldOptions = collectionFieldConfiguration.options || {}
    if (setFieldOptions.fields) {
      itemField.value = setFieldOptions.fields.reduce(
        (accumulator, currentFieldConfiguration) => {
          const currentFieldName = currentFieldConfiguration.name
          accumulator[currentFieldName] = createCollectionField(
            collectionName,
            collectionFieldValue
              ? collectionFieldValue[currentFieldName]
              : null,
            currentFieldConfiguration
          )

          return accumulator
        },
        {}
      )
    } else {
      // TODO: report error
      itemField.value = {}
    }
  } else {
    itemField.value = collectionFieldValue
  }

  return itemField
  /* }

  return null */
}

const extractImagesFromMarkdown = (markdown, existingImages) => {
  let unparsedMarkdown = markdown
  let match

  while ((match = MARKDOWN_IMAGE_REGEXP.exec(unparsedMarkdown))) {
    unparsedMarkdown = unparsedMarkdown.substring(match.index + match[0].length)
    existingImages[match[1]] = null
  }
}

const extractAssetsFromMarkdown = (markdown, existingAssets) => {
  let unparsedMarkdown = markdown
  let match

  while ((match = MARKDOWN_ASSET_REGEXP.exec(unparsedMarkdown))) {
    unparsedMarkdown = unparsedMarkdown.substring(match.index + match[0].length)
    const mediaType = mime.getType(match[1])

    if (mediaType && mediaType !== 'text/html') {
      existingAssets[match[1]] = null
    }
  }
}
