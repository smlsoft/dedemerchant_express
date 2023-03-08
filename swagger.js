const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DEDEMERCHANT REPORT',
      version: '1.0.0',
    },
    
  },
  apis: ['./routes/api/swagger/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
