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
    const response = await fetch("/api/get-stock-status2");  // เรียก API
    const result = await response.json();  // แปลงข้อมูลเป็น JSON
    // console.log("✅ ค่าที่ได้รับจาก API:", result);  // ตรวจสอบค่าที่ API ส่งมา
    // console.table(result.data);  // แสดงข้อมูลแบบตารางใน Console

    if (!result.success || !result.data || result.data.length === 0) {
        document.querySelector("#stockSummaryTable tbody").innerHTML = "<tr><td colspan='4' class='text-center'>❌ ไม่พบข้อมูล</td></tr>";
        return;
    }

    updateStockTable(result.data);  // เรียกฟังก์ชันเพื่ออัปเดตตาราง
} catch (error) {
    console.error("⚠️ Error loading stock status:", error);
}
}       
    // ✅ ฟังก์ชันอัปเดตตาราง
    function updateStockTable(data) {
        if (!Array.isArray(data)) {
            console.error("❌ Data ไม่ใช่ array:", data);
            return;
        }
    const tableBody = document.querySelector("#stockSummaryTable tbody");
    tableBody.innerHTML = ""; // เคลียร์ตารางก่อนใส่ข้อมูลใหม่

    data.forEach(row => {
        if (!row.STATUS_NAME) return; // ✅ ข้ามค่าที่ไม่ใช่ "รอการจัดเตรียม" หรือ "จัดเตรียมเรียบร้อย"
         // ✅ กำหนดสีพื้นหลังตามสถานะ
        let bgColor = "";
        if (row.STATUS_NAME === "รอการจัดเตรียม") {
            bgColor = "background-color: yellow;";
        } else if (row.STATUS_NAME === "จัดเตรียมเรียบร้อย") {
            bgColor = "background-color: lightgreen;";
        }
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${row.DI_REF || '-'}</td>
            <td>${row.SKU_NAME || '-'}</td>
            <td>${row.LATEST_PREPARE_QTY !== null ? row.LATEST_PREPARE_QTY : '-'}</td>
            <td style="${bgColor}">${row.STATUS_NAME}</td>
        `;

        tableBody.appendChild(tr);
    });
}
    

document.getElementById('logoutButton').addEventListener('click', function() {
    localStorage.clear();
    window.location.href = '/';
});

window.onload = function() {
    const CheckUser = localStorage.getItem('username');
    if (CheckUser === null || CheckUser.trim() === '') {
        window.location.href = '/';
    }
    document.querySelector("#userDropdown span").textContent = CheckUser;
};
async function DashboardCheckRight() {
    
    const rights = localStorage.getItem("user_rights");
    const username = localStorage.getItem("user_rusernameights");
    
    try {
        
    

        if (rights == 'user') {
            document.getElementById("Report").hidden = true;
            return;
        }


    } catch (error) {
        console.error("Error:", error);
    }
}
DashboardCheckRight();