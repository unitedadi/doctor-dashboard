import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadDoctorSupplementProducts, DOCTOR_GS1_PRODUCT_ID } from '../src/lib/doctorSupplementProducts.js';

test('adds only the approved GS1 skin product, preserving supplement seller prices and stock', async () => {
  const ordinary = [{ product_uuid: 'euro', seller_offer: { price_aed_fils: 7650 }, inventory: { available_qty: 7 } }, {product_id:'other-supplement'}];
  const gs1 = { product_id: DOCTOR_GS1_PRODUCT_ID, price_fils: 49900, attributes_json: { category: 'SKIN' } };
  const calls = [];
  const products = await loadDoctorSupplementProducts({apiBase:'/api',doctorId:'doctor-test',sellerId:'seller-test',fetchJson: async url => {
    calls.push(new URL(url,'https://example.invalid'));
    return {products: url.includes('/doctor/') ? [gs1, {product_id:'OTHER-SKIN'}] : ordinary};
  }});
  assert.deepEqual(products,[...ordinary,gs1]);
  assert.equal(calls[0].searchParams.get('category'),'SUPPLEMENT');
  assert.equal(calls[1].pathname,'/api/doctor/quickwlp/products');
  assert.equal(calls[1].searchParams.get('q'),DOCTOR_GS1_PRODUCT_ID);
  assert.equal(calls[1].searchParams.get('doctor_id'),'doctor-test');
});
test('passes search to both catalogues and does not duplicate the exact product', async () => {
  const gs1 = {product_uuid:DOCTOR_GS1_PRODUCT_ID, seller_offer:{price_aed_fils:49900}};
  const calls=[];
  const products=await loadDoctorSupplementProducts({apiBase:'/api',doctorId:'doc',sellerId:'seller',query:' GS1 ',fetchJson:async url=>{
    calls.push(new URL(url,'https://example.invalid'));
    return {products:url.includes('/doctor/')?[{product_id:DOCTOR_GS1_PRODUCT_ID}]:[gs1]};
  }});
  assert.deepEqual(products,[gs1]);
  assert.ok(calls.every(url=>url.searchParams.get('q')==='GS1'));
});
test('does not hide catalogue authentication failures', async () => {
  await assert.rejects(loadDoctorSupplementProducts({apiBase:'/api',doctorId:'doc',sellerId:'seller',fetchJson:async()=>{throw new Error('not_authorized');}}),/not_authorized/);
});
