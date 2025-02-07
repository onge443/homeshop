async function loadProductCategories() {
  const categoryDropdown = document.getElementById('filterCategory');

  try {
      const response = await fetch('/api/product-categories');
      if (!response.ok) throw new Error("Failed to fetch product categories");
      
      const { data } = await response.json();

      // ✅ เพิ่มตัวเลือก "ทั้งหมด" เป็นค่าเริ่มต้น
      categoryDropdown.innerHTML = '<option value="all">ทั้งหมด</option>';
      
      data.forEach(category => {
          const option = document.createElement("option");
          option.value = category.ICCAT_KEY; // ✅ ใช้ `ICCAT_KEY` เป็นค่า
          option.textContent = category.ICCAT_NAME; // ✅ แสดง `ICCAT_NAME`
          categoryDropdown.appendChild(option);
      });

  } catch (error) {
      console.error("Error loading product categories:", error);
  }
}
async function loadStatusList() {
  const statusDropdown = document.getElementById('filterStatus');

  try {
      const response = await fetch('/api/status-list');
      if (!response.ok) throw new Error("Failed to fetch status list");
      
      const { data } = await response.json();

      // ✅ เพิ่มตัวเลือก "ทั้งหมด" เป็นค่าเริ่มต้น
      statusDropdown.innerHTML = '<option value="all">ทั้งหมด</option>';
      
      data.forEach(status => {
          const option = document.createElement("option");
          option.value = status.status; // ✅ ใช้ `status` เป็นค่า
          option.textContent = status.status; // ✅ แสดง `status`
          statusDropdown.appendChild(option);
      });

      // ✅ ตั้งค่าเริ่มต้นเป็น "รอการจัดเตรียม"
      statusDropdown.value = "รอการจัดเตรียม";

  } catch (error) {
      console.error("Error loading status list:", error);
  }
}

// ✅ เรียกใช้ฟังก์ชันทันทีเมื่อ `dropdown.js` ถูกโหลด
loadStatusList();

// ✅ เรียกใช้ฟังก์ชันทันทีเมื่อ `dropdown.js` ถูกโหลด
loadProductCategories();
document.getElementById("searchButton").addEventListener("click", async () => {
  let category = document.getElementById("filterCategory").value;
  let status = document.getElementById("filterStatus").value;
  let documentId = document.getElementById("filterDocument").value.trim();

  const searchParams = {
    category: category === "all" ? null : category, // ✅ ถ้าเลือก "ทั้งหมด" ให้ส่งค่า null
    status: status === "all" ? null : status, // ✅ ถ้าเลือก "ทั้งหมด" ให้ส่งค่า null
    documentId: documentId || null
};

  try {
      const response = await fetch(`/api/search-preparation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(searchParams)
      });

      const { data } = await response.json();
      const tableBody = document.querySelector("#resultstock tbody");

      tableBody.innerHTML = ""; // ✅ เคลียร์ข้อมูลเดิมก่อนโหลดใหม่
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn("⚠ ไม่มีข้อมูลที่ดึงมาได้!");
        alert("ไม่พบข้อมูลตามที่ค้นหา");
        return;
      }
      data.forEach((item,index ) => {
        const isReadOnly = item.Status === "รอสโตร์ตรวจจ่าย" ? "readonly" : ""; // ✅ ตรวจสอบสถานะ
        const row = document.createElement("tr");
    
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.DocumentID}</td>
            <td>${item.StorageLocation}</td>
            <td>${item.ProductCategory}</td>
            <td>${item.ProductCode}</td>
            <td>${item.ProductName}</td>
            <td>${item.SoldQty}</td>
            <td>${item.ReceivedQty}</td>
            <td>${item.PendingQty}</td>
            <td><input type="number" class="form-control prepare-input" id="prepareQTY${index}" ${isReadOnly}></td>
            <td>${item.Status}</td>
            <td><button class="btn btn-success btn-save" data-doc="${item.DocumentID}" data-prod="${item.ProductCode}">บันทึก</button></td>
        `;
    
        tableBody.appendChild(row);
        
        document.addEventListener("click", async (event) => {
          if (event.target.classList.contains("btn-save")) {
              const button = event.target;
              const row = button.closest("tr");
      
              const docID = button.getAttribute("data-doc");  // ✅ ดึงค่า Document ID จากปุ่ม
              const prodCode = button.getAttribute("data-prod"); // ✅ ดึงค่า Product Code จากปุ่ม
              const qtyInput = row.querySelector(".prepare-input").value.trim();
      
              if (!docID || !prodCode) {
                  console.error("Missing docID or prodCode");
                  alert("มีข้อผิดพลาด: ไม่พบข้อมูลเอกสารหรือรหัสสินค้า");
                  return;
              }
      
              if (!qtyInput) {
                  alert("กรุณากรอกจำนวนจัดเตรียมก่อนกดบันทึก!");
                  return;
              }
      
              const username = localStorage.getItem("username") || "ระบบ";
              const payload = {
                  DI_REF: docID,
                  ProductCode: prodCode,
                  PreparedQty: parseInt(qtyInput, 10),
                  Username: username
              };
      
              try {
                  const response = await fetch('/api/save-preparation', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload)
                  });
      
                  const result = await response.json();
      
                  if (result.success) {
                      alert("บันทึกข้อมูลสำเร็จ!");
                      
                      row.querySelector("td:nth-last-child(2)").textContent = "จัดเตรียมสำเร็จ";
                      button.style.display = "none"; // ✅ ซ่อนปุ่ม "บันทึก"
      
                  } else {
                      alert("เกิดข้อผิดพลาดในการบันทึก");
                  }
              } catch (error) {
                  console.error("Error saving data:", error);
                  alert("เกิดข้อผิดพลาดในการบันทึก");
              }
          }
      });
      
    });

  } catch (error) {
      console.error("Error fetching search results:", error);
  }
});