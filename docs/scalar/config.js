const fs = require('fs');
const path = require('path');

const customCss = fs.readFileSync(path.join(__dirname, 'custom.css'), 'utf8');
const customJs = fs.readFileSync(path.join(__dirname, 'custom.js'), 'utf8');

module.exports = {
  spec: {
    url: '/openapi/v1.json',
  },

  // Core UI options
  showDeveloperTools: 'never',
  showToolbar: 'localhost',
  operationTitleSource: 'summary',
  theme: 'default',
  persistAuth: false,
  telemetry: true,
  layout: 'modern',
  isEditable: false,
  isLoading: false,
  hideModels: false,
  documentDownloadType: 'both',
  hideTestRequestButton: false,
  hideSearch: false,
  showOperationId: false,
  hideDarkModeToggle: false,
  withDefaultFonts: true,
  defaultOpenFirstTag: true,
  defaultOpenAllTags: false,
  expandAllModelSections: false,
  expandAllResponses: false,
  orderSchemaPropertiesBy: 'alpha',
  orderRequiredPropertiesFirst: true,
  searchHotKey: 'k',
  _integration: 'express',
  hideDownloadButton: false,
  darkMode: true,
  showSidebar: true,
  hideClientButton: true,

  metaData: {
    title: 'Mahadev Matka Developer API',
    description: 'Official API Documentation',
  },

  default: false,
  slug: 'api-1',
  title: 'API #1',

  customCss,
  customJs,
};
