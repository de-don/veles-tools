## [1.4.0](https://github.com/de-don/veles-tools/compare/v1.3.1...v1.4.0) (2025-10-10)

### Features

* **active-deals:** add Active Deals page with real-time monitoring, P&L aggregation ([e8d617c](https://github.com/de-don/veles-tools/commit/e8d617cec81744dd5206e4848a185af0f83aebd3))
* **ui:** update donate button design with BuyMeACoffee branding ([d1adae4](https://github.com/de-don/veles-tools/commit/d1adae417981a6b95a8636a2394f82147b94d913))

## [1.3.1](https://github.com/de-don/veles-tools/compare/v1.3.0...v1.3.1) (2025-10-07)

### Bug Fixes

* **backtests:** rollback aggregate MPU metric removal ([baec423](https://github.com/de-don/veles-tools/commit/baec4239b25c56ab7c93df6e4b3bf143eb601159))

## [1.3.0](https://github.com/de-don/veles-tools/compare/v1.2.0...v1.3.0) (2025-10-07)

### Features

* add support for ru.veles.finance domain ([f14d9f6](https://github.com/de-don/veles-tools/commit/f14d9f60232afa19aca3da7c26d6889e2ab204f0))
* **api:** centralize API endpoint construction with `buildApiUrl` function ([d7051fc](https://github.com/de-don/veles-tools/commit/d7051fc748a781d52c4c524e388c689de2d32a63))
* **backtests:** add avgNetPerDay metric ([bc03145](https://github.com/de-don/veles-tools/commit/bc03145655bcddbec54d0fa030e28a0db7e13545))
* **backtests:** add error logging ([39a777c](https://github.com/de-don/veles-tools/commit/39a777ca7d06fd29db568d6fedad13cec26da117))
* **backtests:** add info tooltips for metrics ([144b62c](https://github.com/de-don/veles-tools/commit/144b62c13e1a381d28df826ed349ec06777a0bbf))
* **backtests:** add portfolio equity chart ([f193349](https://github.com/de-don/veles-tools/commit/f193349e6db929310a8a5661a494aaab19b17c09))
* **backtests:** add tabs for aggregation data and improve UI handling ([f9af790](https://github.com/de-don/veles-tools/commit/f9af790699ec31dc7363b63235645b529fc8f47e))
* **bots:** add filtering capabilities including API keys, status, and algorithms ([e88703e](https://github.com/de-don/veles-tools/commit/e88703e5853a13c5cc2664392850624f4a4f303e))
* **pagination:** add 100 option to page size selector ([731307f](https://github.com/de-don/veles-tools/commit/731307ff7e4afa1bee9821011c008edadec89291))

### Bug Fixes

* **backtests:** correct the problem when part of backtest results could be missed ([fa31e42](https://github.com/de-don/veles-tools/commit/fa31e420953cd9ad0c1e9cf0418364afb4b6143f))
* **backtests:** count all orders, not only finished ([a316fb2](https://github.com/de-don/veles-tools/commit/a316fb2a33c2508628006a31ec64f7f70ea16603))

## [1.2.0](https://github.com/de-don/veles-tools/compare/v1.1.0...v1.2.0) (2025-10-06)

### Features

* **backtests:** save previous currencies list to local storage ([571ceec](https://github.com/de-don/veles-tools/commit/571ceec8d51083194aa1f235fe01615d9a6a236a))

### Bug Fixes

* **backtests:** correct cancel button press in backtests modal ([6fc0c1e](https://github.com/de-don/veles-tools/commit/6fc0c1e59f3a05b8e91cc9751383e1fd4d526d48))

## [1.1.0](https://github.com/de-don/veles-tools/compare/v1.0.0...v1.1.0) (2025-10-05)

### Features

* add links to repo and author ([ade0e41](https://github.com/de-don/veles-tools/commit/ade0e4159454014c0881d234fce32f291baa9ffc))
* update texts & logo ([7f6acb7](https://github.com/de-don/veles-tools/commit/7f6acb7361390aabd064c57576add8118c2337b1))

## 1.0.0 (2025-10-05)

### Features

* add backtest execution functionality ([8567516](https://github.com/de-don/veles-tools/commit/85675165b84e63a6eecf99fabcec7b84dc2a5b10))
* add backtests support and connection status indicator ([87c84a7](https://github.com/de-don/veles-tools/commit/87c84a722a73aade587f88025cd99ce2b20f6a15))
* add bots page ([ec2f4e4](https://github.com/de-don/veles-tools/commit/ec2f4e4114b8224822170ecb1fb617e9996426d5))
* add cache for backtests ([64f3cb1](https://github.com/de-don/veles-tools/commit/64f3cb145dc80e7bdad1f9d8e89894a828ff49a5))
* add custom backtests ([0790892](https://github.com/de-don/veles-tools/commit/0790892e24499554dd67cd4c761336a54ec0dfd1))
* add detailed statistics ([502f831](https://github.com/de-don/veles-tools/commit/502f831860e9651606d49cf7a5a18a9e9219a2e3))
* add dynamic version and name handling ([4694c6b](https://github.com/de-don/veles-tools/commit/4694c6b8377f17abfe5a98924d0e9df6f585a8ea))
* add multi backtests and aggregation logic ([4fd8cb6](https://github.com/de-don/veles-tools/commit/4fd8cb6086125dbabe82c5129737ab5a7e7c01a1))
* add settings page ([29944f5](https://github.com/de-don/veles-tools/commit/29944f5f368f8130c84102bd125660ecafa121ff))
* dynamic icon (wip) ([d6cb0dd](https://github.com/de-don/veles-tools/commit/d6cb0dd394ca4c1d205cf760346a887a3046e4f0))
* implement extension UI ([956cef5](https://github.com/de-don/veles-tools/commit/956cef5606f2225a620c0816d2c3a79315f99ba1))
* open veles tab when not opened ([5a2e673](https://github.com/de-don/veles-tools/commit/5a2e673592a99b56338ed43a218557997b8ac96a))
* release & docs ([3c954c0](https://github.com/de-don/veles-tools/commit/3c954c0c0a0151c3b3a47c23c03286159c852b3c))
