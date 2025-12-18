// ================= STORAGE =================
function saveData() {
    localStorage.setItem("doorprizeData", JSON.stringify({ prizes, participants }));
}

function loadData() {
    const data = JSON.parse(localStorage.getItem("doorprizeData"));
    if (data) {
        prizes = data.prizes || [];
        participants = data.participants || [];
    }
}

// ================= DATA =================
let participants = [];
let prizes = [];
let currentPrizeIndex = null;

// rolling state
let rollingInterval = null;
let rollingTimeout = null;

// ================= INIT =================
loadData();
renderPrizes();

// ================= ROLLING RESET =================
function resetRolling() {
    if (rollingInterval) {
        clearInterval(rollingInterval);
        rollingInterval = null;
    }
    if (rollingTimeout) {
        clearTimeout(rollingTimeout);
        rollingTimeout = null;
    }

    const rollSound = document.getElementById("rollSound");

    rollSound.pause();
    rollSound.currentTime = 0;

    document.getElementById("rollingBox").innerText = "Siap Diundi...";
}

// ================= UI =================
function renderPrizes() {
    const prizeList = document.getElementById("prizeList");
    prizeList.innerHTML = "";

    prizes.forEach((p, i) => {
        const card = document.createElement("div");
        card.className = "card";
        card.onclick = () => openDrawPage(i);

        card.innerHTML = `
            <h3>${p.name}</h3>
            ${p.winners.length
                ? `<div class="winner-list">${p.winners.join("<br>")}</div>`
                : ""}
        `;
        prizeList.appendChild(card);
    });
}

function openDrawPage(index) {
    resetRolling();
    currentPrizeIndex = index;

    document.getElementById("prizePage").classList.remove("active");
    document.getElementById("drawPage").classList.add("active");

    updateDrawInfo();
}

function backToHome() {
    resetRolling();
    document.getElementById("drawPage").classList.remove("active");
    document.getElementById("prizePage").classList.add("active");
}

function formatWinners(winners, locked) {
    return winners.map((w, i) =>
        locked
            ? `🎉 ${w}`
            : `🎉 ${w} <button onclick="removeWinner(${i})">❌</button>`
    ).join(" | ");
}

function updateDrawInfo() {
    const prize = prizes[currentPrizeIndex];
    document.getElementById("prizeTitle").innerText = prize.name;

    document.getElementById("winnerListLive").innerHTML =
        prize.winners.length
            ? formatWinners(prize.winners, prize.locked)
            : "-";

    document.getElementById("lockBtn").innerText =
        prize.locked ? "🔓 UNLOCK" : "🔒 LOCK";
}

// ================= DRAW PROCESS =================
document.getElementById("drawBtn").onclick = () => {
    const prize = prizes[currentPrizeIndex];
    if (prize.locked) return alert("Hadiah sedang di-LOCK");
    if (rollingInterval || rollingTimeout) return;

    const quota = parseInt(document.getElementById("quotaInput").value);
    const missing = quota - prize.winners.length;

    if (missing <= 0) return alert("Kuota sudah terpenuhi");
    if (participants.length < missing) return alert("Peserta tidak mencukupi");

    const rollSound = document.getElementById("rollSound");
    const winSound = document.getElementById("winSound");

    rollSound.play();

    rollingInterval = setInterval(() => {
        document.getElementById("rollingBox").innerText =
            participants[Math.floor(Math.random() * participants.length)];
    }, 80);

    rollingTimeout = setTimeout(() => {
        resetRolling(); // 🔥 stop drumroll + rolling

        let newWinners = [];
        for (let i = 0; i < missing; i++) {
            const idx = Math.floor(Math.random() * participants.length);
            newWinners.push(participants.splice(idx, 1)[0]);
        }

        prize.winners.push(...newWinners);

        document.getElementById("rollingBox").innerText =
            newWinners.join(" | ");

        winSound.play();
        confetti({ particleCount: 2000, spread: 1000 });

        saveData();
        renderPrizes();
        updateDrawInfo();
    }, 15000);
};

// ================= REMOVE / GUGUR =================
function removeWinner(index) {
    const prize = prizes[currentPrizeIndex];
    if (prize.locked) return;

    const removed = prize.winners.splice(index, 1)[0];
    participants.push(removed);

    saveData();
    renderPrizes();
    updateDrawInfo();
}

// ================= LOCK / UNLOCK =================
function lockPrize() {
    const prize = prizes[currentPrizeIndex];

    if (!prize.locked) {
        if (!confirm("LOCK hadiah ini? Pemenang tidak bisa dihapus.")) return;
        prize.locked = true;
    } else {
        if (!confirm("UNLOCK hadiah ini? Pemenang bisa dihapus lagi.")) return;
        prize.locked = false;
    }

    saveData();
    updateDrawInfo();
}

// ================= RESET =================
function resetPrize() {
    const prize = prizes[currentPrizeIndex];
    if (prize.locked) return alert("Hadiah sedang di-LOCK");

    participants.push(...prize.winners);
    prize.winners = [];

    saveData();
    renderPrizes();
    updateDrawInfo();
}

function resetAllWinners() {
    if (!confirm("Reset SEMUA pemenang (yang belum LOCK)?")) return;

    prizes.forEach(p => {
        if (!p.locked) {
            participants.push(...p.winners);
            p.winners = [];
        }
    });

    saveData();
    renderPrizes();
}

// ================= IMPORT EXCEL =================
document.getElementById("excelInput").addEventListener("change", e => {
    handleExcel(e, rows => {
        participants = rows.map(r => r[0]).filter(Boolean);
        saveData();
        alert("Peserta berhasil diimport");
    });
});

document.getElementById("prizeExcelInput").addEventListener("change", e => {
    handleExcel(e, rows => {
        prizes = rows
            .map(r => r[0])
            .filter(Boolean)
            .map(name => ({ name, winners: [], locked: false }));

        saveData();
        renderPrizes();
        alert("Hadiah berhasil diimport");
    });
});

function handleExcel(e, callback) {
    const reader = new FileReader();
    reader.onload = evt => {
        const wb = XLSX.read(new Uint8Array(evt.target.result), { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        callback(XLSX.utils.sheet_to_json(sheet, { header: 1 }));
    };
    reader.readAsArrayBuffer(e.target.files[0]);
}

// ================= EXPORT =================
function exportExcel() {
    let data = [];
    prizes.forEach(p =>
        p.winners.forEach(w =>
            data.push({ Hadiah: p.name, Pemenang: w })
        )
    );

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pemenang");
    XLSX.writeFile(wb, "hasil_doorprize.xlsx");
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 10;

    prizes.forEach(p => {
        doc.text(p.name, 10, y);
        y += 6;
        p.winners.forEach(w => {
            doc.text("- " + w, 15, y);
            y += 6;
        });
        y += 4;
    });

    doc.save("hasil_doorprize.pdf");
}

// ================= FULLSCREEN =================
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}
