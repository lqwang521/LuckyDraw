(function () {
  "use strict";

  const ADMIN_CONFIG_KEY = "mango-h5-admin-config";
  const DRAW_RECORDS_KEY = "mango-h5-draw-records";
  let cloudApp = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function getBaseConfig() {
    return clone(window.LOTTERY_CONFIG);
  }

  function getRuntimeConfig() {
    const base = getBaseConfig();
    const saved = readJson(ADMIN_CONFIG_KEY, null);
    if (!saved) return base;

    return {
      ...base,
      activity: {
        ...base.activity,
        ...(saved.activity || {})
      },
      prizes: Array.isArray(saved.prizes) ? saved.prizes : base.prizes,
      winners: Array.isArray(saved.winners) ? saved.winners : base.winners,
      avatars: Array.isArray(saved.avatars) ? saved.avatars : base.avatars
    };
  }

  function saveRuntimeConfig(config) {
    writeJson(ADMIN_CONFIG_KEY, {
      activity: config.activity,
      prizes: config.prizes,
      winners: config.winners,
      avatars: config.avatars
    });
  }

  function resetRuntimeConfig() {
    window.localStorage.removeItem(ADMIN_CONFIG_KEY);
  }

  function getDrawRecords() {
    return readJson(DRAW_RECORDS_KEY, []);
  }

  function addDrawRecord(record) {
    const records = getDrawRecords();
    records.unshift(record);
    writeJson(DRAW_RECORDS_KEY, records);
    return records;
  }

  function clearDrawRecords() {
    window.localStorage.removeItem(DRAW_RECORDS_KEY);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportDrawRecordsAsExcel(records) {
    const rows = [
      ["抽奖时间", "用户ID", "用户昵称", "奖品ID", "奖品名称", "是否中奖", "剩余机会", "记录ID"],
      ...records.map((record) => [
        record.time,
        record.userId,
        record.userName,
        record.prizeId,
        record.prizeName,
        record.isWin ? "是" : "否",
        record.remainingChances,
        record.recordId
      ])
    ];

    const table = rows
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
      .join("");
    const html = `<!doctype html><html><head><meta charset="UTF-8" /></head><body><table>${table}</table></body></html>`;
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(`抽奖数据-${date}.xls`, html, "application/vnd.ms-excel;charset=utf-8");
  }

  function exportPrizeConfig(config) {
    const content = JSON.stringify(
      {
        activity: config.activity,
        prizes: config.prizes
      },
      null,
      2
    );
    downloadTextFile("lottery-config.json", content, "application/json;charset=utf-8");
  }

  function isCloudEnabled() {
    return Boolean(
      window.CLOUDBASE_CONFIG &&
        window.CLOUDBASE_CONFIG.enabled &&
        window.CLOUDBASE_CONFIG.envId &&
        window.cloudbase
    );
  }

  async function getCloudApp() {
    if (!isCloudEnabled()) return null;
    if (cloudApp) return cloudApp;

    cloudApp = window.cloudbase.init({
      env: window.CLOUDBASE_CONFIG.envId
    });

    const auth = cloudApp.auth({ persistence: "local" });
    const loginState = await auth.getLoginState();
    if (!loginState) {
      await auth.anonymousAuthProvider().signIn();
    }

    return cloudApp;
  }

  async function callCloud(action, data) {
    const app = await getCloudApp();
    if (!app) throw new Error("CloudBase is not enabled.");

    const response = await app.callFunction({
      name: window.CLOUDBASE_CONFIG.functionName || "lotteryApi",
      data: {
        action,
        data
      }
    });

    const result = response.result || {};
    if (!result.ok) {
      throw new Error(result.message || "CloudBase request failed.");
    }
    return result.data;
  }

  window.LotteryShared = {
    ADMIN_CONFIG_KEY,
    DRAW_RECORDS_KEY,
    addDrawRecord,
    clearDrawRecords,
    exportDrawRecordsAsExcel,
    exportPrizeConfig,
    callCloud,
    getBaseConfig,
    getDrawRecords,
    getRuntimeConfig,
    isCloudEnabled,
    resetRuntimeConfig,
    saveRuntimeConfig
  };
})();
