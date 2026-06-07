(function () {
  "use strict";

  const tableBody = document.getElementById("prizeTableBody");
  const probabilityTotal = document.getElementById("probabilityTotal");
  const saveButton = document.getElementById("saveButton");
  const addPrizeButton = document.getElementById("addPrizeButton");
  const resetButton = document.getElementById("resetButton");
  const exportConfigButton = document.getElementById("exportConfigButton");
  const exportRecordsButton = document.getElementById("exportRecordsButton");
  const clearRecordsButton = document.getElementById("clearRecordsButton");
  const recordCount = document.getElementById("recordCount");
  const recordsList = document.getElementById("recordsList");
  const initialChancesInput = document.getElementById("initialChancesInput");
  const participantCountInput = document.getElementById("participantCountInput");
  const endAtInput = document.getElementById("endAtInput");
  const sloganInput = document.getElementById("sloganInput");

  let config = window.LotteryShared.getRuntimeConfig();
  let cloudRecords = null;

  function render() {
    renderActivityForm();
    renderPrizeTable();
    renderRecords();
  }

  async function boot() {
    if (window.LotteryShared.isCloudEnabled()) {
      try {
        const cloudConfig = await window.LotteryShared.callCloud("getConfig", {});
        config = {
          ...config,
          activity: {
            ...config.activity,
            ...(cloudConfig.activity || {})
          },
          prizes: Array.isArray(cloudConfig.prizes) ? cloudConfig.prizes : config.prizes
        };
        cloudRecords = await loadCloudRecords();
      } catch (error) {
        window.alert(`读取 CloudBase 配置失败：${error.message}`);
      }
    }

    render();
  }

  function renderActivityForm() {
    initialChancesInput.value = config.activity.initialChances;
    participantCountInput.value = config.activity.participantCount;
    endAtInput.value = toDatetimeLocalValue(config.activity.endAt);
    sloganInput.value = config.activity.slogan;
  }

  function renderPrizeTable() {
    tableBody.innerHTML = "";

    config.prizes.forEach((prize, index) => {
      const row = document.createElement("tr");
      row.dataset.index = String(index);
      row.innerHTML = `
        <td><input data-field="enabled" type="checkbox" ${prize.stock === 0 ? "" : "checked"} /></td>
        <td><input data-field="name" type="text" value="${escapeAttr(prize.name)}" /></td>
        <td><input data-field="shortName" type="text" value="${escapeAttr(prize.shortName || "")}" /></td>
        <td><input data-field="stock" type="number" step="1" value="${Number(prize.stock ?? 0)}" /></td>
        <td><input data-field="probability" type="number" min="0" step="0.01" value="${Number(prize.probability || 0)}" /></td>
        <td><input data-field="thumb" type="text" value="${escapeAttr(prize.thumb || "")}" /></td>
        <td><input data-field="image" type="text" value="${escapeAttr(prize.image || "")}" /></td>
        <td><button class="danger-button" data-action="remove" type="button">删除</button></td>
      `;
      tableBody.appendChild(row);
    });

    updateProbabilityTotal();
  }

  function renderRecords() {
    const records = cloudRecords || window.LotteryShared.getDrawRecords();
    recordCount.textContent = String(records.length);
    recordsList.innerHTML = "";

    if (!records.length) {
      recordsList.innerHTML = `<p class="empty-text">暂无抽奖记录。</p>`;
      return;
    }

    records.slice(0, 8).forEach((record) => {
      const item = document.createElement("div");
      item.className = "record-item";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(record.prizeName)}</strong>
          <span>${escapeHtml(record.userName)} · ${escapeHtml(record.time)}</span>
        </div>
        <em>${record.isWin ? "中奖" : "未中奖"}</em>
      `;
      recordsList.appendChild(item);
    });
  }

  function syncConfigFromForm() {
    config.activity.initialChances = Math.max(0, Number(initialChancesInput.value || 0));
    config.activity.participantCount = Math.max(0, Number(participantCountInput.value || 0));
    config.activity.endAt = fromDatetimeLocalValue(endAtInput.value);
    config.activity.slogan = sloganInput.value.trim() || config.activity.slogan;

    config.prizes = Array.from(tableBody.querySelectorAll("tr")).map((row, index) => {
      const original = config.prizes[index] || {};
      const enabled = row.querySelector('[data-field="enabled"]').checked;
      const stockInput = Number(row.querySelector('[data-field="stock"]').value || 0);
      const stock = enabled ? stockInput : 0;
      const name = row.querySelector('[data-field="name"]').value.trim();
      const shortName = row.querySelector('[data-field="shortName"]').value.trim();
      const probability = Number(row.querySelector('[data-field="probability"]').value || 0);

      return {
        ...original,
        id: original.id || `prize-${Date.now()}-${index}`,
        name: name || `未命名奖品${index + 1}`,
        shortName: shortName || name || `奖品${index + 1}`,
        image: row.querySelector('[data-field="image"]').value.trim(),
        thumb: row.querySelector('[data-field="thumb"]').value.trim(),
        probability: Math.max(0, probability),
        stock,
        color: original.color || "#ff9d37"
      };
    });
  }

  function updateProbabilityTotal() {
    const total = Array.from(tableBody.querySelectorAll('[data-field="probability"]')).reduce(
      (sum, input) => sum + Number(input.value || 0),
      0
    );
    probabilityTotal.textContent = `${formatNumber(total)}%`;
    probabilityTotal.classList.toggle("is-warning", Math.abs(total - 100) > 0.001);
  }

  function addPrize() {
    syncConfigFromForm();
    config.prizes.push({
      id: `prize-${Date.now()}`,
      name: "新奖品",
      shortName: "新奖品",
      image: "",
      thumb: "",
      probability: 0,
      stock: 0,
      color: "#ff9d37"
    });
    renderPrizeTable();
  }

  function removePrize(index) {
    syncConfigFromForm();
    config.prizes.splice(index, 1);
    renderPrizeTable();
  }

  function saveConfig() {
    syncConfigFromForm();
    saveButton.disabled = true;
    Promise.resolve()
      .then(async () => {
        if (window.LotteryShared.isCloudEnabled()) {
          await window.LotteryShared.callCloud("saveConfig", {
            adminToken: window.CLOUDBASE_CONFIG.adminToken,
            activity: config.activity,
            prizes: config.prizes
          });
        } else {
          window.LotteryShared.saveRuntimeConfig(config);
        }
        saveButton.textContent = "已保存";
      })
      .catch((error) => {
        window.alert(`保存失败：${error.message}`);
      })
      .finally(() => {
        window.setTimeout(() => {
          saveButton.textContent = "保存配置";
          saveButton.disabled = false;
        }, 1200);
      });
  }

  function resetConfig() {
    if (!window.confirm("确定恢复默认奖品配置吗？当前后台修改会被清除。")) return;
    window.LotteryShared.resetRuntimeConfig();
    config = window.LotteryShared.getRuntimeConfig();
    render();
  }

  function clearRecords() {
    if (!window.confirm("确定清空当前浏览器里的抽奖记录吗？")) return;
    if (window.LotteryShared.isCloudEnabled()) {
      window.alert("CloudBase 云端流水不建议直接清空，请在云开发控制台或专用运维接口中处理。");
      return;
    }
    window.LotteryShared.clearDrawRecords();
    renderRecords();
  }

  async function loadCloudRecords() {
    const result = await window.LotteryShared.callCloud("getRecords", {
      adminToken: window.CLOUDBASE_CONFIG.adminToken,
      limit: 1000
    });
    return Array.isArray(result.records) ? result.records : [];
  }

  function escapeAttr(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function formatNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  function toDatetimeLocalValue(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function fromDatetimeLocalValue(value) {
    if (!value) return config.activity.endAt;
    return new Date(value).toISOString();
  }

  tableBody.addEventListener("input", updateProbabilityTotal);
  tableBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const row = button.closest("tr");
    removePrize(Number(row.dataset.index));
  });

  addPrizeButton.addEventListener("click", addPrize);
  saveButton.addEventListener("click", saveConfig);
  resetButton.addEventListener("click", resetConfig);
  exportConfigButton.addEventListener("click", () => {
    syncConfigFromForm();
    window.LotteryShared.exportPrizeConfig(config);
  });
  exportRecordsButton.addEventListener("click", () => {
    Promise.resolve()
      .then(async () => {
        const records = window.LotteryShared.isCloudEnabled() ? await loadCloudRecords() : window.LotteryShared.getDrawRecords();
        window.LotteryShared.exportDrawRecordsAsExcel(records);
      })
      .catch((error) => {
        window.alert(`导出失败：${error.message}`);
      });
  });
  clearRecordsButton.addEventListener("click", clearRecords);

  boot();
})();
