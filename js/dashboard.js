document.addEventListener("DOMContentLoaded", async () => {
    await loadStockData(); // โหลดข้อมูลตอนเปิดหน้าเว็บครั้งแรก
    await DashboardCheckRight();
  
    // รีเฟรชข้อมูลอัตโนมัติทุก 5 นาที
    setInterval(async () => {
      console.log("🔄 รีเฟรชข้อมูลอัตโนมัติ...");
      await loadStockData();
      await DashboardCheckRight();
    }, 300000); // 300,000 ms = 5 นาที
  });
  
  // ฟังก์ชันดึงข้อมูลและอัปเดต card
  async function loadStockData() {
    try {
      const response = await fetch("/api/get-stock-status2"); // เรียก API
      const result = await response.json(); // แปลงข้อมูลเป็น JSON
      if (!result.success || !result.data || result.data.length === 0) {
        const container = document.getElementById("cardContainer");
        container.innerHTML = `<div class="col-12 text-center">❌ ไม่พบข้อมูล</div>`;
        return;
      }
      updateCardContainer(result.data); // อัปเดต card ด้วยข้อมูลที่ดึงมา
    } catch (error) {
      console.error("⚠️ Error loading stock status:", error);
    }
  }
  
  // ฟังก์ชันสร้าง card จากข้อมูลที่ได้รับ
  function updateCardContainer(data) {
    const container = document.getElementById("cardContainer");
    container.innerHTML = ""; // เคลียร์ข้อมูลเก่า
  
    // กำหนด mapping สีสำหรับสถานะ
    const statusColorMapping = {
      "รอจัด": "btn-danger",
      "กำลังจัด": "btn-pink",       // btn-pink ต้องมีการกำหนด CSS เพิ่มเติมในไฟล์ CSS ของคุณ
      "จัดบางส่วน": "btn-warning",
      "จัดเสร็จ": "btn-success",
      "จ่ายบางส่วน": "btn-info",
      "จ่ายทั้งหมด": "btn-primary"
    };
  
    // Group ข้อมูลตาม DI_REF (รองรับทั้งตัวพิมพ์ใหญ่และตัวพิมพ์เล็ก)
    const groupedData = data.reduce((acc, item) => {
      const diRef = item.DI_REF || item.di_ref;
      if (!diRef) return acc;
      if (!acc[diRef]) {
        acc[diRef] = [];
      }
      acc[diRef].push(item);
      return acc;
    }, {});
  
    // วนลูป group ที่ได้และสร้าง card สำหรับแต่ละ group
    Object.keys(groupedData).forEach(diRef => {
      const group = groupedData[diRef];
      // ใช้ record แรกใน group เป็นข้อมูลพื้นฐาน
      const first = group[0];
  
      // แปลงวันที่เอกสาร
      let diDate = first.DI_DATE || first.di_date;
      if (diDate) {
        const dateObj = new Date(diDate);
        diDate = dateObj.toLocaleDateString("th-TH");
      } else {
        diDate = '-';
      }
  
      // กำหนดข้อความสถานะ และเลือกสีจาก mapping
      const statusText = first.STATUS_NAME || first.status_name || '-';
      const statusClass = statusColorMapping[statusText] || "btn-secondary";
  
      // สร้าง HTML ของ card โดยแสดง "ลูกค้า" และ "สถานะ" ในแถวเดียวกัน
      const cardHTML = `
        <div class="card border-left-primary shadow h-100 py-2 mb-3" style="width: 100%;">
          <div class="card-body">
            <!-- แถวเดียวสำหรับลูกค้า (ด้านซ้าย) และสถานะ (ด้านขวา) -->
            <div class="mb-2 d-flex justify-content-between align-items-center">
              <div>
                <div class="text-xs font-weight-bold text-primary text-uppercase">ลูกค้า</div>
                <div class="h5 mb-0 font-weight-bold text-gray-800">${first.AR_NAME || first.ar_name || '-'}</div>
              </div>
              <div>
                <div class="text-xs font-weight-bold text-primary text-uppercase">สถานะ</div>
                <div class="h5 mb-0 font-weight-bold">
                  <span class="btn ${statusClass} btn-sm">${statusText}</span>
                </div>
              </div>
            </div>
            <!-- ข้อมูลอื่น ๆ -->
            <div class="mb-2">
              <div class="text-xs font-weight-bold text-primary text-uppercase">เลขที่เอกสาร</div>
              <div class="h5 mb-0 font-weight-bold text-gray-800">${diRef}</div>
            </div>
            <div class="mb-2">
              <div class="text-xs font-weight-bold text-primary text-uppercase">วันที่เอกสาร</div>
              <div class="h5 mb-0 font-weight-bold text-gray-800">${diDate}</div>
            </div>
            <!-- หากมีหลายรายการใน group (เช่น รายการสินค้า) -->
            ${group.length > 1 ? `<hr>
            <div class="mt-2">
              <div class="text-xs font-weight-bold text-secondary text-uppercase">รายการสินค้า</div>
              ${group.map(item => `<div>${item.SKU_NAME || '-'}</div>`).join('')}
            </div>` : ''}
          </div>
        </div>
      `;
      container.insertAdjacentHTML("beforeend", cardHTML);
    });
  }
  
  
  
  
  
  
  
  
  // อัปเดตข้อมูลทุก 1 นาที (optional)
  function fetchAndUpdateStock() {
    fetch("/api/get-stock-status2")
      .then(response => response.json())
      .then(result => {
        console.log("✅ ค่าที่ได้รับจาก API:", result);
        if (result.success && Array.isArray(result.data)) {
          updateCardContainer(result.data);
        }
      })
      .catch(error => console.error("⚠️ Error loading stock status:", error));
  }
  fetchAndUpdateStock();
  setInterval(fetchAndUpdateStock, 60000);
  
  // ฟังก์ชัน Logout
  document.getElementById('logoutButton').addEventListener('click', function() {
    localStorage.clear();
    window.location.href = '/';
  });
  
  // เช็คสิทธิ์ผู้ใช้
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
  