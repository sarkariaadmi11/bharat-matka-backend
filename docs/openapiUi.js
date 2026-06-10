const buildHtml = ({ title, body }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>html,body{margin:0;padding:0;height:100%;}</style>
</head>
<body>
${body}
</body>
</html>`;

const swaggerHtml = (specUrl) => buildHtml({
  title: 'Swagger UI',
  specUrl,
  body: `
  <div id="swagger-ui"></div>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: '${specUrl}', dom_id: '#swagger-ui' });
  </script>
  `,
});

const redocHtml = (specUrl) => buildHtml({
  title: 'Redoc',
  specUrl,
  body: `
  <redoc spec-url="${specUrl}"></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  `,
});

const createOpenApiUiMiddleware = ({ ui = 'scalar', specUrl = '/openapi.json' } = {}) => {
  if (ui === 'swagger') {
    return (req, res) => res.send(swaggerHtml(specUrl));
  }

  if (ui === 'redoc') {
    return (req, res) => res.send(redocHtml(specUrl));
  }

  return async (req, res, next) => {
    try {
      const { apiReference } = await import('@scalar/express-api-reference');
      const middleware = apiReference({ spec: { url: specUrl } });
      return middleware(req, res, next);
    } catch (error) {
      return next(error);
    }
  };
};

module.exports = {
  createOpenApiUiMiddleware,
};

