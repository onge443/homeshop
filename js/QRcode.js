document.addEventListener("DOMContentLoaded", function () {
// Create Html5Qrcode instance
const html5QrCode = new Html5Qrcode("reader");
            
// Function when QR Code scan is successful
async function onScanSuccess(decodedText) {
    // console.log("Decoded Text:", decodedText); // Debug
    try {

        // ส่งข้อมูลไปยัง API `/search1` เพื่อ Query ข้อมูลและอัปเดตตาราง
        const searchResponse = await fetch('/search1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference: decodedText })
        });

        if (!searchResponse.ok) {
            throw new Error(`HTTP error during search! status: ${searchResponse.status}`);
        }

        const searchResult = await searchResponse.json();
        updateTable(searchResult);
        document.getElementById('reader').style.display = 'none';

    } catch (err) {
        console.error("Error during scan process:", err);
        document.getElementById('reader').style.display = 'none';
        alert("An error occurred. Please try again.");
    }
}
// Function when QR Code scan fails
function onScanFailure(error) {
    console.warn("Scan Error:", error);
}

// Start scanning from camera
Html5Qrcode.getCameras().then(cameras => {
    if (cameras && cameras.length) {
        html5QrCode.start(
            { facingMode: "environment" },  // ใช้กล้องหลัง
            {
                fps: 10,                    // กำหนดค่า fps (frame rate)
                qrbox: 250,
                focusMode: "continuous",               // ขนาดของพื้นที่สแกน
                formatsToSupport: [          // กำหนดให้รองรับหลายฟอร์แมต
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.DATA_MATRIX,
                    Html5QrcodeSupportedFormats.AZTEC,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.UPC_A
                ]
                
            },
            onScanSuccess,
            onScanFailure
        );
    } else {
        // console.log("No camera found.");
       document.getElementById('reader').style.display = 'none';
    }
}).catch(err => {
    // console.log("Camera error:", err);
   document.getElementById('reader').style.display = 'none';
});

// Scan QR Code from uploaded image file
document.getElementById("fileInput").addEventListener("change", async function (event) {
    const file = event.target.files[0];
    if (!file) {
        alert("No file selected.");
        return;
    }

    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
        alert("Please upload a valid image file (.jpg, .png).");
            return;
    }
        try {
          
            const decodedText = await html5QrCode.scanFile(file, true);
            // alert("Decode."+`${decodedText}`);
            const response = await fetch('/search1', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reference: decodedText })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                updateTable(result);
                
        } catch (err) {
            console.error("Error scanning file:", err);
            
            alert("Failed to decode QR Code. Please try again.");
        }
   
});

document.getElementById('searchForm1').addEventListener('submit', async (event) => {
    event.preventDefault();
    //const ref = document.getElementById('reference').value; // reference
    const dataarray = {
        reference: document.getElementById('reference').value, // reference
        branch: localStorage.getItem("branch_code")
    };
    const response = await fetch('/searchCheckQTY', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataarray)
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    updateTable(result);
    
    });

    document.getElementById("insertStockButton").addEventListener("click", function() {
        // แสดง Modal เมื่อผู้ใช้คลิกปุ่ม "ยืนยัน"
        $('#confirmInsertModal').modal('show');
        // $('#confirmInsertModal').modal('dispose');
    });

    document.getElementById("confirmToInsert").addEventListener("click", async function () {
        
        $('#confirmInsertModal').modal('hide'); // ปิด Modal
        $('.modal-backdrop').remove(); // ลบ backdrop ด้วยตัวเอง
        $('body').removeClass('modal-open');
        // var myModal = bootstrap.Modal.getInstance(document.getElementById('confirmInsertModal'));
        // myModal.hide();

        const table = document.getElementById("resultTable");
        const RefNo =document.getElementById("DI_Ref").value;
        const RefDate =document.getElementById("DI_Date").value;
        const Round = document.getElementById("DI_Round").value;
        const rows = table.querySelectorAll("tbody tr");
        const data = [];

        // ดึงข้อมูลจากแต่ละแถวในตาราง
        rows.forEach((row, index) => {
            const cells = row.querySelectorAll("td");
            const checkQTYInput = row.querySelector(`#CheckQTY${index + 1}`);
            const subtotalInput = row.querySelector(`#Subtotal${index + 1}`);
            const identInput = row.querySelector(`#ident${index + 1}`);
            let location =  cells[3].textContent.trim();
            const prepareQTY = cells[6].textContent.trim();
            let  status ="ตรวจจ่ายเรียบร้อย";
            let lastestppqty = null;
            if(parseInt(checkQTYInput.value, 10) > 0 ){
                if(location == "สโตร์/คลัง"){
                    status = "รอการจัดเตรียม";
                    if(parseInt(subtotalInput.value, 10)>0){
                        // status = "รอการจัดเตรียม";
                        lastestppqty = 0;
                    }else{
                        status ="ตรวจจ่ายเรียบร้อย";
                        //status ="รับของครบเรียบร้อย";
                    }
                }else if(location == "คลังสินค้า"){
                    if((parseInt(prepareQTY,10) != 0 && !isNaN(prepareQTY)) && (parseInt(checkQTYInput.value, 10) < parseInt(prepareQTY,10))) {
                        status = "รอการจัดเตรียม";
                        c
                    }else if ((parseInt(prepareQTY,10) != 0 && !isNaN(prepareQTY)) && parseInt(checkQTYInput.value, 10) == parseInt(prepareQTY,10) && parseInt(subtotalInput.value, 10) > 0){
                        status = "รอการจัดเตรียม";
                       
                    }else if((parseInt(prepareQTY,10) != 0 &&  !isNaN(prepareQTY)) && parseInt(checkQTYInput.value, 10) == parseInt(prepareQTY,10) && parseInt(subtotalInput.value, 10) == 0){
                        status = "ตรวจจ่ายเรียบร้อย";
                        
                    }
                    else if((parseInt(prepareQTY,10) != 0 &&  !isNaN(prepareQTY)) && parseInt(checkQTYInput.value, 10) == parseInt(prepareQTY,10) && parseInt(subtotalInput.value, 10) == 0){
                        status = "รอการจัดเตรียม";
                        
                    }
                   

                }
            }else{
                if(location == "คลังสินค้า" && parseInt(prepareQTY,10) == 0 || isNaN(prepareQTY)){
                    status = "รอการจัดเตรียม";
                }
            }
            data.push({
                ID:  parseInt(identInput.value, 10) || 0,  // update เข้า stock summary
                RefNo: RefNo, // update เข้า stock 
                RefDate: RefDate, // update เข้า stock 
                Round: Round,  // update เข้า stock และ stock summary
                ProductCode: cells[1].textContent.trim(), // update เข้า stock 
                ProductName: cells[2].textContent.trim(), // update เข้า stock 
                Location: cells[3].textContent.trim(),
                QuantitySold: parseInt(cells[4].textContent.trim(), 10), // update เข้า stock 
                TotalCR: parseInt(cells[5].textContent.trim(), 10), // update เข้า stock summary
                CheckQTY: parseInt(checkQTYInput.value, 10) || 0, // update เข้า stock 
                RemainQTY: parseInt(subtotalInput.value, 10) || 0, // update เข้า stock summary
                LatestPPQTY: lastestppqty, // update เข้า stock summary
                CreateBy: localStorage.getItem('username'),// update เข้า stock และ stock summary
                Status: status, // update เข้า stock summary
                CATKEY:  parseInt(cells[11].textContent.trim(), 10) || 0,
                CATCODE:  cells[12].textContent.trim(),
                CATNAME:  cells[13].textContent.trim(),
                BRANCHCODE: localStorage.getItem('branch_code')
            });
            location="";
        });

        // console.log("Data to Update:", data); // Debug ดูข้อมูลที่ดึงมา

        // ส่งข้อมูลไปยัง Backend
        try {
            const batchSize = 50; // ✅ กำหนดจำนวน batch ที่ส่งต่อครั้ง
            const batches = [];
            
            for (let i = 0; i < data.length; i += batchSize) {
                batches.push(data.slice(i, i + batchSize));
            }
        
            // ✅ ใช้ Promise.all() เพื่อส่งหลาย batch พร้อมกัน
            const responses = await Promise.all(batches.map(async batch => {
                try {
                    const response = await fetch('/insert-stock-data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ data: batch })
                    });
        
                    if (!response.ok) {
                        throw new Error(`Server error: ${response.status}`);
                    }
        
                    return await response.json();
                } catch (err) {
                    console.error("Error inserting batch:", err);
                    return { success: false, message: "Batch insert failed" };
                }
            }));
        
            // ✅ ตรวจสอบว่ามี batch ไหนล้มเหลวบ้าง
            const failedBatches = responses.filter(result => !result.success);
            
            if (failedBatches.length === 0) {
                document.getElementById("insertStockButton").hidden = true;
                document.getElementById("printButton").disabled = false;
                document.getElementById("printButton").hidden = false;
                tabledisable();
                alert("✅ Data inserted successfully!");
            } else {
                alert(`⚠️ Some batches failed: ${failedBatches.length} batches`);
            }
        } catch (err) {
            console.error("❌ Error inserting data:", err);
            alert("❌ Failed to insert data. Please try again.");
        }
        

        
    });

    function tabledisable() {
        const table = document.getElementById("resultTable");
        const rows = table.querySelectorAll("tbody tr");

        // ดึงข้อมูลจากแต่ละแถวในตาราง
        rows.forEach((row, index) => {
            // ดึง element จาก id โดยไม่ใช้ # 
            const checkQTY = document.getElementById(`CheckQTY${index + 1}`);
            const subtotal = document.getElementById(`Subtotal${index + 1}`);
            const receiveAll = document.getElementById(`ReceiveAll${index + 1}`);

            // ตรวจสอบว่า element มีอยู่ก่อนที่จะใช้ setAttribute
            if (checkQTY) {
                checkQTY.setAttribute("disabled", true);
            }
            if (subtotal) {
                subtotal.setAttribute("disabled", true);
            }
            if (receiveAll) {
                receiveAll.setAttribute("disabled", true);
            }
        });
    }

    function showAlert(text) {
        // สร้าง div สำหรับ Alert
        const alertDiv = document.createElement('div');
        alertDiv.classList.add('alert', 'alert-success', 'd-flex', 'align-items-center');
        alertDiv.setAttribute('role', 'alert');

        // สร้าง svg ไอคอน
        const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgIcon.classList.add('bi', 'flex-shrink-0', 'me-2');
        svgIcon.setAttribute('width', '24');
        svgIcon.setAttribute('height', '24');
        svgIcon.setAttribute('role', 'img');
        svgIcon.setAttribute('aria-label', 'Success:');
        const useElement = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        useElement.setAttribute('xlink:href', '#check-circle-fill');
        svgIcon.appendChild(useElement);

        // สร้างข้อความใน Alert
        const alertText = document.createElement('div');
        alertText.textContent = text;

        // เพิ่มไอคอนและข้อความเข้าไปใน alertDiv
        alertDiv.appendChild(svgIcon);
        alertDiv.appendChild(alertText);

        // เพิ่ม alert ลงใน body หรือส่วนที่ต้องการ
        document.body.appendChild(alertDiv);

        // ปิด alert หลังจาก 5 วินาที
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }                               

    document.getElementById("printButton").addEventListener("click", function () {
        console.log("✅ Print button clicked!"); // ✅ Debugging
    
        const printContainer = document.getElementById("printContainer");
        const printFrame = document.getElementById("printFrame");
    
        // ✅ ดึงค่าจากฟอร์ม
        const DI_REF = document.getElementById("DI_Ref").value;
        const DI_Round = document.getElementById("DI_Round").value;
        const DI_Date = document.getElementById("DI_Date").value;
        const CreateBy = localStorage.getItem("username") || "unknown_user";
    
        let Ref = `
            <div class="col">เลขที่เอกสาร: ${DI_REF}</div>
            <div class="col">รอบตรวจจ่าย: ${DI_Round}</div>
            <div class="col">วันที่ออกบิล: ${DI_Date}</div>`;
    
        // ✅ ดึงข้อมูลจากตาราง
        const table = document.getElementById("resultTable");
        const rows = table.querySelectorAll("tbody tr");
        let updatedTableHtml = `
            <table border="1" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th>ลำดับ</th>
                        <th>รหัสสินค้า</th>
                        <th>ชื่อสินค้า</th>
                        <th>จำนวนขาย</th>
                        <th>จำนวนตรวจจ่าย</th>
                        <th>จำนวนคงเหลือ</th>
                    </tr>
                </thead>
                <tbody>`;
    
        rows.forEach((row, index) => {
            const cells = row.querySelectorAll("td");
            const inputCQ = row.querySelector(`#CheckQTY${index + 1}`);  
            const checkQTY = inputCQ ? inputCQ.value : "0";
    
            const inputTotal = row.querySelector(`#Subtotal${index + 1}`);  
            const TotalQTY = inputTotal ? inputTotal.value : "0";
    
            updatedTableHtml += `
                <tr>
                    <td>${cells[0].textContent}</td>
                    <td>${cells[1].textContent}</td>
                    <td>${cells[2].textContent}</td>
                    <td>${cells[4].textContent}</td>
                    <td>${checkQTY}</td>
                    <td>${TotalQTY}</td>
                </tr>`;
        });
    
        updatedTableHtml += `</tbody></table>`;
    
        // ✅ สร้าง QR Code
        const qrDiv = document.createElement("div");
        qrDiv.style.textAlign = "center";
        new QRCode(qrDiv, {
            text: DI_REF,
            width: 100,
            height: 100,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    
        setTimeout(() => {
            const qrCanvas = qrDiv.querySelector("canvas");
            if (!qrCanvas) {
                console.error("❌ QR Code not generated.");
                return;
            }
            const qrImageBase64 = qrCanvas.toDataURL("image/png"); 
            const qrCodeHtml = `<img src="${qrImageBase64}" alt="QR Code">`;
    
            // ✅ ใส่ข้อมูลลงใน `iframe`
            const iframeDoc = printFrame.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(`
                <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
                        <style>
                            body { font-family: Arial, sans-serif; padding: 20px; background-color: #f8f9fa; }
                            .report-container { display: flex; justify-content: space-between; align-items: flex-start; }
                            .report-content { flex: 1; }
                            .qr-container { flex: 0 0 150px; text-align: center; padding-left: 20px; }
                            .table-container { width: 100%;  }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            table, th, td { border: 1px solid black; }
                            th, td { padding: 10px; text-align: left; }
                            .header { text-align: center; margin-bottom: 20px; }
                        </style>
                    </head>
                    <body>
                        <div class="container report-container">
                            <div class="report-content">
                                <div class="header">
                                    <h2>ใบจำหน่ายสินค้า</h2>
                                </div>
                            </div>
                            <div class="qr-container">${qrCodeHtml}</div>
                        </div>
                        <div class="container">${Ref}</div>
                        <div class="container">
                            <div class="table-container">${updatedTableHtml}</div> 
                        </div>
                        <div class="container">บันทึกโดย: ${CreateBy}</div>
                    </body>
                </html>`);
            iframeDoc.close();
    
            // ✅ แสดง `iframe`
            printContainer.style.display = "block";
    
            // ✅ รอ 1.5 วินาทีแล้วพิมพ์
            setTimeout(() => {
                printFrame.contentWindow.print();
            }, 1500);
        }, 1000); // ✅ รอให้ QR Code โหลดเสร็จก่อนพิมพ์
    });
    
    


function updateTable(result) {
    const messageDiv = document.getElementById('message');
    const tableBody = document.getElementById('resultTable').querySelector('tbody');
    tableBody.innerHTML = ''; // ลบข้อมูลเก่าในตาราง

    if (result.success) {
        result.data.forEach((row, index) => {
            // แสดงค่า reference
            const round = row.LATEST_ROUND+1;
            if(index == 0){
                document.getElementById('DI_Ref').value = `${row.DI_REF}`;
                document.getElementById('DI_Date').value = `${row.DI_DATE}`;
                document.getElementById('DI_Round').value = round;
            }
            
            // สร้างแถวใหม่ในตาราง
            const tr = tableBody.insertRow();

            // หมายเลขแถว
            tr.insertCell().textContent = index + 1;

            // SKU_CODE (productcode)
            tr.insertCell().textContent = row.SKU_CODE;

            // SKU_NAME (productname)
            tr.insertCell().textContent = row.SKU_NAME;

            //SKU_WL (ตำแหน่งเก็บ)
            const location = row.SKU_WL;
            tr.insertCell().textContent = location;

           

             //QuantitySold
            const QuantitySold = row.QTY;
            tr.insertCell().textContent = QuantitySold;

            //จำนวนที่จ่ายไปแล้ว
            const TotalCRQTY = row.TOTAL_CR_QTY;
            tr.insertCell().textContent = TotalCRQTY;

            //จำนวนที่จัดเตรียม
            const LatestPPQTY = row.LATEST_PREPARE_QTY;
            tr.insertCell().textContent = LatestPPQTY;
            
            //สถานะ
           const status = row.STATUS;
           
           //จำนวนทีคงเหลือ
            const RemainQTY = row.REMAIN_QTY;

            // จำนวนตรวจจ่าย (แสดงเป็น input)
            const tdCheckQTY = tr.insertCell();
            const inputCheckQTY = document.createElement('input');
            inputCheckQTY.setAttribute('id', 'CheckQTY'+(index + 1));
            inputCheckQTY.type = 'number';
            inputCheckQTY.value = 0;

           // กำหนด maxCheckQTY ตามค่า RemainQTY หรือ QuantitySold หรือ PrepareQTY
            let maxCheckQTY = 0; // กำหนดค่าเริ่มต้น
            if (round <= 1 ) {
                maxCheckQTY = (QuantitySold && !isNaN(QuantitySold)) ? QuantitySold : 0; // ตรวจสอบ QuantitySold ว่ามีค่าหรือไม่
                if(location == "Warehouse" && !isNaN(QuantitySold) )
                {
                    if(parseInt(LatestPPQTY,10)==0 || isNaN(LatestPPQTY)){
                        maxCheckQTY = (RemainQTY && !isNaN(RemainQTY)) ? RemainQTY : 0;
                    }else{
                        maxCheckQTY = (LatestPPQTY && !isNaN(LatestPPQTY)) ? LatestPPQTY : 0;
                    }
                }
            } else {
                if(RemainQTY>0 && RemainQTY < QuantitySold ){ // QuantitySold =5 and remain = 2
                    maxCheckQTY = (RemainQTY && !isNaN(RemainQTY)) ? RemainQTY : 0; // ตรวจสอบ RemainQTY ว่ามีค่าหรือไม่
                }else if(RemainQTY == 0){
                    maxCheckQTY = 0;
                }
                else { // QuantitySold =5 and remain = 0
                    maxCheckQTY = (QuantitySold && !isNaN(QuantitySold)) ? QuantitySold : 0; // ตรวจสอบ QuantitySold ว่ามีค่าหรือไม่
                }
                if(location == "Warehouse" && !isNaN(QuantitySold) )
                {
                    if(parseInt(LatestPPQTY,10)==0 || isNaN(LatestPPQTY)){
                        maxCheckQTY = (RemainQTY && !isNaN(RemainQTY)) ? RemainQTY : 0;
                    }else{
                        maxCheckQTY = (LatestPPQTY && !isNaN(LatestPPQTY)) ? LatestPPQTY : 0;
                    }
                    
                }
            }
            
           
            inputCheckQTY.setAttribute('min', 0); // กำหนด minimum value
            inputCheckQTY.setAttribute('max', maxCheckQTY); // กำหนด maximum value
            tdCheckQTY.appendChild(inputCheckQTY);
            
            // Sub total จำนวนสินค้าคงค้าง
            const tdSubTotal = tr.insertCell();
            const inputSubTotal = document.createElement('input');
            inputSubTotal.type = 'number';
            inputSubTotal.setAttribute('ID', 'Subtotal'+(index + 1));
            inputSubTotal.setAttribute('class', 'form-control-plaintext');
            inputSubTotal.setAttribute('readonly', 'true');
            inputSubTotal.readOnly = true;
            // inputSubTotal.value = QuantitySold-inputCheckQTY.value;
            // inputSubTotal.value = maxCheckQTY-inputCheckQTY.value;
            if(row.IDENT!=0){
                inputSubTotal.value= RemainQTY;
            }else{
                inputSubTotal.value = maxCheckQTY-inputCheckQTY.value;
            }
           
            tdSubTotal.appendChild(inputSubTotal);
            
            //Event เมื่อมีการแก้ไขใน checkQTY
            inputCheckQTY.addEventListener('input', (event) => {

                inputCheckQTY.value = event.target.value;

                // ตรวจสอบว่า check qty ต้องไม่เกิน quantitySold และไม่ต่ำกว่า 0
                const value = parseInt(inputCheckQTY.value, 10);
                // ถ้าค่าต่ำกว่าขีดจำกัด min
                if (value < 0) {
                    inputCheckQTY.value = 0;
                }
                // ถ้าค่ามากกว่าขีดจำกัด max
                else if (value > maxCheckQTY) {
                    inputCheckQTY.value = maxCheckQTY;
                }
                 // อัปเดต model เมื่อ input เปลี่ยนแปลง
                 if(row.IDENT!=0){
                    inputSubTotal.value= RemainQTY-inputCheckQTY.value;
                }else{
                    inputSubTotal.value = maxCheckQTY-inputCheckQTY.value;
                }
                if(document.getElementById("insertStockButton").hidden === true){
                    document.getElementById("insertStockButton").hidden = false;
                }

                //เปิดปุ่มรับทั้งหมดกรณีที่ ค่า subtotal ไม่เท่ากับ 0
                let inputcheck = event.target.id;
                let i = inputcheck.replace("CheckQTY","");
                if(inputSubTotal != 0 && document.getElementById("ReceiveAll"+i).hidden === true){
                    document.getElementById("ReceiveAll"+i).hidden = false;

                }else{
                    document.getElementById("ReceiveAll"+i).hidden = true;
                }
                // console.log('Updated จำนวนตรวจจ่าย:', inputCheckQTY.value);

            });

           
           
            //ปุ่มรับทั้งหมด
            const tdAction = tr.insertCell();
            const button = document.createElement('button');
            button.textContent = 'รับทั้งหมด';
            button.setAttribute('class', 'btn btn-primary');
            button.setAttribute('id', 'ReceiveAll'+(index + 1));
            
            // Stock ID 
            const tdID = tr.insertCell();
            const inputID = document.createElement('input');
            inputID.type = 'number';
            inputID.setAttribute('ID', "ident"+(index+1));
            inputID.setAttribute('readonly', 'true');
            inputID.value = row.IDENT;
            inputID.style.display = 'none';
            tdID.appendChild(inputID);
            tdID.style.display='none';

            // Stock ID 
            const tdCATID = tr.insertCell();
            tdCATID.textContent = row.ICCAT_KEY;
            tdCATID.style.display='none';

            // Stock Code
            const tdCATCODE = tr.insertCell();
            tdCATCODE.textContent = row.ICCAT_CODE;
            tdCATCODE.style.display='none';

            // Stock Name
            const tdCATNAME = tr.insertCell();
            tdCATNAME.textContent = row.ICCAT_NAME;
            tdCATNAME.style.display='none';
            

            
            // เมื่อคลิกปุ่มให้ค่าจากแถวนี้ไปใส่ใน input fields
            button.addEventListener('click', (event) => {
                inputCheckQTY.value = maxCheckQTY;
                inputSubTotal.value = 0;
                if(row.IDENT!=0){
                    inputSubTotal.value= RemainQTY-inputCheckQTY.value;
                }else{
                    inputSubTotal.value = 0;
                }
                
                // document.getElementById("ReceiveAll").hidden = true;

                if(document.getElementById("insertStockButton").hidden === true){
                    document.getElementById("insertStockButton").hidden = false;
                }
                // ซ่อนปุ่มปัจจุบันที่ถูกคลิก
                const clickedButton = document.getElementById(event.target.id);
                if (clickedButton) {
                    clickedButton.hidden = true;  // ใช้ style.display แทน hidden
                }
            });

            tdAction.appendChild(button);
            if(RemainQTY==0){
                document.getElementById("ReceiveAll"+(index + 1)).hidden = true;
                document.getElementById("CheckQTY"+(index + 1)).disabled = true;
            }else if (location == "Warehouse" && (LatestPPQTY == 0 || isNaN(LatestPPQTY)) && RemainQTY!=0){
                document.getElementById("ReceiveAll"+(index + 1)).hidden = true;
                document.getElementById("CheckQTY"+(index + 1)).disabled = true;
            }else if ( location == "Store/Warehouse" && status == "รอการจัดเตรียม" && LatestPPQTY == 0){
                document.getElementById("ReceiveAll"+(index + 1)).hidden = true;
                document.getElementById("CheckQTY"+(index + 1)).disabled = true;
            }
            
            
           

            
        });
        messageDiv.innerHTML = ''; // ถ้าไม่มีข้อผิดพลาด
    } else {
        messageDiv.innerHTML = `<p>${result.message}</p>`;
    }
}
});

