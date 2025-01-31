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
  
    // 2. ล้างข้อมูลในตาราง
    const dataTableBody = document.querySelector('#resultTable tbody');
    dataTableBody.innerHTML = '';
  
    // 3. สร้าง DataTable ใหม่
    const dataTable = $('#resultTable').DataTable({
      "autoWidth": false, // ปิดการขยายอัตโนมัติ
      "scrollX": true, // เปิดแถบเลื่อนแนวนอนหากจำเป็น
      "language": {
        "url": "//cdn.datatables.net/plug-ins/1.10.20/i18n/Thai.json"
      }
    });
  
    // 4. เพิ่มข้อมูล
    products.forEach((item, index) => {
      dataTable.row.add([
        index + 1,
        item.DI_REF,
        item.ICCAT_CODE,
        item.ICCAT_NAME,
        item.SKM_QTY
      ]).draw(false);
    });
  
    // 5. แสดงตารางผ่าน container
    document.getElementById("dataTableContainer").style.display = 'block';

  console.log("✅ Table Updated with DataTables!");

    
    console.log("✅ Table Updated and Visible!"); // ✅ Debug

    // ตรวจสอบและลบ DataTable เก่า
    if ($.fn.DataTable.isDataTable('#dataTable')) {
      $('#dataTable').DataTable().clear().destroy(); // ป้องกัน error
    }
  }
});
