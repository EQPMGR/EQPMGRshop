import type { WorkOrder } from '@/lib/types';

// Riders type some of these values, so everything is escaped before it's printed.
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const row = (label: string, value: unknown) =>
  `<tr><th>${esc(label)}</th><td>${esc(value || 'N/A')}</td></tr>`;

/** Prints one work order from a hidden frame, so only the order itself is printed. */
export function printWorkOrder(workOrder: WorkOrder) {
  const number = workOrder.id.substring(0, 7);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Work Order ${esc(number)}</title><style>
    body { font: 14px/1.4 system-ui, sans-serif; color: #000; margin: 0; }
    h1 { font-size: 22px; margin: 0 0 16px; }
    h2 { font-size: 15px; margin: 20px 0 6px; border-bottom: 1px solid #000; padding-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-weight: 600; width: 140px; padding: 3px 0; vertical-align: top; }
    td { padding: 3px 0; white-space: pre-wrap; }
    .box { border: 1px solid #000; height: 180px; }
  </style></head><body>
    <h1>Work Order #${esc(number)}</h1>
    <table>${row('Received', workOrder.createdAt)}${row('Status', workOrder.status)}</table>
    <h2>Customer</h2>
    <table>${row('Name', workOrder.customerName)}${row('Email', workOrder.userEmail)}${row('Phone', workOrder.userPhone)}</table>
    <h2>Bike</h2>
    <table>${row('Bike', workOrder.bike)}${row('Nickname', workOrder.equipmentName)}</table>
    <h2>Service</h2>
    <table>${row('Issue reported', workOrder.issueDescription)}${row('Customer notes', workOrder.notes)}</table>
    <h2>Work performed</h2>
    <div class="box"></div>
  </body></html>`;

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) return;
    win.onafterprint = () => frame.remove();
    win.focus();
    win.print();
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
}
