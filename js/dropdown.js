async function searchPreparation() {
    const username = localStorage.getItem("username");
    const branch = localStorage.getItem("branch_code");

    if (!username) {
        alert("กรุณาเข้าสู่ระบบก่อนใช้งาน");
        window.location.href = '/';
        return;
    }

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
                    return `<input type='number' class='form-control prepare-input' value='${data || ''}' data-doc='${row.DocumentID}' data-prod='${row.SKU_CODE}' max ='${row.PendingQty}' min='0' >`;
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
    const categoryDropdown = document.getElementById('filterCategory');

    try {
        const response = await fetch('/api/product-categories');
        if (!response.ok) throw new Error("Failed to fetch product categories");

        const { success, data } = await response.json();
        if (!success) throw new Error("API returned failure response");

        categoryDropdown.innerHTML = '<option value="all">ทั้งหมด</option>'; // ✅ เพิ่มค่า "ทั้งหมด"
        
        data.forEach(category => {
            const option = document.createElement("option");
            option.value = category.ICCAT_CODE; // ✅ ใช้ ICCAT_CODE แทน ICCAT_KEY
            option.textContent = `${category.ICCAT_CODE} - ${category.ICCAT_NAME}`;
            categoryDropdown.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading product categories:", error);
    }
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

        statusDropdown.value = "รอการจัดเตรียม";
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
        const branch = localStorage.getItem("branch");

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
            } else {
                alert("เกิดข้อผิดพลาดในการบันทึก");
            }
        } catch (error) {
            console.error("Error saving data:", error);
            alert("เกิดข้อผิดพลาดในการบันทึก");
        }
    }
});

// ✅ โหลดข้อมูลเมื่อเปิดหน้าเว็บ
loadStatusList();
loadProductCategories();
document.getElementById("searchButton").addEventListener("click", searchPreparation);
