const API = '/api/weather';

async function load() {
  const res = await fetch(API + '?limit=50');
  const data = await res.json();
  const labels = data.map(d=> new Date(d.timestamp).toLocaleString()).reverse();
  const temps = data.map(d=> d.temperature).reverse();

  const tbody = document.querySelector('#tbl tbody');
  tbody.innerHTML = '';
  data.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${new Date(r.timestamp).toLocaleString()}</td><td>${r.temperature ?? '-'}</td><td>${r.windspeed ?? '-'}</td>`;
    tbody.appendChild(tr);
  });

  const ctx = document.getElementById('tempChart').getContext('2d');
  if (window.myChart) window.myChart.destroy();
  window.myChart = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[{label:'Temperature', data:temps, fill:false}] },
    options:{ responsive:true, maintainAspectRatio:false }
  });
}
load();
setInterval(load, 60*1000);
