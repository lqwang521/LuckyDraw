# H5 抽奖活动页面

一个可静态部署的 H5 抽奖页面，视觉参考粉色转盘抽奖活动页。页面逻辑、奖品和概率配置已拆开，后续可替换为后端接口或迁移到微信小程序。

## 本地预览

```bash
python3 -m http.server 5173
```

打开 `http://localhost:5173`。

后台管理页：

```text
http://localhost:5173/admin.html
```

## 配置活动

主要配置在 `assets/config.js`：

- `activity.initialChances`：用户初始抽奖次数。
- `activity.endAt`：活动结束时间，影响倒计时。
- `prizes[].name`：完整奖品名称。
- `prizes[].shortName`：转盘上展示的短名称。
- `prizes[].image`：弹窗和后续奖品详情使用的大图。
- `prizes[].thumb`：转盘上使用的缩略图。
- `prizes[].probability`：中奖权重，所有可用奖品权重相加后按比例抽取。
- `prizes[].stock`：库存，`0` 表示不参与抽取，`-1` 表示不限库存。
- `prizes[].noPrize`：是否为“谢谢参与”类未中奖项。

当前 5 个实际奖品按大致价值设置为：贴纸 `34%`、香氛挂片 `26%`、手机挂绳 `18%`、折叠托特包 `12%`、野餐手提袋 `10%`。如果后续接服务端，建议由服务端返回中奖结果，前端只负责转盘动画和结果展示。

## 后台管理

`admin.html` 支持编辑奖品名称、库存、中奖概率、图片路径，并能导出抽奖流水为 Excel 可打开的 `.xls` 文件。当前版本的后台配置和抽奖流水存储在浏览器 `localStorage` 中，适合本地演示和运营配置原型。

正式云端多人参与时，应迁移为：

- CloudBase 数据库存储活动配置、奖品库存、中奖记录。
- CloudBase 云函数执行抽奖、扣次数、扣库存和写流水。
- 后台管理页调用云函数读写配置和导出数据。

CloudBase 上线步骤见 [CLOUDBASE_DEPLOY.md](/Users/wangliquan/Documents/youavideoEmpty/codexProject/CLOUDBASE_DEPLOY.md)。

## 小程序迁移建议

- `assets/config.js` 可迁为小程序页面 `data` 或接口返回值。
- `assets/app.js` 中的抽奖权重算法可抽成独立工具函数复用。
- 当前转盘使用 Canvas 绘制，小程序可用 `canvas` 组件迁移绘制逻辑。
- `localStorage` 状态可替换为 `wx.setStorageSync`，正式上线建议以服务端机会次数和发奖记录为准。
