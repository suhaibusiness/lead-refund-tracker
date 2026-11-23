# Vendored code in Lead Refund Tracker

Served from this site only, so reading a screenshot asks no other host for anything (specs/one-input-tools.md §4,
AC-X1). Downloaded 23 Nov 2026 as the published npm tarballs from registry.npmjs.org; no npm install was run.
To update: download the new tarball, copy the same files, update the hashes below, run tests.html and the walk.

| File | Package and version | Licence | Bytes | SHA-256 |
|---|---|---|---|---|
| tesseract/tesseract.min.js | tesseract.js 7.0.0 `dist/` | Apache-2.0 (tesseract/LICENSE.md) | 62,961 | 000c27d9cd0def655f77b36c72a389c0ab13793aa31cb4d7aab56d09c0afbc7e |
| tesseract/worker.min.js | tesseract.js 7.0.0 `dist/` | Apache-2.0 | 111,307 | 576b7df7e3393e137e51849357c9adb53fe7ac1bb69bfa06cf3d61520f182c6d |
| tesseract/core/tesseract-core-lstm.wasm.js | tesseract.js-core 7.0.0 | Apache-2.0 (tesseract/core/LICENSE) | 3,896,484 | eef5f8b2f8e20e150680b20adaec4a60babafee3adbe8a94583c81fee46e8680 |
| tesseract/core/tesseract-core-simd-lstm.wasm.js | tesseract.js-core 7.0.0 | Apache-2.0 | 3,899,472 | c58b46a4c796c0b8afccf77591d5b875b6896b45d402bbce8caa6f5362447b38 |
| tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js | tesseract.js-core 7.0.0 | Apache-2.0 | 3,905,767 | 861a536cf9ef8e63cb644d57bab39c388f37f7d6b6f60024b741c5f6b39a59b3 |
| tesseract/lang/eng.traineddata.gz | @tesseract.js-data/eng 1.0.0, `4.0.0_best_int/` | package MIT; the data is Tesseract's tessdata_best, Apache-2.0 | 2,952,873 | 45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91 |

Only the three LSTM cores are shipped: the worker runs with OEM 1 (LSTM only) and picks one of them by what the
browser supports (relaxed SIMD, SIMD, or neither). The legacy-engine cores and `4.0.0/` language data are not needed.

The same files and hashes as payout-shield/js/vendor/ (copied 23 Nov 2026). pdf.js is not shipped here: lead emails come as
text, .eml files, screenshots or CSV, and js/docread.js only loads pdf.js for a PDF, which this tool does not accept.
