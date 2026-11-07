# trade-canvas-card

`kcard.js` 是 trade-canvas 的 T3 卡片外殼。agent 交給 T3 `html_render` 的只有兩個 script tag：

```html
<script type="text/kcard">{"src":"<canvas server>","id":"<view id>"}</script>
<script src="https://cdn.jsdelivr.net/gh/Decayo/trade-canvas-card@<commit>/kcard.js"></script>
```

- 外殼讀這段設定，從 `<src>/api/card/<id>` 取 K 棒、畫線、note、signal，自己算 JS 指標，用跟 web app 同一份 chart core 畫圖。
- KLineChart 從 jsDelivr 的 npm `klinecharts@10.1.0` 載入。
- 每 3 秒同步畫線；在卡片上畫、拖、刪的線透過 `<src>/api/drawings` 存回，帶 `expected_revision`，衝突時重新載入。
- 這個 repo 只放打包好的 `kcard.js`、打包腳本 `build.mjs`、這份說明。沒有主機位址、帳號或券商程式；主機位址在卡片的設定裡，由 canvas server 產生。

## 打包

`build.mjs` 在 trade-canvas 的原始碼目錄裡執行（`npm run build:card`）。它把 `card/shell.js` 和它 import 的模組（`public/core/*`、`indicators/*.js`）合成一個檔，並在輸出含有 tailnet 主機、IP 或帳號格式時拒絕寫入。
