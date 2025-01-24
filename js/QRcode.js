// Create Html5Qrcode instance
                                    
const html5QrCode = new Html5Qrcode("reader");
            
// Function when QR Code scan is successful
async function onScanSuccess(decodedText) {
    // console.log("Decoded Text:", decodedText); // Debug

    try {
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
        document.getElementById('reader').style.display = 'none';
    } catch (err) {
        
        document.getElementById('reader').style.display = 'none';
        alert("Failed to decode QR Code. Please try again.");
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
    const ref = document.getElementById('reference').value; // reference
    const response = await fetch('/search1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: ref })
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    updateTable(result);
    
    });



function updateTable(result) {
    const messageDiv = document.getElementById('message');
    const tableBody = document.getElementById('resultTable').querySelector('tbody');
    tableBody.innerHTML = ''; // ลบข้อมูลเก่าในตาราง

    if (result.success) {
        result.data.forEach((row, index) => {
            // สร้างแถวใหม่ในตาราง
            const tr = tableBody.insertRow();

            // หมายเลขแถว
            tr.insertCell().textContent = index + 1;

            // SKU_CODE
            tr.insertCell().textContent = row.SKU_CODE;

            // SKU_NAME
            tr.insertCell().textContent = row.SKU_NAME;

             //TOTAL_QTY
             const QueryQTY = row.QTY*(-1);
             tr.insertCell().textContent = QueryQTY;

            //  //จำนวนตรวจจ่าย
            //  tr.insertCell().textContent = row.QTY*(-1);


            // จำนวนตรวจจ่าย (แสดงเป็น input)
            const tdCheckQTY = tr.insertCell();
            const inputCheckQTY = document.createElement('input');
            inputCheckQTY.setAttribute('id', 'CheckQTY'+(index + 1));
            inputCheckQTY.type = 'number';
            inputCheckQTY.value = 0;

            // ตรวจสอบว่า QueryQTY มีค่าที่เหมาะสมหรือไม่
            const maxQTY = (QueryQTY && !isNaN(QueryQTY)) ? QueryQTY : 0; // ตรวจสอบว่า QueryQTY เป็นตัวเลขที่ถูกต้องหรือไม่
            inputCheckQTY.setAttribute('min', 0); // กำหนด minimum value
            inputCheckQTY.setAttribute('max', maxQTY); // กำหนด maximum value
            tdCheckQTY.appendChild(inputCheckQTY);
            const tdSubTotal = tr.insertCell();
            const inputSubTotal = document.createElement('input');
            inputSubTotal.type = 'number';
            inputSubTotal.setAttribute('ID', 'Subtotal'+(index + 1));
            inputSubTotal.setAttribute('class', 'form-control-plaintext');
            inputSubTotal.setAttribute('readonly', 'true');
            inputSubTotal.readOnly = true;
            inputSubTotal.value = QueryQTY-inputCheckQTY.value;
            tdSubTotal.appendChild(inputSubTotal);
            
            // เชื่อมโยงข้อมูลกับ model (data binding)
            inputCheckQTY.addEventListener('input', (event) => {
                inputCheckQTY.value = event.target.value;
                const value = parseInt(inputCheckQTY.value, 10);
                // ถ้าค่าต่ำกว่าขีดจำกัด min
                if (value < 0) {
                    inputCheckQTY.value = 0;
                }
                // ถ้าค่ามากกว่าขีดจำกัด max
                else if (value > maxQTY) {
                    inputCheckQTY.value = maxQTY;
                }
                
                inputSubTotal.value = QueryQTY-inputCheckQTY.value;
                 // อัปเดต model เมื่อ input เปลี่ยนแปลง
                console.log('Updated จำนวนตรวจจ่าย:', inputCheckQTY.value);

            });

            // เชื่อมโยงข้อมูลกับ model (data binding)
           

            const tdAction = tr.insertCell();
            const button = document.createElement('button');
            button.textContent = 'รับทั้งหมด';
            button.setAttribute('class', 'btn btn-primary');
            button.setAttribute('id', 'ReceiveAll'+(index + 1));
            
            // เมื่อคลิกปุ่มให้ค่าจากแถวนี้ไปใส่ใน input fields
            button.addEventListener('click', () => {
                inputCheckQTY.value = QueryQTY;
                inputSubTotal.value = 0;
            });

            tdAction.appendChild(button);
             document.getElementById('DI_Ref').value = `${row.DI_REF}`;
            document.getElementById('DI_CreateDate').value = `${row.DI_DATE}`;

            
           

            
        });
        messageDiv.innerHTML = ''; // ถ้าไม่มีข้อผิดพลาด
    } else {
        messageDiv.innerHTML = `<p>${result.message}</p>`;
    }
}



