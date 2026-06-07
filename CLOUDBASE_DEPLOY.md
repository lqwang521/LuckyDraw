# CloudBase 上线说明

当前项目已经支持两种模式：

- 本地演示模式：`assets/cloudbase-config.js` 里 `enabled: false`，使用浏览器 `localStorage`。
- CloudBase 模式：`enabled: true`，前台抽奖、后台配置、抽奖流水都走云函数 `lotteryApi`。

## 1. 创建 CloudBase 环境

在腾讯云 CloudBase 控制台创建环境，记录环境 ID，例如：

```text
your-env-id-123456
```

## 2. 创建数据库集合

在 CloudBase 数据库中新建 3 个集合：

```text
lottery_configs
lottery_users
lottery_records
```

建议权限：

- `lottery_configs`：客户端不可直接写，读写由云函数完成。
- `lottery_users`：客户端不可直接写，读写由云函数完成。
- `lottery_records`：客户端不可直接写，读写由云函数完成。

如果控制台要求设置安全规则，可先设置为“仅云函数可读写”。前端不要直接操作数据库。

## 3. 部署云函数

云函数目录：

```text
cloudfunctions/lotteryApi
```

函数名：

```text
lotteryApi
```

运行环境：

```text
Node.js 18
```

安装依赖：

```bash
npm install
```

入口文件：

```text
index.js
```

需要在云函数环境变量里配置后台令牌：

```text
ADMIN_TOKEN=换成一个足够长的随机字符串
```

后台管理页保存配置、读取云端流水时会使用这个令牌。

## 4. 修改前端 CloudBase 配置

编辑 `assets/cloudbase-config.js`：

```js
window.CLOUDBASE_CONFIG = {
  enabled: true,
  envId: "your-env-id-123456",
  functionName: "lotteryApi",
  adminToken: "和云函数 ADMIN_TOKEN 一致"
};
```

如果只想让用户前台抽奖，不开放后台管理，可以部署时不把 `admin.html` 暴露给用户，或者把后台页面单独放到受保护路径。

## 5. 部署静态网站

CloudBase 静态网站托管配置：

| 配置项 | 填写 |
|---|---|
| 项目框架 | 其他 |
| 目标目录 | `./` |
| 安装命令 | 留空 |
| 构建命令 | 留空 |
| 构建产物目录 | `./` |
| 部署路径 | `/` |

部署完成后访问：

```text
https://你的域名/
https://你的域名/admin.html
```

## 6. 数据流

前台抽奖：

```text
index.html
  -> CloudBase Web SDK
  -> 云函数 lotteryApi action=draw
  -> lottery_users 扣次数
  -> lottery_configs 扣库存
  -> lottery_records 写抽奖流水
```

后台配置：

```text
admin.html
  -> action=getConfig 读取配置
  -> action=saveConfig 保存奖品、库存、概率
  -> action=getRecords 读取抽奖流水并导出 Excel
```

## 7. 重要上线提醒

- 前台不要再使用前端概率作为真实开奖结果，真实中奖结果必须由云函数返回。
- 后台令牌不要提交到公开仓库；生产环境建议改成登录鉴权，而不是在前端写固定 `adminToken`。
- 当前云函数使用事务扣次数、扣库存和写流水，能避免高并发下库存被重复扣减。
- 如果活动访问量很大，建议增加用户限频、IP/设备风控、验证码或登录态校验。
