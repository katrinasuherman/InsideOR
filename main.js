
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let data = [];
let caseData = [];
let selectedCase = null;
let activeZone = null;

const orImage = document.getElementById("or-image");
const tooltip = document.getElementById("tooltip");

document.addEventListener("DOMContentLoaded", async () => {
  data = await loadChartData();
  updateChart();
  await loadCaseData();

  d3.selectAll('#controls select, #emergencyToggle, #showMale, #showFemale, input[name="optype"]')
    .on('change', updateChart);

  // === REVEAL logic for line1 → line2 animation ===
  const line1 = document.getElementById("line1");
  const line2 = document.getElementById("line2");

  if (line1 && line2) {
    const lineObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            line1.classList.add("hidden");
            setTimeout(() => {
              line2.classList.remove("hidden");
              line2.classList.add("visible");
            }, 1000);
          }, 1800);
          lineObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    lineObserver.observe(line1.parentElement);
  }
});


async function loadChartData() {
  const raw = await d3.csv('data.csv', d => {
    d.age = +d.age;
    d.height = +d.height;
    d.weight = +d.weight;
    d.bmi = +d.bmi;
    d.asa = +d.asa;
    d.emop = +d.emop;
    d.surgery_time = +d.surgery_time;
    d.icu_days = +d.icu_days;
    return d;
  });
  return raw.filter(d => !isNaN(d.surgery_time));
}

function updateChart() {
  const yVar = d3.select('#ySelect').property('value');
  const xVar = d3.select('#xQuantSelect').property('value');
  const showEmergencyOnly = d3.select("#emergencyToggle").property("checked");
  const showMale = d3.select("#showMale").property("checked");
  const showFemale = d3.select("#showFemale").property("checked");
  const selectedOptype = d3.select('input[name="optype"]:checked')?.property('value');

  const svg = d3.select('#chart');
  svg.selectAll('*').remove();

  const width = +svg.attr('width');
  const height = +svg.attr('height');
  const margin = { top: 40, right: 40, bottom: 80, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const chart = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  let filtered = data.filter(d => {
    const yVal = +d[yVar];
    if (isNaN(yVal) || d[yVar] === "" || d[xVar] === "") return false;
    if (yVar === "icu_days" && yVal > 50) return false;
    if (showEmergencyOnly && d.emop !== 1 && d.emop !== "1") return false;
    if ((d.sex === "M" && !showMale) || (d.sex === "F" && !showFemale)) return false;
    if (selectedOptype && selectedOptype !== "All" && d.optype !== selectedOptype) return false;
    return true;
  });

  // Summary text display
  const avgY = d3.mean(filtered, d => d[yVar]);
  const summaryText = filtered.length && avgY !== undefined
    ? `${filtered.length} patients | Avg ${yVar.replace('_', ' ')}: ${avgY.toFixed(1)}`
    : `No matching data.`;
  d3.select("#summary").text(summaryText);

  const x = d3.scaleLinear()
    .domain(d3.extent(filtered, d => +d[xVar])).nice()
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(filtered, d => +d[yVar])]).nice()
    .range([innerHeight, 0]);

  chart.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));

  chart.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 45)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .text(xVar.replaceAll('_', ' '));

  chart.append('g').call(d3.axisLeft(y));

  chart.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -45)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .text(yVar.replaceAll('_', ' '));

  chart.selectAll('circle')
    .data(filtered)
    .join('circle')
    .attr('cx', d => x(d[xVar]))
    .attr('cy', d => y(d[yVar]))
    .attr('r', 4)
    .attr('fill', 'steelblue')
    .attr('opacity', 0.6);
}


async function loadCaseData() {
  const res = await fetch(`patient.json?nocache=${Date.now()}`);
  caseData = await res.json();
  const dropdown = document.getElementById("caseDropdown");
  caseData.forEach(d => {
    const option = document.createElement("option");
    option.value = d.caseid;
    option.textContent = `Case ${d.caseid}`;
    dropdown.appendChild(option);
  });

  dropdown.addEventListener("change", () => {
    const selectedId = parseInt(dropdown.value);
    selectedCase = caseData.find(d => d.caseid === selectedId);
    renderSurgeryInfo(selectedId);
    if (orImage && selectedCase) {
      const sex = selectedCase.sex?.toLowerCase();
      orImage.src = sex === "f" ? "images/table-female.png" : "images/table-male.png";
    }
  });
}

function renderSurgeryInfo(caseid) {
  const surgery = caseData.find(d => Number(d.caseid) === Number(caseid));
  const container = document.getElementById("surgeryInfo");
  if (!surgery) {
    container.innerHTML = "<p>No surgery data available.</p>";
    return;
  }

  container.innerHTML = `
    <h2>PATIENT CARD</h2>
    <div class="surgery-section"><div class="surgery-section-title">Case Summary</div><p><strong>Case ID:</strong> ${surgery.caseid}</p><p><strong>Department:</strong> ${surgery.department}</p></div>
    <div class="surgery-section"><div class="surgery-section-title">Surgery Details</div><p><strong>Operation Name:</strong> ${surgery.opname}</p><p><strong>Operation Type:</strong> ${surgery.optype}</p><p><strong>Approach:</strong> ${surgery.approach}</p><p><strong>Patient Position:</strong> ${surgery.position}</p></div>
    <div class="surgery-section"><div class="surgery-section-title">Medical Context</div><p><strong>Emergency:</strong> ${surgery.emop || 'N/A'}</p><p><strong>Diagnosis:</strong> ${surgery.dx}</p><p><strong>ASA:</strong> ${surgery.asa}</p></div>
  `;
}

orImage.addEventListener("mousemove", (e) => {
  if (selectedCase) {
    tooltip.style.left = `${e.offsetX + 20}px`;
    tooltip.style.top = `${e.offsetY + 20}px`;
  }
});

orImage.addEventListener("mouseenter", () => {
  if (selectedCase) {
    tooltip.innerHTML = `
      <strong>Case ${selectedCase.caseid}</strong><br>
      Age: ${selectedCase.age}<br>
      Sex: ${selectedCase.sex}<br>
      BMI: ${selectedCase.bmi}<br>
      Height: ${selectedCase.height}
    `;
    tooltip.style.display = "block";
  }
});

orImage.addEventListener("mouseleave", () => {
  tooltip.style.display = "none";
});
