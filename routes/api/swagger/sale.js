/**
 * @swagger
* tags:
 *   - name: sale
 *     description: Report sale
 * /api/sale:
 *   get:
 *     tags:
 *       - sale
 *     summary: Get Report sale
 *     description: Get Report sale
 *     parameters:
 *       - in: query
 *         name: fromdate
 *         description: fromdate
 *         schema:
 *           type: string
 *       - in: query
 *         name: todate
 *         description: todate
 *         schema:
 *           type: string
 *       - in: query
 *         name: mode
 *         description: mode
 *         schema:
 *           type: string
 *       - in: query
 *         name: doctype
 *         description: doctype
 *         schema:
 *           type: string
 *       - in: query
 *         name: custcode
 *         description: custcode
 *         schema:
 *           type: string
 *       - in: query
 *         name: inquirytype
 *         description: inquirytype
 *         schema:
 *           type: string
 *       - in: query
 *         name: vattype
 *         description: vattype
 *         schema:
 *           type: string
 *       - in: query
 *         name: ispos
 *         description: ispos
 *         schema:
 *           type: string
 *       - in: query
 *         name: itemcode
 *         description: itemcode
 *         schema:
 *           type: string
 *       - in: query
 *         name: whcode
 *         description: whcode
 *         schema:
 *           type: string
 *       - in: query
 *         name: shelfcode
 *         description: shelfcode
 *         schema:
 *           type: string
 *       - in: query
 *         name: salecode
 *         description: salecode
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: list sale
 * /api/sale/pdfview:
 *   get:
 *     tags:
 *       - sale
 *     summary: Get PDF Preview Report sale
 *     description: Get Report sale
 *     responses:
 *       200:
 *         description: list sale
 * /api/sale/pdfdownload:
 *   get:
 *     tags:
 *       - sale
 *     summary: Get PDF Preview Report sale Download
 *     description: Get Report sale
 *     responses:
 *       200:
 *         description: list sale
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