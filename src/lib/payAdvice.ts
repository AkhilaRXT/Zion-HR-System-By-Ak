import { Employee } from '../types';

export function printPayAdvice(
  employee: Employee, 
  month: string, 
  advancesTotal: number, 
  fuelPrice: number = 398,
  deductEPF: boolean = true,
  epfPercentage: number = 8,
  companyName: string = 'Zion HR',
  companySubtitle: string = 'Human Resources',
  payComponents: any = {
    baseSalary: true,
    performanceAllowance: true,
    travelingAllowance: true,
    vehicleAllowance: true,
    petrolAllowance: true,
    attendanceBonus: true,
    overtime: true,
    deductions: true
  }
) {
  const petrolLKR = payComponents.petrolAllowance ? (employee.petrolLitres || 0) * fuelPrice : 0;
  const epf = (deductEPF && payComponents.deductions) ? (employee.baseSalary || 0) * (epfPercentage / 100) : 0;
  
  const earnings = {
    baseSalary: payComponents.baseSalary ? (employee.baseSalary || 0) : 0,
    performance: payComponents.performanceAllowance ? (employee.performanceAllowance || 0) : 0,
    traveling: payComponents.travelingAllowance ? (employee.travelingAllowance || 0) : 0,
    vehicle: payComponents.vehicleAllowance ? (employee.vehicleAllowance || 0) : 0,
    petrol: petrolLKR,
    attendance: payComponents.attendanceBonus ? (employee.attendanceBonus || 0) : 0,
    overtime: payComponents.overtime ? (employee.overtime || 0) : 0
  };

  const totalEarnings = Object.values(earnings).reduce((s, v) => s + v, 0);
  
  const bonusIncentive = 0; 
  const otherAllowance = 0;
  const lateMark = 0;

  const deductions = {
    advances: payComponents.deductions ? advancesTotal : 0,
    bike: payComponents.deductions ? (employee.bikeInstallment || 0) : 0,
    loan: payComponents.deductions ? (employee.staffLoan || 0) : 0,
    epf: epf,
    late: payComponents.deductions ? lateMark : 0
  };

  const totalDeductions = Object.values(deductions).reduce((s, v) => s + v, 0);
  const netSalary = totalEarnings - totalDeductions;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
    <head>
        <title>Pay Advice - ${employee.id}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
            body {
                font-family: 'Courier Prime', monospace;
                padding: 40px;
                color: #000;
                line-height: 1.4;
                background: #fff;
            }
            .advice-container {
                max-width: 700px;
                margin: 0 auto;
                border: 2px solid #000;
                padding: 30px;
                position: relative;
            }
            .header-sn {
                position: absolute;
                top: 10px;
                right: 20px;
                font-size: 10px;
                text-transform: uppercase;
            }
            .brand {
                text-align: center;
                border-bottom: 2px solid #000;
                padding-bottom: 10px;
                margin-bottom: 5px;
            }
            .brand h1 {
                margin: 0;
                font-size: 24px;
                text-decoration: underline;
                letter-spacing: 2px;
            }
            .pay-month {
                text-align: center;
                font-weight: bold;
                text-transform: uppercase;
                margin-bottom: 30px;
                font-size: 14px;
                letter-spacing: 1px;
            }
            .info-row {
                display: flex;
                margin-bottom: 8px;
            }
            .info-label { width: 150px; }
            .info-sep { width: 30px; }
            .info-val { font-weight: bold; text-transform: uppercase; }

            .divider {
                border-top: 1px dashed #666;
                margin: 20px 0;
            }

            .section-title {
                font-weight: bold;
                text-decoration: underline;
                text-transform: uppercase;
                margin-bottom: 15px;
            }

            .calc-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 6px;
                padding-left: 20px;
            }
            .calc-sub-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 4px;
                padding-left: 40px;
                font-style: italic;
                font-size: 13px;
            }

            .total-row {
                display: flex;
                justify-content: space-between;
                font-weight: bold;
                text-transform: uppercase;
                margin-top: 10px;
                border-top: 1px solid #000;
                padding-top: 5px;
            }

            .net-salary-box {
                margin-top: 30px;
                border-top: 3px solid #000;
                border-bottom: 3px solid #000;
                padding: 10px 0;
                display: flex;
                justify-content: space-between;
                font-size: 20px;
                font-weight: 900;
                text-transform: uppercase;
            }

            .footer {
                margin-top: 80px;
                display: flex;
                justify-content: space-between;
            }
            .sig-box {
                width: 250px;
                border-top: 1px solid #000;
                text-align: center;
                padding-top: 5px;
                font-size: 11px;
                text-transform: uppercase;
            }

            @media print {
                body { padding: 0; }
                .advice-container { border: 2px solid #000; }
            }
        </style>
    </head>
    <body>
        <div class="advice-container">
            <div class="header-sn">SN: ${companyName.substring(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${employee.id}</div>
            
            <div class="brand">
                <h1>${companyName}</h1>
                <div style="font-size: 12px; margin-top: 5px; letter-spacing: 1px;">${companySubtitle}</div>
            </div>
            <div class="pay-month">
                Pay Advice for the Month of ${month}
            </div>

            <div class="employee-info">
                <div class="info-row">
                    <div class="info-label">Employee Name</div>
                    <div class="info-sep">:-</div>
                    <div class="info-val">${employee.name}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Employee ID</div>
                    <div class="info-sep">:-</div>
                    <div class="info-val">${employee.id}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Designation</div>
                    <div class="info-sep">:-</div>
                    <div class="info-val">${employee.role}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Branch Name</div>
                    <div class="info-sep">:-</div>
                    <div class="info-val">${employee.branch || 'Head Office'}</div>
                </div>
            </div>

            <div class="divider"></div>

            <div class="earnings">
                <div class="section-title">Earnings</div>
                <div class="calc-row">
                    <div>▪ 1 BASIC SALARY</div>
                    <div>${earnings.baseSalary.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
                <div class="calc-row">
                    <div>▪ 2 INCENTIVE / FUEL / TRAVEL</div>
                </div>
                <div class="calc-sub-row">
                    <div>I PERFORMANCE ALLOWANCE</div>
                    <div>${earnings.performance.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
                <div class="calc-sub-row">
                    <div>II TRAVEL ALLOWANCE</div>
                    <div>${earnings.traveling.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
                <div class="calc-sub-row">
                    <div>III VEHICLE ALLOWANCE</div>
                    <div>${earnings.vehicle.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
                <div class="calc-sub-row">
                    <div>IV FUEL ALLOWANCE (${payComponents.petrolAllowance ? employee.petrolLitres : 0}L × LKR ${fuelPrice})</div>
                    <div>${earnings.petrol.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
                <div class="calc-sub-row">
                    <div>IV BONUS / INCENTIVE</div>
                    <div>${bonusIncentive.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
                <div class="calc-sub-row">
                    <div>V OTHER ALLOWANCE</div>
                    <div>${otherAllowance.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
                <div class="calc-row">
                    <div>▪ 3 ATTENDANCE BONUS</div>
                    <div>${earnings.attendance.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
                <div class="calc-row">
                    <div>▪ 4 OVERTIME</div>
                    <div>${earnings.overtime.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>

                <div class="total-row">
                    <div>▪ TOTAL EARNINGS</div>
                    <div>${totalEarnings.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
            </div>

            <div class="divider"></div>

            <div class="deductions">
                <div class="section-title">Deductions</div>
                <div class="calc-row">
                    <div>▪ 1 SALARY ADVANCED</div>
                    <div>${deductions.advances.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
                <div class="calc-row">
                    <div>▪ 2 LATE MARK / ABSENT</div>
                    <div>${deductions.late.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
                <div class="calc-row">
                    <div>▪ 3 BIKE INSTALLMENTS</div>
                    <div>${deductions.bike.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
                <div class="calc-row">
                    <div>▪ 4 STAFF LOAN</div>
                    <div>${deductions.loan.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
                <div class="calc-row">
                    <div>▪ 5 EPF ${epfPercentage}%</div>
                    <div>${deductions.epf.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>

                <div class="total-row">
                    <div>▪ TOTAL DEDUCTIONS</div>
                    <div>${totalDeductions.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
            </div>

            <div class="net-salary-box">
                <div>▪ NET SALARY</div>
                <div>LKR ${netSalary.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            </div>

            <div class="footer">
                <div class="sig-box">Date</div>
                <div class="sig-box">Signature of Branch Manager</div>
            </div>
        </div>
        <script>
            window.onload = function() { window.print(); }
        </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
