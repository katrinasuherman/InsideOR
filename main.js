// main.js

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let data = [];          // For the main patient‐data scatterplot (CSV)
let caseData = [];      // Loaded from patient.json (metadata + index)
let selectedCase = null; 
let allVitalData = {};  // Loaded from images/vital_data.json
let allInterData = {};  // Loaded from images/proxy_drug_data.json
let vitalData = {};     // Alias for allVitalData in scatterplot logic
let proxyData = {};     // Alias for allInterData in scatterplot logic
let allParamKeys = [];  // Keys for heatmap
let globalCorrMatrix = {};

const orImage = document.getElementById("or-image");
const tooltip = document.getElementById("tooltip");
const orContainer = document.getElementById("or-container");

// ----------------------------------------------------------
// 1) DOMContentLoaded: load CSV + draw initial scatter, then load 5 cases
// ----------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  // 1a) Load the CSV data for the patient‐level scatterplot
  data = await loadChartData();
  updateChart(); // draws the initial “no filters” scatter (likely blank)

  // 1b) Load exactly 5 cases from patient.json → populates #caseDropdown
  await loadCaseData();

  // 1c) Attach all the “filter‐by‐age/BMI/sex/optype” listeners for the CSV chart
  d3.selectAll('#controls select, #emergencyToggle, #showMale, #showFemale, input[name="optype"]')
    .on('change', updateChart);

  // 1d) (Optional) Any IntersectionObserver logic for line1/line2 goes here…
});

// ----------------------------------------------------------
// 2) loadChartData & updateChart (unchanged except minor formatting)
// ----------------------------------------------------------
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
    d.intraop_crystalloid = +d.intraop_crystalloid;
    d.intraop_rocu = +d.intraop_rocu;
    d.intraop_uo = +d.intraop_uo;
    d.preop_alb = +d.preop_alb;
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
  const width = +svg.attr('width');
  const height = +svg.attr('height');
  const margin = { top: 40, right: 40, bottom: 80, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const chart = svg.selectAll("g.chart-group")
    .data([null])
    .join("g")
    .attr("class", "chart-group")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  let filtered = data.filter(d => {
    const yVal = +d[yVar];
    if (isNaN(yVal) || d[yVar] === "" || d[xVar] === "") return false;
    if (yVar === "icu_days" && yVal > 50) return false;

    // Age slider filtering
    const minAge = parseInt(ageMinInput?.value || 0);
    const maxAge = parseInt(ageMaxInput?.value || 100);
    if (d.age < minAge || d.age > maxAge) return false;

    // BMI slider filtering
    const minBmi = parseFloat(document.getElementById('bmiMin').value || 10);
    const maxBmi = parseFloat(document.getElementById('bmiMax').value || 50);
    if (d.bmi < minBmi || d.bmi > maxBmi) return false;

    if (showEmergencyOnly && d.emop !== 1 && d.emop !== "1") return false;
    if ((d.sex === "M" && !showMale) || (d.sex === "F" && !showFemale)) return false;
    if (selectedOptype && selectedOptype !== "All" && d.optype !== selectedOptype) return false;

    return true;
  });

  // Summary text
  const avgY = d3.mean(filtered, d => d[yVar]);
  const summaryText = (filtered.length && avgY !== undefined)
    ? `${filtered.length} patients | Avg ${yVar.replace('_', ' ')}: ${avgY.toFixed(1)}`
    : `No matching data.`;
  d3.select("#summary").text(summaryText);

  const x = d3.scaleLinear()
    .domain(d3.extent(filtered, d => +d[xVar])).nice()
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(filtered, d => +d[yVar])]).nice()
    .range([innerHeight, 0]);

  // Draw axes
  chart.selectAll(".x-axis")
    .data([null])
    .join("g")
    .attr("class", "x‐axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .transition().duration(1000)
    .call(d3.axisBottom(x));

  chart.selectAll(".y-axis")
    .data([null])
    .join("g")
    .attr("class", "y‐axis")
    .transition().duration(1000)
    .call(d3.axisLeft(y));

  // Axis labels
  chart.selectAll(".x-label")
    .data([null])
    .join("text")
      .attr("class", "x-label")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 45)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .text(xVar.replaceAll('_', ' '));

  chart.selectAll(".y-label")
    .data([null])
    .join("text")
      .attr("class", "y-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .text(yVar.replaceAll('_', ' '));

  // Bind data to circles
  const circles = chart.selectAll("circle")
    .data(filtered, d => d.caseid);

  circles.join(
    enter => enter.append("circle")
      .attr("r", 4)
      .attr("fill", "steelblue")
      .attr("opacity", 0.6)
      .attr("cx", d => x(d[xVar]))
      .attr("cy", d => y(d[yVar])),
    update => update.transition().duration(1000)
      .attr("cx", d => x(d[xVar]))
      .attr("cy", d => y(d[yVar])),
    exit => exit.transition().duration(300).attr("r", 0).remove()
  );
}

// ----------------------------------------------------------
// 3) loadCaseData: build dropdown of exactly 5 cases & attach a SINGLE listener
// ----------------------------------------------------------
async function loadCaseData() {
  try {
    const res = await fetch(`patient.json?nocache=${Date.now()}`);
    caseData = await res.json();

    const dropdown = document.getElementById("caseDropdown");

    // Reset to placeholder
    dropdown.innerHTML = `
      <option value="" disabled selected>-- Select a case --</option>
    `;

    // Add the first 5 cases
    caseData.slice(0, 5).forEach(d => {
      const option = document.createElement("option");
      option.value = d.caseid;
      option.textContent = `Case ${d.caseid}`;
      dropdown.appendChild(option);
    });

    // Attach ONE listener that triggers EVERYTHING needed on selection:
    dropdown.addEventListener("change", (e) => {
      const selectedId = e.target.value;
      if (!selectedId) return;

      // 3a) Find and render the patient card + OR image:
      selectedCase = caseData.find(d => String(d.caseid) === String(selectedId));
      if (selectedCase) {
        renderSurgeryInfo(selectedId);
        const sex = (selectedCase.sex || "").toLowerCase();
        if (orImage) {
          orImage.src = sex === "f"
            ? "images/table-female.png"
            : "images/table-male.png";
        }
      }

      // 3b) Draw the live EKG + intervention charts:
      resetAndDrawForCase(selectedId);

      // 3c) Update the scatterplot/heatmap controls + redraw:
      updateParamOptions();
      plotScatter();

      // 3d) Scroll into the case‐explorer section:
      const nextSection = document.getElementById("case-explorer");
      if (nextSection) {
        nextSection.scrollIntoView({ behavior: "smooth" });
      }
    });

  } catch (err) {
    console.error("Error loading patient.json:", err);
  }
}

// ----------------------------------------------------------
// 4) renderSurgeryInfo (patient card + OR image tooltip)
// ----------------------------------------------------------
function renderSurgeryInfo(caseid) {
  const surgery = caseData.find(d => Number(d.caseid) === Number(caseid));
  const container = document.getElementById("surgeryInfo");
  if (!surgery) {
    container.innerHTML = "<p>No surgery data available.</p>";
    return;
  }

  container.innerHTML = `
    <h2>PATIENT CARD</h2>
    <div class="surgery-section">
      <div class="surgery-section-title">Case Summary</div>
      <p><strong>Case ID:</strong> ${surgery.caseid}</p>
      <p><strong>Department:</strong> ${surgery.department}</p>
    </div>
    <div class="surgery-section">
      <div class="surgery-section-title">Surgery Details</div>
      <p><strong>Operation Name:</strong> ${surgery.opname}</p>
      <p><strong>Operation Type:</strong> ${surgery.optype}</p>
      <p><strong>Approach:</strong> ${surgery.approach}</p>
      <p><strong>Patient Position:</strong> ${surgery.position}</p>
    </div>
    <div class="surgery-section">
      <div class="surgery-section-title">Medical Context</div>
      <p><strong>Emergency:</strong> ${surgery.emop || 'N/A'}</p>
      <p><strong>Diagnosis:</strong> ${surgery.dx}</p>
      <p><strong>ASA:</strong> ${surgery.asa}</p>
    </div>
  `;
}

// Tooltip on OR image
orImage.addEventListener("mousemove", (e) => {
  if (selectedCase && orContainer) {
    const rect = orContainer.getBoundingClientRect();
    tooltip.style.left = `${e.clientX - rect.left + 20}px`;
    tooltip.style.top = `${e.clientY - rect.top + 20}px`;
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

// ----------------------------------------------------------
// 5) Live EKG + Intervention Charts
// ----------------------------------------------------------
const WINDOW_SIZE = 600;
let playInterval = null;
let playSpeed = 100;
const margin_ekg = { top: 40, right: 20, bottom: 40, left: 60 };
const RIGHT_PADDING = 30;
const totalWidth = 1150;
const totalHeight = 400;
const chartWidth = totalWidth - margin_ekg.left - margin_ekg.right;
const chartHeight = totalHeight - margin_ekg.top - margin_ekg.bottom;
const interChartHeight = totalHeight - margin_ekg.top - margin_ekg.bottom;
const effectiveChartWidth = chartWidth - RIGHT_PADDING;

const vitalColor = d3.scaleOrdinal(d3.schemeTableau10);
const interColor = d3.scaleOrdinal(d3.schemeSet2);

const liveValuesContainer = d3.select("#live-values");
const playBtn = d3.select("#play-btn");
const pauseBtn = d3.select("#pause-btn");
const fasterBtn  = d3.select("#faster-btn");
const resetBtn = d3.select("#reset-btn");

const slider = d3.select("#time-slider");

let currentVitals = [];
let currentInters = [];
let duration = 0;
let currentTime = 0;

let xScaleVitals, yScaleVitals, xAxisVitals, yAxisVitals, xGridVitals, yGridVitals;
let xScaleInter, yScaleInter, xAxisInter, yAxisInter, xGridInter, yGridInter;



const vitalSVG = d3
  .select("#vital-chart")
  .append("svg")
  .attr("width", chartWidth + margin_ekg.left + margin_ekg.right)
  .attr("height", chartHeight + margin_ekg.top + margin_ekg.bottom)
  .append("g")
  .attr("transform", `translate(${margin_ekg.left},${margin_ekg.top})`);

const interSVG = d3
  .select("#intervention-chart")
  .append("svg")
  .attr("width", chartWidth + margin_ekg.left + margin_ekg.right)
  .attr("height", interChartHeight + margin_ekg.top + margin_ekg.bottom)
  .append("g")
  .attr("transform", `translate(${margin_ekg.left},${margin_ekg.top})`);

function sanitizeParam(str) {
  return str.replace(/[^a-zA-Z0-9]/g, "_");
}

function formatHMS(d) {
  const hours = Math.floor(d / 3600);
  const mins = Math.floor((d % 3600) / 60);
  const secs = d % 60;
  const hh = hours < 10 ? "0" + hours : hours;
  const mm = mins < 10 ? "0" + mins : mins;
  const ss = secs < 10 ? "0" + secs : secs;
  return `${hh}:${mm}:${ss}`;
}

// 5a) Load all vital & intervention data once (***paths adjusted***)
Promise.all([
  d3.json("images/vital_data.json"),
  d3.json("images/proxy_drug_data.json")
])
  .then(([vitalDataJSON, interDataJSON]) => {
    allVitalData = vitalDataJSON;
    allInterData = interDataJSON;
  })
  .catch((error) => {
    console.error("Error loading vital or intervention data:", error);
  });

function resetAndDrawForCase(caseID) {
  // Stop any existing animation
  stopAnimation();
  vitalSVG.selectAll("*").remove();
  interSVG.selectAll("*").remove();
  liveValuesContainer.selectAll("*").remove();

  // Prepare currentVitals / currentInters for that caseID
  currentVitals = Object.entries(allVitalData[caseID] || {}).map(([param, arr]) => ({
    param: param,
    values: arr.map((d) => ({ time: +d.time, value: +d.value })),
  }));

  currentInters = Object.entries(allInterData[caseID] || {}).map(([param, arr]) => ({
    param: param,
    values: arr.map((d) => ({ time: +d.time, value: +d.value })),
  }));

  duration = d3.max(currentVitals, (d) => d3.max(d.values, (v) => v.time)) || 0;
  currentTime = 0;

  slider
    .attr("min", 0)
    .attr("max", Math.max(0, duration - WINDOW_SIZE))
    .attr("step", 1)
    .property("value", 0)
    .on("input", () => {
      currentTime = +slider.property("value");
      updateCharts(currentTime);
    });

  configureVitalScales();
  configureInterScales();

  drawLegendAndLiveValues();
  drawCharts();
  updateCharts(currentTime);
}

function configureVitalScales() {
  xScaleVitals = d3.scaleLinear().domain([0, WINDOW_SIZE]).range([0, effectiveChartWidth]);

  const allVals = currentVitals.flatMap((d) => d.values.map((v) => v.value));
  const yMin = (d3.min(allVals) || 0) * 0.9;
  const yMax = (d3.max(allVals) || 0) * 1.1;

  yScaleVitals = d3.scaleLinear().domain([yMin, yMax]).range([chartHeight, 0]);

  xAxisVitals = d3.axisBottom(xScaleVitals).ticks(6).tickFormat(formatHMS);
  yAxisVitals = d3.axisLeft(yScaleVitals).ticks(6);

  xGridVitals = d3.axisBottom(xScaleVitals).tickSize(-chartHeight).tickFormat("").ticks(6);
  yGridVitals = d3.axisLeft(yScaleVitals).tickSize(-effectiveChartWidth).tickFormat("").ticks(6);
}

function configureInterScales() {
  xScaleInter = d3.scaleLinear().domain([0, WINDOW_SIZE]).range([0, effectiveChartWidth]);

  const allVals = currentInters.flatMap((d) => d.values.map((v) => v.value));
  const yMax = (d3.max(allVals) || 0) * 1.1;

  yScaleInter = d3.scaleLinear().domain([0, yMax]).range([interChartHeight, 0]);

  xAxisInter = d3.axisBottom(xScaleInter).ticks(6).tickFormat(formatHMS);
  yAxisInter = d3.axisLeft(yScaleInter).ticks(6);

  xGridInter = d3.axisBottom(xScaleInter).tickSize(-interChartHeight).tickFormat("").ticks(6);
  yGridInter = d3.axisLeft(yScaleInter).tickSize(-effectiveChartWidth).tickFormat("").ticks(6);
}

function drawLegendAndLiveValues() {
  const legendContainer = d3.select("#legend");
  legendContainer.selectAll("*").remove();

  legendContainer.append("div").html("<strong>Vitals:</strong>");
  const vitalLegend = legendContainer.append("ul").attr("class", "legend-list");
  currentVitals.forEach((d, i) => {
    const li = vitalLegend.append("li");
    li.append("span")
      .style("display", "inline-block")
      .style("width", "12px")
      .style("height", "12px")
      .style("background-color", vitalColor(i))
      .style("margin-right", "6px");
    li.append("span").text(d.param);
  });

  legendContainer.append("div").style("margin-top", "12px").html("<strong>Interventions:</strong>");
  const interLegend = legendContainer.append("ul").attr("class", "legend-list");
  currentInters.forEach((d, i) => {
    const li = interLegend.append("li");
    li.append("span")
      .style("display", "inline-block")
      .style("width", "12px")
      .style("height", "12px")
      .style("background-color", interColor(i))
      .style("margin-right", "6px");
    li.append("span").text(d.param);
  });

  liveValuesContainer
    .append("div")
    .attr("id", "live-time-display")
    .style("margin-bottom", "8px")
    .html("<strong>Current Time: --:--:--</strong>");

  const liveVitals = liveValuesContainer.append("div").attr("class", "live-section").html("<strong>Live Values (Vitals):</strong>");
  currentVitals.forEach((d) => {
    liveVitals.append("div").attr("id", `live-${sanitizeParam(d.param)}`).text(`${d.param}: –`);
  });

  const liveInters = liveValuesContainer.append("div").attr("class", "live-section").style("margin-top", "12px").html("<strong>Live Values (Interventions):</strong>");
  currentInters.forEach((d) => {
    liveInters.append("div").attr("id", `live-inter-${sanitizeParam(d.param)}`).text(`${d.param}: –`);
  });
}

function drawCharts() {
  // Vitals
  vitalSVG.append("g").attr("class", "x grid").attr("transform", `translate(0, ${chartHeight})`).call(xGridVitals);
  vitalSVG.append("g").attr("class", "y grid").call(yGridVitals);
  vitalSVG.append("g").attr("class", "x axis").attr("transform", `translate(0, ${chartHeight})`).call(xAxisVitals);
  vitalSVG.append("g").attr("class", "y axis").call(yAxisVitals);

  vitalSVG
    .append("line")
    .attr("id", "vital-time-indicator")
    .attr("x1", effectiveChartWidth)
    .attr("x2", effectiveChartWidth)
    .attr("y1", 0)
    .attr("y2", chartHeight)
    .attr("stroke", "black")
    .attr("stroke-width", 1);

  vitalSVG
    .append("text")
    .attr("class", "chart-title")
    .attr("x", effectiveChartWidth / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .text("Vitals");

  currentVitals.forEach((d, i) => {
    vitalSVG
      .append("path")
      .datum(d.values)
      .attr("class", "vital-line")
      .attr("id", `vital-path-${sanitizeParam(d.param)}`)
      .attr("fill", "none")
      .attr("stroke", vitalColor(i))
      .attr("stroke-width", 2);
  });

  vitalSVG
    .append("rect")
    .attr("class", "ekg-border")
    .attr("x", -margin_ekg.left + 5)
    .attr("y", -margin_ekg.top + 5)
    .attr("width", chartWidth + margin_ekg.left + margin_ekg.right - 10)
    .attr("height", chartHeight + margin_ekg.top + margin_ekg.bottom - 10)
    .attr("fill", "none")
    .attr("stroke", "#000")
    .attr("stroke-width", 2);

  // Interventions
  interSVG.append("g").attr("class", "x grid").attr("transform", `translate(0, ${interChartHeight})`).call(xGridInter);
  interSVG.append("g").attr("class", "y grid").call(yGridInter);
  interSVG.append("g").attr("class", "x axis").attr("transform", `translate(0, ${interChartHeight})`).call(xAxisInter);
  interSVG.append("g").attr("class", "y axis").call(yAxisInter);

  interSVG
    .append("line")
    .attr("id", "inter-time-indicator")
    .attr("x1", effectiveChartWidth)
    .attr("x2", effectiveChartWidth)
    .attr("y1", 0)
    .attr("y2", interChartHeight)
    .attr("stroke", "black")
    .attr("stroke-width", 1);

  interSVG
    .append("text")
    .attr("class", "chart-title")
    .attr("x", effectiveChartWidth / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .text("Interventions");

  currentInters.forEach((d, i) => {
    interSVG
      .append("path")
      .datum(d.values)
      .attr("class", "inter-line")
      .attr("id", `inter-path-${sanitizeParam(d.param)}`)
      .attr("fill", "none")
      .attr("stroke", interColor(i))
      .attr("stroke-width", 2);
  });

  interSVG
    .append("rect")
    .attr("class", "ekg-border")
    .attr("x", -margin_ekg.left + 5)
    .attr("y", -margin_ekg.top + 5)
    .attr("width", chartWidth + margin_ekg.left + margin_ekg.right - 10)
    .attr("height", interChartHeight + margin_ekg.top + margin_ekg.bottom - 10)
    .attr("fill", "none")
    .attr("stroke", "#000")
    .attr("stroke-width", 2);
}

function updateCharts(startTime) {
  const windowStart = startTime;
  const windowEnd = startTime + WINDOW_SIZE;

  xScaleVitals.domain([windowStart, windowEnd]);
  xScaleInter.domain([windowStart, windowEnd]);

  vitalSVG.select(".x.axis").call(xAxisVitals);
  vitalSVG.select(".y.axis").call(yAxisVitals);
  vitalSVG.select(".x.grid").call(xGridVitals);
  vitalSVG.select(".y.grid").call(yGridVitals);

  interSVG.select(".x.axis").call(xAxisInter);
  interSVG.select(".y.axis").call(yAxisInter);
  interSVG.select(".x.grid").call(xGridInter);
  interSVG.select(".y.grid").call(yGridInter);

  vitalSVG
    .select("#vital-time-indicator")
    .attr("x1", xScaleVitals(windowStart))
    .attr("x2", xScaleVitals(windowStart));

  interSVG
    .select("#inter-time-indicator")
    .attr("x1", xScaleInter(windowStart))
    .attr("x2", xScaleInter(windowStart));

  currentVitals.forEach((d) => {
    const filtered = d.values.filter((v) => v.time >= windowStart && v.time <= windowEnd);
    const lineGen = d3
      .line()
      .x((v) => xScaleVitals(v.time))
      .y((v) => yScaleVitals(v.value))
      .curve(d3.curveMonotoneX);

    vitalSVG.select(`#vital-path-${sanitizeParam(d.param)}`).datum(filtered).attr("d", lineGen);
  });

  currentInters.forEach((d) => {
    const filtered = d.values.filter((v) => v.time >= windowStart && v.time <= windowEnd);
    const lineGen = d3
      .line()
      .x((v) => xScaleInter(v.time))
      .y((v) => yScaleInter(v.value))
      .curve(d3.curveStepAfter);

    interSVG.select(`#inter-path-${sanitizeParam(d.param)}`).datum(filtered).attr("d", lineGen);
  });

  currentVitals.forEach((d) => {
    const upToWindow = d.values.filter((v) => v.time <= windowEnd);
    const lastPoint = upToWindow.length ? upToWindow[upToWindow.length - 1] : null;
    const text = lastPoint ? lastPoint.value.toFixed(1) : "–";
    d3.select(`#live-${sanitizeParam(d.param)}`).text(`${d.param}: ${text}`);
  });

  currentInters.forEach((d) => {
    const upToWindow = d.values.filter((v) => v.time <= windowEnd);
    const lastPoint = upToWindow.length ? upToWindow[upToWindow.length - 1] : null;
    const text = lastPoint ? lastPoint.value : "–";
    d3.select(`#live-inter-${sanitizeParam(d.param)}`).text(`${d.param}: ${text}`);
  });

  const timeStr = formatHMS(windowStart);
  d3.select("#live-time-display").html(`<strong>Current Time: ${timeStr}</strong>`);

  slider.property("value", windowStart);
}

playBtn.on("click", () => {
  if (playInterval) return;

  playBtn.property("disabled", true);
  pauseBtn.property("disabled", false);

  playInterval = setInterval(() => {
    currentTime += playSpeed;
    if (currentTime > duration - WINDOW_SIZE) {
      currentTime = duration - WINDOW_SIZE;
      stopAnimation();
    }
    updateCharts(currentTime);
  }, 1000);
});

pauseBtn.on("click", () => {
  stopAnimation();
});

fasterBtn.on("click", () => {
  playSpeed = playSpeed + 20;
  console.log("Playback speed is now ×" + playSpeed);
});

resetBtn.on("click", () => {
  // 1) Stop any ongoing animation
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }

  // 2) Reset speed back to 100 (your original baseline)
  playSpeed = 100;

  // 3) Reset time to 0, update slider & chart
  currentTime = 0;
  slider.property("value", 0);
  updateCharts(0);

  // 4) Re‐enable/disable buttons so the user can Play again
  playBtn.property("disabled", false);
  pauseBtn.property("disabled", true);

  console.log("Reset: speed=100, time=0, playback paused");
});


function stopAnimation() {
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
    playBtn.property("disabled", false);
    pauseBtn.property("disabled", true);
  }
}

// ----------------------------------------------------------
// 6) POST-OP GIF (click to reveal discharge summary)
// ----------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const gif = document.getElementById("postOpGif");
  const summaryBox = document.getElementById("dischargeSummary");

  if (gif && summaryBox) {
    gif.addEventListener("click", () => {
      if (!selectedCase) {
        summaryBox.classList.remove("hidden");
        summaryBox.classList.add("visible");
        summaryBox.textContent = "Please select a case first.";
        return;
      }

      summaryBox.classList.remove("hidden");
      summaryBox.classList.add("visible");
      summaryBox.innerHTML = "";

      const admDays = (selectedCase.adm / (60 * 60 * 24)).toFixed(1);
      const disDays = (selectedCase.dis / (60 * 60 * 24)).toFixed(1);

      const outcomeText = selectedCase.death_inhosp
        ? "❌ Patient did not survive the hospital stay."
        : "✅ Patient discharged in stable condition.";

      const dischargeText = `
        <h3 class="summary-title">📋 Discharge Summary</h3>
        <div class="summary-row"><strong>🕐 Admission:</strong> ${admDays} days from surgery start</div>
        <div class="summary-row"><strong>📤 Discharge:</strong> ${disDays} days from surgery start</div>
        <div class="summary-row"><strong>🏥 Post-op Stay:</strong> ${selectedCase.los_postop ?? "N/A"} days</div>
        <div class="summary-row"><strong>🛌 ICU Stay:</strong> ${selectedCase.icu_days ?? "N/A"} days</div>
      `;

      const outcomeDiv = document.getElementById("outcome-text");
      outcomeDiv.textContent = outcomeText;

      summaryBox.innerHTML = dischargeText;
    });
  }
});

// ----------------------------------------------------------
// 7) Time‐Series Scatterplot & Global Heatmap
// ----------------------------------------------------------
const VITALS_URL = 'images/vital_data.json';
const PROXY_URL = 'images/proxy_drug_data.json';

const caseSelect2 = d3.select('#caseDropdown');  // same dropdown as above
const xSelect = d3.select('#param-x');
const ySelect = d3.select('#param-y');

const svgScatter = d3.select('#scatterplot');
svgScatter.attr("width", 900).attr("height", 600);

const tooltip2 = d3.select('#tooltip-heatmap');
const heatmapSvg = d3.select('#heatmap');

const margin2 = { top: 40, right: 40, bottom: 60, left: 60 };

// 7a) Load vital & proxy data once, then prepare global heatmap & attach scatter logic
Promise.all([d3.json(VITALS_URL), d3.json(PROXY_URL)])
  .then(([vData, pData]) => {
    vitalData = vData;
    proxyData = pData;

    // We already have caseData (first 5 cases). Grab their IDs:
    const caseIDs = caseData.slice(0, 5).map(d => String(d.caseid));

    // 1) Gather every unique param key from both vitalData & proxyData:
    const paramSet = new Set();
    caseIDs.forEach(c => {
      if (vitalData[c])    Object.keys(vitalData[c]).forEach(k => paramSet.add(k));
      if (proxyData[c])    Object.keys(proxyData[c]).forEach(k => paramSet.add(k));
    });

    // 2) Create a small Set of the four keys we want to drop:
    const exclude = new Set([
      "Cardiac Output",
      "Central Venous Pressure",
      "Respiratory Rate",
      "Stroke Volume"
    ]);

    // 3) Filter those out, then sort the remainder into allParamKeys:
    allParamKeys = Array.from(paramSet)
                         .filter(k => !exclude.has(k))
                         .sort();

    // 4) Now compute correlations & draw the heatmap using only the filtered list:
    computeGlobalCorrelation(caseIDs);
    drawHeatmap();

    // 5) Finally hook up scatterplot listeners, etc.—unchanged from before:
    caseSelect2.on('change', () => {
      updateParamOptions();
      plotScatter();
    });
    xSelect.on('change', plotScatter);
    ySelect.on('change', plotScatter);

    updateParamOptions();
    plotScatter();
  })
  .catch(err => console.error("Error loading VITALS_URL or PROXY_URL:", err));


function updateParamOptions() {
  const caseID = caseSelect2.property('value');

  // 1) Grab whatever raw keys exist for that case:
  let vitalKeys = Object.keys(vitalData[caseID] || {});
  let proxyKeys = Object.keys(proxyData[caseID] || {});

  // 2) Filter them so that only keys present in allParamKeys remain:
  vitalKeys = vitalKeys.filter(k => allParamKeys.includes(k));
  proxyKeys = proxyKeys.filter(k => allParamKeys.includes(k));

  // 3) Clear out any old <option> nodes:
  xSelect.html(null);
  ySelect.html(null);

  // 4) A small helper to append an <optgroup> + options for each key array:
  function addOptions(selectElem, groupName, keys) {
    if (!keys || keys.length === 0) return;
    const og = selectElem.append('optgroup')
                        .attr('label', groupName);
    og.selectAll('option')
      .data(keys.sort())
      .enter()
      .append('option')
        .attr('value', d => d)
        .text(d => d);
  }

  // 5) Only keys that survived the filter get appended:
  addOptions(xSelect, 'Patient Vitals', vitalKeys);
  addOptions(xSelect, 'Ventilator & Infusion Settings', proxyKeys);
  addOptions(ySelect, 'Patient Vitals', vitalKeys);
  addOptions(ySelect, 'Ventilator & Infusion Settings', proxyKeys);

  // 6) If there is at least one <option>, pick a sensible default:
  const allXOpts = xSelect.selectAll('option').nodes();
  if (allXOpts.length) xSelect.property('value', allXOpts[0].value);

  const allYOpts = ySelect.selectAll('option').nodes();
  if (allYOpts.length) {
    // default to the second if it exists, otherwise the first
    ySelect.property('value', allYOpts[1] ? allYOpts[1].value : allYOpts[0].value);
  }
}


function plotScatter() {
  const caseID = caseSelect2.property('value');
  const paramX = xSelect.property('value');
  const paramY = ySelect.property('value');

  if (!caseID || !paramX || !paramY) return;

  const svg = d3.select('#scatterplot');
  const rawWidth = +svg.attr('width') || 800;
  const rawHeight = +svg.attr('height') || 500;
  const width = rawWidth - margin2.left - margin2.right;
  const height = rawHeight - margin2.top - margin2.bottom;

  // Remove old plot group, if any
  svg.selectAll('g.plot-area').remove();

  const g = svg
    .append('g')
    .attr('class', 'plot-area')
    .attr('transform', `translate(${margin2.left},${margin2.top})`);

  const xAxisG = g.append('g').attr('transform', `translate(0, ${height})`);
  const yAxisG = g.append('g');

  const xRaw = (vitalData[caseID] && vitalData[caseID][paramX]) ||
               (proxyData[caseID] && proxyData[caseID][paramX]) ||
               [];
  const yRaw = (vitalData[caseID] && vitalData[caseID][paramY]) ||
               (proxyData[caseID] && proxyData[caseID][paramY]) ||
               [];

  const yMap = new Map(yRaw.map(d => [d.time, +d.value]));

  const points = xRaw
    .map(d => {
      const yv = yMap.get(d.time);
      return yv != null ? { t: d.time, x: +d.value, y: +yv } : null;
    })
    .filter(d => d !== null);

  if (points.length === 0) {
    xAxisG.call(d3.axisBottom(d3.scaleLinear().range([0, width])).ticks(0));
    yAxisG.call(d3.axisLeft(d3.scaleLinear().range([height, 0])).ticks(0));
    return;
  }

  const xVals = points.map(d => d.x);
  const yVals = points.map(d => d.y);

  const xScaleLocal = d3.scaleLinear().range([0, width]).domain([d3.min(xVals), d3.max(xVals)]).nice();
  const yScaleLocal = d3.scaleLinear().range([height, 0]).domain([d3.min(yVals), d3.max(yVals)]).nice();

  xAxisG.transition().duration(200).call(d3.axisBottom(xScaleLocal).ticks(6));
  yAxisG.transition().duration(200).call(d3.axisLeft(yScaleLocal).ticks(6));

  g.append('text')
    .attr('class', 'x-label')
    .attr('x', width / 2)
    .attr('y', height + 45)
    .attr('text-anchor', 'middle')
    .style('font-weight', '600')
    .text(`${paramX}`);

  g.append('text')
    .attr('class', 'y-label')
    .attr('x', -height / 2)
    .attr('y', -45)
    .attr('transform', 'rotate(-90)')
    .attr('text-anchor', 'middle')
    .style('font-weight', '600')
    .text(`${paramY}`);

  const dots = g.selectAll('.dot')
    .data(points, d => d.t);

  // ENTER
  const dotsEnter = dots.enter()
    .append('circle')
    .attr('class', 'dot')
    .attr('cx', d => xScaleLocal(d.x))
    .attr('cy', d => yScaleLocal(d.y))
    .attr('r', 0)
    .attr('fill', '#1f77b4')
    .attr('opacity', 0.75)
    .on('mouseover', (event, d) => {
      const timeStr = formatSecondsToMMSS(d.t);
      tooltip2
        .style('visibility', 'visible')
        .html(`
          <div><strong>Time:</strong> ${timeStr}</div>
          <div><strong>${paramX}:</strong> ${d.x}</div>
          <div><strong>${paramY}:</strong> ${d.y}</div>
        `);
    })
    .on('mousemove', (event) => {
      tooltip2
        .style('top', event.pageY + 10 + 'px')
        .style('left', event.pageX + 10 + 'px');
    })
    .on('mouseout', () => {
      tooltip2.style('visibility', 'hidden');
    });

  // ENTER + UPDATE
  dotsEnter.merge(dots)
    .transition()
    .duration(400)
    .attr('cx', d => xScaleLocal(d.x))
    .attr('cy', d => yScaleLocal(d.y))
    .attr('r', 4);

  // EXIT
  dots.exit()
    .transition()
    .duration(300)
    .attr('r', 0)
    .remove();
}

function computeGlobalCorrelation(caseIDs) {
  function pearsonCorr(arrA, arrB) {
    const bMap = new Map(arrB.map(d => [d.time, +d.value]));
    const pairs = [];
    arrA.forEach(d => {
      const yv = bMap.get(d.time);
      if (yv != null) {
        pairs.push([+d.value, yv]);
      }
    });
    if (pairs.length < 2) return null;
    const meanX = d3.mean(pairs, d => d[0]);
    const meanY = d3.mean(pairs, d => d[1]);
    let num = 0, denX = 0, denY = 0;
    pairs.forEach(([xv, yv]) => {
      const dx = xv - meanX;
      const dy = yv - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    });
    if (denX === 0 || denY === 0) return 0;
    return num / Math.sqrt(denX * denY);
  }

  for (let i = 0; i < allParamKeys.length; i++) {
    for (let j = i; j < allParamKeys.length; j++) {
      const keyA = allParamKeys[i];
      const keyB = allParamKeys[j];
      const corrVals = [];

      caseIDs.forEach(c => {
        const seriesA = (vitalData[c] && vitalData[c][keyA]) || (proxyData[c] && proxyData[c][keyA]) || [];
        const seriesB = (vitalData[c] && vitalData[c][keyB]) || (proxyData[c] && proxyData[c][keyB]) || [];
        if (seriesA.length > 1 && seriesB.length > 1) {
          const r = pearsonCorr(seriesA, seriesB);
          if (r !== null) corrVals.push(r);
        }
      });

      let avgR = 0;
      if (corrVals.length > 0) {
        avgR = d3.mean(corrVals);
      }
      globalCorrMatrix[`${keyA}||${keyB}`] = avgR;
      globalCorrMatrix[`${keyB}||${keyA}`] = avgR;
    }
  }

  allParamKeys.forEach(k => {
    globalCorrMatrix[`${k}||${k}`] = 1.0;
  });
}

function drawHeatmap() {
  const n = allParamKeys.length;
  if (n === 0) return;

  const cellSize = 30;
  const marginLeft = 150;
  const marginTop = 180;
  const marginRight = 100;
  const marginBottom = 50;

  const gridWidth = n * cellSize;
  const gridHeight = n * cellSize;

  // Resize the <svg id="heatmap"> to fit
  heatmapSvg
    .attr('width', marginLeft + gridWidth + marginRight)
    .attr('height', marginTop + gridHeight + marginBottom);

  // Clear any old contents
  heatmapSvg.selectAll('*').remove();

  // Create a <g> group at the correct translate
  const hmG = heatmapSvg
    .append('g')
    .attr('transform', `translate(${marginLeft}, ${marginTop})`);

  // Use a red‐to‐blue sequential scale on [-1, 1]
  const colorScale = d3.scaleSequential(d3.interpolateRdBu).domain([1, -1]);

  // Build a flat array of { i, j, value } for every cell
  const cells = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const keyA = allParamKeys[i];
      const keyB = allParamKeys[j];
      const r = globalCorrMatrix[`${keyA}||${keyB}`] || 0;
      cells.push({ i, j, value: r });
    }
  }

  // Append one <rect> per cell
  hmG.selectAll('rect')
    .data(cells)
    .enter()
    .append('rect')
      .attr('x', d => d.j * cellSize)
      .attr('y', d => d.i * cellSize)
      .attr('width', cellSize)
      .attr('height', cellSize)
      .style('fill', d => colorScale(d.value))
      .style('stroke', '#eee')

      // ← THIS IS THE NEW BIT: on click, load these two params into the scatter dropdowns
      .on('click', function(event, d) {
        // d.i is the row index → param name at allParamKeys[i]
        // d.j is the column index → param name at allParamKeys[j]
        const xName = allParamKeys[d.j];
        const yName = allParamKeys[d.i];

        // Programmatically set the two <select> elements:
        d3.select('#param-x').property('value', xName);
        d3.select('#param-y').property('value', yName);

        // Now re‐draw the scatterplot with those two new variables:
        plotScatter();
      });

  // Append row labels on the left
  heatmapSvg.append('g')
    .attr('transform', `translate(${marginLeft - 10}, ${marginTop})`)
    .selectAll('text')
    .data(allParamKeys)
    .enter()
    .append('text')
      .attr('x', 0)
      .attr('y', (d, i) => i * cellSize + cellSize / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('class', 'heatmap-label')
      .text(d => d);

  // Append column labels along the top (rotated -90°)
  heatmapSvg.append('g')
    .attr('transform', `translate(${marginLeft}, ${marginTop - 10})`)
    .selectAll('text')
    .data(allParamKeys)
    .enter()
    .append('text')
      .attr('x', (d, i) => i * cellSize + cellSize / 2)
      .attr('y', 0)
      .attr('text-anchor', 'start')
      .attr('transform', (d, i) => {
        const x = i * cellSize + cellSize / 2;
        const y = 0;
        return `rotate(-90, ${x}, ${y})`;
      })
      .attr('class', 'heatmap-label')
      .text(d => d);

  // Draw color‐scale legend to the right
  const legendX = marginLeft + n * cellSize + 20;
  const legendY = marginTop;
  const legendHeight = gridHeight;
  const legendWidth = 20;

  const defs = heatmapSvg.append('defs');
  const linearGradient = defs.append('linearGradient')
    .attr('id', 'corr-gradient')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');

  linearGradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', d3.interpolateRdBu(0));
  linearGradient.append('stop')
    .attr('offset', '50%')
    .attr('stop-color', d3.interpolateRdBu(0.5));
  linearGradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', d3.interpolateRdBu(1));

  heatmapSvg.append('rect')
    .attr('x', legendX)
    .attr('y', legendY)
    .attr('width', legendWidth)
    .attr('height', legendHeight)
    .style('fill', 'url(#corr-gradient)');

  const legendScale = d3.scaleLinear()
    .domain([1, -1])
    .range([legendY, legendY + legendHeight]);

  const legendAxis = d3.axisRight(legendScale)
    .ticks(5)
    .tickFormat(d => d.toFixed(1));

  heatmapSvg.append('g')
    .attr('transform', `translate(${legendX + legendWidth}, 0)`)
    .call(legendAxis)
    .selectAll('text')
    .style('font-size', '10px');
}


function formatSecondsToMMSS(sec) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

// ----------------------------------------------------------
// 8) AGE SLIDER Handling
// ----------------------------------------------------------
const ageMinInput = document.getElementById('ageMin');
const ageMaxInput = document.getElementById('ageMax');
const ageValueSpan = document.getElementById('ageValue');

function updateAgeDisplay(event) {
  const minAge = parseInt(ageMinInput.value);
  const maxAge = parseInt(ageMaxInput.value);

  if (minAge > maxAge) {
    if (event.target === ageMinInput) ageMaxInput.value = minAge;
    else ageMinInput.value = maxAge;
  }

  ageValueSpan.textContent = `${ageMinInput.value} - ${ageMaxInput.value}`;
  updateChart();
}

ageMinInput.addEventListener('input', updateAgeDisplay);
ageMaxInput.addEventListener('input', updateAgeDisplay);

// ----------------------------------------------------------
// 9) SCROLL INDICATOR
// ----------------------------------------------------------
window.addEventListener("scroll", () => {
  const scrollTop = window.scrollY;
  const docHeight = document.body.scrollHeight - window.innerHeight;
  const scrolled = (scrollTop / docHeight) * 100;
  document.getElementById("scroll-bar").style.width = `${scrolled}%`;
});

// ----------------------------------------------------------
// 10) BMI SLIDER Handling
// ----------------------------------------------------------
d3.selectAll('#bmiMin, #bmiMax').on('input', () => {
  const min = +d3.select('#bmiMin').property('value');
  const max = +d3.select('#bmiMax').property('value');
  d3.select('#bmiValue').text(`${min} - ${max}`);
  updateChart();
});
