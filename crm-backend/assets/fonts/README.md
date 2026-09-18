# Quotation PDF fonts

These unmodified Noto Sans WOFF files are copied from `@fontsource/noto-sans` 5.3.0.
The Latin files provide quotation text; the Devanagari files include U+20B9 (₹).
Both regular (400) and bold (700) weights are required.

Deploy this directory with the backend. PDF generation uses these files directly,
so a missing font package in `node_modules` cannot change ₹ to INR or break downloads.
The included `LICENSE` contains the SIL Open Font License and copyright notice.
