import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

async function loadData() {
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

const data = await loadData();
updateChart();

d3.selectAll('#controls select, #controls input[name="xType"], #emergencyToggle, #showMale, #showFemale')
  .on('change', updateChart);

function updateChart() {
  const yVar = d3.select('#ySelect').property('value');
  const xType = d3.select('input[name="xType"]:checked').property('value');
  const xVar = xType === 'quant'
    ? d3.select('#xQuantSelect').property('value')
    : d3.select('#xCatSelect').property('value');
  const showEmergencyOnly = d3.select("#emergencyToggle").property("checked");
  const showMale = d3.select("#showMale").property("checked");
  const showFemale = d3.select("#showFemale").property("checked");

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
    return true;
  });

  const avgY = d3.mean(filtered, d => d[yVar]);
  const summaryText = filtered.length && avgY !== undefined
    ? `${filtered.length} patients | Avg ${yVar.replace('_', ' ')}: ${avgY.toFixed(1)}`
    : `No matching data.`;
  d3.select("#summary").text(summaryText);

  if (xType === 'quant') {
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
  } else {
    const categories = [...new Set(filtered.map(d => d[xVar]))];
    const x = d3.scaleBand()
      .domain(categories)
      .range([0, innerWidth])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(filtered, d => +d[yVar])]).nice()
      .range([innerHeight, 0]);

    chart.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'rotate(-40)')
      .style('text-anchor', 'end');

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
      .attr('cx', d => x(d[xVar]) + x.bandwidth() / 2)
      .attr('cy', d => y(d[yVar]))
      .attr('r', 4)
      .attr('fill', 'tomato')
      .attr('opacity', 0.6);
  }
}
