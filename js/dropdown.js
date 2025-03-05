async function searchPreparation() {
    const branch = localStorage.getItem("branch_code");

    $('#resultstock').DataTable({
        "processing": true,
        "serverSide": true,
        "ajax": {
            "url": "/api/search-preparation",
            "type": "POST",
            "contentType": "application/json",
            "data": function (d) {
                return JSON.stringify({
                    branch: branch,
                    start: d.start,
                    length: d.length,
                    status: window.selectedStatus, // ส่งค่า status ที่เลือกจากปุ่ม
                    category: document.getElementById("filterCategory").value,
                    documentID: document.getElementById("filterDocument").value
                    // เพิ่ม filter อื่นๆ ถ้ามี
                });
            },
            "dataSrc": function (json) {
                console.log("✅ จำนวนข้อมูลที่ API ส่งมา:", json.data.length);
                return json.data;
            }
        },
        "pageLength": 10,
        "columns": [
            { 
              "data": null, 
              "render": function(data, type, row, meta) { return meta.row + 1; },
              "title": "ลำดับ" 
            },
            { 
              "data": "AR_NAME", 
              "title": "ชื่อลูกค้า"  // เปลี่ยน title ให้เป็นชื่อภาษาไทย
            },
            { 
              "data": "DocumentID", 
              "title": "เลขที่เอกสาร"  // DocumentID คือ DI_REF ที่ API ส่งกลับ
            },
            { 
              "data": "DI_DATE", 
              "title": "วันที่",
              "render": function(data, type, row) { 
                  return data ? new Date(data).toLocaleDateString() : ''; 
              }
            },
            { 
              "data": null, 
              "title": "ดำเนินการ",
              "render": function(data, type, row) {
                  return `<button class="btn btn-primary btn-detail" data-doc="${row.DocumentID}">
                            เริ่มจัด
                          </button>`;
              }
            }
        ],
        "destroy": true
    });
}

// ✅ โหลดข้อมูลประเภทสินค้า
async function loadProductCategories() {
    try {
        const response = await fetch('/api/product-categories');
        const data = await response.json();

        console.log("📌 API Response:", data); // ✅ Debug เช็ค API ส่งข้อมูลมาให้จริงไหม

        if (!data.success) throw new Error("Failed to load categories");

        const categoryDropdown = document.getElementById("filterCategory"); // ✅ เปลี่ยนเป็น filterCategory ให้ตรง HTML
        categoryDropdown.innerHTML = ""; // ✅ ล้างค่าก่อนโหลดใหม่

        // ✅ เพิ่มค่า "ทั้งหมด" เป็นค่าเริ่มต้น
        const defaultOption = document.createElement("option");
        defaultOption.value = "all";
        defaultOption.textContent = "ทั้งหมด";
        categoryDropdown.appendChild(defaultOption);

        // ✅ เพิ่มหมวดหมู่ที่ได้จาก API
        data.data.forEach(category => {
            const option = document.createElement("option");
            option.value = category.categoryCode;  // ✅ ส่ง categoryCode ไป API
            option.textContent = category.categoryName;  // ✅ แสดงชื่อหมวดหมู่ที่กำหนด
            categoryDropdown.appendChild(option);
        });

        console.log("📌 Dropdown Updated:", categoryDropdown.innerHTML); // ✅ Debug เช็คว่ามีการอัปเดต dropdown จริง

    } catch (error) {
        console.error("❌ Error loading categories:", error);
    }
}

// ✅ โหลดข้อมูลเมื่อหน้าเว็บโหลด
document.addEventListener("DOMContentLoaded", loadProductCategories);

// ✅ ฟังก์ชันที่ใช้ส่งค่าหมวดหมู่ไปที่ API เมื่อเลือก dropdown
document.getElementById("filterCategory").addEventListener("change", function() {
    const selectedCategory = this.value; // ✅ ค่าที่เลือกจาก dropdown (A, K, M, O, ...)

    // ✅ ส่งค่าไปที่ API /api/products (หรือ API ที่ใช้ดึงข้อมูล)
    loadProductData(selectedCategory);
});

// ✅ ฟังก์ชันเรียก API ดึงข้อมูลสินค้าโดยส่ง `categoryCode`
function loadProductData(category) {
    fetch(`/api/products?category=${category}`)
        .then(response => response.json())
        .then(data => {
            console.log("📌 ข้อมูลสินค้า:", data);
            updateProductTable(data.data); // ✅ ฟังก์ชันอัปเดตตารางสินค้า
        })
        .catch(error => console.error("❌ Error fetching product data:", error));
}
// ✅ โหลดประเภทสินค้าตอนหน้าเว็บโหลด
document.addEventListener("DOMContentLoaded", loadProductCategories);

// ฟังก์ชันโหลดปุ่มสถานะ (Status Buttons) ในหน้า tables2.html
async function loadStatusButtons() {
    const statusButtonsContainer = document.getElementById('statusButtons');
    if (!statusButtonsContainer) return;
    statusButtonsContainer.innerHTML = ''; // ล้างข้อมูลเดิม

    // กำหนดรายการสถานะที่ต้องการ (สามารถปรับแก้ได้ตามความเหมาะสม)
    const statuses = [
        { value: 'all', text: 'ทั้งหมด' },
        { value: '1', text: 'รอการจัดเตรียม' },
        { value: '2', text: 'รอการตรวจจ่าย' },
        { value: '3', text: 'จัดเตรียมเรียบร้อย' },
        { value: '4', text: 'ตรวจจ่ายเรียบร้อย' },
        { value: '5', text: 'รอสโตร์ตรวจจ่าย' }
    ];

    statuses.forEach(status => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-outline-primary status-btn';
        btn.dataset.status = status.value;
        btn.textContent = status.text;
        statusButtonsContainer.appendChild(btn);
    });

    // กำหนดค่าเริ่มต้น (เลือก "ทั้งหมด" เป็นค่า default)
    window.selectedStatus = 'all';

    // เพิ่ม event listener ให้กับปุ่มสถานะทุกปุ่ม
    document.querySelectorAll('.status-btn').forEach(button => {
        button.addEventListener('click', function() {
            // เอา active class ออกจากปุ่มทั้งหมด
            document.querySelectorAll('.status-btn').forEach(btn => btn.classList.remove('active'));
            // เพิ่ม active class ให้กับปุ่มที่ถูกคลิก
            this.classList.add('active');
            window.selectedStatus = this.dataset.status;
        });
    });
}


// ✅ บันทึกข้อมูลเมื่อกดปุ่ม
// document.addEventListener("click", async (event) => {
//     if (event.target.classList.contains("btn-save")) {
//         const button = event.target;
//         const row = button.closest("tr");
//         const docID = button.getAttribute("data-doc");
//         const SKUCode = button.getAttribute("data-prod");
//         const qtyInput = row.querySelector(".prepare-input").value.trim();
//         const username = localStorage.getItem("username") || "ระบบ";
//         const branch = localStorage.getItem("branch_code");

//         if (!docID || !SKUCode) {
//             alert("ไม่พบข้อมูลเอกสารหรือรหัสสินค้า");
//             return;
//         }
//         if (!qtyInput) {
//             alert("กรุณากรอกจำนวนจัดเตรียมก่อนกดบันทึก!");
//             return;
//         }

//         const payload = {
//             DI_REF: docID,
//             ProductCode: SKUCode,
//             PreparedQty: parseInt(qtyInput, 10),
//             Username: username,
//             branch: branch
//         };

//         try {
//             const response = await fetch('/api/save-preparation', {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(payload)
//             });

//             const result = await response.json();

//             if (result.success) {
//                 alert("บันทึกข้อมูลสำเร็จ!");
//                 row.querySelector("td:nth-last-child(2)").textContent = "จัดเตรียมสำเร็จ";
//                 button.style.display = "none"; // ✅ ซ่อนปุ่ม "บันทึก"
                
//                 // ✅ รีโหลดตารางใหม่โดยไม่ต้องโหลดหน้าเว็บ
//                 $('#resultstock').DataTable().ajax.reload();
//             } else {
//                 alert(result.message); // ✅ แจ้งเตือนเมื่อบันทึกไม่สำเร็จ
//             }
//         } catch (error) {
//             console.error("Error saving data:", error);
//             alert("เกิดข้อผิดพลาดในการบันทึก");
//         }
    document.addEventListener("DOMContentLoaded", function() {
    // เพิ่ม event listener สำหรับการคลิกใน document
    document.addEventListener("click", function(event) {
        // ตรวจสอบว่าปุ่มที่ถูกคลิกมี class "btn-detail" หรือไม่
        if (event.target.classList.contains("btn-detail")) {
            // ดึงค่า di_ref จาก data attribute ของปุ่ม
            const docID = event.target.getAttribute("data-doc");
            if (!docID) return; // ถ้าไม่มีค่า di_ref ก็ไม่ทำอะไร
            // เปลี่ยนหน้าไปที่ prepdetail.html พร้อมส่ง di_ref ใน query string
            window.location.href = `/prepdetail?di_ref=${encodeURIComponent(docID)}`;
            // หากต้องการเปิดในแท็บใหม่ ใช้ window.open() แทน:
            // window.open(`/prepdetail.html?di_ref=${encodeURIComponent(docID)}`, '_blank');
        }
    });
});

// }
// });
async function PrepareCheckRight() {
    const username = localStorage.getItem("username");
    const rights = localStorage.getItem("user_rights");

    try {
        if (username) {
            document.querySelector("#userDropdown span").textContent = username;
        }else{
            alert("กรุณาเข้าสู่ระบบก่อนใช้งาน");
            window.location.href = '/';
            return;
        }
        if (rights == 'user') {
            document.getElementById("Report").hidden = true;
            return;
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

document.getElementById('logoutButton').addEventListener('click', function() {
    localStorage.clear();
    window.location.href = '/';
});

PrepareCheckRight();
// ✅ โหลดข้อมูลเมื่อเปิดหน้าเว็บ
document.addEventListener("DOMContentLoaded", function () {
    loadStatusButtons();
    loadProductCategories();
    // โหลดสถานะ/หมวดหมู่สินค้าตามที่ต้องการ
});

document.getElementById("searchButton").addEventListener("click", searchPreparation);
document.addEventListener("DOMContentLoaded", function () {
    const userRights = localStorage.getItem("user_rights"); // ดึงค่า user_rights
    // const filterStatus = document.getElementById("filterStatus"); // หา dropdown สถานะ

    // if (filterStatus && userRights === "user") {
    //     // ✅ จำกัดสิทธิ์เฉพาะ user ให้เลือกได้แค่ "ทั้งหมด"
    //     filterStatus.innerHTML = `<option value="all" selected>ทั้งหมด</option>`;
    //     filterStatus.disabled = true;
    // }
});

