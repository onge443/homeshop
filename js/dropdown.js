document.addEventListener('DOMContentLoaded', async () => {
  const dropdown = document.getElementById('productDropdown');
  const dataTableContainer = document.getElementById('dataTableContainer');
  let dataTable; // ตัวแปรเก็บ instance ของ DataTable

  console.log("Fetching dropdown data...");
  
  // โหลดข้อมูล Dropdown
  try {
    const response = await fetch('/api/dropdown-data');
    if (!response.ok) throw new Error("Failed to fetch dropdown data");
    const { data } = await response.json();
    console.log("Dropdown API Response:", data);
    console.log("Dropdown Data:", data); // Debugging

    if (!data || data.length === 0) {
      dropdown.innerHTML = '<option value="">ไม่มีหมวดหมู่</option>';
      return;
    } 
    dropdown.innerHTML = '<option value="">เลือกประเภทสินค้า</option>';
        data.forEach(item => {
            const option = document.createElement("option");
            option.value = item.ICCAT_KEY;
            option.textContent = `${item.ICCAT_CODE} - ${item.ICCAT_NAME}`;
            dropdown.appendChild(option);
      });
    
  } catch (error) {
    console.error('Error loading dropdown:', error);
    dropdown.innerHTML = '<option value="">โหลดข้อมูลล้มเหลว</option>';
  }

  // Event Listener เมื่อเลือก Dropdown
  dropdown.addEventListener('change', async (e) => {
    const categoryKey = parseInt(e.target.value, 10);
    console.log("Selected Category Key:", categoryKey);


  if (isNaN(categoryKey)) {
    alert("เลือกประเภทสินค้าไม่ถูกต้อง");
    return;
  }

    try {
      const response = await fetch('/api/products-by-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryKey })
      });

      if (!response.ok) throw new Error("Failed to fetch product data");

      const { data } = await response.json();
      console.log("Fetched Product Data:", data); // ✅ Debug
      
      if (data.length > 0) {
        updateTable(data);
        document.getElementById("resultTable").style.display = 'block';
      } else {
        document.getElementById("resultTable").style.display = 'none';
        alert("ไม่มีข้อมูลสินค้าในหมวดหมู่นี้");
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      alert("เกิดข้อผิดพลาดในการโหลดข้อมูลสินค้า");
    }
  });

  // ฟังก์ชันอัปเดตตาราง
  function updateTable(products) {
    // 1. ทำลาย DataTable เก่า (ถ้ามี)
    if ($.fn.DataTable.isDataTable('#resultTable')) {
      $('#resultTable').DataTable().destroy();
    }
  
    // 2. สร้าง DataTable ใหม่ พร้อมคอลัมน์สถานะ
  const dataTable = $('#resultTable').DataTable({
    "autoWidth": false,
    "scrollX": true,
    "language": {
      "url": "//cdn.datatables.net/plug-ins/1.10.20/i18n/Thai.json"
    },
    "columns": [ // กำหนดคอลัมน์ทั้งหมด
      { title: "ลำดับ" },
      { title: "เลขที่บิล" },
      { title: "รหัสสินค้า" },
      { title: "ชื่อสินค้า" },
      { title: "จำนวนจัดเตรียม" },
      { title: "สถานะ" }, // เพิ่มคอลัมน์สถานะ
      { title: "จัดเตรียมเรียบร้อย" } // คอลัมน์ปุ่ม OK
    ]
  });

    // 3. เพิ่มข้อมูลพร้อมสถานะเริ่มต้น
  products.forEach((item, index) => {
    dataTable.row.add([
      index + 1,
      item.DI_REF,
      item.ICCAT_CODE,
      item.ICCAT_NAME,
      Math.abs(item.SKM_QTY), // ✅ แสดงค่าบวกเสมอ
      '<span class="status-pending">กำลังจัดเตรียม</span>', // สถานะเริ่มต้น
      '<button class="btn-confirm">OK</button>' // ปุ่ม OK
    ]).draw(false);
  });
    // 4. Event เมื่อคลิกปุ่ม OK
  $('#resultTable').on('click', '.btn-confirm', async function () {
    const tr = $(this).closest('tr');
    const rowData = dataTable.row(tr).data();
    const username = localStorage.getItem('username') || 'unknown_user';
    const payload = [{
      DI_REF: rowData[1],
      ICCAT_CODE: rowData[2],
      ICCAT_NAME: rowData[3],
      SKM_QTY: rowData[4],
      Status: 'จัดเตรียมสำเร็จ' // บันทึกสถานะลงฐานข้อมูล
    }];
    try {
      const response = await fetch('/api/save-preparation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload, username })
      });
      const result = await response.json();
      if (result.success) {
        alert("บันทึกข้อมูลสำเร็จ!");
        rowData[5] = '<span class="status-completed">จัดเตรียมสำเร็จ</span>';
        dataTable.row(tr).data(rowData).draw();
        $(this).prop('disabled', true).text('OK แล้ว');
      } else {
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }
    } catch (error) {
      console.error("Error saving data:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
    // อัปเดตสถานะ
    rowData[5] = '<span class="status-completed">จัดเตรียมสำเร็จ</span>';
    dataTable.row(tr).data(rowData).draw();

    // ปิดการใช้งานปุ่ม
    $(this).prop('disabled', true).text('OK แล้ว');
    // ตรวจสอบสถานะทั้งหมด
    checkAllCompleted();
  });
  // 5. แสดงตาราง
  document.getElementById("dataTableContainer").style.display = 'block';
}
// ฟังก์ชันตรวจสอบสถานะทั้งหมด
function checkAllCompleted() {
  const allRows = $('#resultTable').DataTable().rows().data();
  let isAllCompleted = true;

  allRows.each(function(row) {
    if (row[5].includes('status-pending')) {
      isAllCompleted = false;
      return false; // หยุดลูปหากพบรายการที่ยังไม่เสร็จ
    }
  });

  // อัปเดตปุ่มจัดเตรียมครบทุกชิ้น
  $('#btnComplete').prop('disabled', !isAllCompleted);

  console.log("✅ Table Updated with DataTables!");

    
    console.log("✅ Table Updated and Visible!"); // ✅ Debug

    // ตรวจสอบและลบ DataTable เก่า
    if ($.fn.DataTable.isDataTable('#dataTable')) {
      $('#dataTable').DataTable().clear().destroy(); // ป้องกัน error
    }
  }
});
