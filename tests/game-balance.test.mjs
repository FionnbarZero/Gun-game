import test from 'node:test';
import assert from 'node:assert/strict';
import { ORIGINAL_CRATE_PRICES, applyWeaponBalance, directWeaponPrice, weaponBalanceForPrice } from '../src/game-balance.js';

test('crate prices remain at their original values',()=>{
  assert.deepEqual(ORIGINAL_CRATE_PRICES,{standard:250,elite:750});
});

test('direct weapon purchases are discounted without affecting free starters',()=>{
  assert.equal(directWeaponPrice(0),0);
  assert.equal(directWeaponPrice(450),750);
  assert.equal(directWeaponPrice(10000),9500);
});

test('all firearms receive more reserve ammo',()=>{
  const balanced=applyWeaponBalance({price:1000,magSize:20,reserve:100,damage:30,headDamage:60});
  assert.equal(balanced.reserve,150);
});

test('premium guns gain a controlled damage, reload, and ammo advantage',()=>{
  const entry=weaponBalanceForPrice(4000);
  const premium=weaponBalanceForPrice(35000);
  assert.ok(premium.damageMultiplier>entry.damageMultiplier);
  assert.ok(premium.reloadMultiplier<entry.reloadMultiplier);
  assert.ok(premium.reserveMultiplier>entry.reserveMultiplier);
  assert.equal(premium.damageMultiplier,1.18);
});

test('ammo-free melee weapons stay ammo-free',()=>{
  const balanced=applyWeaponBalance({price:20000,magSize:1,reserve:0,ammoCost:0,damage:80,headDamage:80,reloadTime:0});
  assert.equal(balanced.reserve,0);
  assert.equal(balanced.reloadTime,0);
});
