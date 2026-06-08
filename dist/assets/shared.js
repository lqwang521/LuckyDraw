(function () {
  "use strict";

  const ADMIN_CONFIG_KEY = "mango-h5-admin-config";
  const DRAW_RECORDS_KEY = "mango-h5-draw-records";
  const CLOUDBASE_RUNTIME_CONFIG_KEY = "mango-cloudbase-runtime-config";
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
    const cloudConfig = getCloudConfig();
    return Boolean(
      cloudConfig && cloudConfig.enabled && cloudConfig.envId && window.cloudbase
    );
  }

  function getCloudConfig() {
    const saved = readJson(CLOUDBASE_RUNTIME_CONFIG_KEY, null);
    return {
      ...(window.CLOUDBASE_CONFIG || {}),
      ...(saved || {})
    };
  }

  function saveCloudConfig(config) {
    cloudApp = null;
    writeJson(CLOUDBASE_RUNTIME_CONFIG_KEY, {
      enabled: Boolean(config.enabled),
      envId: String(config.envId || "").trim(),
      functionName: String(config.functionName || "lotteryApi").trim() || "lotteryApi"
    });
  }

  async function getCloudApp() {
    if (!isCloudEnabled()) return null;
    if (cloudApp) return cloudApp;
    const cloudConfig = getCloudConfig();

    cloudApp = window.cloudbase.init({
      env: cloudConfig.envId
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
      name: getCloudConfig().functionName || "lotteryApi",
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

  async function uploadImage(file, type) {
    if (!file) throw new Error("请选择图片文件。");
    if (!file.type.startsWith("image/")) throw new Error("只能上传图片文件。");

    if (!isCloudEnabled()) {
      return readFileAsDataURL(file);
    }

    const app = await getCloudApp();
    const extension = getFileExtension(file.name);
    const cloudPath = `lottery-prizes/${type || "image"}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.${extension}`;
    const uploadResult = await app.uploadFile({
      cloudPath,
      filePath: file
    });
    const fileID = uploadResult.fileID;
    if (!fileID) throw new Error("图片上传失败，未返回 fileID。");

    try {
      const tempResult = await app.getTempFileURL({
        fileList: [fileID]
      });
      const fileInfo = tempResult.fileList && tempResult.fileList[0];
      return (fileInfo && (fileInfo.tempFileURL || fileInfo.download_url)) || fileID;
    } catch (error) {
      return fileID;
    }
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("读取图片失败。"));
      reader.readAsDataURL(file);
    });
  }

  function getFileExtension(filename) {
    const extension = String(filename || "")
      .split(".")
      .pop()
      .toLowerCase();
    return /^[a-z0-9]+$/.test(extension) ? extension : "png";
  }

  window.LotteryShared = {
    ADMIN_CONFIG_KEY,
    CLOUDBASE_RUNTIME_CONFIG_KEY,
    DRAW_RECORDS_KEY,
    addDrawRecord,
    clearDrawRecords,
    exportDrawRecordsAsExcel,
    exportPrizeConfig,
    callCloud,
    getBaseConfig,
    getCloudConfig,
    getDrawRecords,
    getRuntimeConfig,
    isCloudEnabled,
    resetRuntimeConfig,
    saveCloudConfig,
    saveRuntimeConfig,
    uploadImage
  };
})();
