/* ═══════════════════════════════════════════════════════════════
   OptiGreeks — Main Application Controller
   ═══════════════════════════════════════════════════════════════ */

import { blackScholesPrice, calculateGreeks } from './blackScholes.js';

// ─── Chart.js defaults ───
const chartColors = {
  blue: { line: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
  cyan: { line: '#22d3ee', bg: 'rgba(34,211,238,0.08)' },
  purple: { line: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
  orange: { line: '#fb923c', bg: 'rgba(251,146,60,0.08)' },
  red: { line: '#f87171', bg: 'rgba(248,113,113,0.08)' },
  green: { line: '#34d399', bg: 'rgba(52,211,153,0.08)' },
  pink: { line: '#f472b6', bg: 'rgba(244,114,182,0.08)' },
  white: { line: '#e2e8f0', bg: 'rgba(226,232,240,0.05)' },
};

const chartPalette = [chartColors.blue, chartColors.cyan, chartColors.purple, chartColors.orange, chartColors.red, chartColors.green];

function defaultChartOpts(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400, easing: 'easeOutCubic' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.9)',
        borderColor: 'rgba(99,102,241,0.2)',
        borderWidth: 1,
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        titleFont: { family: 'Inter', weight: '600' },
        bodyFont: { family: 'JetBrains Mono', size: 12 },
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(148,163,184,0.06)' },
        ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
        border: { color: 'rgba(148,163,184,0.1)' },
      },
      y: {
        grid: { color: 'rgba(148,163,184,0.06)' },
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 11 } },
        border: { color: 'rgba(148,163,184,0.1)' },
      },
    },
    elements: {
      point: { radius: 0, hoverRadius: 4 },
      line: { tension: 0.3, borderWidth: 2.5 },
    },
    ...extra,
  };
}

function makeLineDataset(label, data, colorObj) {
  return {
    label,
    data,
    borderColor: colorObj.line,
    backgroundColor: colorObj.bg,
    fill: true,
  };
}

// ─── Helpers ───
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function linspace(min, max, n) {
  const step = (max - min) / (n - 1);
  return Array.from({ length: n }, (_, i) => min + step * i);
}

function fmt(val, digits = 4) {
  return val.toFixed(digits);
}

// ──────────────────────────────────────────────────────────────
//  NAVIGATION
// ──────────────────────────────────────────────────────────────
const modeConfig = {
  single: { title: 'Single Option Analysis', subtitle: 'Adjust parameters to see real-time pricing & Greeks' },
  compare: { title: 'Compare Two Options', subtitle: 'Side-by-side analysis of two options' },
  strategy: { title: 'Strategy Builder', subtitle: 'Build & visualise a two-leg options strategy' },
};

let currentMode = 'single';

$$('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    if (mode === currentMode) return;
    currentMode = mode;

    // Update nav
    $$('.nav-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    // Update panels
    $$('.mode-panel').forEach((p) => p.classList.remove('active'));
    $(`#panel-${mode}`).classList.add('active');

    // Update header
    $('#page-title').textContent = modeConfig[mode].title;
    $('.header-subtitle').textContent = modeConfig[mode].subtitle;

    // Recalculate
    if (mode === 'single') singleRecalc();
    else if (mode === 'compare') compareRecalc();
    else strategyRecalc();

    // Close mobile sidebar
    $('#sidebar').classList.remove('open');
  });
});

// Mobile menu
$('#menu-toggle').addEventListener('click', () => {
  $('#sidebar').classList.toggle('open');
});

// ──────────────────────────────────────────────────────────────
//  GLOBAL DEFAULTS — sidebar sliders
// ──────────────────────────────────────────────────────────────
function globalSpot() { return parseFloat($('#g-spot').value) || 100; }
function globalVol() { return parseInt($('#g-vol').value) / 100; }
function globalRate() { return parseInt($('#g-rate').value) / 1000; }
function globalTime() { return parseInt($('#g-time').value) / 100; }

function updateGlobalLabels() {
  $('#g-vol-val').textContent = `${$('#g-vol').value}%`;
  $('#g-rate-val').textContent = `${(parseInt($('#g-rate').value) / 10).toFixed(1)}%`;
  $('#g-time-val').textContent = `${(parseInt($('#g-time').value) / 100).toFixed(2)}y`;
}

$('#g-vol').addEventListener('input', updateGlobalLabels);
$('#g-rate').addEventListener('input', updateGlobalLabels);
$('#g-time').addEventListener('input', updateGlobalLabels);

// ──────────────────────────────────────────────────────────────
//  COLLAPSIBLES
// ──────────────────────────────────────────────────────────────
function setupCollapsible(toggleId, bodyId) {
  const toggle = $(toggleId);
  const body = $(bodyId);
  toggle.addEventListener('click', () => {
    body.classList.toggle('open');
    toggle.querySelector('.collapse-icon').classList.toggle('collapsed');
  });
}
setupCollapsible('#s-pnl-toggle', '#s-pnl-body');
setupCollapsible('#s-greeks-toggle', '#s-greeks-body');

// ──────────────────────────────────────────────────────────────
//  TYPE TOGGLE (call/put)
// ──────────────────────────────────────────────────────────────
function getToggleVal(toggleId) {
  const active = $(`${toggleId} .toggle-btn.active`);
  return active ? active.dataset.val : 'call';
}

function setupToggle(toggleId, onChange) {
  const container = $(toggleId);
  container.querySelectorAll('.toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.toggle-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onChange();
    });
  });
}

// ══════════════════════════════════════════════════════════════
//  MODE 1: SINGLE OPTION
// ══════════════════════════════════════════════════════════════

// Chart instances
let sCharts = {};

function singleGetParams() {
  return {
    S: parseFloat($('#s-spot').value) || 100,
    K: parseFloat($('#s-strike').value) || 105,
    T: parseInt($('#s-time').value) / 100,
    r: parseInt($('#s-rate').value) / 1000,
    sigma: parseInt($('#s-vol').value) / 100,
    type: getToggleVal('#s-type-toggle'),
  };
}

function singleUpdateLabels() {
  $('#s-time-val').textContent = `${(parseInt($('#s-time').value) / 100).toFixed(2)}y`;
  $('#s-rate-val').textContent = `${(parseInt($('#s-rate').value) / 10).toFixed(1)}%`;
  $('#s-vol-val').textContent = `${$('#s-vol').value}%`;
}

function singleRecalc() {
  const p = singleGetParams();
  singleUpdateLabels();

  // Price & Greeks
  const price = blackScholesPrice(p.S, p.K, p.T, p.r, p.sigma, p.type);
  const greeks = calculateGreeks(p.S, p.K, p.T, p.r, p.sigma, p.type);

  $('#s-m-price').textContent = `$${fmt(price)}`;
  $('#s-m-delta').textContent = fmt(greeks.delta);
  $('#s-m-gamma').textContent = fmt(greeks.gamma);
  $('#s-m-vega').textContent = fmt(greeks.vega / 100);
  $('#s-m-theta').textContent = fmt(greeks.theta / 365);
  $('#s-m-rho').textContent = fmt(greeks.rho / 100);

  // Sensitivity
  singleSensitivity(p);

  // PnL
  singlePnL(p, price);
}

function singleSensitivity(p) {
  const variable = $('#s-sensitivity-var').value;
  let xRange, xLabel;

  if (variable === 'spot') {
    xRange = linspace(p.S * 0.5, p.S * 1.5, 50);
    xLabel = 'Spot Price';
  } else if (variable === 'vol') {
    xRange = linspace(0.05, 0.8, 50);
    xLabel = 'Volatility';
  } else {
    xRange = linspace(0.01, 3.0, 50);
    xLabel = 'Time (years)';
  }

  const prices = [], deltas = [], gammas = [], vegas = [], thetas = [], rhos = [];

  for (const x of xRange) {
    let S = p.S, K = p.K, T = p.T, r = p.r, sigma = p.sigma;
    if (variable === 'spot') S = x;
    else if (variable === 'vol') sigma = x;
    else T = x;

    const pr = blackScholesPrice(S, K, T, r, sigma, p.type);
    const g = calculateGreeks(S, K, T, r, sigma, p.type);
    prices.push(pr);
    deltas.push(g.delta);
    gammas.push(g.gamma);
    vegas.push(g.vega);
    thetas.push(g.theta);
    rhos.push(g.rho);
  }

  const labels = xRange.map((v) => variable === 'vol' ? `${(v * 100).toFixed(0)}%` : v.toFixed(1));
  const datasets = [
    { id: 's-chart-price', data: prices, color: chartPalette[0] },
    { id: 's-chart-delta', data: deltas, color: chartPalette[1] },
    { id: 's-chart-gamma', data: gammas, color: chartPalette[2] },
    { id: 's-chart-vega', data: vegas, color: chartPalette[3] },
    { id: 's-chart-theta', data: thetas, color: chartPalette[4] },
    { id: 's-chart-rho', data: rhos, color: chartPalette[5] },
  ];

  for (const ds of datasets) {
    if (sCharts[ds.id]) {
      sCharts[ds.id].data.labels = labels;
      sCharts[ds.id].data.datasets[0].data = ds.data;
      sCharts[ds.id].update('none');
    } else {
      const ctx = document.getElementById(ds.id).getContext('2d');
      sCharts[ds.id] = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [makeLineDataset('', ds.data, ds.color)] },
        options: defaultChartOpts(),
      });
    }
  }
}

let sPnlChart = null;

function singlePnL(p, premium) {
  const range = linspace(p.S * 0.5, p.S * 1.5, 100);
  const payoff = range.map((s) => {
    if (p.type === 'call') return Math.max(s - p.K, 0) - premium;
    return Math.max(p.K - s, 0) - premium;
  });

  const breakeven = p.type === 'call' ? p.K + premium : p.K - premium;
  $('#s-breakeven').textContent = `Breakeven at Expiration: $${breakeven.toFixed(2)}`;

  const labels = range.map((v) => v.toFixed(1));

  // Color zones: green above 0, red below
  const colors = payoff.map((v) => v >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)');
  const borderColors = payoff.map((v) => v >= 0 ? '#34d399' : '#f87171');

  if (sPnlChart) {
    sPnlChart.data.labels = labels;
    sPnlChart.data.datasets[0].data = payoff;
    sPnlChart.data.datasets[0].backgroundColor = colors;
    sPnlChart.data.datasets[0].borderColor = borderColors;
    sPnlChart.update('none');
  } else {
    const ctx = document.getElementById('s-chart-pnl').getContext('2d');
    sPnlChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: payoff,
          borderColor: borderColors,
          backgroundColor: colors,
          fill: true,
          borderWidth: 2.5,
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 4,
          segment: {
            borderColor: (ctx2) => {
              const val = ctx2.p1.parsed.y;
              return val >= 0 ? '#34d399' : '#f87171';
            },
            backgroundColor: (ctx2) => {
              const val = ctx2.p1.parsed.y;
              return val >= 0 ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)';
            },
          },
        }],
      },
      options: {
        ...defaultChartOpts(),
        plugins: {
          ...defaultChartOpts().plugins,
          annotation: undefined,
        },
      },
    });
  }
}

// Event bindings for Single mode
['#s-spot', '#s-strike'].forEach((sel) => $(sel).addEventListener('input', singleRecalc));
['#s-time', '#s-rate', '#s-vol'].forEach((sel) => $(sel).addEventListener('input', singleRecalc));
$('#s-sensitivity-var').addEventListener('change', singleRecalc);
setupToggle('#s-type-toggle', singleRecalc);

// ══════════════════════════════════════════════════════════════
//  MODE 2: COMPARE TWO OPTIONS
// ══════════════════════════════════════════════════════════════

let cBarChart = null;
let cPayoffChart = null;

function compareGetParams(prefix) {
  return {
    S: parseFloat($(`#${prefix}-spot`).value) || 100,
    K: parseFloat($(`#${prefix}-strike`).value) || 100,
    T: parseInt($(`#${prefix}-time`).value) / 100,
    r: parseInt($(`#${prefix}-rate`).value) / 1000,
    sigma: parseInt($(`#${prefix}-vol`).value) / 100,
    type: getToggleVal(`#${prefix}-type-toggle`),
  };
}

function compareUpdateLabels() {
  ['a', 'b'].forEach((pre) => {
    $(`#${pre}-time-val`).textContent = `${(parseInt($(`#${pre}-time`).value) / 100).toFixed(2)}y`;
    $(`#${pre}-rate-val`).textContent = `${(parseInt($(`#${pre}-rate`).value) / 10).toFixed(1)}%`;
    $(`#${pre}-vol-val`).textContent = `${$(`#${pre}-vol`).value}%`;
  });
}

function compareRecalc() {
  compareUpdateLabels();

  const a = compareGetParams('a');
  const b = compareGetParams('b');

  const priceA = blackScholesPrice(a.S, a.K, a.T, a.r, a.sigma, a.type);
  const greeksA = calculateGreeks(a.S, a.K, a.T, a.r, a.sigma, a.type);

  const priceB = blackScholesPrice(b.S, b.K, b.T, b.r, b.sigma, b.type);
  const greeksB = calculateGreeks(b.S, b.K, b.T, b.r, b.sigma, b.type);

  // Table
  const rows = [
    ['Price', `$${fmt(priceA)}`, `$${fmt(priceB)}`, priceB - priceA],
    ['Delta', fmt(greeksA.delta), fmt(greeksB.delta), greeksB.delta - greeksA.delta],
    ['Gamma', fmt(greeksA.gamma), fmt(greeksB.gamma), greeksB.gamma - greeksA.gamma],
    ['Vega (per 1%)', fmt(greeksA.vega / 100), fmt(greeksB.vega / 100), (greeksB.vega - greeksA.vega) / 100],
    ['Theta (per day)', fmt(greeksA.theta / 365), fmt(greeksB.theta / 365), (greeksB.theta - greeksA.theta) / 365],
    ['Rho (per 1%)', fmt(greeksA.rho / 100), fmt(greeksB.rho / 100), (greeksB.rho - greeksA.rho) / 100],
  ];

  const tbody = document.querySelector('#compare-table tbody');
  tbody.innerHTML = rows.map(([metric, va, vb, diff]) => {
    const cls = diff > 0 ? 'diff-positive' : diff < 0 ? 'diff-negative' : '';
    const sign = diff > 0 ? '+' : '';
    return `<tr>
      <td>${metric}</td>
      <td>${va}</td>
      <td>${vb}</td>
      <td class="${cls}">${sign}${fmt(diff)}</td>
    </tr>`;
  }).join('');

  // Bar chart
  const greekNames = ['Delta', 'Gamma', 'Vega', 'Theta', 'Rho'];
  const valsA = [greeksA.delta, greeksA.gamma, greeksA.vega / 100, greeksA.theta / 365, greeksA.rho / 100];
  const valsB = [greeksB.delta, greeksB.gamma, greeksB.vega / 100, greeksB.theta / 365, greeksB.rho / 100];

  if (cBarChart) {
    cBarChart.data.datasets[0].data = valsA;
    cBarChart.data.datasets[1].data = valsB;
    cBarChart.update('none');
  } else {
    const ctx = document.getElementById('c-greeks-bar').getContext('2d');
    cBarChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: greekNames,
        datasets: [
          {
            label: 'Option A',
            data: valsA,
            backgroundColor: 'rgba(99,102,241,0.6)',
            borderColor: '#6366f1',
            borderWidth: 1.5,
            borderRadius: 6,
          },
          {
            label: 'Option B',
            data: valsB,
            backgroundColor: 'rgba(251,146,60,0.6)',
            borderColor: '#fb923c',
            borderWidth: 1.5,
            borderRadius: 6,
          },
        ],
      },
      options: {
        ...defaultChartOpts(),
        plugins: {
          ...defaultChartOpts().plugins,
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#94a3b8',
              font: { family: 'Inter', size: 12, weight: '500' },
              padding: 20,
              usePointStyle: true,
              pointStyle: 'rectRounded',
            },
          },
        },
      },
    });
  }

  // Payoff chart
  const sMin = Math.min(a.S, b.S) * 0.5;
  const sMax = Math.max(a.S, b.S) * 1.5;
  const sRange = linspace(sMin, sMax, 100);

  const payoffA = sRange.map((s) => a.type === 'call' ? Math.max(s - a.K, 0) : Math.max(a.K - s, 0));
  const payoffB = sRange.map((s) => b.type === 'call' ? Math.max(s - b.K, 0) : Math.max(b.K - s, 0));

  const labels = sRange.map((v) => v.toFixed(1));

  if (cPayoffChart) {
    cPayoffChart.data.labels = labels;
    cPayoffChart.data.datasets[0].data = payoffA;
    cPayoffChart.data.datasets[1].data = payoffB;
    cPayoffChart.update('none');
  } else {
    const ctx = document.getElementById('c-payoff-chart').getContext('2d');
    cPayoffChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { ...makeLineDataset(`Option A (${a.type})`, payoffA, chartColors.blue), fill: false, borderWidth: 2.5 },
          { ...makeLineDataset(`Option B (${b.type})`, payoffB, chartColors.orange), fill: false, borderWidth: 2.5 },
        ],
      },
      options: {
        ...defaultChartOpts(),
        plugins: {
          ...defaultChartOpts().plugins,
          legend: {
            display: true,
            position: 'top',
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 12, weight: '500' }, padding: 20, usePointStyle: true },
          },
        },
      },
    });
  }
}

// Event bindings for Compare mode
['a', 'b'].forEach((pre) => {
  [`#${pre}-spot`, `#${pre}-strike`].forEach((sel) => $(sel).addEventListener('input', compareRecalc));
  [`#${pre}-time`, `#${pre}-rate`, `#${pre}-vol`].forEach((sel) => $(sel).addEventListener('input', compareRecalc));
  setupToggle(`#${pre}-type-toggle`, compareRecalc);
});

// ══════════════════════════════════════════════════════════════
//  MODE 3: STRATEGY BUILDER
// ══════════════════════════════════════════════════════════════

let stPayoffChart = null;

function strategyUpdateLabels() {
  $('#st-vol-val').textContent = `${$('#st-vol').value}%`;
  $('#st-rate-val').textContent = `${(parseInt($('#st-rate').value) / 10).toFixed(1)}%`;
  $('#st-time-val').textContent = `${(parseInt($('#st-time').value) / 100).toFixed(2)}y`;
}

function strategyRecalc() {
  strategyUpdateLabels();

  const S = parseFloat($('#st-spot').value) || 100;
  const sigma = parseInt($('#st-vol').value) / 100;
  const r = parseInt($('#st-rate').value) / 1000;
  const T = parseInt($('#st-time').value) / 100;

  const legs = [1, 2].map((n) => ({
    action: $(`#l${n}-action`).value,
    type: $(`#l${n}-type`).value,
    K: parseFloat($(`#l${n}-strike`).value) || 100,
    qty: parseInt($(`#l${n}-qty`).value) || 1,
  }));

  // Premiums
  const signs = legs.map((l) => l.action === 'Buy' ? 1 : -1);
  const prems = legs.map((l, i) => blackScholesPrice(S, l.K, T, r, sigma, l.type) * l.qty * signs[i]);
  const netPremium = prems[0] + prems[1];

  // Greeks
  const greeks = legs.map((l) => calculateGreeks(S, l.K, T, r, sigma, l.type));
  const netDelta = greeks[0].delta * legs[0].qty * signs[0] + greeks[1].delta * legs[1].qty * signs[1];
  const netGamma = greeks[0].gamma * legs[0].qty * signs[0] + greeks[1].gamma * legs[1].qty * signs[1];
  const netVega = greeks[0].vega * legs[0].qty * signs[0] + greeks[1].vega * legs[1].qty * signs[1];
  const netTheta = greeks[0].theta * legs[0].qty * signs[0] + greeks[1].theta * legs[1].qty * signs[1];
  const netRho = greeks[0].rho * legs[0].qty * signs[0] + greeks[1].rho * legs[1].qty * signs[1];

  // Display
  $('#st-net-premium').textContent = `$${fmt(Math.abs(netPremium), 2)}`;
  $('#st-net-type').textContent = netPremium > 0 ? 'Net Debit' : netPremium < 0 ? 'Net Credit' : 'Zero Cost';
  $('#st-net-type').style.color = netPremium > 0 ? '#f87171' : '#34d399';

  $('#st-m-delta').textContent = fmt(netDelta);
  $('#st-m-gamma').textContent = fmt(netGamma);
  $('#st-m-vega').textContent = fmt(netVega / 100);
  $('#st-m-theta').textContent = fmt(netTheta / 365);
  $('#st-m-rho').textContent = fmt(netRho / 100);

  // Leg summary
  $('#st-leg-summary').innerHTML = legs.map((l, i) =>
    `<div class="leg-line"><strong>Leg ${i + 1}:</strong> ${l.action} ${l.qty}× ${l.type.toUpperCase()} @ $${l.K}</div>`
  ).join('');

  // Payoff
  const kMin = Math.min(legs[0].K, legs[1].K);
  const kMax = Math.max(legs[0].K, legs[1].K);
  const range = linspace(kMin * 0.5, kMax * 1.5, 200);

  function legPayoff(spot, l, sign) {
    const intrinsic = l.type === 'call' ? Math.max(spot - l.K, 0) : Math.max(l.K - spot, 0);
    return sign * l.qty * intrinsic;
  }

  const payoff1 = range.map((s) => legPayoff(s, legs[0], signs[0]));
  const payoff2 = range.map((s) => legPayoff(s, legs[1], signs[1]));
  const totalPayoff = range.map((_, i) => payoff1[i] + payoff2[i]);
  const netPnL = totalPayoff.map((v) => v - Math.abs(netPremium) * (netPremium > 0 ? 1 : -1));

  // For correct net P&L: if you buy (debit), subtract; if you sell (credit), add
  const correctedPnL = totalPayoff.map((v) => v - netPremium);

  const labels = range.map((v) => v.toFixed(1));

  if (stPayoffChart) {
    stPayoffChart.data.labels = labels;
    stPayoffChart.data.datasets[0].data = payoff1;
    stPayoffChart.data.datasets[1].data = payoff2;
    stPayoffChart.data.datasets[2].data = totalPayoff;
    stPayoffChart.data.datasets[3].data = correctedPnL;
    stPayoffChart.update('none');
  } else {
    const ctx = document.getElementById('st-payoff-chart').getContext('2d');
    stPayoffChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { ...makeLineDataset('Leg 1', payoff1, chartColors.blue), fill: false, borderWidth: 1.5, borderDash: [4, 4] },
          { ...makeLineDataset('Leg 2', payoff2, chartColors.orange), fill: false, borderWidth: 1.5, borderDash: [4, 4] },
          { ...makeLineDataset('Total Payoff', totalPayoff, chartColors.cyan), fill: false, borderWidth: 3 },
          { ...makeLineDataset('Net P&L', correctedPnL, chartColors.green), fill: true, borderWidth: 3, borderDash: [6, 3] },
        ],
      },
      options: {
        ...defaultChartOpts(),
        plugins: {
          ...defaultChartOpts().plugins,
          legend: {
            display: true,
            position: 'top',
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 12, weight: '500' }, padding: 16, usePointStyle: true },
          },
        },
      },
    });
  }

  // Breakevens & stats
  const statsEl = $('#st-stats');
  const breakevens = [];
  for (let i = 0; i < correctedPnL.length - 1; i++) {
    if ((correctedPnL[i] <= 0 && correctedPnL[i + 1] > 0) || (correctedPnL[i] >= 0 && correctedPnL[i + 1] < 0)) {
      // Linear interpolation
      const frac = Math.abs(correctedPnL[i]) / (Math.abs(correctedPnL[i]) + Math.abs(correctedPnL[i + 1]));
      breakevens.push(range[i] + frac * (range[i + 1] - range[i]));
    }
  }

  const maxProfit = Math.max(...correctedPnL);
  const maxLoss = Math.min(...correctedPnL);

  let statsHTML = '';
  if (breakevens.length) {
    statsHTML += breakevens.map((b) => `<span class="stat-pill"><strong>Breakeven:</strong> $${b.toFixed(2)}</span>`).join('');
  }
  statsHTML += `<span class="stat-pill"><strong>Max Profit:</strong> $${maxProfit.toFixed(2)}</span>`;
  statsHTML += `<span class="stat-pill"><strong>Max Loss:</strong> $${maxLoss.toFixed(2)}</span>`;
  statsEl.innerHTML = statsHTML;
}

// Event bindings for Strategy mode
['#st-spot'].forEach((sel) => $(sel).addEventListener('input', strategyRecalc));
['#st-vol', '#st-rate', '#st-time'].forEach((sel) => $(sel).addEventListener('input', strategyRecalc));
[1, 2].forEach((n) => {
  [`#l${n}-action`, `#l${n}-type`].forEach((sel) => $(sel).addEventListener('change', strategyRecalc));
  [`#l${n}-strike`, `#l${n}-qty`].forEach((sel) => $(sel).addEventListener('input', strategyRecalc));
});

// ──────────────────────────────────────────────────────────────
//  INITIAL RENDER
// ──────────────────────────────────────────────────────────────
updateGlobalLabels();
singleRecalc();
