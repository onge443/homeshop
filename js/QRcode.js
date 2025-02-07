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

           
           //จำนวนทีคงเหลือ
            const RemainQTY = row.REMAIN_QTY;

            // จำนวนตรวจจ่าย (แสดงเป็น input)
            const tdCheckQTY = tr.insertCell();
            const inputCheckQTY = document.createElement('input');
            inputCheckQTY.setAttribute('id', 'CheckQTY'+(index + 1));
            inputCheckQTY.type = 'number';
            inputCheckQTY.value = 0;

           // กำหนด maxCheckQTY ตามค่า RemainQTY หรือ QuantitySold
            let maxCheckQTY = 0; // กำหนดค่าเริ่มต้น
            if (round <= 1 ) {
                maxCheckQTY = (QuantitySold && !isNaN(QuantitySold)) ? QuantitySold : 0; // ตรวจสอบ QuantitySold ว่ามีค่าหรือไม่
                
            } else {
                if(RemainQTY>0 && RemainQTY < QuantitySold ){ // QuantitySold =5 and remain = 2
                    maxCheckQTY = (RemainQTY && !isNaN(RemainQTY)) ? RemainQTY : 0; // ตรวจสอบ RemainQTY ว่ามีค่าหรือไม่
                }else if(RemainQTY == 0){
                    maxCheckQTY = 0;
                }
                else { // QuantitySold =5 and remain = 0
                    maxCheckQTY = (QuantitySold && !isNaN(QuantitySold)) ? QuantitySold : 0; // ตรวจสอบ QuantitySold ว่ามีค่าหรือไม่
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
            inputSubTotal.value = maxCheckQTY-inputCheckQTY.value;
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
                inputSubTotal.value = maxCheckQTY-inputCheckQTY.value;
                if(document.getElementById("insertStockButton").hidden === true){
                    document.getElementById("insertStockButton").hidden = false;
                }

                //เปิดปุ่มรับทั้งหมดกรณีที่ ค่า subtotal ไม่เท่ากับ 0
                let inputcheck = event.target.id;
                let i = inputcheck.replace("CheckQTY","");
                if(inputSubTotal != 0 && document.getElementById("ReceiveAll"+i).hidden === true){
                    document.getElementById("ReceiveAll"+i).hidden = false;

                }
                // console.log('Updated จำนวนตรวจจ่าย:', inputCheckQTY.value);

            });

           
           
            //ปุ่มรับทั้งหมด
            const tdAction = tr.insertCell();
            const button = document.createElement('button');
            button.textContent = 'รับทั้งหมด';
            button.setAttribute('class', 'btn btn-primary');
            button.setAttribute('id', 'ReceiveAll'+(index + 1));
            
            const tdID = tr.insertCell();
            const inputID = document.createElement('input');
            inputID.type = 'number';
            inputID.setAttribute('ID', "ident"+(index+1));
            inputID.setAttribute('readonly', 'true');
            inputID.value = row.IDENT;
            inputID.style.display = 'none';
            tdID.appendChild(inputID);
            tdID.style.display='none';

            
            // เมื่อคลิกปุ่มให้ค่าจากแถวนี้ไปใส่ใน input fields
            button.addEventListener('click', (event) => {
                inputCheckQTY.value = maxCheckQTY;
                inputSubTotal.value = 0;
                
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
            }else if (location == "Warehouse" && LatestPPQTY == 0 && RemainQTY!=0){
                document.getElementById("ReceiveAll"+(index + 1)).hidden = true;
                document.getElementById("CheckQTY"+(index + 1)).disabled = true;
            }
            
            
           

            
        });
        messageDiv.innerHTML = ''; // ถ้าไม่มีข้อผิดพลาด
    } else {
        messageDiv.innerHTML = `<p>${result.message}</p>`;
    }
}



