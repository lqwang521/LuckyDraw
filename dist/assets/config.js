window.LOTTERY_CONFIG = {
  activity: {
    title: "抽奖",
    slogan: "\"芒\"里\"抽\"闲，chill一下!",
    initialChances: 100000,
    participantCount: 104,
    endAt: "2026-06-20T23:59:59+08:00",
    storageKey: "mango-h5-lottery-state",
    rules: [
      "每次抽奖消耗 1 次机会，抽奖机会可由运营系统或后端接口发放。",
      "奖品、展示文案、中奖概率均在 assets/config.js 中配置，当前 5 个奖品权重合计 100%。",
      "实际发奖建议以后接入服务端校验，前端仅负责展示和交互。"
    ]
  },
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
  winners: [
    { name: "王**", prize: "养乐多芒果味贴纸", time: "刚刚" },
    { name: "李**", prize: "芒果味手机挂绳", time: "2分钟前" },
    { name: "陈**", prize: "芒果味香氛挂片", time: "5分钟前" }
  ],
  avatars: [
    "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=96&q=80",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=96&q=80",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=96&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=96&q=80",
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=96&q=80",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=96&q=80"
  ]
};
