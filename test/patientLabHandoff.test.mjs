import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import test from 'node:test';

test('patient chart displays and opens the explicitly shared report', async () => {
  const cwd = fileURLToPath(new URL('../', import.meta.url));
  const dir = await mkdtemp(`${cwd}chart-handoff-test-`);
  await writeFile(`${dir}/index.html`, `<!doctype html><div id="root"></div><script type="module">
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {setActiveDoctorAccount} from '/src/config.js'; import '/src/data.js';
    import '/src/components/shell.jsx'; import '/src/components/clinicalUi.jsx';
    import '/src/components/patientChart.jsx'; import '/src/styles/dashboard.css';
    setActiveDoctorAccount('mp_sami'); createRoot(document.getElementById('root')).render(
      React.createElement(window.DD_PatientChart, {patientId:'synthetic-patient'}));</script>`);
  const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd, env: {...process.env, VITE_API_BASE:'/api', VITE_API_PROXY_TARGET:'http://127.0.0.1:1'}, stdio:'ignore' });
  let browser;
  try {
    for (let i = 0; i < 200; i++) { if (await fetch(origin).then(r => r.ok).catch(() => false)) break; await delay(25); }
    browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true});
    for (const viewport of [{width:390,height:844}, {width:1365,height:768}]) {
      const context = await browser.newContext({viewport, acceptDownloads:true}); let opened = false;
      await context.route('**/*', async route => {
        const u = new URL(route.request().url());
        if (u.origin !== origin) return route.abort();
        if (!u.pathname.startsWith('/api/')) return route.continue();
        if (u.pathname.endsWith('/chart')) return route.fulfill({json:{patient:{id:'synthetic-patient',name:'Synthetic Member'}, clinical:{}, notes:[], lab_requests:[], lab_result_handoffs:[{note_id:123,order_id:'DL-TEST',created_at:'2026-11-01T00:00:00Z',report_url:'/doctor/lab-result-handoffs/123/pdf'}]}});
        if (u.pathname.endsWith('/doctor/lab-result-handoffs/123/pdf')) { opened=true; return route.fulfill({status:200,contentType:'application/pdf',body:'%PDF-1.4 synthetic'}); }
        return route.fulfill({json:{requests:[]}});
      });
      const page = await context.newPage(); await page.goto(`${origin}/${dir.slice(cwd.length)}/index.html`);
      const section = page.locator('.patient-chart-section').filter({hasText:'Shared lab results'});
      await section.waitFor(); assert.match(await section.innerText(), /DL-TEST/);
      await section.getByRole('button',{name:'Download results'}).click();
      await page.waitForTimeout(100); assert.equal(opened,true);
      await section.screenshot();
      await context.close();
    }
  } finally { await browser?.close(); server.kill('SIGTERM'); await rm(dir,{recursive:true,force:true}); }
});
