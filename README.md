# trade-canvas-card

`kcard.js` 是 trade-canvas 的 T3 卡片外殼。agent 交給 T3 `html_render` 的只有兩個 script tag：

```html
<script type="text/kcard">{"src":"<canvas server>","id":"<card id>","hook":"<agent thread webhook，可省略>"}</script>
<script src="https://cdn.jsdelivr.net/gh/Decayo/trade-canvas-card@<commit>/kcard.js"></script>
```

- 一張卡最多 4 個分頁（pane），每個分頁有自己的週期、日期範圍、agent 暫時線和顯示設定；草稿、待刪、選取都記在各自的分頁。
- 卡片是一張快照：K 棒、指標、當時共用畫線的副本（記下 revision），加上 agent 只給這張卡的「暫時」線。
- 使用者在卡片上可以選一根 bar 或一段範圍、畫草稿趨勢線和水平線、寫一則備註，按「送出」。
- 點選任何一條線可以刪：草稿直接拿掉；共用的線變成「待刪」草稿，跟著送出，由 agent 確認才真的刪；agent 的暫時線只能隱藏。「線」清單可以逐條隱藏（只影響這張卡的畫面）。
- 送出時先到 `<src>/api/card/<id>/submit` 存成待對齊的紀錄（不會寫進共用畫線），再把 server 產生的純文字回覆 POST 到設定裡的 `hook`（agent 自己 thread 的 webhook，可省略），之後卡片鎖定。
- KLineChart 從 jsDelivr 的 npm `klinecharts@10.1.0` 載入。
- 這個 repo 只放打包好的 `kcard.js`、打包腳本 `build.mjs`、這份說明。沒有主機位址、帳號或券商程式；主機位址和 hook 在卡片的設定裡，由 agent 產生。

## 打包

`build.mjs` 在 trade-canvas 的原始碼目錄裡執行（`npm run build:card`）。它把 `card/shell.js` 和它 import 的模組（`public/core/*`、`indicators/*.js`）合成一個檔，並在輸出含有 tailnet 主機、IP 或帳號格式時拒絕寫入。

## 授權備註

`indicators/pa.js` 的 PA 結構規則（pivot、channel、range box）參考 PA_Agent（AGPL-3.0）的行為描述自行實作，沒有複製它的程式碼。
