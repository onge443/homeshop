// ReviseStock.js

document.addEventListener("DOMContentLoaded", () => {
    // ตรวจสอบสิทธิ์ผู้ใช้
    const username = localStorage.getItem("username");
    const branch = localStorage.getItem("branch_code");
    if (username) {
        const userSpan = document.querySelector("#userDropdown span");
        if (userSpan) {
            userSpan.textContent = username;
        }
    } else {
        alert("กรุณาเข้าสู่ระบบก่อนใช้งาน");
        window.location.href = '/';
        return;
    }

    // ติดตั้ง event listener สำหรับปุ่มค้นหา
    const searchButton = document.getElementById("searchButton");
    if (searchButton) {
        searchButton.addEventListener("click", function() {
            const reportType = document.getElementById('reportTypeDropdown').value;
            const DI_REF_input = document.getElementById('filterDI_REF').value.trim();
            const CHECKROUND_input = document.getElementById('filterCHECKROUND').value.trim();
            const DI_REF = DI_REF_input !== "" ? DI_REF_input : null;
            const CHECKROUND = CHECKROUND_input !== "" ? parseInt(CHECKROUND_input, 10) : null;
            
            // แสดงข้อความกำลังโหลดใน container ผลลัพธ์
            const reportContainer = document.getElementById('reportContainer');
            if (reportContainer) {
                reportContainer.innerHTML = "<p>กำลังโหลด...</p>";
            }
            
            // ถ้า reportType เป็น "stock" ให้โหลดข้อมูลจาก stock transactions
            if(reportType === 'stock'){
                loadStockTransactions({ DI_REF, CHECKROUND, branch });
            }
            // ถ้า reportType เป็น "preparationRecords" ให้ดึงข้อมูลจาก API
            else if(reportType === 'preparationRecords'){
                fetch('/api/get-report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reportType: reportType,
                        DI_REF: DI_REF,
                        CHECKROUND: CHECKROUND
                    })
                })
                .then(response => response.json())
                .then(result => {
                    if(result.success && result.data && result.data.length > 0) {
                        renderReportTable(result.data);
                    } else {
                        if(reportContainer) {
                            reportContainer.innerHTML = "<p>ไม่มีข้อมูล</p>";
                        }
                    }
                })
                .catch(err => {
                    console.error(err);
                    if(reportContainer) {
                        reportContainer.innerHTML = "<p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>";
                    }
                });
            }
        });
    }

    // ตรวจสอบสิทธิ์ผู้ใช้ (ซ่อนรายงานหาก user ไม่ใช่ admin)
    CheckRight();

    // Logout event
    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.clear();
            window.location.href = '/';
        });
    }

    const reportContainer = document.getElementById('reportContainer');
    if(reportContainer) {
        reportContainer.addEventListener('click', function(e) {
            if (e.target && e.target.classList.contains('edit-btn')) {
                console.log("Edit button clicked", e.target);
                const row = e.target.closest('tr');
                enableRowEditing(row);
            }
        });
    }
});


// สำหรับ "รายงานจัดเตรียม" – แสดงตารางพร้อมปุ่ม Edit
function renderReportTable(data) {
    let html = `
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>เลขที่เอกสาร</th>
                    <th>ICCAT_CODE</th>
                    <th>ICCAT_NAME</th>
                    <th>PREPARE_QTY</th>
                    <th>PreparedBy</th>
                    <th>Timestamp</th>
                    <th>Status</th>
                    <th>SKU_CODE</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody id="reportTableBody">
    `;
    data.forEach((row, index) => {
        html += `
            <tr data-documentid="${row.DI_REF}" data-id="${row.ID}">
                <td>${row.ID}</td>
                <td>${row.DI_REF}</td>
                <td>${row.ICCAT_CODE}</td>
                <td>${row.ICCAT_NAME}</td>
                <td class="prepareqty-cell">${row.PREPARE_QTY}</td>
                <td>${row.PreparedBy}</td>
                <td>${row.Timestamp}</td>
                <td class="status-cell">${row.Status}</td>
                <td>${row.SKU_CODE}</td>
                <td class="action-cell">
                    <button class="btn btn-success edit-btn">Edit</button>
                </td>
            </tr>
        `;
    });
    html += `
            </tbody>
        </table>
    `;
    document.getElementById('reportContainer').innerHTML = html;
    attachEditListeners();
}

function attachEditListeners() {
    const editButtons = document.querySelectorAll('.edit-btn');
    editButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            enableRowEditing(row);
        });
    });
}

function enableRowEditing(row) {
    const statusCell = row.querySelector('.status-cell');
    const prepareQtyCell = row.querySelector('.prepareqty-cell');
    const actionCell = row.querySelector('.action-cell');

    const originalStatus = statusCell.textContent.trim();
    const originalPrepareQty = prepareQtyCell.textContent.trim();

    statusCell.innerHTML = `<input type="text" value="${originalStatus}" class="edit-status form-control">`;
    prepareQtyCell.innerHTML = `<input type="number" value="${originalPrepareQty}" class="edit-prepareqty form-control">`;

    actionCell.innerHTML = `
        <button class="btn btn-primary save-btn">Save</button>
        <button class="btn btn-secondary cancel-btn">Cancel</button>
    `;

    actionCell.querySelector('.save-btn').addEventListener('click', function() {
        const newStatus = row.querySelector('.edit-status').value;
        const newPrepareQty = row.querySelector('.edit-prepareqty').value;
        const documentID = row.getAttribute('data-documentid');
        const updated_by = localStorage.getItem('username') || "unknown_user";
        updatePreparationRecord(documentID, newStatus, newPrepareQty, updated_by, row);
    });

    actionCell.querySelector('.cancel-btn').addEventListener('click', function() {
        statusCell.textContent = originalStatus;
        prepareQtyCell.textContent = originalPrepareQty;
        actionCell.innerHTML = `<button class="btn btn-success edit-btn">Edit</button>`;
        attachEditListeners();
    });
}

function updatePreparationRecord(documentID, status, prepare_qty, updated_by, row) {
    fetch('/api/update-preparation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            documentID: documentID,
            status: status,
            prepare_qty: prepare_qty,
            updated_by: updated_by
        })
    })
    .then(response => response.json())
    .then(result => {
        if(result.success) {
            alert("Update successful");
            row.querySelector('.status-cell').textContent = status;
            row.querySelector('.prepareqty-cell').textContent = prepare_qty;
            row.querySelector('.action-cell').innerHTML = `<button class="btn btn-success edit-btn">Edit</button>`;
            attachEditListeners();
        } else {
            alert("Update failed: " + result.message);
        }
    })
    .catch(err => {
        console.error(err);
        alert("Error updating record");
    });
}

// ตรวจสอบสิทธิ์ผู้ใช้งาน
async function CheckRight() {
    const rights = localStorage.getItem("user_rights");
    try {
        if (rights == 'user') {
            const reportElement = document.getElementById("Report");
            if(reportElement) {
                reportElement.hidden = true;
            }
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

// ฟังก์ชันสำหรับโหลดข้อมูล "รายงานตรวจจ่าย" (stock report)
// ตัวอย่างนี้เป็นแนวทาง คุณสามารถปรับแต่งตามการตอบกลับจาก API ของคุณ
async function loadStockTransactions(params) {
   
        const searchParams = {
            DI_REF: params.DI_REF,
            CHECKROUND: params.CHECKROUND,
            BRANCH: params.branch
        };

        try {
            const response = await fetch("/api/get-stock-transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(searchParams)
            });
            document.getElementById("reportContainer").innerHTML = 
            `
            <table class="table table-bordered">
                <thead>
                    <tr>
                        <th>ลำดับที่</th>
                        <th>เลขที่เอกสาร</th>
                        <th>รหัสสินค้า</th>
                        <th>ชื่อสินค้า</th>
                        <th>รอบตรวจจ่าย</th>
                        <th>จำนวนที่ขาย</th>
                        <th>จำนวนที่จ่าย</th>
                        <th>จำนวนที่ต้องแก้ไข</th>
                        <th>แก้ไขโดย</th>
                        <th>วันที่แก้ไข</th>
                        <th>Action</th>
                        <th style="display: none;">ID</th>
                    </tr>
                </thead>
                <tbody id="stockTableBody">
                </tbody>
            </table>
        `;

            const { data } = await response.json();
           
            const tableBody = document.getElementById("stockTableBody");
            tableBody.innerHTML = ""; 

            if (!data || data.length === 0) {
                alert("ไม่พบข้อมูล");
                return;
            }


            
            document.querySelectorAll(".cr_qty_input").forEach(input => {
                input.addEventListener("input", function () {
                    let value = parseInt(this.value, 10);
                    let min = parseInt(this.min, 10);
                    let max = parseInt(this.max, 10);
            
                    if (value < min) {
                        this.value = min;
                    } else if (value > max) {
                        this.value = max;
                    }
                });
            });

            
            

            data.forEach((item, index) => {
                const row = document.createElement("tr");
                const remainingQty = item.REMAINING_QTY !== null && item.REMAINING_QTY !== undefined ? item.REMAINING_QTY : 0;
            
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${item.DI_REF}</td>
                    <td>${item.SKU_CODE}</td>
                    <td>${item.SKU_NAME}</td>
                    <td>${item.CHECKROUND}</td>
                    <td>${item.SKU_QTY}</td>
                    <td>${item.CR_QTY}</td>
                    <td>
                        <input type="number" 
                            class="form-control cr_qty_input" 
                            id="cr_qty_input${index + 1}" 
                            value="${item.CR_QTY}" 
                            min="0" 
                            max="${remainingQty}" 
                            disabled>
                    </td>
                    <td>${item.UPDATE_BY || "-"}</td>
                    <td>${item.UPDATE_DATE}</td>
                    <td>
                        <button class="btn btn-warning btn-edit">Edit</button>
                        <button class="btn btn-success btn-save" hidden>Save</button>
                    </td>
                     <td style="display: none;">${item.ID}</td>
                `;
                tableBody.appendChild(row);
        
            

                const editButton = row.querySelector(".btn-edit");
                const saveButton = row.querySelector(".btn-save");
                const inputField = row.querySelector(".cr_qty_input");

                editButton.addEventListener("click", () => {
                    editButton.hidden = true;
                    inputField.disabled = false;
                    saveButton.hidden = false;
                });

                saveButton.addEventListener("click", async () => {
                    const updatedQty = parseInt(inputField.value, 10);
                    const username = localStorage.getItem("username") || "unknown_user";

                    const payload = {
                        ID: item.ID,
                        DI_REF: item.DI_REF,
                        SKU_CODE: item.SKU_CODE,
                        NEW_CR_QTY: updatedQty,
                        Username: username,
                        BranchCode: params.branch
                    };

                    try {
                        const response2 = await fetch("/api/update-stock-transaction", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload)
                        });

                        const result2 = await response2.json();

                        if (result2.success) {
                            alert("อัปเดตข้อมูลสำเร็จ!");
                            inputField.disabled = true;
                            editButton.hidden = false;
                            saveButton.hidden = true;

                            document.getElementById("searchButton").click();
                        } else {
                            alert("เกิดข้อผิดพลาด");
                        }
                    } catch (error) {
                        console.error("Error updating data:", error);
                    }
                });
            });
        } catch (error) {
            console.error("Error fetching data:", error);
        }
}


// ฟังก์ชันสำหรับเปิดโหมดแก้ไขแถว
function enableRowEditing(row) {
    const statusCell = row.querySelector('.status-cell');
    const prepareQtyCell = row.querySelector('.prepareqty-cell');
    const actionCell = row.querySelector('.action-cell');

    const originalStatus = statusCell.textContent.trim();
    const originalPrepareQty = prepareQtyCell.textContent.trim();

    // แทนที่ cell ด้วย input fields ที่ไม่ถูก disabled
    statusCell.innerHTML = `<input type="text" value="${originalStatus}" class="edit-status form-control">`;
    prepareQtyCell.innerHTML = `<input type="number" value="${originalPrepareQty}" class="edit-prepareqty form-control">`;

    // เปลี่ยนปุ่ม Edit เป็น Save และ Cancel
    actionCell.innerHTML = `
        <button class="btn btn-primary save-btn">Save</button>
        <button class="btn btn-secondary cancel-btn">Cancel</button>
    `;

    // ผูก event ให้กับปุ่ม Save
    actionCell.querySelector('.save-btn').addEventListener('click', function() {
        const newStatus = row.querySelector('.edit-status').value;
        const newPrepareQty = row.querySelector('.edit-prepareqty').value;
        const documentID = row.getAttribute('data-documentid');
        const updated_by = localStorage.getItem('username') || "unknown_user";
        updatePreparationRecord(documentID, newStatus, newPrepareQty, updated_by, row);
    });

    // ผูก event ให้กับปุ่ม Cancel
    actionCell.querySelector('.cancel-btn').addEventListener('click', function() {
        // คืนค่าเดิมกลับไป
        statusCell.textContent = originalStatus;
        prepareQtyCell.textContent = originalPrepareQty;
        actionCell.innerHTML = `<button class="btn btn-success edit-btn">Edit</button>`;
    });
}

