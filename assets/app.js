(function () {
  "use strict";

  const config = window.LotteryShared.getRuntimeConfig();
  const canvas = document.getElementById("wheelCanvas");
  const ctx = canvas.getContext("2d");
  const spinButton = document.getElementById("spinButton");
  const remainingChancesEl = document.getElementById("remainingChances");
  const countdownEl = document.getElementById("countdown");
  const modalBackdrop = document.getElementById("modalBackdrop");
  const modalClose = document.getElementById("modalClose");
  const modalAction = document.getElementById("modalAction");
  const modalTitle = document.getElementById("modalTitle");
  const modalPrize = document.getElementById("modalPrize");
  const modalNote = document.getElementById("modalNote");
  const panelBackdrop = document.getElementById("panelBackdrop");
  const panelClose = document.getElementById("panelClose");
  const panelTitle = document.getElementById("panelTitle");
  const panelContent = document.getElementById("panelContent");
  const winnerList = document.getElementById("winnerList");
  const avatars = document.getElementById("avatars");
  const participantCount = document.getElementById("participantCount");
  const activitySlogan = document.getElementById("activitySlogan");

  const wheelSize = canvas.width;
  const center = wheelSize / 2;
  const radius = wheelSize * 0.45;
  const innerRadius = wheelSize * 0.14;
  const pointerAngle = -Math.PI / 2;
  const TAU = Math.PI * 2;
  const prizeImages = new Map();

  let state = loadState();
  let currentRotation = 0;
  let isSpinning = false;

  preloadPrizeImages();
  loadCloudConfig();

  function loadState() {
    const fallback = {
      remainingChances: config.activity.initialChances,
      wonPrizes: []
    };

    try {
      const raw = window.localStorage.getItem(config.activity.storageKey);
      return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveState() {
    window.localStorage.setItem(config.activity.storageKey, JSON.stringify(state));
  }

  function normalizeAngle(angle) {
    const normalized = angle % TAU;
    return normalized < 0 ? normalized + TAU : normalized;
  }

  function drawWheel() {
    ctx.clearRect(0, 0, wheelSize, wheelSize);
    drawOuterRing();

    const segmentAngle = TAU / config.prizes.length;
    config.prizes.forEach((prize, index) => {
      const start = index * segmentAngle - Math.PI / 2;
      const end = start + segmentAngle;
      drawSegment(start, end, prize, index);
    });

    drawCenterCutout();
  }

  function drawOuterRing() {
    const gradient = ctx.createRadialGradient(center, center, radius * 0.6, center, center, radius * 1.2);
    gradient.addColorStop(0, "#fff4fb");
    gradient.addColorStop(0.72, "#ff2f80");
    gradient.addColorStop(1, "#ff8bc4");

    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius + 54, 0, TAU);
    ctx.fillStyle = gradient;
    ctx.shadowColor = "rgba(224, 48, 122, 0.36)";
    ctx.shadowBlur = 36;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(center, center, radius + 28, 0, TAU);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 13;
    ctx.stroke();
  }

  function drawSegment(start, end, prize, index) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = index % 2 === 0 ? "#fffdf6" : "#fff8ed";
    ctx.fill();
    ctx.strokeStyle = "#f72d83";
    ctx.lineWidth = 8;
    ctx.stroke();

    const mid = (start + end) / 2;
    drawNotch(mid);
    drawPrizeContent(mid, prize);
    ctx.restore();
  }

  function drawNotch(angle) {
    const notchRadius = radius - 7;
    const x = center + Math.cos(angle) * notchRadius;
    const y = center + Math.sin(angle) * notchRadius;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 23, 0, TAU);
    ctx.fillStyle = "#ff3f8f";
    ctx.fill();
    ctx.restore();
  }

  function drawPrizeContent(angle, prize) {
    const labelRadius = radius * 0.64;
    const iconRadius = radius * 0.43;

    ctx.save();
    ctx.translate(center + Math.cos(angle) * labelRadius, center + Math.sin(angle) * labelRadius);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = "#5d5964";
    ctx.font = "500 28px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(truncateText(prize.shortName || prize.name, 9), 0, -16);
    ctx.restore();

    ctx.save();
    ctx.translate(center + Math.cos(angle) * iconRadius, center + Math.sin(angle) * iconRadius);
    ctx.rotate(angle + Math.PI / 2);
    if (prizeImages.has(prize.id) && prizeImages.get(prize.id).complete) {
      drawPrizeImage(prizeImages.get(prize.id));
    } else if (prize.icon === "ticket") {
      drawTicketIcon(prize.color);
    } else if (prize.icon === "coupon") {
      drawCouponIcon(prize.color);
    } else {
      drawThanksIcon(prize.color);
    }
    ctx.restore();
  }

  function preloadPrizeImages() {
    config.prizes.forEach((prize) => {
      if (!prize.thumb) return;

      const image = new Image();
      image.onload = drawWheel;
      image.src = prize.thumb;
      prizeImages.set(prize.id, image);
    });
  }

  function drawPrizeImage(image) {
    const size = 82;

    ctx.save();
    ctx.beginPath();
    roundedRect(-size / 2, -size / 2, size, size, 14);
    ctx.clip();
    drawImageCover(image, -size / 2, -size / 2, size, size);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    roundedRect(-size / 2, -size / 2, size, size, 14);
    ctx.stroke();
    ctx.restore();
  }

  function drawImageCover(image, x, y, width, height) {
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = width / height;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;
    let sourceX = 0;
    let sourceY = 0;

    if (sourceRatio > targetRatio) {
      sourceWidth = image.naturalHeight * targetRatio;
      sourceX = (image.naturalWidth - sourceWidth) / 2;
    } else {
      sourceHeight = image.naturalWidth / targetRatio;
      sourceY = (image.naturalHeight - sourceHeight) / 2;
    }

    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  }

  function drawTicketIcon(color) {
    ctx.save();
    ctx.fillStyle = color;
    roundedRect(-45, -24, 90, 48, 8);
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(-45, 0, 10, 0, TAU);
    ctx.arc(45, 0, 10, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.font = "700 30px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("券", 0, 1);
    ctx.restore();
  }

  function drawCouponIcon(color) {
    ctx.save();
    ctx.fillStyle = "#ffc6df";
    roundedRect(-44, -32, 88, 64, 9);
    ctx.fill();
    ctx.fillStyle = color;
    roundedRect(-30, -16, 60, 32, 7);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.24)";
    ctx.font = "700 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("券", 0, 1);
    ctx.restore();
  }

  function drawThanksIcon(color) {
    ctx.save();
    ctx.rotate(-0.05);
    ctx.fillStyle = "#ffc6df";
    roundedRect(-42, -34, 84, 68, 9);
    ctx.fill();
    ctx.fillStyle = color;
    roundedRect(-22, -26, 14, 50, 4);
    roundedRect(9, -26, 14, 50, 4);
    ctx.fill();
    ctx.strokeStyle = "#2f2a32";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-25, -20);
    ctx.lineTo(-34, -20);
    ctx.moveTo(25, -20);
    ctx.lineTo(34, -20);
    ctx.stroke();
    ctx.strokeStyle = "#ff4f5f";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-6, 12);
    ctx.lineTo(0, 18);
    ctx.lineTo(8, 9);
    ctx.stroke();
    ctx.restore();
  }

  function drawCenterCutout() {
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, innerRadius + 8, 0, TAU);
    ctx.fillStyle = "#fff5df";
    ctx.fill();
    ctx.restore();
  }

  function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function truncateText(text, maxLength) {
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
  }

  function pickPrize() {
    const availablePrizes = config.prizes.filter((prize) => prize.stock !== 0);
    const totalWeight = availablePrizes.reduce((sum, prize) => sum + Number(prize.probability || 0), 0);
    let cursor = Math.random() * totalWeight;

    for (const prize of availablePrizes) {
      cursor -= Number(prize.probability || 0);
      if (cursor <= 0) return prize;
    }

    return availablePrizes[availablePrizes.length - 1];
  }

  function spinToPrize(prize) {
    const index = config.prizes.findIndex((item) => item.id === prize.id);
    const segmentAngle = TAU / config.prizes.length;
    const prizeCenterAngle = index * segmentAngle - Math.PI / 2 + segmentAngle / 2;
    const currentAngle = normalizeAngle(currentRotation);
    const targetAngle = normalizeAngle(pointerAngle - prizeCenterAngle);
    const delta = normalizeAngle(targetAngle - currentAngle);
    const fullTurns = 6 + Math.floor(Math.random() * 2);
    const targetRotation = currentRotation + fullTurns * TAU + delta;

    return animateRotation(targetRotation, 4200);
  }

  function animateRotation(targetRotation, duration) {
    const startRotation = currentRotation;
    const start = performance.now();

    return new Promise((resolve) => {
      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        currentRotation = startRotation + (targetRotation - startRotation) * eased;
        canvas.style.transform = `rotate(${currentRotation}rad)`;

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          currentRotation = normalizeAngle(targetRotation);
          canvas.style.transform = `rotate(${currentRotation}rad)`;
          resolve();
        }
      }

      requestAnimationFrame(tick);
    });
  }

  async function handleSpin() {
    if (isSpinning) return;
    if (state.remainingChances <= 0) {
      showResult(null, "今日机会已经用完", "可以在配置里调整初始机会，或后续接入任务发放机会。");
      return;
    }

    isSpinning = true;
    spinButton.disabled = true;
    state.remainingChances -= 1;
    renderState();

    let drawResult = null;
    let prize = null;
    try {
      drawResult = await requestDrawResult();
      prize = normalizePrizeFromResult(drawResult);
    } catch (error) {
      state.remainingChances += 1;
      renderState();
      showResult(null, "抽奖失败", error.message || "请稍后再试。");
      isSpinning = false;
      spinButton.disabled = false;
      return;
    }

    await spinToPrize(prize);

    if (!prize.noPrize) {
      state.wonPrizes.unshift({
        id: prize.id,
        name: prize.name,
        time: new Date().toLocaleString("zh-CN", { hour12: false })
      });
    }

    if (drawResult && typeof drawResult.remainingChances === "number") {
      state.remainingChances = drawResult.remainingChances;
    }

    if (!window.LotteryShared.isCloudEnabled()) {
      window.LotteryShared.addDrawRecord({
        recordId: `DR${Date.now()}${Math.random().toString(16).slice(2, 8)}`,
        time: new Date().toLocaleString("zh-CN", { hour12: false }),
        userId: getUserId(),
        userName: "H5用户",
        prizeId: prize.id,
        prizeName: prize.name,
        isWin: !prize.noPrize,
        remainingChances: state.remainingChances
      });
    }

    saveState();
    renderState();
    showResult(
      prize,
      prize.noPrize ? "差一点点" : "恭喜中奖",
      prize.noPrize ? "谢谢参与，再来一次可能会更有手感。" : "奖品已记录到“我的奖品”，部署后可接入真实发奖流程。"
    );
    isSpinning = false;
    spinButton.disabled = false;
  }

  function showResult(prize, title, note) {
    modalTitle.textContent = title;
    if (prize && prize.image) {
      modalPrize.innerHTML = "";
      const image = document.createElement("img");
      image.src = prize.image;
      image.alt = prize.name;
      const name = document.createElement("strong");
      name.textContent = prize.name;
      modalPrize.append(image, name);
    } else {
      modalPrize.textContent = prize ? prize.name : "暂无抽奖机会";
    }
    modalNote.textContent = note;
    modalBackdrop.hidden = false;
  }

  function closeModal() {
    modalBackdrop.hidden = true;
  }

  function renderState() {
    remainingChancesEl.textContent = state.remainingChances;
    spinButton.disabled = isSpinning;
  }

  function renderStaticContent() {
    document.title = config.activity.title;
    activitySlogan.textContent = config.activity.slogan;
    participantCount.textContent = config.activity.participantCount;

    winnerList.innerHTML = "";
    config.winners.forEach((winner) => {
      const item = document.createElement("div");
      item.className = "winner-item";
      const user = document.createElement("span");
      user.textContent = `${winner.time} ${winner.name}`;
      const prize = document.createElement("strong");
      prize.textContent = winner.prize;
      item.append(user, prize);
      winnerList.appendChild(item);
    });

    avatars.innerHTML = "";
    config.avatars.forEach((src, index) => {
      const img = document.createElement("img");
      img.src = src;
      img.alt = `参与用户 ${index + 1}`;
      img.loading = "lazy";
      avatars.appendChild(img);
    });
  }

  function updateCountdown() {
    const endTime = new Date(config.activity.endAt).getTime();
    const diff = Math.max(0, endTime - Date.now());
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    const parts = [`${days}天`, hours, minutes, seconds].map((part) =>
      typeof part === "number" ? String(part).padStart(2, "0") : part
    );

    countdownEl.innerHTML = parts.map((part) => `<span>${part}</span>`).join("");
  }

  function openPanel(type) {
    panelTitle.textContent = type === "prizes" ? "我的奖品" : "活动说明";
    panelContent.innerHTML = "";

    if (type === "prizes") {
      if (!state.wonPrizes.length) {
        panelContent.innerHTML = `<p class="empty-text">暂时还没有中奖记录，先抽一次试试。</p>`;
      } else {
        state.wonPrizes.forEach((item) => {
          const row = document.createElement("div");
          row.className = "panel-row";
          const name = document.createElement("strong");
          name.textContent = item.name;
          const time = document.createElement("span");
          time.textContent = item.time;
          row.append(name, time);
          panelContent.appendChild(row);
        });
      }
    } else {
      const list = document.createElement("ol");
      config.activity.rules.forEach((rule) => {
        const item = document.createElement("li");
        item.textContent = rule;
        list.appendChild(item);
      });
      panelContent.appendChild(list);
    }

    panelBackdrop.hidden = false;
  }

  function closePanel() {
    panelBackdrop.hidden = true;
  }

  function getUserId() {
    const key = "mango-h5-user-id";
    let userId = window.localStorage.getItem(key);
    if (!userId) {
      userId = `USER-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      window.localStorage.setItem(key, userId);
    }
    return userId;
  }

  async function loadCloudConfig() {
    if (!window.LotteryShared.isCloudEnabled()) return;

    try {
      const cloudConfig = await window.LotteryShared.callCloud("getConfig", {});
      if (!cloudConfig || !Array.isArray(cloudConfig.prizes)) return;

      config.activity = { ...config.activity, ...(cloudConfig.activity || {}) };
      config.prizes = cloudConfig.prizes;
      prizeImages.clear();
      preloadPrizeImages();
      state.remainingChances =
        typeof cloudConfig.remainingChances === "number" ? cloudConfig.remainingChances : state.remainingChances;
      renderStaticContent();
      renderState();
      drawWheel();
    } catch (error) {
      console.warn("CloudBase config load failed, fallback to local config.", error);
    }
  }

  async function requestDrawResult() {
    if (!window.LotteryShared.isCloudEnabled()) {
      return {
        prize: pickPrize(),
        remainingChances: state.remainingChances
      };
    }

    return window.LotteryShared.callCloud("draw", {
      userId: getUserId(),
      userName: "H5用户"
    });
  }

  function normalizePrizeFromResult(drawResult) {
    const resultPrize = drawResult && drawResult.prize;
    if (!resultPrize) throw new Error("没有返回奖品结果。");

    const localPrize = config.prizes.find((item) => item.id === resultPrize.id);
    if (localPrize) return { ...localPrize, ...resultPrize };

    config.prizes.push(resultPrize);
    drawWheel();
    return resultPrize;
  }

  drawWheel();
  renderStaticContent();
  renderState();
  updateCountdown();
  setInterval(updateCountdown, 1000);

  spinButton.addEventListener("click", handleSpin);
  modalClose.addEventListener("click", closeModal);
  modalAction.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) closeModal();
  });
  panelClose.addEventListener("click", closePanel);
  panelBackdrop.addEventListener("click", (event) => {
    if (event.target === panelBackdrop) closePanel();
  });
  document.querySelectorAll("[data-panel-target]").forEach((button) => {
    button.addEventListener("click", () => openPanel(button.dataset.panelTarget));
  });
})();
