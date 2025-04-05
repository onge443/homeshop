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
    const exportButton = document.getElementById("exportChartData");
    if (exportButton) {
        exportButton.addEventListener("click", exportToExcel);
    }

    // ติดตั้ง event listener สำหรับปุ่มค้นหา
    const searchButton = document.getElementById("searchButton");
    if (searchButton) {
        searchButton.addEventListener("click", function() {
            const reportType = document.getElementById('reportTypeDropdown').value;
            const DI_REF_input = document.getElementById('filterDI_REF').value.trim();
            const CHECKROUND_input = document.getElementById('filterCHECKROUND').value.trim();
            // ดึงค่าจาก Filter อื่นๆ เพิ่มเติม
            const startDate = document.getElementById("filterStartDate").value;
            const endDate = document.getElementById("filterEndDate").value;
            const customerName = document.getElementById("filterCustomerName").value.trim();
            const DI_REF = DI_REF_input !== "" ? DI_REF_input : null;
            const CHECKROUND = CHECKROUND_input !== "" ? parseInt(CHECKROUND_input, 10) : null;

            // แสดงข้อความกำลังโหลดใน container ผลลัพธ์
            const reportContainer = document.getElementById('reportContainer');
            if (reportContainer) {
                reportContainer.innerHTML = "<p>กำลังโหลด...</p>";
            }

            // ถ้า reportType เป็น "stock" ให้โหลดข้อมูลจาก stock transactions
            if(reportType === 'stock'){
                loadStockTransactions({ DI_REF, CHECKROUND, branch, startDate,
                    endDate,
                    customerName });
            }
            // ถ้า reportType เป็น "preparationRecords" ให้ดึงข้อมูลจาก API
            else if(reportType === 'preparationRecords'){
                fetch('/api/get-report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reportType: reportType,
                        DI_REF: DI_REF,
                        CHECKROUND: CHECKROUND,
                        startDate: document.getElementById("filterStartDate").value,
                        endDate: document.getElementById("filterEndDate").value,
                        customerName: document.getElementById("filterCustomerName").value,
                        showRound: true // ✅ เพิ่ม showRound สำหรับรายงานจัดเตรียม
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
            // ถ้า reportType เป็น "stocksummary" ให้ดึงข้อมูลจาก API
            else if(reportType === 'stocksummary'){
                fetch('/api/get-report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reportType: reportType,
                        DI_REF: DI_REF,
                        CHECKROUND: CHECKROUND,
                        startDate: document.getElementById("filterStartDate").value,
                        endDate: document.getElementById("filterEndDate").value,
                        customerName: document.getElementById("filterCustomerName").value,
                        showRound: true // ✅ เพิ่ม showRound สำหรับรายงานคงค้าง
                    })
                })
                
                .then(response => response.json())
                .then(result => {
                    if(result.success && result.data && result.data.length > 0) {
                        renderStockSummaryTable(result.data);
                    } else {
                        if(reportContainer) {
                            reportContainer.innerHTML = "<p>ไม่มีข้อมูล</p>";
                        }
                    }
                    
                })
            }
                else if(reportType === 'all_stock_summary') { // <<< แยกเงื่อนไขออกมา
                    if (!startDate || !endDate || startDate.trim() === '' || endDate.trim() === '') {
                        alert("สำหรับรายงานทั้งหมด กรุณาเลือกช่วงวันที่เริ่มต้นและสิ้นสุด");
                        if (reportContainer) {
                            reportContainer.innerHTML = "<p>กรุณาเลือกช่วงวันที่</p>";
                        }
                        return; // <<< สำคัญ: หยุดการทำงานต่อ ไม่ต้อง fetch
                    }
                    const reportParams = {
                        reportType: 'all_stock_summary',
                        DI_REF: DI_REF,
                        startDate: startDate, // ใช้ค่าที่อ่านมาแล้ว
                        endDate: endDate,   // ใช้ค่าที่อ่านมาแล้ว
                        customerName: customerName || null,
                        branch: branch     // ใช้ค่าที่อ่านมาแล้ว
                    };
                    fetch('/api/get-report', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(reportParams)
                    })
                    
                    .then(response => response.json())
                    .then(result => {
                     if(result.success && result.data && result.data.length > 0) {
                         renderAllStockSummaryReportTable(result.data); // เรียกใช้ Render ใหม่
                     } else {
                         if(reportContainer) {
                             reportContainer.innerHTML = "<p>ไม่มีข้อมูลตามเงื่อนไขที่เลือก</p>";
                         }
                         if (!result.success) { console.warn("API Error:", result.message); }
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
// --- ส่วนที่เพิ่มเข้ามา ---
const reportTypeDropdown = document.getElementById('reportTypeDropdown');

// 1. ตั้งค่าเริ่มต้นเมื่อโหลดหน้าเสร็จ
if (reportTypeDropdown) {
    const initialReportType = reportTypeDropdown.value;
    toggleCustomerFilter(initialReportType); // เรียกใช้ฟังก์ชันเพื่อตั้งค่า disable/enable เริ่มต้น
}

// 2. เพิ่ม Event Listener ให้กับ Dropdown
if (reportTypeDropdown) {
    reportTypeDropdown.addEventListener('change', function(event) {
        const selectedType = event.target.value; // หรือ this.value
        toggleCustomerFilter(selectedType); // เรียกใช้ฟังก์ชันเมื่อมีการเปลี่ยนแปลง
    });
}
// --- จบส่วนที่เพิ่มเข้ามา ---
// Object สำหรับ map ค่า status ID เป็นข้อความภาษาไทย
const statusMapping = {
    1: "รอจัด",
    2: "กำลังจัด",
    3: "จัดบางส่วน",
    4: "จัดเสร็จ",
    5: "จ่ายบางส่วน",
    6: "จ่ายทั้งหมด"
    // เพิ่มสถานะอื่นๆ ถ้ามี
};
// --- เพิ่มฟังก์ชันสำหรับ เปิด/ปิด การใช้งานช่องกรอกชื่อลูกค้า ---
function toggleCustomerFilter(selectedReportType) {
    const customerInput = document.getElementById('filterCustomerName');
    if (customerInput) { // ตรวจสอบว่า element มีอยู่จริง
        if (selectedReportType === 'stock') { // <-- ตรวจสอบว่าเป็นรายงานตรวจจ่ายหรือไม่
            customerInput.disabled = true;
            customerInput.value = ''; // ล้างค่าในช่องเมื่อถูก disable (ทางเลือก)
            // อาจจะเพิ่ม style ให้ดูจางลง (ทางเลือก)
            // customerInput.style.backgroundColor = '#e9ecef';
        } else {
            customerInput.disabled = false;
            // คืน style เดิม (ทางเลือก)
            // customerInput.style.backgroundColor = '';
        }
    }
}
// --- จบฟังก์ชัน ---
// สำหรับ "รายงานจัดเตรียม" และ "รายงานคงค้าง" – แสดงตารางพร้อมปุ่ม Edit
function renderReportTable(data) {
    let html = `
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>เลขที่เอกสาร</th>
                    <th>วันที่เอกสาร</th>
                    <th>ICCAT_CODE</th>
                    <th>ICCAT_NAME</th>
                    <th>PREPARE_QTY</th>
                    <th>PreparedBy</th>                   
                    <th>Status</th>
                    <th>SKU_CODE</th>
                    <th>รอบ</th> 
                    <th>Action</th>
                </tr>
            </thead>
            <tbody id="reportTableBody">
    `;
    data.forEach((row, index) => {
         // --- ส่วนนี้คือการนำค่า status ไปหาใน mapping ---
         const statusText = statusMapping[row.Status] || (row.Status !== null ? row.Status : '-');
         // statusMapping[row.STATUS] -> ค้นหาข้อความไทย
         // || (...) -> ถ้าหาไม่เจอ หรือ row.STATUS เป็น null/undefined ให้แสดงค่าเดิม หรือ '-'
        html += `
            <tr data-documentid="${row.DI_REF}" data-id="${row.ID}" data-sku-code="${row.SKU_CODE}" data-status="${row.Status}">
                <td>${row.ID}</td>
                <td>${row.DI_REF}</td>
                <td>${row.DI_DATE ? new Date(row.DI_DATE).toLocaleString('th-TH') : '-'}</td>
                <td>${row.ICCAT_CODE}</td>
                <td>${row.ICCAT_NAME}</td>
                <td class="prepareqty-cell">${row.PREPARE_QTY}</td>
                <td>${row.PreparedBy}</td>
                <td class="status-cell">${statusText}</td>
                <td>${row.SKU_CODE}</td>
                <td>${row.Round}</td> <td class="action-cell">
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
            enableRowEditing1(row);
        });
    });
}
function renderStockSummaryTable(data) {
    // กำหนด Header ของตาราง
    let html = `
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>เลขที่เอกสาร</th>
                    <th>วันที่เอกสาร</th>
                    <th>ชื่อลูกค้า</th>
                    <th>รหัสสินค้า</th>
                    <th>ชื่อสินค้า</th>
                    <th>หมวดหมู่สินค้า</th> 
                    <th>จำนวนขาย</th>     
                    <th>จำนวนรับ</th>     
                    <th>จำนวนค้าง</th>    
                    <th>จำนวนจัดล่าสุด</th>
                    <th>สถานะ</th>
                    </tr>
            </thead>
            <tbody id="reportTableBody">
    `;

    data.forEach((row, index) => {
            // --- ส่วนนี้คือการนำค่า status ไปหาใน mapping ---
            const statusText = statusMapping[row.STATUS] || (row.STATUS !== null ? row.STATUS : '-');
            // statusMapping[row.STATUS] -> ค้นหาข้อความไทย
            // || (...) -> ถ้าหาไม่เจอ หรือ row.STATUS เป็น null/undefined ให้แสดงค่าเดิม หรือ '-'
        
        // *** ใช้ชื่อ property ให้ตรงกับข้อมูลที่ API ส่งมา (หลัง AS) ***
        html += `
            <tr data-documentid="${row.DI_REF}" data-sku-code="${row.SKU_CODE}">
                <td>${row.DI_REF || '-'}</td>
                <td>${row.DI_DATE ? new Date(row.DI_DATE).toLocaleDateString('th-TH') : '-'}</td>
                <td>${row.AR_NAME || '-'}</td>
                <td>${row.SKU_CODE || '-'}</td>
                <td>${row.SKU_NAME || '-'}</td>
                <td>${row.ProductCategoryName || '-'}</td> 
                <td>${row.SoldQty !== null ? row.SoldQty : '-'}</td> 
                <td>${row.ReceivedQty !== null ? row.ReceivedQty : '-'}</td> 
                <td>${row.PendingQty !== null ? row.PendingQty : '-'}</td> 
                <td>${row.LATEST_PREPARE_QTY !== null ? row.LATEST_PREPARE_QTY : '-'}</td>
                <td>${statusText !== null ? statusText : '-'}</td>
               </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;
    document.getElementById('reportContainer').innerHTML = html;
//     attachStockSummaryEditListeners();
//     // attachStockSummaryEditListeners(); // (ถ้าต้องการ Edit)
//     function attachStockSummaryEditListeners() {
//         const editButtons = document.querySelectorAll('.edit-btn');
//         editButtons.forEach(btn => {
//             btn.addEventListener('click', function() {
//                 const row = this.closest('tr');
//                 enableRowEditing1(row);
//             });
//         });
}
// --- ฟังก์ชันใหม่สำหรับ Render "รายงานทั้งหมด" (ข้อมูลจาก Stock_Summary) ---
function renderAllStockSummaryReportTable(data) {
    // กำหนด Header ของตาราง - *** ปรับแก้ตามคอลัมน์ที่คุณต้องการแสดง ***
    const headers = [
        "ID", "เลขที่เอกสาร", "วันที่เอกสาร", "ชื่อลูกค้า", "รหัสสินค้า", "ชื่อสินค้า",
        "หมวดหมู่สินค้า", "จำนวนขาย", "จำนวนรับ", "จำนวนคงเหลือ", "จำนวนจัดล่าสุด",
        "สถานะ", "เวลาอัปเดต", "ผู้อัปเดต"
        // เพิ่ม Header อื่นๆ ตรงนี้
    ];

    let html = `
        <table class="table table-bordered">
            <thead>
                <tr>
                    ${headers.map(header => `<th>${header}</th>`).join('')}
                </tr>
            </thead>
            <tbody id="reportTableBody">
    `;

    if (!data || data.length === 0) {
        // แสดงข้อความเมื่อไม่มีข้อมูล
        html += `<tr><td colspan="${headers.length}" class="text-center">ไม่มีข้อมูล</td></tr>`;
    } else {
        data.forEach((row, index) => {
            // แปลงค่า Status เป็นข้อความ
            const statusText = statusMapping[row.STATUS] || (row.STATUS !== null ? row.STATUS : '-');

            // Format วันที่ - *** ใช้ชื่อ Property ที่ Backend ส่งมาให้ถูกต้อง ***
            // สมมติ Backend ส่ง Date มาเป็น ISO String หรือ Date Object และตั้ง Alias ไว้
            const displayDate = row.DI_DATE_STR || (row.DI_DATE ? new Date(row.DI_DATE).toLocaleDateString('th-TH') : '-');
            const displayUpdateDate = row.UPDATE_DATE_STR || (row.UPDATE_DATE ? new Date(row.UPDATE_DATE).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-');

            html += `
                <tr>
                    
                    <td>${row.ID ?? '-'}</td>
                    <td>${row.DI_REF ?? '-'}</td>
                    <td>${displayDate}</td>
                    <td>${row.AR_NAME ?? '-'}</td>
                    <td>${row.SKU_CODE ?? '-'}</td>
                    <td>${row.SKU_NAME ?? '-'}</td>
                    <td>${row.ICCAT_NAME ?? '-'} (${row.ICCAT_CODE ?? '-'})</td> 
                    <td>${row.TOTAL_SKU_QTY ?? '-'}</td>
                    <td>${row.TOTAL_CR_QTY ?? '-'}</td>
                    <td>${row.REMAINING_QTY ?? '-'}</td>
                    <td>${row.LATEST_PREPARE_QTY ?? '-'}</td>
                    <td>${statusText}</td>
                    <td>${displayUpdateDate}</td>
                    <td>${row.UPDATE_BY ?? '-'}</td>
                    
                </tr>
            `;
        });
    }

    html += `
            </tbody>
        </table>
        
    `;

    // แสดงผลใน reportContainer
    const reportContainer = document.getElementById('reportContainer');
    if (reportContainer) {
        reportContainer.innerHTML = html;
    }
    // รายงานนี้อาจจะไม่ต้องมีปุ่ม Edit ? ถ้าต้องการให้มี ก็เรียก attachEditListeners(); หลังบรรทัดนี้
    // attachEditListeners();
}

function enableRowEditing1(row) {
    const statusCell = row.querySelector('.status-cell');
    const prepareQtyCell = row.querySelector('.prepareqty-cell');
    const actionCell = row.querySelector('.action-cell');

    const originalstatusText = statusCell.textContent.trim();
    const originalStatusId = row.getAttribute('data-status-id');
    const originalPrepareQty = prepareQtyCell.textContent.trim();
    let selectHtml = `<select class="edit-status form-control">`; // ใช้ class เดิม 'edit-status'
    // วน loop สร้าง options จาก statusMapping
    for (const [id, text] of Object.entries(statusMapping)) {
        // ตรวจสอบว่า option นี้คือค่าเดิมหรือไม่ เพื่อใส่ 'selected'
        const selected = (id === originalStatusId) ? 'selected' : '';
        selectHtml += `<option value="${id}" ${selected}>${text}</option>`;
    }
    selectHtml += `</select>`;
    // แทนที่เนื้อหาใน statusCell ด้วย Dropdown ที่สร้างขึ้น
    statusCell.innerHTML = selectHtml;
    // statusCell.innerHTML = `<input type="text" value="${originalStatus}" class="edit-status form-control">`;
    prepareQtyCell.innerHTML = `<input type="number" value="${originalPrepareQty}" class="edit-prepareqty form-control">`;

    actionCell.innerHTML = `
        <button class="btn btn-primary save-btn">Save</button>
        <button class="btn btn-secondary cancel-btn">Cancel</button>
    `;

    actionCell.querySelector('.save-btn').addEventListener('click', function() {
        // ดึงค่า VALUE ที่ถูกเลือกจาก dropdown (ซึ่งก็คือ Status ID)
        // const newStatus = row.querySelector('.edit-status').value;
        const newStatusId = row.querySelector('.edit-status').value;
        const newPrepareQty = row.querySelector('.edit-prepareqty').value;
        const documentID = row.getAttribute('data-documentid');
        const id = row.getAttribute('data-id'); // ดึงค่า ID จาก data-id
        const updated_by = localStorage.getItem('username') || "unknown_user";
        updatePreparationRecord(documentID, newStatusId, newPrepareQty, updated_by, id, row); // ส่ง id ไปยังฟังก์ชัน
    });

    actionCell.querySelector('.cancel-btn').addEventListener('click', function() {
        // คืนค่า "ข้อความ" สถานะเดิมกลับไป
        statusCell.textContent = originalstatusText; // ใช้ Text เดิมที่เก็บไว้
        prepareQtyCell.textContent = originalPrepareQty;
        actionCell.innerHTML = `<button class="btn btn-success edit-btn">Edit</button>`;
        attachEditListeners();
    });
}

function updatePreparationRecord(documentID, status, prepare_qty, updated_by, id, row) { // รับ parameter id เพิ่ม
    const skuCode = row.getAttribute('data-sku-code'); // ดึงค่า SKU_CODE จาก data attribute
    fetch('/api/update-preparation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            documentID: documentID,
            status: status,
            prepare_qty: prepare_qty,
            updated_by: updated_by,
            id: id, // ส่ง id ใน body
            SKU_CODE: skuCode // ส่ง SKU_CODE ไปด้วย
        })
    })
    .then(response => response.json())
    .then(result => {
        if(result.success) {
            alert("Update successful");
            // --- ส่วนที่แก้ไข ---
            // แปลง Status ID กลับเป็น Text ก่อนแสดงผล
            const statusTextToDisplay = statusMapping[status] || status; // ค้นหาใน mapping, ถ้าไม่เจอให้แสดง ID เดิม
            row.querySelector('.status-cell').textContent = statusTextToDisplay; // แสดง Text ที่แปลงแล้ว
            // --- จบส่วนแก้ไข ---
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
    // params ตอนนี้จะมี startDate, endDate, customerName เพิ่มเข้ามาด้วย

    // สร้าง object ที่จะส่งไปใน body ของ request
        const searchParams = {
            DI_REF: params.DI_REF,
            CHECKROUND: params.CHECKROUND,
            BRANCH: params.branch,
            startDate: params.startDate || null, // ส่งเป็น null ถ้าไม่มีค่า
            endDate: params.endDate || null,     // ส่งเป็น null ถ้าไม่มีค่า
            customerName: params.customerName || null // ส่งเป็น null ถ้าไม่มีค่า
        };

        try {
            const response = await fetch("/api/get-stock-transactions", {// ยิงไป API เดิม
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
                        
                    </tr>
                </thead>
                <tbody id="stockTableBody">
                </tbody>
            </table>
        `;

            // const { data } = await response.json();

            // const tableBody = document.getElementById("stockTableBody");
            // tableBody.innerHTML = "";

            // if (!data || data.length === 0) {
            //     alert("ไม่พบข้อมูล");
            //     return;
            // }
            const result = await response.json(); // แก้ไข: รับค่า response เป็น result

            // ***** แก้ไข: ตรวจสอบ success และ data จาก result *****
            if (!result.success || !result.data || result.data.length === 0) {
                const reportContainer = document.getElementById('reportContainer');
                if(reportContainer){
                    // แสดงข้อความ "ไม่มีข้อมูล" กลางตาราง หรือใช้ alert
                    reportContainer.innerHTML = "<p>ไม่มีข้อมูลที่ตรงตามเงื่อนไข</p>";
                } else {
                    alert("ไม่พบข้อมูล");
                }
                return;
            }

            const data = result.data; // ใช้ data จาก result.data
            const tableBody = document.getElementById("stockTableBody");
            tableBody.innerHTML = ""; // เคลียร์ tbody ก่อนเพิ่มข้อมูลใหม่
    


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
// ฟังก์ชันสำหรับ Export ข้อมูลตารางเป็น Excel
function exportToExcel() {
    const reportContainer = document.getElementById('reportContainer');
    const table = reportContainer.querySelector('table');

    if (!table) {
        alert('ไม่พบตารางข้อมูลสำหรับ Export');
        return;
    }

    const ws = XLSX.utils.table_to_sheet(table);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Charts');

    /* generate XLSX file and send to client */
    XLSX.writeFile(wb, 'Charts.xlsx');
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
        const id = row.getAttribute('data-id'); // ดึงค่า ID จาก data-id
        const updated_by = localStorage.getItem('username') || "unknown_user";
        updatePreparationRecord(documentID, newStatus, newPrepareQty, updated_by, id, row); // ส่ง id ไปยังฟังก์ชัน
    });

    // ผูก event ให้กับปุ่ม Cancel
    actionCell.querySelector('.cancel-btn').addEventListener('click', function() {
        // คืนค่าเดิมกลับไป
        statusCell.textContent = originalStatus;
        prepareQtyCell.textContent = originalPrepareQty;
        actionCell.innerHTML = `<button class="btn btn-success edit-btn">Edit</button>`;
    });
}