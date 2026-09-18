const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const vm = require('node:vm');

const servicePath = path.resolve(__dirname, '../services/quotationPdfService.js');
const serviceRequire = createRequire(servicePath);
const PDFDocument = serviceRequire('pdfkit');
const quotation = {
  communityKey: 'live',
  quotationMode: 'rental',
  quotationNumber: 'TEST-001',
  quotationDate: '2026-09-17',
  validUntil: '2026-09-30',
  clientName: 'Sample Client',
  subject: 'Equipment rental',
  items: [{ description: 'Display', quantity: 1, days: 2, unitRate: 1000, taxRate: 18, amount: 2360 }],
  subtotal: 2000,
  taxableAmount: 2000,
  taxAmount: 360,
  grandTotal: 2360,
};

const cases = [
  { name: 'installed fonts', missing: () => false, labels: ['₹ '] },
  { name: 'woff2 only', missing: (request) => request.endsWith('.woff'), labels: ['INR '] },
  { name: 'missing font package', missing: () => true, labels: ['INR '] },
  { name: 'missing bold fonts', missing: (request) => request.includes('-700-'), labels: ['₹ ', 'INR '] },
];

for (const scenario of cases) {
  test(`generates quotation PDF with ${scenario.name}`, async () => {
    const text = [];
    class ObservedDocument extends PDFDocument {
      text(value, ...args) {
        text.push(value);
        return super.text(value, ...args);
      }
    }
    const isolatedRequire = (request) =>
      request === 'pdfkit' ? ObservedDocument : serviceRequire(request);
    isolatedRequire.resolve = (request) => {
      if (request.startsWith('@fontsource/') && scenario.missing(request)) {
        throw Object.assign(new Error(`Missing test asset: ${request}`), { code: 'MODULE_NOT_FOUND' });
      }
      return serviceRequire.resolve(request);
    };
    const context = {
      require: isolatedRequire,
      module: { exports: {} },
      __dirname: path.dirname(servicePath),
      Buffer,
      process,
    };
    vm.runInNewContext(fs.readFileSync(servicePath, 'utf8'), context, { filename: servicePath });
    const pdf = await context.module.exports.generateQuotationPdf(quotation);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.match(pdf.subarray(-20).toString(), /%%EOF/);
    assert.ok(text.includes('QUOTATION'));
    assert.ok(text.includes('2,360.00'));
    for (const label of scenario.labels) assert.ok(text.includes(label), `Expected ${label}`);
    if (scenario.labels.length === 1) {
      assert.ok(!text.includes(scenario.labels[0] === 'INR ' ? '₹ ' : 'INR '));
    }
    if (process.env.PDF_QA_OUTPUT) {
      fs.mkdirSync(process.env.PDF_QA_OUTPUT, { recursive: true });
      fs.writeFileSync(path.join(process.env.PDF_QA_OUTPUT, `${scenario.name.replaceAll(' ', '-')}.pdf`), pdf);
    }
  });
}
