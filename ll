<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>حجز الشاليه</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; text-align: center; background-color: #f0f8ff; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  td, th { border: 1px solid #ccc; padding: 10px; text-align: center; }
  td.booked { background-color: #f88; color: white; cursor: not-allowed; }
  td.available { background-color: #8f8; cursor: pointer; }
  #result { margin-top: 20px; font-size: 18px; font-weight: bold; }
  img { max-width: 100%; border-radius: 10px; margin-top: 20px; }
</style>
</head>
<body>
<h1>حجز الشاليه</h1>
<p>اختر اليوم لمعرفة إذا كان متوفر أو محجوز. يظهر التاريخ الميلادي والهجري.</p>
<img src="https://via.placeholder.com/800x300?text=صورة+الشاليه" alt="صورة الشاليه">
<div id="calendar"></div>
<div id="result"></div>

<script src="https://cdn.jsdelivr.net/npm/hijri-date/lib/index.min.js"></script>
<script>
const bookedDates = ["2025-10-05","2025-10-06","2025-10-09"];

function createCalendar() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let html = "<table><tr>";
  const daysOfWeek = ["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"];
  for(let d of daysOfWeek) html += `<th>${d}</th>`;
  html += "</tr><tr>";

  for(let i=0;i<firstDay.getDay();i++) html += "<td></td>";

  for(let day=1; day<=lastDay.getDate(); day++){
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const hijriDate = new HijriDate(new Date(year, month, day));
    const hijriStr = `${hijriDate.getDate()}/${hijriDate.getMonth()+1}/${hijriDate.getFullYear()}`;
    const isBooked = bookedDates.includes(dateStr);
    const cls = isBooked ? "booked" : "available";
    html += `<td class="${cls}" data-date="${dateStr}" data-hijri="${hijriStr}">${day}<br><small>${hijriStr}</small></td>`;
    if((firstDay.getDay()+day)%7==0) html += "</tr><tr>";
  }
  html += "</tr></table>";
  document.getElementById("calendar").innerHTML = html;

  document.querySelectorAll("td.available").forEach(td=>{
    td.addEventListener("click", ()=>{
      const date = td.getAttribute("data-date");
      const hijri = td.getAttribute("data-hijri");
      document.getElementById("result").textContent = `✅ التاريخ متوفر: ${date} (هجري: ${hijri})`;
      document.getElementById("result").style.color = "green";
    });
  });
}

createCalendar();
</script>
</body>
</html>
