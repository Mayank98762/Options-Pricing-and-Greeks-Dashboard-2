/**
 * Black-Scholes Option Pricing & Greeks Calculator
 * Pure JavaScript implementation — no external dependencies.
 */

// ---------- Normal Distribution Helpers ----------

/** Standard normal PDF */
function normPDF(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Standard normal CDF using the rational approximation from
 * Abramowitz & Stegun (formula 26.2.17). Max error ≈ 7.5e-8.
 */
function normCDF(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1.0 + sign * y);
}

// ---------- Black-Scholes Price ----------

/**
 * @param {number} S     Spot price
 * @param {number} K     Strike price
 * @param {number} T     Time to expiration (years)
 * @param {number} r     Risk-free rate
 * @param {number} sigma Volatility
 * @param {string} type  'call' or 'put'
 * @returns {number}     Option price
 */
export function blackScholesPrice(S, K, T, r, sigma, type = 'call') {
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  if (type === 'call') {
    return S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
  }
  return K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1);
}

// ---------- Greeks ----------

/**
 * @returns {{ delta: number, gamma: number, vega: number, theta: number, rho: number }}
 */
export function calculateGreeks(S, K, T, r, sigma, type = 'call') {
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const nd1 = normPDF(d1);
  const Nd1 = normCDF(d1);
  const Nd2 = normCDF(d2);

  const gamma = nd1 / (S * sigma * sqrtT);
  const vega = S * nd1 * sqrtT;

  let delta, theta, rho;

  if (type === 'call') {
    delta = Nd1;
    theta = -(S * nd1 * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * Nd2;
    rho = K * T * Math.exp(-r * T) * Nd2;
  } else {
    delta = Nd1 - 1;
    theta = -(S * nd1 * sigma) / (2 * sqrtT) + r * K * Math.exp(-r * T) * normCDF(-d2);
    rho = -K * T * Math.exp(-r * T) * normCDF(-d2);
  }

  return { delta, gamma, vega, theta, rho };
}
