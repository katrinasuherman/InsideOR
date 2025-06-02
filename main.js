
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

  const line1 = document.getElementById("line1");
  const line2 = document.getElementById("line2");
  const caseSelector = document.getElementById("case-selector");

  // Reveal line2 after line1 is visible
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
          lineObserver.unobserve(line1);
        }
      });
    }, { threshold: 0.5 });

    lineObserver.observe(line1);
  }

  // Reveal case selector when line2 appears
  if (line2 && caseSelector) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          caseSelector.style.display = "flex";
          observer.unobserve(line2);
        }
      });
    }, { threshold: 0.5 });

    observer.observe(line2);
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
  
    // 🔽 Scroll to the case explorer section
    const nextSection = document.getElementById("case-explorer");
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: "smooth" });
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

const WINDOW_SIZE = 600;

let playInterval = null;

let playSpeed = 100;
const NORMAL_SPEED = 10;

const margin = { top: 40, right: 20, bottom: 40, left: 60 };

const RIGHT_PADDING = 30;
const totalWidth = 1150;
const totalHeight = 400;
const chartWidth = totalWidth - margin.left - margin.right;
const chartHeight = totalHeight - margin.top - margin.bottom;
const interChartHeight = totalHeight - margin.top - margin.bottom;

const effectiveChartWidth = chartWidth - RIGHT_PADDING;

const vitalColor = d3.scaleOrdinal(d3.schemeTableau10);
const interColor = d3.scaleOrdinal(d3.schemeSet2);

const liveValuesContainer = d3.select("#live-values");
const caseSelect = d3.select("#case-select");
const playBtn = d3.select("#play-btn");
const pauseBtn = d3.select("#pause-btn");
const slider = d3.select("#time-slider");

let allVitalData = {};
let allInterData = {};
let currentCaseID = null;
let currentVitals = [];
let currentInters = [];
let duration = 0;
let currentTime = 0;

let xScaleVitals, yScaleVitals, xAxisVitals, yAxisVitals, xGridVitals, yGridVitals;
let xScaleInter, yScaleInter, xAxisInter, yAxisInter, xGridInter, yGridInter;

const vitalSVG = d3
  .select("#vital-chart")
  .append("svg")
  .attr("width", chartWidth + margin.left + margin.right)
  .attr("height", chartHeight + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const interSVG = d3
  .select("#intervention-chart")
  .append("svg")
  .attr("width", chartWidth + margin.left + margin.right)
  .attr("height", interChartHeight + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

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

Promise.all([d3.json("vital_data.json"), d3.json("proxy_drug_data.json")])
  .then(([vitalDataJSON, interDataJSON]) => {
    allVitalData = vitalDataJSON;
    allInterData = interDataJSON;

    const dropdown = document.getElementById("caseDropdown");

    dropdown.addEventListener("change", () => {
      const selectedId = dropdown.value;
      resetAndDrawForCase(selectedId);
    });
    
    // Optional: auto-initialize if dropdown already populated
    if (dropdown.value) {
      resetAndDrawForCase(dropdown.value);
    }
    
  })
  .catch((error) => {
    console.error("Error loading data:", error);
  });

function resetAndDrawForCase(caseID) {
  stopAnimation();
  vitalSVG.selectAll("*").remove();
  interSVG.selectAll("*").remove();
  liveValuesContainer.selectAll("*").remove();

  currentVitals = Object.entries(allVitalData[caseID]).map(([param, arr]) => ({
    param: param,
    values: arr.map((d) => ({ time: +d.time, value: +d.value })),
  }));

  currentInters = Object.entries(allInterData[caseID]).map(([param, arr]) => ({
    param: param,
    values: arr.map((d) => ({ time: +d.time, value: +d.value })),
  }));

  duration = d3.max(currentVitals, (d) => d3.max(d.values, (v) => v.time));
  currentTime = 0;

  slider.attr("min", 0).attr("max", Math.max(0, duration - WINDOW_SIZE)).attr("step", 1).property("value", 0);

  slider.on("input", () => {
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
  const yMin = d3.min(allVals) * 0.9;
  const yMax = d3.max(allVals) * 1.1;

  yScaleVitals = d3.scaleLinear().domain([yMin, yMax]).range([chartHeight, 0]);

  xAxisVitals = d3.axisBottom(xScaleVitals).ticks(6).tickFormat(formatHMS);

  yAxisVitals = d3.axisLeft(yScaleVitals).ticks(6);

  xGridVitals = d3.axisBottom(xScaleVitals).tickSize(-chartHeight).tickFormat("").ticks(6);

  yGridVitals = d3.axisLeft(yScaleVitals).tickSize(-effectiveChartWidth).tickFormat("").ticks(6);
}

function configureInterScales() {
  xScaleInter = d3.scaleLinear().domain([0, WINDOW_SIZE]).range([0, effectiveChartWidth]);

  const allVals = currentInters.flatMap((d) => d.values.map((v) => v.value));
  const yMax = d3.max(allVals) * 1.1;

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
    .attr("x", -margin.left + 5)
    .attr("y", -margin.top + 5)
    .attr("width", chartWidth + margin.left + margin.right - 10)
    .attr("height", chartHeight + margin.top + margin.bottom - 10)
    .attr("fill", "none")
    .attr("stroke", "#000")
    .attr("stroke-width", 2);

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
    .attr("x", -margin.left + 5)
    .attr("y", -margin.top + 5)
    .attr("width", chartWidth + margin.left + margin.right - 10)
    .attr("height", interChartHeight + margin.top + margin.bottom - 10)
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

function stopAnimation() {
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
    playBtn.property("disabled", false);
    pauseBtn.property("disabled", true);
  }
}