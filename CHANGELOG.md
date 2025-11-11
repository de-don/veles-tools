## [2.0.0](https://github.com/de-don/veles-tools/compare/v1.8.3...v2.0.0) (2025-11-11)

### ⚠ BREAKING CHANGES

* **backtests:** all calculations is updated

### Features

* **active-deals:** add grouping by API key and enhance chart options ([5e08a07](https://github.com/de-don/veles-tools/commit/5e08a07841555cfc268bae2a5ab062d5931ce047))
* **backtests:** rewrite backtests logic from scratch ([7328c4d](https://github.com/de-don/veles-tools/commit/7328c4d528b1b9e287e219fcc3607dceb6be62c2))

## [1.8.3](https://github.com/de-don/veles-tools/compare/v1.8.2...v1.8.3) (2025-11-08)

### Bug Fixes

* **support:** referral code ([3618383](https://github.com/de-don/veles-tools/commit/36183830da59f3db17947776ccd1f7ca9ccc0662))

## [1.8.2](https://github.com/de-don/veles-tools/compare/v1.8.1...v1.8.2) (2025-11-06)

### Bug Fixes

* **support-project:** enhance support modal with email copy functionality and referral details ([484c371](https://github.com/de-don/veles-tools/commit/484c371535f8db60035e4912005ff8ea3a6a7ff0))

## [1.8.1](https://github.com/de-don/veles-tools/compare/v1.8.0...v1.8.1) (2025-11-06)

### Bug Fixes

* **backtests:** correct risks calculation ([1201e99](https://github.com/de-don/veles-tools/commit/1201e99281546676bfc5523f42df6b546f4c5772))

## [1.8.0](https://github.com/de-don/veles-tools/compare/v1.7.0...v1.8.0) (2025-11-05)

### Features

* **active-deals:** add sort by executedOrdersCount ([248dbc1](https://github.com/de-don/veles-tools/commit/248dbc1ab330ad343bb3c76b5c92131275cf8d2b))
* **support-project:** add free type of support ([686b121](https://github.com/de-don/veles-tools/commit/686b121ea08d0ec6ffc03814ae259bdb13518339))
* **ui:** add configurable API request delay settings ([1f864bf](https://github.com/de-don/veles-tools/commit/1f864bf39491baf095655dc943f9bbee788f2bf5))

### Bug Fixes

* **backtests:** allow to stop backtests run ([d16c0e8](https://github.com/de-don/veles-tools/commit/d16c0e8a60764a51933fc19ba6503da1e4bf1eac))
* **backtests:** correct open position risk handling in metrics and aggregation ([daeadba](https://github.com/de-don/veles-tools/commit/daeadba703977a71905fccbdec89468e5c7fd3f3))

## [1.7.0](https://github.com/de-don/veles-tools/compare/v1.6.0...v1.7.0) (2025-10-31)

### Features

* **active-deals:** restrict position history to 1 hour ([0ea0a31](https://github.com/de-don/veles-tools/commit/0ea0a316d44cd95d346a51cbad5839d87a33c5b9))
* **backtest:** add backtests-groups & update sync logic ([dc94647](https://github.com/de-don/veles-tools/commit/dc94647a888e6dd405f706d375b36fedda9564ba))
* **backtest:** add worst risk and risk efficiency metrics to backtest calculations and charts ([7ee124c](https://github.com/de-don/veles-tools/commit/7ee124c7512bc5cd29315d2402c9da5e2d32949f))
* **backtest:** include open positions in risk metrics ([d37a66d](https://github.com/de-don/veles-tools/commit/d37a66d03605fbf3e2264b1444a4f84dd3561bef))
* **backtests:** local work with loaded backtests ([84fce02](https://github.com/de-don/veles-tools/commit/84fce02108de42bdbdc1ea454f8df4b95cce8e0f))
* **bots:** make bot ID clickable with a link to the bot's page ([6656aac](https://github.com/de-don/veles-tools/commit/6656aaced03831b017cec9dae9130ea6ecb3e507))
* **extension:** enhance security with nonce validation and iframe restrictions ([7806e71](https://github.com/de-don/veles-tools/commit/7806e71219df439d8f0d90b7881dbe58401c5bb2))
* **layout:** refactor AppLayout with new navigation structure and improved styling ([43ce9b6](https://github.com/de-don/veles-tools/commit/43ce9b6115c0ff45cd099180eb9cc029691f1721))
* **ui:** add open deals and active Mpu metrics to BacktestAggregationPanel and update BacktestCycle status ([8bc0553](https://github.com/de-don/veles-tools/commit/8bc0553570c7d7d3f02763672372238060a4372d))
* **ui:** enhance BacktestsPage with selection summary and improved empty state messaging ([abf2338](https://github.com/de-don/veles-tools/commit/abf2338dcb20e27f9dbac34df97e6682148de50d))
* **ui:** introduce StatisticCard component and replace aggregation metrics with it in ActiveDealsPage and BacktestAggregationPanel ([41d9512](https://github.com/de-don/veles-tools/commit/41d9512db521942b3c8e850407d8e2ab2626e8c5))
* **ui:** sort BacktestGroups by recent activity and set default sort order ([4f03018](https://github.com/de-don/veles-tools/commit/4f03018d45a2ba3a9a17b8b6c427efb936f5d6ff))
* **ui:** update "Support Project" button with dynamic wave styling and improved colors ([7929c98](https://github.com/de-don/veles-tools/commit/7929c9853b95e51bad4fa967a30ed2e162d5787a))

### Bug Fixes

* **active-deals:** correct max orders count ([3468f26](https://github.com/de-don/veles-tools/commit/3468f2630552311eae5e58e98e0467705010b70f)), closes [#10](https://github.com/de-don/veles-tools/issues/10)
* add stopLoss configuration when creating bots ([41945a0](https://github.com/de-don/veles-tools/commit/41945a0246be4ad40244878dc6bc70eaadf4fd73))

## [1.6.0](https://github.com/de-don/veles-tools/compare/v1.5.1...v1.6.0) (2025-10-16)

### Features

* add position history tracking and sparkline visualization for active deals ([55f7647](https://github.com/de-don/veles-tools/commit/55f76473c10436c4032977b25b50c71d8d5e6124))
* add table column settings functionality across multiple pages ([63674da](https://github.com/de-don/veles-tools/commit/63674daf831b2f17a2af99fd93d1c7153210b346))
* implement bot cloning functionality with customizable parameters ([6a0e05d](https://github.com/de-don/veles-tools/commit/6a0e05d7d7e77735bb088cd00d6e1f8e344e5810)), closes [#15](https://github.com/de-don/veles-tools/issues/15)
* show curren P&L in tab title while on active deals page ([5f6f878](https://github.com/de-don/veles-tools/commit/5f6f8780449986a5a45921b7ca7dd2b60fa0beec)), closes [#12](https://github.com/de-don/veles-tools/issues/12)

## [1.5.1](https://github.com/de-don/veles-tools/compare/v1.5.0...v1.5.1) (2025-10-12)

### Bug Fixes

* add bybit id ([4719165](https://github.com/de-don/veles-tools/commit/47191658929cebb461b024bdf5b97a903c51c918))

## [1.5.0](https://github.com/de-don/veles-tools/compare/v1.4.0...v1.5.0) (2025-10-12)

### Features

* **active-deals:** add executed and total orders metrics ([9506701](https://github.com/de-don/veles-tools/commit/9506701205007fedeaad9e134fc154c95b625c89))
* **active-deals:** always watch active deals even when the other section opened ([d5c9cdc](https://github.com/de-don/veles-tools/commit/d5c9cdc87aa7876e394818709190e288179a737f))
* **active-deals:** enhance deals table with detailed actions, bot links, and formatted data ([cce48ab](https://github.com/de-don/veles-tools/commit/cce48ab336e2153f9c24bb326bd5c726dca8d716))
* **active-deals:** persist refresh interval preferences ([9d09bbf](https://github.com/de-don/veles-tools/commit/9d09bbf91ba645f21ba34f07fe753fc7e010b35b))
* add support project modal ([a8e682f](https://github.com/de-don/veles-tools/commit/a8e682fd4a7fc1fd960c52f6dc9782db784eedb0))
* **backtests:** add aggregate risk chart to visualize cumulative potential drawdowns ([455ac1e](https://github.com/de-don/veles-tools/commit/455ac1ec2d02e55f9ffe86861229dde2e79c1098))
* **backtests:** add bot creation from backtests with bulk actions ([ee93554](https://github.com/de-don/veles-tools/commit/ee93554b8043a6d0b219731aa0e2c3f7ea906f88))
* **backtests:** add concurrency limit for trade aggregation ([1e1e2be](https://github.com/de-don/veles-tools/commit/1e1e2bef9f1d92c8241db8b6d5112b15405f40ad))
* **backtests:** add deposit and leverage data to metrics, display win rate ([0da1f03](https://github.com/de-don/veles-tools/commit/0da1f033ac22d1318cad282e158927905736370f))
* **backtests:** add limit impact chart to analyze bot limit effects on P&L and risk metrics ([c79e6f5](https://github.com/de-don/veles-tools/commit/c79e6f53a7b805c81341e4bdb4408f8297c090ae))
* **backtests:** add sortable columns ([4c1c6e9](https://github.com/de-don/veles-tools/commit/4c1c6e9d23bc77333d8238ff3346dbb5a02df59f))
* **backtests:** display win/loss rates and max/mean trade duration ([d8226d0](https://github.com/de-don/veles-tools/commit/d8226d002e95a5307874f5bfe4276fa7d4fe856a))
* **backtests:** update row selection for aggregation table ([48da450](https://github.com/de-don/veles-tools/commit/48da450ffc20bc1bd44ec63b411cd1d2e5e62cd1))
* **bots:** add bulk actions for bots management ([b1d3dd3](https://github.com/de-don/veles-tools/commit/b1d3dd3ab57e10befdc3f3ad13f69933ebe733d0))
* integrate Ant Design tables ([c019b28](https://github.com/de-don/veles-tools/commit/c019b280f02df328da2d6e2515cf619ac1af50e6))

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
