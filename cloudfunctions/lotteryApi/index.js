const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV
});

const db = app.database();
const _ = db.command;

const ACTIVITY_ID = "default";
const DEFAULT_USER_CHANCES = 100000;

exports.main = async (event, context) => {
  const { action, data = {} } = event || {};

  try {
    if (action === "getConfig") return ok(await getConfig(data));
    if (action === "saveConfig") return ok(await saveConfig(data));
    if (action === "draw") return ok(await draw(data, context));
    if (action === "getRecords") return ok(await getRecords(data));
    return fail(`Unsupported action: ${action}`);
  } catch (error) {
    console.error(error);
    return fail(error.message || "Server error");
  }
};

async function getConfig(data) {
  const activity = await ensureActivityConfig();
  const userId = data.userId || getUserId(data, {});
  const userState = userId ? await ensureUserState(userId, activity.initialChances) : null;

  return {
    activity: activity.activity,
    prizes: activity.prizes,
    remainingChances: userState ? userState.remainingChances : activity.initialChances
  };
}

async function saveConfig(data) {
  assertAdmin(data.adminToken);

  const prizes = sanitizePrizes(data.prizes || []);
  const activity = sanitizeActivity(data.activity || {});
  await db.collection("lottery_configs").doc(ACTIVITY_ID).set({
    activity,
    prizes,
    initialChances: Number(activity.initialChances || DEFAULT_USER_CHANCES),
    updatedAt: new Date()
  });

  return { activity, prizes };
}

async function draw(data, context) {
  const userId = getUserId(data, context);
  const userName = data.userName || "H5用户";
  const configDoc = await ensureActivityConfig();
  const userState = await ensureUserState(userId, configDoc.initialChances);

  if (userState.remainingChances <= 0) {
    throw new Error("抽奖机会已用完。");
  }

  const availablePrizes = configDoc.prizes.filter((prize) => Number(prize.stock) !== 0 && Number(prize.probability) > 0);
  if (!availablePrizes.length) {
    throw new Error("暂无可抽奖品。");
  }

  const pickedPrize = pickPrize(availablePrizes);
  const isUnlimited = Number(pickedPrize.stock) < 0;
  const recordId = `DR${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
  const now = new Date();

  await db.runTransaction(async (transaction) => {
    const latestConfig = await transaction.collection("lottery_configs").doc(ACTIVITY_ID).get();
    const latestUser = await transaction.collection("lottery_users").doc(userId).get();
    const config = latestConfig.data && latestConfig.data[0];
    const user = latestUser.data && latestUser.data[0];

    if (!config || !user) throw new Error("活动状态异常，请重试。");
    if (Number(user.remainingChances || 0) <= 0) throw new Error("抽奖机会已用完。");

    const prizeIndex = config.prizes.findIndex((prize) => prize.id === pickedPrize.id);
    if (prizeIndex < 0) throw new Error("奖品不存在。");

    const prize = config.prizes[prizeIndex];
    if (Number(prize.stock) === 0) throw new Error("奖品库存不足，请重试。");

    const nextPrizes = config.prizes.slice();
    if (!isUnlimited && Number(prize.stock) > 0) {
      nextPrizes[prizeIndex] = {
        ...prize,
        stock: Number(prize.stock) - 1
      };
    }

    await transaction.collection("lottery_configs").doc(ACTIVITY_ID).update({
      prizes: nextPrizes,
      updatedAt: now
    });

    await transaction.collection("lottery_users").doc(userId).update({
      remainingChances: _.inc(-1),
      updatedAt: now
    });

    await transaction.collection("lottery_records").add({
      recordId,
      activityId: ACTIVITY_ID,
      userId,
      userName,
      prizeId: prize.id,
      prizeName: prize.name,
      isWin: !prize.noPrize,
      remainingChances: Number(user.remainingChances || 0) - 1,
      createdAt: now,
      time: formatDate(now)
    });
  });

  return {
    prize: pickedPrize,
    remainingChances: userState.remainingChances - 1,
    recordId
  };
}

async function getRecords(data) {
  assertAdmin(data.adminToken);
  const limit = Math.min(Number(data.limit || 500), 1000);
  const result = await db.collection("lottery_records").orderBy("createdAt", "desc").limit(limit).get();
  return {
    records: result.data || []
  };
}

async function ensureActivityConfig() {
  const result = await db.collection("lottery_configs").doc(ACTIVITY_ID).get();
  const existing = result.data && result.data[0];
  if (existing) return existing;

  const defaultConfig = getDefaultConfig();
  await db.collection("lottery_configs").doc(ACTIVITY_ID).set(defaultConfig);
  return defaultConfig;
}

async function ensureUserState(userId, initialChances) {
  const result = await db.collection("lottery_users").doc(userId).get();
  const existing = result.data && result.data[0];
  if (existing) return existing;

  const user = {
    userId,
    remainingChances: Number(initialChances || DEFAULT_USER_CHANCES),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await db.collection("lottery_users").doc(userId).set(user);
  return user;
}

function pickPrize(prizes) {
  const totalWeight = prizes.reduce((sum, prize) => sum + Number(prize.probability || 0), 0);
  let cursor = Math.random() * totalWeight;

  for (const prize of prizes) {
    cursor -= Number(prize.probability || 0);
    if (cursor <= 0) return prize;
  }

  return prizes[prizes.length - 1];
}

function sanitizePrizes(prizes) {
  return prizes.map((prize, index) => ({
    id: String(prize.id || `prize-${index + 1}`),
    name: String(prize.name || `奖品${index + 1}`),
    shortName: String(prize.shortName || prize.name || `奖品${index + 1}`),
    image: String(prize.image || ""),
    thumb: String(prize.thumb || ""),
    probability: Math.max(0, Number(prize.probability || 0)),
    stock: Number(prize.stock || 0),
    color: String(prize.color || "#ff9d37"),
    noPrize: Boolean(prize.noPrize)
  }));
}

function sanitizeActivity(activity) {
  return {
    title: String(activity.title || "抽奖"),
    slogan: String(activity.slogan || "\"芒\"里\"抽\"闲，chill一下!"),
    initialChances: Math.max(0, Number(activity.initialChances || DEFAULT_USER_CHANCES)),
    participantCount: Math.max(0, Number(activity.participantCount || 0)),
    endAt: String(activity.endAt || "2026-06-20T23:59:59+08:00"),
    storageKey: String(activity.storageKey || "mango-h5-lottery-state"),
    rules: Array.isArray(activity.rules) ? activity.rules.map(String) : []
  };
}

function assertAdmin(adminToken) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) throw new Error("云函数未配置 ADMIN_TOKEN。");
  if (!adminToken || adminToken !== expected) throw new Error("后台管理令牌无效。");
}

function getUserId(data, context) {
  const wxContext = context && context.WX_CONTEXT;
  return data.userId || (wxContext && (wxContext.OPENID || wxContext.UNIONID)) || "anonymous";
}

function getDefaultConfig() {
  return {
    _id: ACTIVITY_ID,
    activity: {
      title: "抽奖",
      slogan: "\"芒\"里\"抽\"闲，chill一下!",
      initialChances: DEFAULT_USER_CHANCES,
      participantCount: 104,
      endAt: "2026-06-20T23:59:59+08:00",
      storageKey: "mango-h5-lottery-state",
      rules: [
        "每次抽奖消耗 1 次机会，抽奖机会由云函数校验。",
        "奖品、库存、中奖概率由 CloudBase 数据库存储。",
        "中奖记录会写入 CloudBase 数据库，可在后台导出。"
      ]
    },
    initialChances: DEFAULT_USER_CHANCES,
    prizes: [
      {
        id: "yakult-sticker",
        name: "养乐多芒果味贴纸",
        shortName: "芒果味贴纸",
        image: "./assets/prizes/prize-1.jpg",
        thumb: "./assets/prizes/prize-1-thumb.jpg",
        probability: 34,
        stock: 600,
        color: "#ffb33f"
      },
      {
        id: "mango-hangtag",
        name: "芒果味香氛挂片",
        shortName: "香氛挂片",
        image: "./assets/prizes/prize-2.jpg",
        thumb: "./assets/prizes/prize-2-thumb.jpg",
        probability: 26,
        stock: 400,
        color: "#ffd34f"
      },
      {
        id: "orange-picnic-bag",
        name: "芒果味野餐手提袋",
        shortName: "野餐手提袋",
        image: "./assets/prizes/prize-3.jpg",
        thumb: "./assets/prizes/prize-3-thumb.jpg",
        probability: 10,
        stock: 80,
        color: "#ff8f2f"
      },
      {
        id: "phone-strap",
        name: "芒果味手机挂绳",
        shortName: "手机挂绳",
        image: "./assets/prizes/prize-4.png",
        thumb: "./assets/prizes/prize-4-thumb.png",
        probability: 18,
        stock: 180,
        color: "#43d061"
      },
      {
        id: "foldable-tote",
        name: "CHILL 芒果味折叠托特包",
        shortName: "折叠托特包",
        image: "./assets/prizes/prize-5.png",
        thumb: "./assets/prizes/prize-5-thumb.png",
        probability: 12,
        stock: 100,
        color: "#ff9d37"
      }
    ],
    updatedAt: new Date()
  };
}

function formatDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
}

function ok(data) {
  return { ok: true, data };
}

function fail(message) {
  return { ok: false, message };
}
