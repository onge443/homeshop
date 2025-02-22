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
    const selectedStatus = document.getElementById("filterStatus").value;
    return JSON.stringify({
        category: document.getElementById("filterCategory").value,
        status: selectedStatus !== "all" ? selectedStatus : "all", // ✅ ใช้ค่าจาก dropdown
        documentID: document.getElementById("filterDocument").value,
        branch: localStorage.getItem("branch_code"),
        start: d.start,
        length: d.length
    });
},
                "dataSrc": function (json) {
            console.log("✅ จำนวนข้อมูลที่ API ส่งมา:", json.data.length);
            return json.data;
                }
        },
        "pageLength": 10,  // ✅ กำหนดค่าเริ่มต้นเป็น 10 แถว
        "lengthMenu": [[10, 25, 50, 100], [10, 25, 50, 100]],  // ✅ ให้เลือกจำนวนแถวได้
        "scrollY": false,  // ❌ ปิดการใช้ `scrollY` (อาจทำให้จำนวนแถวไม่ตรง)
        "scrollCollapse": false,  // ❌ ปิดเพื่อป้องกัน DataTables คำนวณความสูงผิดพลาด
        "deferRender": true,
        "scroller": true,
        "columns": [
            { "data": "RowNum" },
            { "data": "DocumentID" },
            { "data": "SKU_WL" },
            { "data": "ProductCategoryName" },
            { "data": "SKU_CODE" },
            { "data": "SKU_NAME" },
            { "data": "SoldQty" },
            { "data": "ReceivedQty" },
            { "data": "PendingQty" },
            { 
            "data": "LATEST_PREPARE_QTY",
                "render": function (data, type, row) {
                        return `<input type='number' class='form-control prepare-input' value='${data || 0}' 
                            data-doc='${row.DocumentID}' 
                            data-prod='${row.SKU_CODE}' 
                            max ='${row.PendingQty}' 
                            min='0' >`;
                }
            },
            { "data": "STATUS" },
            {
                "data": null,
                "render": function (data, type, row) {
                    return `<button class='btn btn-success btn-save' data-doc='${row.DocumentID}' data-prod='${row.SKU_CODE}'>บันทึก</button>`;
                }
            }
        ],
        "destroy": true  // ✅ ป้องกัน DataTables ซ้ำซ้อน
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

// ✅ โหลดข้อมูลสถานะ
async function loadStatusList() {
    const statusDropdown = document.getElementById('filterStatus');

    try {
        const response = await fetch('/api/status-list');
        if (!response.ok) throw new Error("Failed to fetch status list");

        const { data } = await response.json();
        statusDropdown.innerHTML = '<option value="all">ทั้งหมด</option>';
        
        data.forEach(status => {
            const option = document.createElement("option");
            option.value = status.status;
            option.textContent = status.status;
            statusDropdown.appendChild(option);
        });

        statusDropdown.value = "all";
    } catch (error) {
        console.error("Error loading status list:", error);
    }
}

// ✅ บันทึกข้อมูลเมื่อกดปุ่ม
document.addEventListener("click", async (event) => {
    if (event.target.classList.contains("btn-save")) {
        const button = event.target;
        const row = button.closest("tr");
        const docID = button.getAttribute("data-doc");
        const SKUCode = button.getAttribute("data-prod");
        const qtyInput = row.querySelector(".prepare-input").value.trim();
        const username = localStorage.getItem("username") || "ระบบ";
        const branch = localStorage.getItem("branch_code");

        if (!docID || !SKUCode) {
            alert("ไม่พบข้อมูลเอกสารหรือรหัสสินค้า");
            return;
        }
        if (!qtyInput) {
            alert("กรุณากรอกจำนวนจัดเตรียมก่อนกดบันทึก!");
            return;
        }

        const payload = {
            DI_REF: docID,
            ProductCode: SKUCode,
            PreparedQty: parseInt(qtyInput, 10),
            Username: username,
            branch: branch
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
                
                // ✅ รีโหลดตารางใหม่โดยไม่ต้องโหลดหน้าเว็บ
                $('#resultstock').DataTable().ajax.reload();
            } else {
                alert(result.message); // ✅ แจ้งเตือนเมื่อบันทึกไม่สำเร็จ
            }
        } catch (error) {
            console.error("Error saving data:", error);
            alert("เกิดข้อผิดพลาดในการบันทึก");
        }
    }
});
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
loadStatusList();
loadProductCategories();

document.getElementById("searchButton").addEventListener("click", searchPreparation);
document.addEventListener("DOMContentLoaded", function () {
    const userRights = localStorage.getItem("user_rights"); // ดึงค่า user_rights
    const filterStatus = document.getElementById("filterStatus"); // หา dropdown สถานะ

    if (filterStatus && userRights === "user") {
        // ✅ จำกัดสิทธิ์เฉพาะ user ให้เลือกได้แค่ "ทั้งหมด"
        filterStatus.innerHTML = `<option value="all" selected>ทั้งหมด</option>`;
        filterStatus.disabled = true;
    }
});

