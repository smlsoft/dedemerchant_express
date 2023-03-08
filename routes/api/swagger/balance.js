/**
 * @swagger
* tags:
 *   - name: balance
 *     description: Report balance
 * /api/balance:
 *   get:
 *     tags:
 *       - balance
 *     summary: Get Report Balance
 *     description: Get Report Balance
 *     responses:
 *       200:
 *         description: list Balance
 * /api/balance/pdfview:
 *   get:
 *     tags:
 *       - balance
 *     summary: Get PDF Preview Report Balance
 *     description: Get Report Balance
 *     responses:
 *       200:
 *         description: list Balance
 * /api/balance/pdfdownload:
 *   get:
 *     tags:
 *       - balance
 *     summary: Get PDF Preview Report Balance Download
 *     description: Get Report Balance
 *     responses:
 *       200:
 *         description: list Balance
 * /sendPDFEmail:
 *   post:
 *     summary: Send PDF to Email
 *     requestBody:
 *       description: Send PDF to Email
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: array
 *                 items:
 *                   type: string
 *               report:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Created
 *       '400':
 *         description: Bad request
 */