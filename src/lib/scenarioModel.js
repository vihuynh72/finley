export function simulate(c, l) {
  const rev0 = c.annual_revenue || 0;
  const gm0 = (c.gross_margin_pct || 0) / 100;
  const cogs0 = rev0 * (1 - gm0);
  const opex0 = c.opex || 0;
  const ebitda0 = rev0 - cogs0 - opex0;
  const mult0 = c.ev_ebitda_multiple || 0;

  const rev = rev0 * (1 + (l.price_change_pct || 0) / 100) * (1 + (l.volume_change_pct || 0) / 100);
  const cogs = cogs0 * (1 + (l.volume_change_pct || 0) / 100) * (1 + (l.cogs_change_pct || 0) / 100);
  const opex = opex0 * (1 + (l.opex_change_pct || 0) / 100);
  const ebitda = rev - cogs - opex;
  const mult = mult0 + (l.multiple_change || 0);
  return [
    ["Revenue ($m)", rev0, rev],
    ["Gross margin (%)", gm0 * 100, rev ? ((rev - cogs) / rev) * 100 : 0],
    ["EBITDA ($m)", ebitda0, ebitda],
    ["EBITDA margin (%)", rev0 ? (ebitda0 / rev0) * 100 : 0, rev ? (ebitda / rev) * 100 : 0],
    ["Enterprise value ($m)", ebitda0 * mult0, ebitda * mult],
  ];
}