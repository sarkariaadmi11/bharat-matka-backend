module.exports = {
  customSiteTitle: 'Mahadev Matka | API Documentation',

  customCss: `
     /* Response box */
    .swagger-ui .responses-inner {
      background: #020617;
    }
      .topbar-wrapper {
    justify-content: space-between;
    display: flex;
}

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 6px;
    }

    ::-webkit-scrollbar-thumb {
      background: #d2d6d7;
      border-radius: 4px;
    }
  `,

  swaggerOptions: {
    docExpansion: 'none',
    filter: true,
    displayRequestDuration: true,
    persistAuthorization: true,
    tryItOutEnabled: true,
    tagsSorter: 'alpha',
    operationsSorter: 'method',
  },
};
