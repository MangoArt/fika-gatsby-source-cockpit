exports.METHODS = { GET: "GET", POST: "POST" };
exports.MARKDOWN_IMAGE_REGEXP_GLOBAL = /!\[[^\]]*\]\(([^\)]*)\)/g;
exports.MARKDOWN_ASSET_REGEXP_GLOBAL = /[^!]\[[^\]]*\]\(([^\)]*)\)/g;
exports.MARKDOWN_IMAGE_REGEXP = /!\[[^\]]*\]\(([^\)]*)\)/;
exports.MARKDOWN_ASSET_REGEXP = /[^!]\[[^\]]*\]\(([^\)]*)\)/;

exports.TYPE_PREFIX_COCKPIT = 'Cockpit';
exports.TYPE_PREFIX_COCKPIT_COLLECTION = exports.TYPE_PREFIX_COCKPIT + 'Collection';
exports.TYPE_PREFIX_COCKPIT_REGION = exports.TYPE_PREFIX_COCKPIT + 'Region';
exports.TYPE_PREFIX_COCKPIT_PAGE = exports.TYPE_PREFIX_COCKPIT + 'Page';
