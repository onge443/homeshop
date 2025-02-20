document.addEventListener("DOMContentLoaded", async () => {
    await loadStockData(); // โหลดข้อมูลตอนเปิดหน้าเว็บครั้งแรก
    await DashboardCheckRight();

    // ✅ ตั้งค่าให้โหลดข้อมูลใหม่ทุก 5 นาที
    setInterval(async () => {
        console.log("🔄 รีเฟรชข้อมูลอัตโนมัติ...");
        await loadStockData();
        await DashboardCheckRight();
    }, 300000); // 300,000ms = 5 นาที
});

// ✅ ฟังก์ชันดึงข้อมูลและอัปเดตตาราง
async function loadStockData() {
    try {
        const response = await fetch("/api/get-stock-status2"); // เรียก API
        const result = await response.json(); // แปลงข้อมูลเป็น JSON
        if (!result.success || !result.data || result.data.length === 0) {
            document.querySelector("#stockSummaryTable tbody").innerHTML = "<tr><td colspan='4' class='text-center'>❌ ไม่พบข้อมูล</td></tr>";
            return;
        }

        updateStockTable(result.data); // เรียกฟังก์ชันเพื่ออัปเดตตาราง
    } catch (error) {
        console.error("⚠️ Error loading stock status:", error);
    }
}

// ฟังก์ชันอัปเดตตาราง
function updateStockTable(data) {
    const tableBody = document.querySelector("#stockSummaryTable tbody");
    tableBody.innerHTML = ""; // เคลียร์ตารางก่อนใส่ข้อมูลใหม่

    const now = new Date(); // เวลาปัจจุบัน

    data.forEach(row => {
        // แปลง UPDATE_DATE จาก API เป็น Date Object
        const updateDate = row.UPDATE_DATE ? new Date(row.UPDATE_DATE) : null;
        const minutesPassed = updateDate ? (now - updateDate) / (1000 * 60) : 0;

        // ถ้าเป็น "จัดเตรียมเรียบร้อย" และเวลาผ่านไปเกิน 10 นาที ให้ข้าม
        if (row.STATUS_NAME === "จัดเตรียมเรียบร้อย" && minutesPassed > 10) {
            return;
        }

        const tr = document.createElement("tr");

        // กำหนดสีพื้นหลังตามสถานะ
        let bgColor = "";
        if (row.STATUS_NAME === "รอการจัดเตรียม") {
            bgColor = "background-color: yellow;";
        } else if (row.STATUS_NAME === "จัดเตรียมเรียบร้อย") {
            bgColor = "background-color: lightgreen;";
        }

        tr.innerHTML = `
            <td>${row.DI_REF || '-'}</td>
            <td>${row.SKU_NAME || '-'}</td>
            <td>${row.LATEST_PREPARE_QTY !== null ? row.LATEST_PREPARE_QTY : '-'}</td>
            <td style="${bgColor}">${row.STATUS_NAME || '-'}</td>
        `;

        tableBody.appendChild(tr);
    });
}

// เรียก API และอัปเดตตารางทุก 1 นาที
function fetchAndUpdateStock() {
    fetch("/api/get-stock-status2")
        .then(response => response.json())
        .then(result => {
            console.log("✅ ค่าที่ได้รับจาก API:", result);
            if (result.success && Array.isArray(result.data)) {
                updateStockTable(result.data);
            }
        })
        .catch(error => console.error("⚠️ Error loading stock status:", error));
}

// เรียก API ครั้งแรกและเซ็ตให้ทำซ้ำทุก 1 นาที
fetchAndUpdateStock();
setInterval(fetchAndUpdateStock, 60000);

// ✅ ฟังก์ชัน Logout
document.getElementById('logoutButton').addEventListener('click', function() {
    localStorage.clear();
    window.location.href = '/';
});

// ✅ เช็คสิทธิ์ผู้ใช้
window.onload = function() {
    const CheckUser = localStorage.getItem('username');
    if (CheckUser === null || CheckUser.trim() === '') {
        window.location.href = '/';
    }
    document.querySelector("#userDropdown span").textContent = CheckUser;
};

async function DashboardCheckRight() {
    const rights = localStorage.getItem("user_rights");
    try {
        if (rights === 'user') {
            document.getElementById("Report").hidden = true;
            return;
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

DashboardCheckRight();
