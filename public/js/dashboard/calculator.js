/**
 * Inventory Management Calculators
 */
const calcData = {
  eoq: {
    title: "EOQ Calculator",
    desc: "Determines the best number of units to order each time to keep total costs as low as possible. It balances the cost of ordering with the cost of storing inventory.",
    formula: "EOQ = √((2 * D * S) / H)",
    inputs: [
      { label: "Annual Demand (D)", id: "in-d", oninput: "runCalc('eoq')" },
      { label: "Ordering Cost (S)", id: "in-s", oninput: "runCalc('eoq')" },
      { label: "Holding Cost (H)", id: "in-h", oninput: "runCalc('eoq')" }
    ]
  },
  avg: {
    title: "Average Inventory",
    desc: "Represents the typical amount of inventory you have on hand over time. It is used to estimate storage needs and calculate inventory costs.",
    formula: "Avg = (Beginning + Ending) / 2",
    inputs: [
      { label: "Beginning Inventory ($)", id: "in-bi", oninput: "runCalc('avg')" },
      { label: "Ending Inventory ($)", id: "in-ei", oninput: "runCalc('avg')" }
    ]
  },
  rop: {
    title: "Reorder Point",
    desc: "Shows the inventory level at which you should place a new order to avoid running out. It accounts for how much you use and how long it takes to receive new inventory.",
    formula: "ROP = (Daily Usage * Lead Time) + SS",
    inputs: [
      { label: "Daily Usage", id: "in-u", oninput: "runCalc('rop')" },
      { label: "Lead Time (Days)", id: "in-l", oninput: "runCalc('rop')" },
      { label: "Safety Stock", id: "in-ss", oninput: "runCalc('rop')" }
    ]
  },
  tic: {
    title: "Total Inventory Cost",
    desc: "Calculates the total cost of managing inventory, including ordering and holding costs. It helps identify the most cost-efficient way to manage stock.",
    formula: "TC = (D/Q)*S + (Q/2)*H",
    inputs: [
      { label: "Annual Demand (D)", id: "in-td", oninput: "runCalc('tic')" },
      { label: "Order Quantity (Q)", id: "in-tq", oninput: "runCalc('tic')" },
      { label: "Ordering Cost (S)", id: "in-ts", oninput: "runCalc('tic')" },
      { label: "Holding Cost (H)", id: "in-th", oninput: "runCalc('tic')" }
    ]
  },
  cogs: {
    title: "Cost of Goods Sold",
    desc: "Represents the total cost of producing or purchasing the items that were sold. It is used to understand profitability and overall production costs.",
    formula: "COGS = Beginning + Purchases - Ending",
    inputs: [
      { label: "Beginning Inventory ($)", id: "c-bi", oninput: "runCalc('cogs')" },
      { label: "Purchases ($)", id: "c-p", oninput: "runCalc('cogs')" },
      { label: "Ending Inventory ($)", id: "c-ei", oninput: "runCalc('cogs')" }
    ]
  },
  turn: {
    title: "Inventory Turnover",
    desc: "Measures how many times inventory is sold or used over a period. Higher turnover means inventory is moving efficiently and not sitting unused.",
    formula: "Turnover = COGS / Avg Inventory",
    inputs: [
      { label: "COGS ($)", id: "t-cogs", oninput: "runCalc('turn')" },
      { label: "Average Inventory ($)", id: "t-avg", oninput: "runCalc('turn')" }
    ]
  }
};

function showCalc(type) {
  const data = calcData[type];
  if (!data) return;

  // Update UI
  document.getElementById('calc-title').innerText = data.title;
  document.getElementById('calc-desc').innerText = data.desc;
  document.getElementById('calc-formula').innerText = data.formula;
  document.getElementById('final-result').innerText = '---';

  // Update active button
  document.querySelectorAll('.calc-tool-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${type}'`));
  });

  // Generate inputs
  const container = document.getElementById('calc-inputs');
  container.innerHTML = data.inputs.map(input => `
    <div class="calc-group">
      <label>${input.label}</label>
      <input type="number" id="${input.id}" oninput="${input.oninput}" placeholder="0">
    </div>
  `).join('');
}

function runCalc(type) {
  const resEl = document.getElementById('final-result');
  
  if (type === 'eoq') {
    const d = parseFloat(document.getElementById('in-d').value);
    const s = parseFloat(document.getElementById('in-s').value);
    const h = parseFloat(document.getElementById('in-h').value);
    if (d && s && h) resEl.innerText = Math.round(Math.sqrt((2 * d * s) / h)) + " units";
  } 
  else if (type === 'avg') {
    const bi = parseFloat(document.getElementById('in-bi').value);
    const ei = parseFloat(document.getElementById('in-ei').value);
    if (!isNaN(bi) && !isNaN(ei)) resEl.innerText = "$" + ((bi + ei) / 2).toLocaleString(undefined, {minimumFractionDigits: 2});
  }
  else if (type === 'rop') {
    const u = parseFloat(document.getElementById('in-u').value);
    const l = parseFloat(document.getElementById('in-l').value);
    const ss = parseFloat(document.getElementById('in-ss').value) || 0;
    if (u && l) resEl.innerText = Math.round((u * l) + ss) + " units";
  }
  else if (type === 'tic') {
    const d = parseFloat(document.getElementById('in-td').value);
    const q = parseFloat(document.getElementById('in-tq').value);
    const s = parseFloat(document.getElementById('in-ts').value);
    const h = parseFloat(document.getElementById('in-th').value);
    if (d && q && s && h) {
      const res = (d / q) * s + (q / 2) * h;
      resEl.innerText = "$" + res.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
  }
  else if (type === 'cogs') {
    const bi = parseFloat(document.getElementById('c-bi').value) || 0;
    const p = parseFloat(document.getElementById('c-p').value) || 0;
    const ei = parseFloat(document.getElementById('c-ei').value) || 0;
    const res = (bi + p) - ei;
    resEl.innerText = "$" + res.toLocaleString(undefined, {minimumFractionDigits: 2});
  }
  else if (type === 'turn') {
    const cogs = parseFloat(document.getElementById('t-cogs').value);
    const avg = parseFloat(document.getElementById('t-avg').value);
    if (cogs && avg && avg !== 0) {
      const res = cogs / avg;
      resEl.innerText = res.toFixed(2) + " times";
    }
  }
}

// Global exposure
window.showCalc = showCalc;
window.runCalc = runCalc;
