document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("searchButton").addEventListener("click", async () => {
        const DI_REF = document.getElementById("filterDI_REF").value.trim();
        const CHECKROUND = document.getElementById("filterCHECKROUND").value.trim();
        
        const searchParams = {
            DI_REF: DI_REF || null,
            CHECKROUND: CHECKROUND ? parseInt(CHECKROUND, 10) : null
        };

        try {
            const response = await fetch("/api/get-stock-transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(searchParams)
            });

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
                    <td>${item.SKU_WL}</td>
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
                    <td>${item.CREATE_BY}</td>
                    <td>${item.CREATE_DATE}</td>
                    <td>${item.UPDATE_BY || "-"}</td>
                    <td>${item.UPDATE_DATE}</td>
                    <td>
                        <button class="btn btn-warning btn-edit">Edit</button>
                        <button class="btn btn-success btn-save" disabled>Save</button>
                    </td>
                     <td style="display: none;">${item.ID}</td>
                `;
                tableBody.appendChild(row);
        
            

                const editButton = row.querySelector(".btn-edit");
                const saveButton = row.querySelector(".btn-save");
                const inputField = row.querySelector(".cr_qty_input");

                editButton.addEventListener("click", () => {
                    inputField.disabled = false;
                    saveButton.disabled = false;
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
                            saveButton.disabled = true;

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
    });
});
