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
  clientEmail: 'client@example.test',
  createdBy: { name: 'Sample Creator', email: 'creator@example.test', position: 'Executive' },
  departmentId: { name: 'Accounts' },
  companyGstin: 'SAMPLE-GSTIN',
  subject: 'Equipment rental',
  items: [
    { description: 'Display', quantity: 1, days: 2, unitRate: 1000, taxRate: 18, amount: 2360 },
  ],
  subtotal: 2000,
  taxableAmount: 2000,
  taxAmount: 360,
  grandTotal: 2360,
};

const cases = [
  { name: 'installed fonts', missing: () => false, labels: ['₹ '] },
  { name: 'woff2 only', missing: (request) => request.endsWith('.woff'), labels: ['₹ '] },
  { name: 'missing font package', missing: () => true, labels: ['₹ '] },
  { name: 'missing bold fonts', missing: (request) => request.includes('-700-'), labels: ['₹ '] },
];

for (const scenario of cases) {
  test(`generates quotation PDF with ${scenario.name}`, async () => {
    const text = [];
    const placements = [];
    const fontPaths = [];
    class ObservedDocument extends PDFDocument {
      text(value, ...args) {
        text.push(value);
        placements.push({ value, x: args[0], y: args[1] });
        return super.text(value, ...args);
      }
      registerFont(name, fontPath, ...args) {
        fontPaths.push(fontPath);
        return super.registerFont(name, fontPath, ...args);
      }
    }
    const isolatedRequire = (request) =>
      request === 'pdfkit' ? ObservedDocument : serviceRequire(request);
    isolatedRequire.resolve = (request) => {
      if (request.startsWith('@fontsource/') && scenario.missing(request)) {
        throw Object.assign(new Error(`Missing test asset: ${request}`), {
          code: 'MODULE_NOT_FOUND',
        });
      }
      return serviceRequire.resolve(request);
    };
    const context = {
      require: isolatedRequire,
      module: { exports: {} },
      __dirname: path.dirname(servicePath),
      Buffer,
      process: { env: { ...process.env, COMPANY_EMAIL: 'website@example.test' } },
    };
    vm.runInNewContext(fs.readFileSync(servicePath, 'utf8'), context, { filename: servicePath });
    const pdf = await context.module.exports.generateQuotationPdf(quotation);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.match(pdf.subarray(-20).toString(), /%%EOF/);
    assert.ok(text.includes('QUOTATION'));
    assert.ok(text.includes('2,360.00'));
    assert.equal(text.filter((value) => value.startsWith('Prepared by:')).length, 1);
    assert.ok(!text.some((value) => /Department|Designation|Executive|Accounts/.test(value)));
    const preparedBy = placements.find((entry) => entry.value === 'Prepared by: Sample Creator');
    assert.equal(preparedBy.y, 746);
    assert.ok(
      placements.some(
        (entry) => entry.value.includes('creator@example.test') && entry.y > preparedBy.y,
      ),
    );
    assert.ok(text.includes('client@example.test'), 'Bill To keeps the client email');
    assert.ok(!text.some((value) => value.includes('website@example.test')));
    assert.equal(fontPaths.length, 4);
    assert.ok(fontPaths.every((fontPath) => fontPath.includes(path.join('assets', 'fonts'))));
    for (const label of scenario.labels) assert.ok(text.includes(label), `Expected ${label}`);
    if (scenario.labels.length === 1) {
      assert.ok(!text.includes(scenario.labels[0] === 'INR ' ? '₹ ' : 'INR '));
    }
    if (process.env.PDF_QA_OUTPUT) {
      fs.mkdirSync(process.env.PDF_QA_OUTPUT, { recursive: true });
      fs.writeFileSync(
        path.join(process.env.PDF_QA_OUTPUT, `${scenario.name.replaceAll(' ', '-')}.pdf`),
        pdf,
      );
    }
    text.length = 0;
    await context.module.exports.generateQuotationPdf({ ...quotation, createdBy: null });
    assert.ok(text.includes('Prepared by: -'));
    assert.ok(!text.some((value) => value.includes('website@example.test')));
  });
}

test('bundled regular and bold currency fonts contain the rupee glyph', () => {
  const fontkit = serviceRequire('fontkit');
  for (const weight of [400, 700]) {
    const font = fontkit.openSync(
      path.resolve(__dirname, `../assets/fonts/noto-sans-devanagari-${weight}-normal.woff`),
    );
    assert.ok(font.hasGlyphForCodePoint(0x20b9));
  }
});
